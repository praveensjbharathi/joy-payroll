import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appPath = join(root, "app/payroll-app.tsx");
let source = await readFile(appPath, "utf8");

// The React PayslipCard is the single master DOM used by preview, individual print/download,
// and bulk print/download. Remove only the redundant run-level Working days value.
source = source.replace(
  /\s*<span><b>Working days<\/b>\s*\{run\?\.workingDays\s*\?\?\s*26\}<\/span>\n?/g,
  "\n",
);
source = source.replace(
  /\s*<div>\s*<span>Working days<\/span>\s*<strong>\{run\?\.workingDays\s*\?\?\s*26\}<\/strong>\s*<\/div>/g,
  "",
);

await writeFile(appPath, source, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
live = live.replace(/\n\/\/ JOY_UNIFIED_PAYSLIP_OUTPUT_V1[\s\S]*?\/\/ END_JOY_UNIFIED_PAYSLIP_OUTPUT_V1\n?/g, "\n");
live += `
// JOY_UNIFIED_PAYSLIP_OUTPUT_V1
// Preview, individual print/download and bulk print/download all clone the same
// .payslip-sheet DOM. This runtime guard also removes any stale run-level
// "Working days" entry produced by an older cached/generated build.
function joyNormalizePayslipSheetV1(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".payslip-sheet .payslip-attendance-inline span").forEach((node) => {
    const label = (node.querySelector("b")?.textContent ?? "").trim().toLowerCase();
    if (label === "working days") node.remove();
  });
}
const joyPayslipFormatObserverV1 = new MutationObserver(() => joyNormalizePayslipSheetV1());
joyPayslipFormatObserverV1.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", () => window.setTimeout(() => joyNormalizePayslipSheetV1(), 0), true);
window.addEventListener("beforeprint", () => joyNormalizePayslipSheetV1());
joyNormalizePayslipSheetV1();
// END_JOY_UNIFIED_PAYSLIP_OUTPUT_V1
`;
await writeFile(livePath, live, "utf8");
console.log("Unified payslip preview, single print/download and bulk print/download; removed run-level Working days.");
