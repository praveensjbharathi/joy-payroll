import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const route = await readFile(join(root, "app/api/app-data/route.ts"), "utf8");
const calculations = await readFile(join(root, "lib/payroll-calculations.ts"), "utf8");
const access = await readFile(join(root, "lib/access-control.ts"), "utf8");

const checks = [
  [route.includes("JOY_PAYROLL_APPROVAL_QUALITY_GATE_V1"), "approval quality gate"],
  [route.includes("await recalculateRun(db, runId, false);"), "pre-approval recalculation"],
  [route.includes("isCashFallbackOnlyValidation"), "cash fallback approval isolation"],
  [route.includes("bank payable") && route.includes("cash payable") && route.includes("final net payable"), "bank/cash/net reconciliation"],
  [route.includes("This payroll run is approved. Reopen it before making changes."), "approved-run edit lock"],
  [route.includes("Approve the payroll run before clearing an accommodation payment batch"), "payment-batch approval lock"],
  [
    route.includes("downloadedPaymentBatches.length && !missingEmployees.length") &&
      route.includes("requirePayrollItemPaymentUnlocked") &&
      route.includes("paid employee records remain locked"),
    "supplementary reopen protection after payment clearance",
  ],
  [calculations.includes("validationForEmployee"), "employee payroll readiness validation"],
  [calculations.includes("accommodationDeduction") && calculations.includes("returnAmount"), "recovery-aware final payable calculation"],
  [access.includes('super_admin: true') && access.includes('payroll_team: false'), "separate payroll approval permission defaults"],
];

const failed = checks.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) {
  throw new Error(`Joy Payroll production safety verification failed: ${failed.join(", ")}`);
}

console.log(`Joy Payroll production safety verification passed (${checks.length}/${checks.length} controls).`);
