import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

// Keep every employee belonging to the active payroll run visible in Recovery.
recovery = recovery.replace(
  /\.filter\(\(row\) => (?:row\.charge \|\| row\.dated\.length \|\| row\.shared > 0|Boolean\(row\.item\) \|\| row\.charge \|\| row\.dated\.length \|\| row\.shared > 0)\);/g,
  '.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);',
);

// Use a component helper instead of adding a scoped variable to each row object.
// This makes the patch safe even when fix:production runs more than once.
if (!recovery.includes("function getRecoveryRoomNumber(employee: Employee)")) {
  recovery = recovery.replace(
    '  const finalizations = run\n    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)\n    : [];',
    '  const finalizations = run\n    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)\n    : [];\n  function getRecoveryRoomNumber(employee: Employee) {\n    return data.accommodationRooms.find((room) => room.id === employee.roomId)?.roomNumber ?? employee.roomNumber ?? "—";\n  }',
  );
}

// Remove any older resolvedRoomNumber patch remnants from prior build attempts.
recovery = recovery.replace(/\n\s*const resolvedRoomNumber = data\.accommodationRooms\.find\([\s\S]*?employee\.roomNumber \?\? "—";/g, "");
recovery = recovery.replace(/\n\s*resolvedRoomNumber,/g, "");
recovery = recovery.replace(/\(\{ employee, resolvedRoomNumber, charge, individual, shared, item \}\) =>/g, '({ employee, charge, individual, shared, item }) =>');
recovery = recovery.replace(/\(\{ resolvedRoomNumber \}\) => !roomPrintRoom \|\| resolvedRoomNumber === roomPrintRoom/g, '({ employee }) => !roomPrintRoom || getRecoveryRoomNumber(employee) === roomPrintRoom');
recovery = recovery.replace(/<td>\{resolvedRoomNumber\}<\/td>/g, '<td>{getRecoveryRoomNumber(employee)}</td>');

// Screen room filter: one selected room shows only those employees; blank selection shows all.
recovery = recovery.replace(
  /\{employeeRows\.map\(\s*\(\{ employee, charge, individual, shared, item \}\) =>/,
  '{employeeRows.filter(({ employee }) => !roomPrintRoom || getRecoveryRoomNumber(employee) === roomPrintRoom).map(({ employee, charge, individual, shared, item }) =>',
);
recovery = recovery.replace(
  /<td>\{employee\.roomNumber \?\? "—"\}<\/td>/,
  '<td>{getRecoveryRoomNumber(employee)}</td>',
);

// Room dropdown and print logic must use the same room resolver.
recovery = recovery.replace(
  /\.\.\.employeeRows\.map\(\(\{ employee \}\) => employee\.roomNumber \?\? "—"\)/g,
  '...employeeRows.map(({ employee }) => getRecoveryRoomNumber(employee))',
);
recovery = recovery.replace(
  /const roomEmployees = employeeRows\.filter\(\(\{ employee \}\) => employee\.roomNumber === roomName\);/g,
  'const roomEmployees = employeeRows.filter(({ employee }) => getRecoveryRoomNumber(employee) === roomName);',
);

await writeFile(recoveryPath, recovery, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");

// Keep only the first Recovery room toolbar. Do not touch tables or employee rows.
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

console.log("Recovery completed: payroll employees restored, roomId resolver shared by view and print, duplicate toolbar safely removed.");
