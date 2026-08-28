import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

if (!source.includes("function improveVoucherButtons()")) {
  source = source.replace(
    "function preparePortraitPrint(event: Event)",
    `function improveVoucherButtons() {\n  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {\n    const text = button.textContent?.trim();\n    if (text === "Download all finalized vouchers") button.textContent = "Bulk recovery slips · A4 portrait";\n    if (text === "Print / Save bulk PDF") button.textContent = "Bulk A4 portrait · Print / Save PDF";\n    if (text === "Print / Save PDF" && button.closest(".room-report-modal")?.querySelector(".advance-voucher")) button.textContent = "Print recovery slip · A4 portrait";\n    if (text === "Print / Save PDF" && button.closest(".modal-layer")?.querySelector(".payslip-sheet")) button.textContent = "Print payslip · A4 portrait";\n  });\n}\n\nfunction preparePortraitPrint(event: Event)`,
  );
}

if (!source.includes("function preparePortraitPrint(event: Event)")) {
  source = source.replace(
    "const observer = new MutationObserver(() => {",
    `function preparePortraitPrint(event: Event) {\n  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");\n  if (!button) return;\n  const modal = button.closest<HTMLElement>(".modal-layer");\n  let target = \"\";\n  if (modal?.querySelector(".advance-voucher")) target = "voucher";\n  else if (modal?.querySelector(".bulk-payslip-pages")) target = "bulk-payslips";\n  else if (modal?.querySelector(".payslip-sheet")) target = "payslip";\n  if (!target) return;\n  const text = button.textContent?.toLowerCase() ?? \"\";\n  if (!text.includes("print") && !text.includes("save")) return;\n  document.body.dataset.printTarget = target;\n  const cleanup = () => { delete document.body.dataset.printTarget; window.removeEventListener("afterprint", cleanup); };\n  window.addEventListener("afterprint", cleanup);\n  window.setTimeout(cleanup, 3000);\n}\ndocument.addEventListener("click", preparePortraitPrint, true);\n\nconst observer = new MutationObserver(() => {`,
  );
}

await writeFile(path, source, "utf8");
console.log("Restored missing live enhancement helper functions for a successful production build.");
