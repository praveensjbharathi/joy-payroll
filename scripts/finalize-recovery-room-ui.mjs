import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

// Recovery must show every employee belonging to the current payroll run.
recovery = recovery.replace(
  /\.filter\(\(row\) => (?:row\.charge \|\| row\.dated\.length \|\| row\.shared > 0|Boolean\(row\.item\) \|\| row\.charge \|\| row\.dated\.length \|\| row\.shared > 0)\);/,
  '.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);',
);

// Add a resolved room only once. The build pipeline runs this script more than once.
if (!recovery.includes("resolvedRoomNumber,")) {
  recovery = recovery.replace(
    "      const dated = entries.filter((entry) => entry.employeeId === employee.id);\n      return {\n        employee,",
    "      const dated = entries.filter((entry) => entry.employeeId === employee.id);\n      const resolvedRoomNumber = data.accommodationRooms.find((room) => room.id === employee.roomId)?.roomNumber ?? employee.roomNumber ?? \"—\";\n      return {\n        employee,\n        resolvedRoomNumber,",
  );
}

// Convert only the Recovery totals map once. Never replace room cells elsewhere in the file.
if (!recovery.includes("map(({ employee, resolvedRoomNumber, charge, individual, shared, item }) =>")) {
  recovery = recovery.replace(
    /\{employeeRows\.map\(\s*\(\{ employee, charge, individual, shared, item \}\) =>/,
    '{employeeRows.filter(({ resolvedRoomNumber }) => !roomPrintRoom || resolvedRoomNumber === roomPrintRoom).map(({ employee, resolvedRoomNumber, charge, individual, shared, item }) =>',
  );
  recovery = recovery.replace(
    /<td>\{employee\.roomNumber \?\? \"—\"\}<\/td>/,
    '<td>{resolvedRoomNumber}</td>',
  );
}

await writeFile(recoveryPath, recovery, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");

// Remove only duplicate room toolbars. Never remove employee rows/panels.
live = live.replace(/\n\/\/ Final Recovery safeguard:[\s\S]*?keepLeftRecoveryRoomControls\(\);\n?/g, "\n");
live = live.replace(/\nfunction removeDuplicateRoomRecoveryTools\(\)[\s\S]*?removeDuplicateRoomRecoveryTools\(\);\n?/g, "\n");
const safeCleanup = `function removeDuplicateRoomPrintToolbars() {\n  document.querySelectorAll<HTMLElement>(\".recovery-final-payable-panel\").forEach((panel) => {\n    const toolbars = Array.from(panel.querySelectorAll<HTMLElement>(\".room-print-toolbar\"));\n    toolbars.slice(1).forEach((toolbar) => toolbar.remove());\n  });\n}`;
if (/function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/.test(live)) {
  live = live.replace(/function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/, safeCleanup);
} else {
  live += `\n${safeCleanup}\n`;
}
if (!live.includes("joyRecoveryDuplicateOnlyObserver")) {
  live += `\nconst joyRecoveryDuplicateOnlyObserver = new MutationObserver(removeDuplicateRoomPrintToolbars);\njoyRecoveryDuplicateOnlyObserver.observe(document.documentElement, { childList: true, subtree: true });\nremoveDuplicateRoomPrintToolbars();\n`;
}
await writeFile(livePath, live, "utf8");
console.log("Recovery fixed safely: payroll employees visible, roomId mapping applied once, one room toolbar retained.");
