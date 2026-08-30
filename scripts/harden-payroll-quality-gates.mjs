import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const routePath = join(root, "app/api/app-data/route.ts");
let source = await readFile(routePath, "utf8");

const marker = "JOY_PAYROLL_APPROVAL_QUALITY_GATE_V1";
if (!source.includes(marker)) {
  const oldBlock = `    } else if (action === "approve") {\n      const run = await requireRun(db, runId, true);\n      if (!run.employeeCount)\n        throw new RequestError("Add employees before approving payroll", 409);\n      if (run.issueCount > 0)\n        throw new RequestError(\n          "Update the employee records that are still marked Review before approval",\n          409,\n        );\n      if (run.grossEarnings <= 0)\n        throw new RequestError(\n          "Add attendance or salary amounts before approving payroll",\n          409,\n        );\n      if (run.netPayable < 0)\n        throw new RequestError("Payroll net payable cannot be negative", 409);\n      await db\n        .update(payrollRuns)\n        .set({`;

  const newBlock = `    } else if (action === "approve") {\n      // ${marker}: always recalculate and re-read the payroll immediately before approval.\n      // This prevents a stale browser/session total from being approved after attendance, salary,\n      // employee bank/statutory data, accommodation or recovery changes.\n      await requireRun(db, runId, true);\n      await recalculateRun(db, runId, false);\n      const run = await requireRun(db, runId, true);\n      const approvalItems = await db\n        .select({\n          id: payrollItems.id,\n          employeeId: payrollItems.employeeId,\n          validationStatus: payrollItems.validationStatus,\n          paymentMode: payrollItems.paymentMode,\n          netPayable: payrollItems.netPayable,\n        })\n        .from(payrollItems)\n        .where(eq(payrollItems.runId, runId));\n      if (!run.employeeCount || !approvalItems.length)\n        throw new RequestError("Add employees before approving payroll", 409);\n      const reviewItems = approvalItems.filter(\n        (item) => item.validationStatus !== "ready",\n      );\n      if (run.issueCount > 0 || reviewItems.length)\n        throw new RequestError(\n          \\`Payroll approval blocked: \\${Math.max(run.issueCount, reviewItems.length)} employee record(s) still require review. Recheck employee, bank, PF/ESI and salary readiness first.\\`,\n          409,\n        );\n      const nonBankItems = approvalItems.filter(\n        (item) => item.paymentMode !== "bank",\n      );\n      if (nonBankItems.length || run.cashPayable > 0)\n        throw new RequestError(\n          "Payroll approval blocked: Joy Payroll is bank-payment only. Correct any non-bank payment mode before approval.",\n          409,\n        );\n      if (run.grossEarnings <= 0)\n        throw new RequestError(\n          "Add attendance or salary amounts before approving payroll",\n          409,\n        );\n      if (run.netPayable < 0)\n        throw new RequestError("Payroll net payable cannot be negative", 409);\n      if (Math.abs(run.netPayable - run.bankPayable) > 0.01)\n        throw new RequestError(\n          \\`Payroll approval blocked: bank payable (₹\\${run.bankPayable.toFixed(2)}) does not match final net payable (₹\\${run.netPayable.toFixed(2)}). Recalculate before approval.\\`,\n          409,\n        );\n      const invalidPayables = approvalItems.filter(\n        (item) => !Number.isFinite(item.netPayable) || item.netPayable < 0,\n      );\n      if (invalidPayables.length)\n        throw new RequestError(\n          \\`Payroll approval blocked: \\${invalidPayables.length} employee(s) have invalid final payable values.\\`,\n          409,\n        );\n      await db\n        .update(payrollRuns)\n        .set({`;

  if (!source.includes(oldBlock)) {
    throw new Error("Unable to locate the payroll approval block for quality hardening");
  }
  source = source.replace(oldBlock, newBlock);
}

await writeFile(routePath, source, "utf8");
console.log("Payroll approval hardened: live recalculation, readiness, bank-only and payable reconciliation gates enabled.");
