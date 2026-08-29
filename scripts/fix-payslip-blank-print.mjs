import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
live = live.replace(/\n\/\/ JOY_PAYSLIP_ISOLATED_PRINT_V2[\s\S]*?\/\/ END_JOY_PAYSLIP_ISOLATED_PRINT_V2\n?/g, "\n");
live += `
// JOY_PAYSLIP_ISOLATED_PRINT_V2
const joyIsolatedPayslipPrintStyle = document.createElement("style");
joyIsolatedPayslipPrintStyle.dataset.joyIsolatedPayslipPrint = "true";
joyIsolatedPayslipPrintStyle.textContent = String.raw\`
#joy-payslip-print-root { display: none; }
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body.joy-isolated-payslip-print > *:not(#joy-payslip-print-root) { display: none !important; }
  body.joy-isolated-payslip-print #joy-payslip-print-root {
    display: block !important; position: static !important; width: 100% !important;
    height: auto !important; overflow: visible !important; background: white !important;
    visibility: visible !important; margin: 0 !important; padding: 0 !important;
  }
  body.joy-isolated-payslip-print #joy-payslip-print-root,
  body.joy-isolated-payslip-print #joy-payslip-print-root * { visibility: visible !important; }
  body.joy-isolated-payslip-print #joy-payslip-print-root > .payslip-sheet {
    display: block !important; position: relative !important; transform: none !important;
    width: 194mm !important; height: 275mm !important; min-height: 275mm !important;
    max-height: 275mm !important; margin: 0 auto !important; padding: 7mm !important;
    box-sizing: border-box !important; overflow: hidden !important; background: white !important;
    break-inside: avoid !important; page-break-inside: avoid !important;
    break-after: page !important; page-break-after: always !important;
  }
  body.joy-isolated-payslip-print #joy-payslip-print-root > .payslip-sheet:last-child {
    break-after: auto !important; page-break-after: auto !important;
  }
}
\`;
document.head.appendChild(joyIsolatedPayslipPrintStyle);

function joyPrepareIsolatedPayslipPrintV2() {
  const target = document.body.dataset.printTarget;
  if (target !== "bulk-payslips" && target !== "payslip") return;
  document.getElementById("joy-payslip-print-root")?.remove();
  const root = document.createElement("div");
  root.id = "joy-payslip-print-root";
  const selector = target === "bulk-payslips"
    ? ".bulk-payslip-modal .bulk-payslip-pages .payslip-sheet, .bulk-payslip-modal .bulk-payslip-pages .payslip-half-a4"
    : ".payslip-modal .payslip-sheet";
  const sheets = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const unique = sheets.filter((sheet, index) => !sheets.some((other, otherIndex) => otherIndex < index && other.contains(sheet)));
  unique.forEach((sheet) => {
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.classList.remove("payslip-half-a4");
    clone.classList.add("payslip-sheet");
    clone.style.removeProperty("transform");
    root.appendChild(clone);
  });
  if (!root.children.length) return;
  document.body.appendChild(root);
  document.body.classList.add("joy-isolated-payslip-print");
}
function joyCleanupIsolatedPayslipPrintV2() {
  document.body.classList.remove("joy-isolated-payslip-print");
  document.getElementById("joy-payslip-print-root")?.remove();
}
window.addEventListener("beforeprint", joyPrepareIsolatedPayslipPrintV2);
window.addEventListener("afterprint", joyCleanupIsolatedPayslipPrintV2);
// END_JOY_PAYSLIP_ISOLATED_PRINT_V2
`;
await writeFile(livePath, live, "utf8");
console.log("Applied isolated A4 payslip print root to prevent blank Chrome print previews.");
