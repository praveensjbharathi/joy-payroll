import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const recoveryPath = join(root, "app/reports-recovery.tsx");
let source = await readFile(recoveryPath, "utf8");

// 1) Keep all payroll employees in the recovery grid.
source = source.replace(
  /\.filter\(\(row\) => (?:row\.charge \|\| row\.dated\.length \|\| row\.shared > 0|Boolean\(row\.item\) \|\| row\.charge \|\| row\.dated\.length \|\| row\.shared > 0)\);/,
  '.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);',
);

// 2) Resolve room from roomId first, then stored roomNumber. This is the single source of truth for recovery.
if (!source.includes("resolvedRoomNumber:")) {
  source = source.replace(
    "      return {\n        employee,\n        charge,",
    "      const resolvedRoomNumber = data.accommodationRooms.find((room) => room.id === employee.roomId)?.roomNumber ?? employee.roomNumber ?? \"—\";\n      return {\n        employee,\n        resolvedRoomNumber,\n        charge,",
  );
}

// 3) Room list must use the resolved employee room plus finalized shared room expenses.
source = source.replace(
  /\.\.\.employeeRows\.map\(\(\{ employee \}\) => employee\.roomNumber \?\? \"—\"\)/g,
  '...employeeRows.map(({ resolvedRoomNumber }) => resolvedRoomNumber)',
);

// 4) Selected-room print must use the same resolved mapping.
source = source.replace(
  /const roomEmployees = employeeRows\.filter\(\(\{ employee \}\) => employee\.roomNumber === roomName\);/g,
  'const roomEmployees = employeeRows.filter(({ resolvedRoomNumber }) => resolvedRoomNumber === roomName);',
);
source = source.replace(
  /employeeRows\.filter\(\(\{ employee \}\) => !roomPrintRoom \|\| employee\.roomNumber === roomPrintRoom\)/g,
  'employeeRows.filter(({ resolvedRoomNumber }) => !roomPrintRoom || resolvedRoomNumber === roomPrintRoom)',
);

// 5) Display resolved room in the employee table.
source = source.replace(
  /\{employee\.roomNumber \?\? \"—\"\}/g,
  '{resolvedRoomNumber}',
);
source = source.replace(
  /\(\{ employee, charge, individual, shared, item \}\) =>/g,
  '({ employee, resolvedRoomNumber, charge, individual, shared, item }) =>',
);

// 6) Remove duplicate React room toolbars, keeping the first complete toolbar only.
const marker = '<div className="room-print-toolbar">';
let first = source.indexOf(marker);
if (first >= 0) {
  let searchFrom = first + marker.length;
  while (true) {
    const next = source.indexOf(marker, searchFrom);
    if (next < 0) break;
    let depth = 0;
    let end = -1;
    const tokenRe = /<div\b|<\/div>/g;
    tokenRe.lastIndex = next;
    let match;
    while ((match = tokenRe.exec(source))) {
      if (match[0].startsWith("<div")) depth += 1;
      else depth -= 1;
      if (depth === 0) { end = tokenRe.lastIndex; break; }
    }
    if (end < 0) break;
    source = source.slice(0, next) + source.slice(end);
    searchFrom = first + marker.length;
  }
}

// 7) Make the single toolbar structure explicit and stable.
source = source.replace(
  /<div className="room-print-toolbar">/,
  '<div className="room-print-toolbar" data-recovery-room-toolbar="primary">',
);

await writeFile(recoveryPath, source, "utf8");

// Runtime safeguard: if an older enhancement injects another room control group, hide/remove only later groups.
const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
const safeguard = `\nfunction enforceSingleRecoveryRoomToolbar(){\n  document.querySelectorAll<HTMLElement>(\".recovery-final-payable-panel\").forEach(panel=>{\n    const primary=panel.querySelector<HTMLElement>(\"[data-recovery-room-toolbar='primary']\") ?? panel.querySelector<HTMLElement>(\".room-print-toolbar\");\n    if(!primary)return;\n    const groups=Array.from(panel.querySelectorAll<HTMLElement>(\".room-print-toolbar\"));\n    groups.forEach(group=>{if(group!==primary)group.remove();});\n    const allButtons=Array.from(panel.querySelectorAll<HTMLButtonElement>(\"button\")).filter(button=>(button.textContent||\"\").includes(\"All rooms · A4 landscape\"));\n    allButtons.slice(1).forEach(button=>{const holder=button.closest<HTMLElement>(\".room-print-toolbar\");if(holder&&holder!==primary)holder.remove();else button.remove();});\n    const selectedButtons=Array.from(panel.querySelectorAll<HTMLButtonElement>(\"button\")).filter(button=>(button.textContent||\"\").includes(\"Selected room · A4 landscape\"));\n    selectedButtons.slice(1).forEach(button=>{const holder=button.closest<HTMLElement>(\".room-print-toolbar\");if(holder&&holder!==primary)holder.remove();else button.remove();});\n  });\n}\nconst joyRecoverySingleToolbarObserver=new MutationObserver(enforceSingleRecoveryRoomToolbar);\njoyRecoverySingleToolbarObserver.observe(document.documentElement,{childList:true,subtree:true});\nenforceSingleRecoveryRoomToolbar();\n`;
if (!live.includes("joyRecoverySingleToolbarObserver")) live += safeguard;
await writeFile(livePath, live, "utf8");

console.log("Stabilized Recovery: one room toolbar, roomId-based employee mapping, selected-room view and printing use the same resolved room.");
