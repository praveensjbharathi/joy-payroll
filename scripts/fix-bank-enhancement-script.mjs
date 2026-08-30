import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "scripts/apply-bank-payment-batch-enhancements.mjs");
let source = await readFile(file, "utf8");
const broken = '  const salaryDescription = `${vendor.legalName.toUpperCase()} SALARY ${monthLabel(run.payPeriod).toUpperCase()}`;';
const fixed = '  const salaryDescription = vendor.legalName.toUpperCase() + " SALARY " + monthLabel(run.payPeriod).toUpperCase();';
if (source.includes(broken)) {
  source = source.replace(broken, fixed);
  await writeFile(file, source, "utf8");
}
console.log("Bank enhancement script syntax normalized.");
