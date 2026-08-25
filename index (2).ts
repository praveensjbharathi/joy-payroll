import { createClient } from "@supabase/supabase-js";
import { GET, POST } from "./generated/route.ts";
import type { AuthenticatedUser } from "./supabase-runtime.ts";

const projectUrl = Deno.env.get("SUPABASE_URL");
const secretKeyDictionary = Deno.env.get("SUPABASE_SECRET_KEYS");
const modernSecretKey = secretKeyDictionary
  ? (JSON.parse(secretKeyDictionary) as Record<string, string>).default
  : undefined;
const secretKey = modernSecretKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!projectUrl || !secretKey) {
  throw new Error("Supabase did not provide the secure server-only API secrets.");
}

const admin = createClient(projectUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const allowedOrigins = new Set(
  (
    Deno.env.get("APP_ORIGIN") ??
    "https://payroll.joycorporatesolutions.com"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function responseHeaders(origin: string | null) {
  const firstAllowedOrigin = [...allowedOrigins][0];
  return {
    "access-control-allow-origin":
      origin && allowedOrigins.has(origin) ? origin : firstAllowedOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    vary: "Origin",
  };
}

function jsonError(message: string, status: number, origin: string | null) {
  return Response.json(
    { error: message },
    { status, headers: responseHeaders(origin) },
  );
}

async function verifyIdentity(request: Request): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;

  const metadata = data.user.user_metadata ?? {};
  const candidate = metadata.full_name ?? metadata.name;
  const fullName =
    typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : null;
  return {
    email: data.user.email.trim().toLowerCase(),
    fullName,
    displayName: fullName ?? data.user.email,
  };
}

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return jsonError("This website is not permitted to access Joy Payroll.", 403, null);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }
    if (!["GET", "POST"].includes(request.method)) {
      return jsonError("Unsupported request method.", 405, origin);
    }

    try {
      const identity = await verifyIdentity(request);
      if (!identity) {
        return jsonError(
          "A verified Joy Payroll email and password are required.",
          401,
          origin,
        );
      }

      const applicationResponse =
        request.method === "GET"
          ? await GET(identity)
          : await POST(request, identity);
      const headers = new Headers(applicationResponse.headers);
      for (const [name, value] of Object.entries(responseHeaders(origin))) {
        headers.set(name, value);
      }
      return new Response(applicationResponse.body, {
        status: applicationResponse.status,
        headers,
      });
    } catch (error) {
      console.error(
        "Joy payroll API request failed:",
        error instanceof Error ? error.message : String(error),
      );
      return jsonError("Unable to complete the payroll request.", 500, origin);
    }
  },
};
