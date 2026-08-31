import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/reports-recovery.tsx");
let source = await readFile(file, "utf8");

source = source.replace(
  "Reopen payroll before changing employee recoveries",
  "Reopen the cleared batch and payroll here",
);
source = source.replace(
  "First reopen ",
  "The button below will reopen ",
);
source = source.replace(
  " cleared payment batch(es) in Payments & Payslips. Then use Reopen Payroll and add the dated recovery.",
  " cleared payment batch(es) and the payroll together. Then add the dated recovery.",
);
source = source.replace(
  "Use Reopen Payroll, then add the dated recovery. Saving it will automatically recalculate final payable and bank payable.",
  "Use the button below to reopen payroll, then add the dated recovery. Saving it will automatically recalculate final payable and bank payable.",
);

const oldButton = `          <button
            className="primary-button form-span"
            disabled={isActing || !employeeId || amount <= 0 || run.status === "approved"}
          >
            {run.status === "approved" ? "Reopen payroll to add recovery" : "Add dated recovery"}
          </button>`;
const newButton = `          <button
            className="primary-button form-span"
            type={run.status === "approved" ? "button" : "submit"}
            onClick={
              run.status === "approved"
                ? () =>
                    void onAction(
                      "reopen-payroll-for-recovery",
                      "Payment batch and payroll reopened. You can now save the recovery.",
                    )
                : undefined
            }
            disabled={
              run.status === "approved"
                ? isActing || !canApprove
                : isActing || !employeeId || amount <= 0
            }
          >
            {run.status === "approved" ? "Reopen payment batch & payroll" : "Add dated recovery"}
          </button>`;

if (!source.includes('"reopen-payroll-for-recovery"')) {
  if (!source.includes(oldButton))
    throw new Error("Approved recovery button marker was not found");
  source = source.replace(oldButton, newButton);
}
if (!source.includes('"reopen-payroll-for-recovery"'))
  throw new Error("Recovery reopen workflow was not applied");

await writeFile(file, source, "utf8");
console.log("Enabled controlled payment batch and payroll reopening from Recoveries.");
