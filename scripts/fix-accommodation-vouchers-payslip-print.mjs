import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const enhancementPath = join(root, "app/payroll-enhancements.tsx");
let enhancement = await readFile(enhancementPath, "utf8");
const reopenPattern = /onClick=\{\(\) => \{\s*if \(\s*window\.confirm\(\s*`Reopen room \$\{selectedRoom\.roomNumber\} and clear its finalized employee shares\?`,\s*\)\s*\)\s*void onAction\(\s*"reopen-room-expense",\s*"Room expense reopened",\s*\{\s*roomId: selectedRoom\.id,\s*expenseId: selectedExpense\.id,\s*\},\s*\);\s*\}\}/m;
if (reopenPattern.test(enhancement)) {
  enhancement = enhancement.replace(reopenPattern, `onClick={async () => {\n                  if (!window.confirm(\`Reopen room \${selectedRoom.roomNumber} and clear its finalized employee shares?\`)) return;\n                  const ok = await onAction("reopen-room-expense", "Room expense reopened", { roomId: selectedRoom.id, expenseId: selectedExpense.id });\n                  if (ok) window.location.reload();\n                }}`);
}
await writeFile(enhancementPath, enhancement, "utf8");

const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");
recovery = recovery.replace(/\{finalizations\.length \? \(\s*<button\s*className="primary-button"\s*onClick=\{\(\) => setBulkVouchers\(true\)\}\s*>\s*Download all finalized vouchers\s*<\/button>\s*\) : null\}/m, `{finalizations.some((entry) => employeeRows.some((row) => row.employee.id === entry.employeeId && (row.total > 0 || row.dated.some((datedEntry) => datedEntry.amount > 0)))) ? (\n            <button className="primary-button" onClick={() => setBulkVouchers(true)}>Bulk deduction vouchers · Print / Save PDF</button>\n          ) : null}`);
recovery = recovery.replace(/rows=\{employeeRows\.filter\(\(row\) =>\s*finalizations\.some\(\(entry\) => entry\.employeeId === row\.employee\.id\),\s*\)\}/m, `rows={employeeRows.filter((row) => finalizations.some((entry) => entry.employeeId === row.employee.id) && (row.total > 0 || row.dated.some((datedEntry) => datedEntry.amount > 0)))}`);
await writeFile(recoveryPath, recovery, "utf8");

// Every employee salary slip gets its own A4 portrait page in individual and bulk print.
const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
live = live.replace(/\n\/\/ JOY_PAYSLIP_PRINT_FINAL_V1[\s\S]*?\/\/ END_JOY_PAYSLIP_PRINT_FINAL_V1\n?/g, "\n");
live += `
// JOY_PAYSLIP_PRINT_FINAL_V1
const joyPayslipPrintStyle = document.createElement("style");
joyPayslipPrintStyle.dataset.joyPayslipPrintFinal = "true";
joyPayslipPrintStyle.textContent = String.raw\`
@page { size: A4 portrait; margin: 8mm; }
@media print {
  html, body { background: #fff !important; width: auto !important; height: auto !important; overflow: visible !important; }
  body[data-print-target="bulk-payslips"] .modal-layer,
  body[data-print-target="payslip"] .modal-layer { position: static !important; inset: auto !important; display: block !important; overflow: visible !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal,
  body[data-print-target="payslip"] .payslip-modal { position: static !important; inset: auto !important; transform: none !important; width: auto !important; max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal .modal-toolbar,
  body[data-print-target="payslip"] .payslip-modal .modal-toolbar,
  body[data-print-target="bulk-payslips"] .modal-scrim,
  body[data-print-target="payslip"] .modal-scrim { display: none !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages { position: static !important; display: block !important; width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-half-a4,
  body[data-print-target="payslip"] .payslip-sheet {
    position: relative !important; inset: auto !important; display: block !important;
    width: 194mm !important; height: 275mm !important; min-height: 275mm !important; max-height: 275mm !important;
    margin: 0 auto !important; padding: 7mm !important; overflow: hidden !important; box-sizing: border-box !important;
    background: #fff !important; visibility: visible !important; break-inside: avoid !important; page-break-inside: avoid !important;
    break-after: page !important; page-break-after: always !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet:last-child,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-half-a4:last-child,
  body[data-print-target="payslip"] .payslip-sheet:last-child { break-after: auto !important; page-break-after: auto !important; }
}
\`;
document.head.appendChild(joyPayslipPrintStyle);
function joyPayslipToolbarCleanupV1() {
  document.querySelectorAll<HTMLElement>(".bulk-payslip-modal").forEach((modal) => {
    modal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const label = (button.textContent || "").trim().toLowerCase();
      if (label === "print payslip · a4 portrait" || label === "print / save pdf") button.remove();
      if (label === "print / save bulk pdf" || label === "bulk a4 portrait · print / save pdf" || label === "bulk a5 portrait · print / save pdf") button.textContent = "Bulk A4 portrait · 1 employee per page · Print / Save PDF";
    });
  });
}
const joyPayslipToolbarObserverV1 = new MutationObserver(joyPayslipToolbarCleanupV1);
joyPayslipToolbarObserverV1.observe(document.documentElement, { childList: true, subtree: true });
joyPayslipToolbarCleanupV1();
// END_JOY_PAYSLIP_PRINT_FINAL_V1
`;
await writeFile(livePath, live, "utf8");
console.log("Applied one employee salary slip per A4 portrait page, accommodation callback refresh, and deduction-only bulk vouchers.");
