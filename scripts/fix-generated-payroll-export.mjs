import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/payroll-app.tsx");
let source = await readFile(path, "utf8");
source = source.replace(
  "downloadCsv(\\`payroll-register-${run.payPeriod}.csv\\`, [",
  'downloadCsv("payroll-register-" + run.payPeriod + ".csv", [',
);
await writeFile(path, source, "utf8");
console.log("Normalized generated 41-column payroll CSV syntax.");
