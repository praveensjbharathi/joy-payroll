import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type AuthenticatedUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
if (!databaseUrl) {
  throw new Error("Supabase did not provide the SUPABASE_DB_URL server secret.");
}

// Supabase Edge Functions use the transaction pooler. Keep one short-lived
// connection per isolate: the previous four-connection pool produced long
// queueing stalls and 150-second gateway timeouts in production.
const connection = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  connect_timeout: 5,
  max_lifetime: 60,
});
const database = drizzle(connection);

export function getDb() {
  return database;
}

class PreparedStatement {
  constructor(
    readonly text: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new PreparedStatement(this.text, values);
  }
}

function postgresPlaceholders(query: string) {
  let position = 0;
  return query.replace(/\?/g, () => `$${++position}`);
}

export function getRawDb() {
  return {
    prepare(query: string) {
      return new PreparedStatement(query);
    },
    async batch(statements: PreparedStatement[]) {
      if (!statements.length) return [];
      return connection.begin(async (transaction) => {
        const results = [];
        for (const statement of statements) {
          results.push(
            await transaction.unsafe(
              postgresPlaceholders(statement.text),
              statement.values as postgres.ParameterOrJSON<never>[],
            ),
          );
        }
        return results;
      });
    },
  };
}
