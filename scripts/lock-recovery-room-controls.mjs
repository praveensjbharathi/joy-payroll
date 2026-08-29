import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const path=join(root,"app/reports-recovery.tsx");
let s=await readFile(path,"utf8");
// Always retain payroll employees in overall recovery list.
s=s.replace(/\.filter\(\(row\) => row\.charge \|\| row\.dated\.length \|\| row\.shared > 0\);/g,'.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);');
// Left room selector must filter the employee table itself.
if(s.includes('const [roomPrintRoom, setRoomPrintRoom]')){
 s=s.replace(/\{employeeRows\.map\(/g,'{employeeRows.filter(({ employee }) => !roomPrintRoom || employee.roomNumber === roomPrintRoom).map(');
}
// Mark the working toolbar explicitly so runtime cleanup never confuses it with legacy right controls.
s=s.replace('className="room-print-toolbar"','className="room-print-toolbar recovery-left-room-toolbar"');
await writeFile(path,s,"utf8");

const livePath=join(root,"supabase-frontend/live-enhancements.ts");
let live=await readFile(livePath,"utf8");
// Remove ONLY legacy right-side controls requested by user: right dropdown, Bulk Recovery Slip A4 Portrait, All Rooms A4 Portrait.
const guard=`\nfunction joyRemoveRightRecoveryLegacyControls(){document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const h=panel.querySelector("h2");if(!h?.textContent?.includes("final payable"))return;const keep=panel.querySelector<HTMLElement>(".recovery-left-room-toolbar");panel.querySelectorAll<HTMLElement>("button").forEach(btn=>{const t=(btn.textContent||"").trim();if(t.includes("Bulk Recovery Slip")&&t.includes("A4")&&t.includes("Portrait"))btn.remove();if(t.includes("All Rooms")&&t.includes("A4")&&t.includes("Portrait"))btn.remove();});panel.querySelectorAll<HTMLSelectElement>("select").forEach(sel=>{if(keep?.contains(sel))return;const aria=(sel.getAttribute("aria-label")||"").toLowerCase();if(aria.includes("room")||Array.from(sel.options).some(o=>(o.textContent||"").toLowerCase().includes("select room")))sel.remove();});});}\nconst joyRecoveryRightOnlyObserver=new MutationObserver(joyRemoveRightRecoveryLegacyControls);joyRecoveryRightOnlyObserver.observe(document.documentElement,{childList:true,subtree:true});joyRemoveRightRecoveryLegacyControls();\n`;
if(!live.includes('joyRecoveryRightOnlyObserver')) live+=guard;
await writeFile(livePath,live,"utf8");
console.log("Locked Recovery: left room dropdown filters employee rows; room prints retain employee-wise table; only right legacy portrait controls are removed.");