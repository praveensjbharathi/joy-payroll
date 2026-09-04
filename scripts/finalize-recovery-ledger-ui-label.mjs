import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/reports-recovery.tsx");
let source = await readFile(file, "utf8");
source = source.replaceAll(
  "Save room-wise recovery for {run.payPeriod}",
  "Save dated room recovery entry for {run.payPeriod}",
);
if (
  !source.includes("Save dated room recovery entry for {run.payPeriod}") &&
  !source.includes("Save dated room recovery entry for {roomRecoveryPeriod}")
) {
  throw new Error("Dated room recovery button label was not finalized");
}
await writeFile(file, source, "utf8");
console.log("Finalized dated room recovery button label.");
