import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Final Recovery repair runs last in fix:production.
// It restores the employee recovery table and keeps the original left room controls.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

// Show every employee who belongs to the current payroll run, even when a recovery
// charge has not yet been created. This restores the old overall employee view.
recovery = recovery.replace(
  '.filter((row) => row.charge || row.dated.length || row.shared > 0);',
  '.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);',
);
recovery = recovery.replace(
  '.filter((row) => row.charge || row.dated.length || row.shared > 0 || Boolean(row.item && row.employee.roomNumber));',
  '.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);',
);

// When a room is chosen in the existing left dropdown, use it as a room-wise view.
// Leaving the dropdown on Select room keeps the overall view of all employees.
if (recovery.includes('const [roomPrintRoom, setRoomPrintRoom]')) {
  recovery = recovery.replace(
    '{employeeRows.map(\n',
    '{employeeRows.filter(({ employee }) => !roomPrintRoom || employee.roomNumber === roomPrintRoom).map(\n',
  );
}

await writeFile(recoveryPath, recovery, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");

// Remove older aggressive Recovery cleanup observers that could remove the whole
// Recovery control area. Only duplicate .room-print-toolbar elements are removed.
live = live.replace(/\n\/\/ Final Recovery safeguard:[\s\S]*?keepLeftRecoveryRoomControls\(\);\n?/g, "\n");
live = live.replace(/\nfunction removeDuplicateRoomRecoveryTools\(\)[\s\S]*?removeDuplicateRoomRecoveryTools\(\);\n?/g, "\n");

// Replace the existing duplicate cleanup with a safe element-only cleanup.
const safeCleanup = `function removeDuplicateRoomPrintToolbars() {\n  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {\n    const heading = panel.querySelector<HTMLElement>("h2");\n    if (!heading?.textContent?.includes("Net salary") || !heading.textContent.includes("final payable")) return;\n    const toolbars = Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));\n    toolbars.slice(1).forEach((toolbar) => toolbar.remove());\n  });\n}`;

if (/function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/.test(live)) {
  live = live.replace(/function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/, safeCleanup);
} else {
  live += `\n${safeCleanup}\n`;
}

if (!live.includes("joyRecoveryDuplicateOnlyObserver")) {
  live += `\n// Remove only the second/right duplicate Recovery room toolbar. Never remove the Recovery panel, table or employee rows.\nconst joyRecoveryDuplicateOnlyObserver = new MutationObserver(removeDuplicateRoomPrintToolbars);\njoyRecoveryDuplicateOnlyObserver.observe(document.documentElement, { childList: true, subtree: true });\nremoveDuplicateRoomPrintToolbars();\n`;
}

await writeFile(livePath, live, "utf8");

console.log("Recovery restored: overall employee list + room-wise view + Gas/Ration/Provision details retained; only the right duplicate room toolbar is removed.");
