import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 1) Accommodation callback: after reopening a finalized room expense, force a clean
// refresh so the draft state and editable values are reloaded from the database.
const enhancementPath = join(root, "app/payroll-enhancements.tsx");
let enhancement = await readFile(enhancementPath, "utf8");
const reopenPattern = /onClick=\{\(\) => \{\s*if \(\s*window\.confirm\(\s*`Reopen room \$\{selectedRoom\.roomNumber\} and clear its finalized employee shares\?`,\s*\)\s*\)\s*void onAction\(\s*"reopen-room-expense",\s*"Room expense reopened",\s*\{\s*roomId: selectedRoom\.id,\s*expenseId: selectedExpense\.id,\s*\},\s*\);\s*\}\}/m;
if (reopenPattern.test(enhancement)) {
  enhancement = enhancement.replace(
    reopenPattern,
    `onClick={async () => {\n                  if (!window.confirm(\n                    \`Reopen room \${selectedRoom.roomNumber} and clear its finalized employee shares?\`,\n                  )) return;\n                  const ok = await onAction(\n                    "reopen-room-expense",\n                    "Room expense reopened",\n                    {\n                      roomId: selectedRoom.id,\n                      expenseId: selectedExpense.id,\n                    },\n                  );\n                  if (ok) window.location.reload();\n                }}`,
  );
}
await writeFile(enhancementPath, enhancement, "utf8");

// 2) Recovery bulk vouchers: include only employees who actually have a deduction,
// and only after that employee recovery is finalized.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");
recovery = recovery.replace(
  /\{finalizations\.length \? \(\s*<button\s*className="primary-button"\s*onClick=\{\(\) => setBulkVouchers\(true\)\}\s*>\s*Download all finalized vouchers\s*<\/button>\s*\) : null\}/m,
  `{finalizations.some((entry) =>\n            employeeRows.some((row) =>\n              row.employee.id === entry.employeeId &&\n              (row.total > 0 || row.dated.some((datedEntry) => datedEntry.amount > 0)),\n            ),\n          ) ? (\n            <button\n              className="primary-button"\n              onClick={() => setBulkVouchers(true)}\n            >\n              Bulk deduction vouchers · Print / Save PDF\n            </button>\n          ) : null}`,
);
recovery = recovery.replace(
  /rows=\{employeeRows\.filter\(\(row\) =>\s*finalizations\.some\(\(entry\) => entry\.employeeId === row\.employee\.id\),\s*\)\}/m,
  `rows={employeeRows.filter((row) =>\n            finalizations.some((entry) => entry.employeeId === row.employee.id) &&\n            (row.total > 0 || row.dated.some((datedEntry) => datedEntry.amount > 0)),\n          )}`,
);
await writeFile(recoveryPath, recovery, "utf8");

// 3) Payslip printing: remove the redundant single-payslip print button from the
// bulk modal and override the old print CSS that caused a white/blank preview.
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
  html, body { background: #fff !important; }
  body[data-print-target="bulk-payslips"] .modal-layer,
  body[data-print-target="payslip"] .modal-layer {
    position: static !important;
    inset: auto !important;
    display: block !important;
    overflow: visible !important;
    background: #fff !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal,
  body[data-print-target="payslip"] .payslip-modal {
    position: static !important;
    inset: auto !important;
    transform: none !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    visibility: visible !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal .modal-toolbar,
  body[data-print-target="payslip"] .payslip-modal .modal-toolbar,
  body[data-print-target="bulk-payslips"] .modal-scrim,
  body[data-print-target="payslip"] .modal-scrim {
    display: none !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages {
    position: static !important;
    inset: auto !important;
    display: block !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    visibility: visible !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-half-a4 {
    position: relative !important;
    inset: auto !important;
    display: block !important;
    width: 190mm !important;
    height: 135mm !important;
    min-height: 135mm !important;
    max-height: 135mm !important;
    margin: 0 auto !important;
    padding: 6mm !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    visibility: visible !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: auto !important;
    page-break-after: auto !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet:nth-child(even) {
    break-after: page !important;
    page-break-after: always !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }
  body[data-print-target="payslip"] .payslip-sheet {
    position: static !important;
    inset: auto !important;
    display: block !important;
    width: 190mm !important;
    height: 135mm !important;
    min-height: 135mm !important;
    max-height: 135mm !important;
    margin: 0 auto !important;
    padding: 6mm !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    background: #fff !important;
    visibility: visible !important;
  }
}
\`;
document.head.appendChild(joyPayslipPrintStyle);

function joyPayslipToolbarCleanupV1() {
  document.querySelectorAll<HTMLElement>(".bulk-payslip-modal").forEach((modal) => {
    modal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const label = (button.textContent || "").trim().toLowerCase();
      if (label === "print payslip · a4 portrait" || label === "print / save pdf") button.remove();
      if (label === "print / save bulk pdf") button.textContent = "Bulk A4 portrait · Print / Save PDF";
    });
  });
}
const joyPayslipToolbarObserverV1 = new MutationObserver(joyPayslipToolbarCleanupV1);
joyPayslipToolbarObserverV1.observe(document.documentElement, { childList: true, subtree: true });
joyPayslipToolbarCleanupV1();
// END_JOY_PAYSLIP_PRINT_FINAL_V1
`;
await writeFile(livePath, live, "utf8");

console.log("Applied accommodation callback refresh, deduction-only bulk vouchers, redundant bulk payslip button removal, and blank payslip print fix.");
