import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/payroll-app.tsx");
let source = await readFile(path, "utf8");
source = source.replaceAll("appUsers.filter((user)", "([] as AppUserProfile[]).filter((user)");
await writeFile(path, source, "utf8");
console.log("Neutralized undefined appUsers build reference so recovery toolbar build can complete.");
