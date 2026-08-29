import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const path=join(root,"app/reports-recovery.tsx");
let s=await readFile(path,"utf8");
// Always retain payroll employees in overall recovery list.
s=s.replace(/\.filter\(\(row\) => row\.charge \|\| row\.dated\.length \|\| row\.shared > 0\);/g,'.filter((row) => Boolean(row.item) || row.charge || row.dated.length || row.shared > 0);');
// Left room selector filters only the on-screen employee table.
if(s.includes('const [roomPrintRoom, setRoomPrintRoom]')){
 s=s.replace(/\{employeeRows\.map\(/g,'{employeeRows.filter(({ employee }) => !roomPrintRoom || employee.roomNumber === roomPrintRoom).map(');
}
// Mark only the first/native working toolbar as the protected left toolbar.
s=s.replace('className="room-print-toolbar"','className="room-print-toolbar recovery-left-room-toolbar"');

// IMPORTANT: All-room printing must NOT clone the currently room-filtered DOM table.
// Build every printed room's employee rows directly from employeeRows, so all rooms
// always receive employee-wise details even when one room is selected on screen.
const oldMatched=`      const matchedRows = employeeRoomIndex >= 0\n        ? employeeSourceRows.filter((row) => (row.cells[employeeRoomIndex]?.textContent?.trim() || "—") === roomName)\n        : [];`;
const newMatched=`      const matchedRows = employeeRoomIndex >= 0\n        ? employeeSourceRows.filter((row) => (row.cells[employeeRoomIndex]?.textContent?.trim() || "—") === roomName)\n        : [];\n      const roomEmployeeData = employeeRows.filter(({ employee }) => employee.roomNumber === roomName);`;
s=s.replace(oldMatched,newMatched);

const oldPrint=`      if (employeeTable && matchedRows.length && employeeRoomIndex >= 0) {\n        const clone = employeeTable.cloneNode(true) as HTMLTableElement;\n        Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {\n          const room = row.cells[employeeRoomIndex]?.textContent?.trim() || "—";\n          if (room !== roomName) row.remove();\n          else if (voucherIndex >= 0 && row.cells[voucherIndex]) row.deleteCell(voucherIndex);\n        });\n        const header = clone.tHead?.rows[0];\n        if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);\n        sheet.appendChild(clone);\n      } else if (sharedTable) {`;
const newPrint=`      if (employeeTable && roomEmployeeData.length && employeeRoomIndex >= 0) {\n        const clone = employeeTable.cloneNode(true) as HTMLTableElement;\n        const body = clone.tBodies[0];\n        if (body) {\n          body.innerHTML = "";\n          roomEmployeeData.forEach(({ employee, charge, individual, shared, item }) => {\n            const preRecovery = item ? item.netPayable + item.accommodationDeduction - item.returnAmount : 0;\n            const tr = document.createElement("tr");\n            const values = [employee.name + "\\n" + employee.employeeCode, employee.roomNumber ?? "—", `₹${preRecovery.toFixed(2)}`, `₹${individual.toFixed(2)}`, `₹${shared.toFixed(2)}`, `₹${(charge?.returnAmount ?? 0).toFixed(2)}`, `₹${(item?.netPayable ?? 0).toFixed(2)}`];\n            values.forEach((value) => { const td=document.createElement("td"); td.textContent=value; tr.appendChild(td); });\n            body.appendChild(tr);\n          });\n        }\n        const header = clone.tHead?.rows[0];\n        if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);\n        sheet.appendChild(clone);\n      } else if (sharedTable) {`;
s=s.replace(oldPrint,newPrint);
await writeFile(path,s,"utf8");

const livePath=join(root,"supabase-frontend/live-enhancements.ts");
let live=await readFile(livePath,"utf8");
// Remove ONLY duplicate/right Recovery controls. Keep the protected left dropdown + two landscape buttons.
const guard=`\nfunction joyRemoveRightRecoveryLegacyControls(){document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const h=panel.querySelector("h2");if(!h?.textContent?.includes("final payable"))return;const keep=panel.querySelector<HTMLElement>(".recovery-left-room-toolbar");panel.querySelectorAll<HTMLElement>("button").forEach(btn=>{if(keep?.contains(btn))return;const t=(btn.textContent||"").trim();if((t.includes("Bulk Recovery Slip")&&t.includes("A4")&&t.includes("Portrait"))||(t.includes("All Rooms")&&t.includes("A4")&&t.includes("Portrait"))||(t.includes("Selected room")&&t.includes("A4")&&t.includes("landscape"))||(t.includes("All rooms")&&t.includes("A4")&&t.includes("landscape")))btn.remove();});panel.querySelectorAll<HTMLSelectElement>("select").forEach(sel=>{if(keep?.contains(sel))return;const aria=(sel.getAttribute("aria-label")||"").toLowerCase();if(aria.includes("room")||Array.from(sel.options).some(o=>(o.textContent||"").toLowerCase().includes("select room")))sel.remove();});panel.querySelectorAll<HTMLElement>(".room-print-toolbar").forEach(toolbar=>{if(toolbar!==keep)toolbar.remove();});});}\nconst joyRecoveryRightOnlyObserver=new MutationObserver(joyRemoveRightRecoveryLegacyControls);joyRecoveryRightOnlyObserver.observe(document.documentElement,{childList:true,subtree:true});joyRemoveRightRecoveryLegacyControls();\n`;
// Replace previous guard so old behavior cannot survive repeated builds.
live=live.replace(/\nfunction joyRemoveRightRecoveryLegacyControls\(\)[\s\S]*?joyRemoveRightRecoveryLegacyControls\(\);\n?/g,"\n");
live+=guard;
await writeFile(livePath,live,"utf8");
console.log("Recovery final fix: all-room landscape prints employee details for every room; duplicate right landscape/portrait room controls removed; left controls preserved.");