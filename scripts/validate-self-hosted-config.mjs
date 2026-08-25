import { readFile } from "node:fs/promises";

const configUrl = new URL("../wrangler.self-hosted.jsonc", import.meta.url);
const config = JSON.parse(await readFile(configUrl, "utf8"));
const database = config.d1_databases?.find((entry) => entry.binding === "DB");
const problems = [];

if (!database?.database_id || /^0{8}-0{4}-4?0{3}-8?0{3}-0{12}$/i.test(database.database_id)) {
  problems.push("replace the D1 database_id with the ID from your Cloudflare account");
}
if (!config.vars?.CF_ACCESS_TEAM_DOMAIN || /YOUR-TEAM/i.test(config.vars.CF_ACCESS_TEAM_DOMAIN)) {
  problems.push("replace CF_ACCESS_TEAM_DOMAIN with your Cloudflare Zero Trust team domain");
}
if (!config.vars?.CF_ACCESS_AUD || /REPLACE_WITH/i.test(config.vars.CF_ACCESS_AUD)) {
  problems.push("replace CF_ACCESS_AUD with the Access application AUD tag");
}

if (problems.length) {
  console.error("Self-hosted deployment is not configured:\n");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("\nFollow SELF_HOSTING_GUIDE.md before deploying.");
  process.exit(1);
}

console.log("Self-hosted Cloudflare configuration is ready.");
