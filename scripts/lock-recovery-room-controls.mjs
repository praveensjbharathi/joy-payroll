import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appPath = join(root, "app/reports-recovery.tsx");
let app = await readFile(appPath, "utf8");

// Keep every payroll employee in the recovery source dataset.
app = app.replace(
  /\.filter\(\(row\) => row\.charge \|\| row\.dated\.length \|\| row\.shared > 0\);/g,
  ".filter((row) => Boolean(row.item) || Boolean(row.charge) || row.dated.length > 0 || row.shared > 0);",
);

// Ensure room resolver exists and uses the employee's mapped room first.
if (!app.includes("function getRecoveryRoomNumber(employee: Employee)")) {
  app = app.replace(
    "  const finalizations = run\n    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)\n    : [];",
    "  const finalizations = run\n    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)\n    : [];\n  function getRecoveryRoomNumber(employee: Employee) {\n    return data.accommodationRooms.find((room) => room.id === employee.roomId)?.roomNumber ?? employee.roomNumber ?? \"—\";\n  }",
  );
}

// Make the screen table use exactly the same room value shown in the Room column.
app = app.replace(
  /\{employeeRows\.map\(\s*\(\{ employee, charge, individual, shared, item \}\) =>/,
  "{employeeRows.filter(({ employee }) => !roomPrintRoom || getRecoveryRoomNumber(employee) === roomPrintRoom).map(({ employee, charge, individual, shared, item }) =>",
);
app = app.replace(
  /<td>\{employee\.roomNumber \?\? \"—\"\}<\/td>/,
  "<td>{getRecoveryRoomNumber(employee)}</td>",
);
app = app.replace(
  /\.\.\.employeeRows\.map\(\(\{ employee \}\) => employee\.roomNumber \?\? \"—\"\)/g,
  "...employeeRows.map(({ employee }) => getRecoveryRoomNumber(employee))",
);
app = app.replace(
  /const roomEmployees = employeeRows\.filter\(\(\{ employee \}\) => employee\.roomNumber === roomName\);/g,
  "const roomEmployees = employeeRows.filter(({ employee }) => getRecoveryRoomNumber(employee) === roomName);",
);

// Restore an employee-wise deduction voucher action for every employee row.
if (!app.includes("Download deduction voucher")) {
  app = app.replace(
    "                      <td>\n                        {finalizations.some(",
    "                      <td>\n                        <button\n                          type=\"button\"\n                          className=\"record-action\"\n                          onClick={() => setVoucherEmployeeId(employee.id)}\n                        >\n                          Download deduction voucher\n                        </button>\n                        {finalizations.some(",
  );
}

// Protect only the first/native left room toolbar.
app = app.replace(
  'className="room-print-toolbar"',
  'className="room-print-toolbar recovery-left-room-toolbar"',
);
await writeFile(appPath, app, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
live = live.replace(/\n\/\/ JOY_RECOVERY_FINALIZER_V4[\s\S]*?\/\/ END_JOY_RECOVERY_FINALIZER_V4\n?/g, "\n");
live = live.replace(/\n\/\/ JOY_RECOVERY_FINALIZER_V3[\s\S]*?\/\/ END_JOY_RECOVERY_FINALIZER_V3\n?/g, "\n");

live += `
// JOY_RECOVERY_FINALIZER_V4
function joyRecoveryPanelV4(){return Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>p.querySelector("h2")?.textContent?.includes("final payable"))??null;}
function joyRecoveryToolbarV4(panel:HTMLElement){return panel.querySelector<HTMLElement>(".recovery-left-room-toolbar")??panel.querySelector<HTMLElement>(".room-print-toolbar");}
function joyRecoveryExactRoomFilterV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const toolbar=joyRecoveryToolbarV4(panel);const select=toolbar?.querySelector<HTMLSelectElement>("select");const table=panel.querySelector<HTMLTableElement>("table");if(!select||!table)return;const headers=Array.from(table.tHead?.rows[0]?.cells??[]).map((c)=>c.textContent?.trim()??"");const roomIndex=headers.findIndex((h)=>h==="Room");if(roomIndex<0)return;const selected=(select.value||"").trim();Array.from(table.tBodies[0]?.rows??[]).forEach((row)=>{const room=(row.cells[roomIndex]?.textContent?.trim()||"");row.style.display=!selected||room===selected?"":"none";});}
function joyRecoveryBindRoomFilterV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const select=joyRecoveryToolbarV4(panel)?.querySelector<HTMLSelectElement>("select");if(!select||select.dataset.joyRoomFilterV4==="1")return;select.dataset.joyRoomFilterV4="1";select.addEventListener("change",()=>requestAnimationFrame(joyRecoveryExactRoomFilterV4));joyRecoveryExactRoomFilterV4();}
function joyRecoveryCleanupV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const toolbars=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));const keep=toolbars.find((t)=>t.classList.contains("recovery-left-room-toolbar"))??toolbars[0]??null;toolbars.forEach((t)=>{if(t!==keep)t.remove();});panel.querySelectorAll<HTMLSelectElement>("select").forEach((s)=>{if(keep?.contains(s))return;const roomish=(s.getAttribute("aria-label")||"").toLowerCase().includes("room")||Array.from(s.options).some((o)=>(o.textContent||"").toLowerCase().includes("select room"));if(roomish)s.remove();});panel.querySelectorAll<HTMLButtonElement>("button").forEach((b)=>{if(keep?.contains(b))return;const t=(b.textContent||"").toLowerCase();if((t.includes("selected room")||t.includes("all room"))&&t.includes("a4")&&t.includes("landscape"))b.remove();if(t.includes("bulk recovery slip")&&t.includes("a4")&&t.includes("portrait"))b.remove();if(t.includes("all room")&&t.includes("a4")&&t.includes("portrait"))b.remove();});}
function joyRecoveryPrintAllRoomsV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const toolbar=joyRecoveryToolbarV4(panel);const allButton=Array.from(toolbar?.querySelectorAll<HTMLButtonElement>("button")??[]).find((b)=>{const t=(b.textContent||"").toLowerCase();return t.includes("all room")&&t.includes("a4")&&t.includes("landscape");});if(!allButton||allButton.dataset.joyAllRoomsV4==="1")return;allButton.dataset.joyAllRoomsV4="1";allButton.addEventListener("click",(event)=>{event.preventDefault();event.stopImmediatePropagation();const table=panel.querySelector<HTMLTableElement>("table");if(!table)return;const headers=Array.from(table.tHead?.rows[0]?.cells??[]).map((c)=>c.textContent?.trim()??"");const roomIndex=headers.findIndex((h)=>h==="Room");const voucherIndex=headers.findIndex((h)=>h==="Voucher");if(roomIndex<0)return;const select=toolbar?.querySelector<HTMLSelectElement>("select")??null;const old=select?.value??"";const run=()=>{Array.from(table.tBodies[0]?.rows??[]).forEach((r)=>r.style.display="");const rows=Array.from(table.tBodies[0]?.rows??[]).map((r)=>r.cloneNode(true) as HTMLTableRowElement);joyBuildAllRoomSheetsV4(table,rows,roomIndex,voucherIndex);if(select){select.value=old;select.dispatchEvent(new Event("change",{bubbles:true}));}};if(select&&select.value){select.value="";select.dispatchEvent(new Event("change",{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(run));}else run();},true);}
function joyBuildAllRoomSheetsV4(employeeTable:HTMLTableElement,sourceRows:HTMLTableRowElement[],roomIndex:number,voucherIndex:number){document.querySelector(".room-recovery-print-layer")?.remove();const sharedPanel=Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>{const t=p.querySelector("h2")?.textContent||"";return t.includes("Gas, Ration")&&t.includes("Provision");});const sharedTable=sharedPanel?.querySelector<HTMLTableElement>("table")??null;const sharedHeaders=Array.from(sharedTable?.tHead?.rows[0]?.cells??[]).map((c)=>c.textContent?.trim()??"");const sharedRoomIndex=sharedHeaders.findIndex((h)=>h==="Room");const rooms=[...new Set([...sourceRows.map((r)=>r.cells[roomIndex]?.textContent?.trim()??"").filter((r)=>r&&r!=="—"),...Array.from(sharedTable?.tBodies[0]?.rows??[]).map((r)=>sharedRoomIndex>=0?r.cells[sharedRoomIndex]?.textContent?.trim()??"":"").filter((r)=>r&&r!=="—")])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const layer=document.createElement("div");layer.className="room-recovery-print-layer";rooms.forEach((roomName)=>{const employeeRows=sourceRows.filter((r)=>r.cells[roomIndex]?.textContent?.trim()===roomName);const sharedRow=sharedTable&&sharedRoomIndex>=0?Array.from(sharedTable.tBodies[0]?.rows??[]).find((r)=>r.cells[sharedRoomIndex]?.textContent?.trim()===roomName):undefined;if(!employeeRows.length&&!sharedRow)return;const sheet=document.createElement("section");sheet.className="room-recovery-print-sheet";const h1=document.createElement("h1");h1.textContent="FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";const h2=document.createElement("h2");h2.textContent="Room: "+roomName;sheet.append(h1,h2);if(sharedRow){const summary=document.createElement("div");summary.className="room-recovery-summary";["Gas","Ration","Provision","Occupants"].forEach((label)=>{const i=sharedHeaders.findIndex((h)=>h===label);const box=document.createElement("div");box.innerHTML="<span>"+(label==="Occupants"?"Roommates":label)+"</span><strong>"+(i>=0?sharedRow.cells[i]?.textContent?.trim()||"—":"—")+"</strong>";summary.appendChild(box);});sheet.appendChild(summary);}if(employeeRows.length){const clone=employeeTable.cloneNode(true) as HTMLTableElement;const body=clone.tBodies[0];if(body)body.innerHTML="";employeeRows.forEach((source)=>{const row=source.cloneNode(true) as HTMLTableRowElement;row.style.display="";if(voucherIndex>=0&&row.cells[voucherIndex])row.deleteCell(voucherIndex);body?.appendChild(row);});const head=clone.tHead?.rows[0];if(head&&voucherIndex>=0&&head.cells[voucherIndex])head.deleteCell(voucherIndex);sheet.appendChild(clone);}layer.appendChild(sheet);});if(!layer.children.length)return;document.body.appendChild(layer);const style=document.createElement("style");style.textContent="@page{size:A4 landscape;margin:7mm;}@media print{body>*:not(.room-recovery-print-layer){display:none!important}.room-recovery-print-layer{display:block!important}.room-recovery-print-sheet{display:block!important;break-after:page!important;page-break-after:always!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important}.room-recovery-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}.room-recovery-print-sheet:empty{display:none!important}}";document.head.appendChild(style);const cleanup=()=>{layer.remove();style.remove();window.removeEventListener("afterprint",cleanup);};window.addEventListener("afterprint",cleanup);window.print();setTimeout(cleanup,3000);}
const joyRecoveryObserverV4=new MutationObserver(()=>{joyRecoveryCleanupV4();joyRecoveryBindRoomFilterV4();joyRecoveryExactRoomFilterV4();joyRecoveryPrintAllRoomsV4();});joyRecoveryObserverV4.observe(document.documentElement,{childList:true,subtree:true});joyRecoveryCleanupV4();joyRecoveryBindRoomFilterV4();joyRecoveryExactRoomFilterV4();joyRecoveryPrintAllRoomsV4();
// END_JOY_RECOVERY_FINALIZER_V4
`;

await writeFile(livePath, live, "utf8");
console.log("Recovery V4: exact selected-room filtering, employee-wise deduction voucher action, all-room printing, duplicate cleanup and blank-page control applied.");
