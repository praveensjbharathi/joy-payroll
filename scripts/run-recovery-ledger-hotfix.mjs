import { readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptsDir, "fix-recovery-ledger-and-payroll-sync.mjs");
const generatedPath = join(scriptsDir, ".generated-recovery-ledger-hotfix.mjs");

let source = await readFile(sourcePath, "utf8");
const unsafe = 'employee?.dateOfJoining?.startsWith(\\`${expense.payPeriod}-\\`) &&';
const safe = 'employee?.dateOfJoining?.startsWith(expense.payPeriod + "-") &&';
if (!source.includes(unsafe)) throw new Error("Recovery ledger hotfix interpolation marker was not found");
source = source.replace(unsafe, safe);

await writeFile(generatedPath, source, "utf8");
try {
  await import(`${pathToFileURL(generatedPath).href}?v=${Date.now()}`);
} finally {
  await unlink(generatedPath).catch(() => {});
}
