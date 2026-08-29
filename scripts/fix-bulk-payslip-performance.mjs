import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");

live = live.replace(/\n\/\/ JOY_BULK_PAYSLIP_PERFORMANCE_V1[\s\S]*?\/\/ END_JOY_BULK_PAYSLIP_PERFORMANCE_V1\n?/g, "\n");
live += `
// JOY_BULK_PAYSLIP_PERFORMANCE_V1
// The previous document-wide observers ran expensive full-DOM scans while a bulk
// payslip modal mounted 100+ salary slips. Disconnect them and use one debounced
// observer so Chrome remains responsive while the printable DOM is created.
observer.disconnect();
joyPayslipToolbarObserverV1.disconnect();
let joyEnhancementTimerV1: number | undefined;
function joyRunEnhancementsV1() {
  window.clearTimeout(joyEnhancementTimerV1);
  joyEnhancementTimerV1 = window.setTimeout(() => {
    addHierarchyGuide();
    cleanIdToolbar();
    removeDuplicateRoomPrintToolbars();
    improveVoucherButtons();
    joyPayslipToolbarCleanupV1();
  }, 180);
}
const joyLightObserverV1 = new MutationObserver(joyRunEnhancementsV1);
joyLightObserverV1.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", () => window.setTimeout(joyRunEnhancementsV1, 0), true);
// END_JOY_BULK_PAYSLIP_PERFORMANCE_V1
`;

await writeFile(livePath, live, "utf8");
console.log("Optimized bulk payslip rendering by replacing repeated full-DOM observers with one debounced observer.");
