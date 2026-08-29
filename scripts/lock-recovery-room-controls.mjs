import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appPath = join(root, "app/reports-recovery.tsx");
let app = await readFile(appPath, "utf8");

// Keep all payroll employees available in the source recovery dataset.
app = app.replace(
  /\.filter\(\(row\) => row\.charge \|\| row\.dated\.length \|\| row\.shared > 0\);/g,
  ".filter((row) => Boolean(row.item) || Boolean(row.charge) || row.dated.length > 0 || row.shared > 0);",
);

// Protect the first/native left toolbar. Do not add another toolbar.
app = app.replace(
  'className="room-print-toolbar"',
  'className="room-print-toolbar recovery-left-room-toolbar"',
);
await writeFile(appPath, app, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");

// Remove older copies of this finalizer before adding one deterministic version.
live = live.replace(/\n\/\/ JOY_RECOVERY_FINALIZER_V3[\s\S]*?\/\/ END_JOY_RECOVERY_FINALIZER_V3\n?/g, "\n");

live += `
// JOY_RECOVERY_FINALIZER_V3
function joyRecoveryFinalCleanupV3(){
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel)=>{
    const h2=panel.querySelector("h2");
    if(!h2?.textContent?.includes("final payable")) return;
    const toolbars=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));
    const keep=toolbars.find((toolbar)=>toolbar.classList.contains("recovery-left-room-toolbar")) ?? toolbars[0] ?? null;
    toolbars.forEach((toolbar)=>{ if(toolbar!==keep) toolbar.remove(); });
    panel.querySelectorAll<HTMLSelectElement>("select").forEach((select)=>{
      if(keep?.contains(select)) return;
      const roomish=(select.getAttribute("aria-label")||"").toLowerCase().includes("room") || Array.from(select.options).some((o)=>(o.textContent||"").toLowerCase().includes("select room"));
      if(roomish) select.remove();
    });
    panel.querySelectorAll<HTMLButtonElement>("button").forEach((button)=>{
      if(keep?.contains(button)) return;
      const text=(button.textContent||"").toLowerCase();
      if((text.includes("selected room")||text.includes("all room")) && text.includes("a4") && text.includes("landscape")) button.remove();
      if(text.includes("bulk recovery slip") && text.includes("a4") && text.includes("portrait")) button.remove();
      if(text.includes("all room") && text.includes("a4") && text.includes("portrait")) button.remove();
    });
  });
}

function joyRecoveryPrintAllRoomsV3(){
  const panel=Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>p.querySelector("h2")?.textContent?.includes("final payable"));
  if(!panel) return false;
  const toolbar=panel.querySelector<HTMLElement>(".recovery-left-room-toolbar") ?? panel.querySelector<HTMLElement>(".room-print-toolbar");
  const allButton=Array.from(toolbar?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((b)=>{const t=(b.textContent||"").toLowerCase();return t.includes("all room")&&t.includes("a4")&&t.includes("landscape");});
  if(!allButton || allButton.dataset.joyAllRoomsV3==="1") return false;
  allButton.dataset.joyAllRoomsV3="1";
  allButton.addEventListener("click",(event)=>{
    event.preventDefault(); event.stopImmediatePropagation();
    const employeeTable=panel.querySelector<HTMLTableElement>("table");
    if(!employeeTable) return;
    const headers=Array.from(employeeTable.tHead?.rows[0]?.cells ?? []).map((c)=>c.textContent?.trim()??"");
    const roomIndex=headers.findIndex((h)=>h==="Room");
    const voucherIndex=headers.findIndex((h)=>h==="Voucher");
    if(roomIndex<0) return;
    const allEmployeeRows=Array.from(employeeTable.tBodies[0]?.rows ?? []).map((row)=>row.cloneNode(true) as HTMLTableRowElement);
    // If the visible table is room-filtered, temporarily clear the left selector so React restores overall rows, then print next frame.
    const select=toolbar?.querySelector<HTMLSelectElement>("select") ?? null;
    if(select?.value){
      const oldValue=select.value;
      select.value="";
      select.dispatchEvent(new Event("change",{bubbles:true}));
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const freshRows=Array.from(employeeTable.tBodies[0]?.rows ?? []).map((row)=>row.cloneNode(true) as HTMLTableRowElement);
        joyBuildAllRoomSheetsV3(panel,employeeTable,freshRows,roomIndex,voucherIndex);
        select.value=oldValue;
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }));
    } else joyBuildAllRoomSheetsV3(panel,employeeTable,allEmployeeRows,roomIndex,voucherIndex);
  },true);
  return true;
}

function joyBuildAllRoomSheetsV3(panel:HTMLElement,employeeTable:HTMLTableElement,sourceRows:HTMLTableRowElement[],roomIndex:number,voucherIndex:number){
  document.querySelector(".room-recovery-print-layer")?.remove();
  const sharedPanel=Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>p.querySelector("h2")?.textContent?.includes("Gas, Ration")&&p.querySelector("h2")?.textContent?.includes("Provision"));
  const sharedTable=sharedPanel?.querySelector<HTMLTableElement>("table") ?? null;
  const sharedHeaders=Array.from(sharedTable?.tHead?.rows[0]?.cells ?? []).map((c)=>c.textContent?.trim()??"");
  const sharedRoomIndex=sharedHeaders.findIndex((h)=>h==="Room");
  const rooms=[...new Set([
    ...sourceRows.map((r)=>r.cells[roomIndex]?.textContent?.trim()??"").filter(Boolean),
    ...Array.from(sharedTable?.tBodies[0]?.rows??[]).map((r)=>sharedRoomIndex>=0?r.cells[sharedRoomIndex]?.textContent?.trim()??"":"").filter(Boolean)
  ])].filter((r)=>r!=="—").sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const layer=document.createElement("div"); layer.className="room-recovery-print-layer";
  rooms.forEach((roomName)=>{
    const sheet=document.createElement("section"); sheet.className="room-recovery-print-sheet";
    const h1=document.createElement("h1"); h1.textContent="FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";
    const h2=document.createElement("h2"); h2.textContent="Room: "+roomName;
    sheet.append(h1,h2);
    if(sharedTable&&sharedRoomIndex>=0){
      const sharedRow=Array.from(sharedTable.tBodies[0]?.rows??[]).find((r)=>r.cells[sharedRoomIndex]?.textContent?.trim()===roomName);
      if(sharedRow){const summary=document.createElement("div");summary.className="room-recovery-summary";const labels=["Gas","Ration","Provision","Occupants"];labels.forEach((label)=>{const i=sharedHeaders.findIndex((h)=>h===label);const box=document.createElement("div");box.innerHTML="<span>"+(label==="Occupants"?"Roommates":label)+"</span><strong>"+(i>=0?sharedRow.cells[i]?.textContent?.trim()||"—":"—")+"</strong>";summary.appendChild(box);});sheet.appendChild(summary);}
    }
    const clone=employeeTable.cloneNode(true) as HTMLTableElement;
    const body=clone.tBodies[0]; if(body) body.innerHTML="";
    sourceRows.filter((r)=>r.cells[roomIndex]?.textContent?.trim()===roomName).forEach((source)=>{const row=source.cloneNode(true) as HTMLTableRowElement;if(voucherIndex>=0&&row.cells[voucherIndex])row.deleteCell(voucherIndex);body?.appendChild(row);});
    const head=clone.tHead?.rows[0];if(head&&voucherIndex>=0&&head.cells[voucherIndex])head.deleteCell(voucherIndex);
    sheet.appendChild(clone); layer.appendChild(sheet);
  });
  if(!layer.children.length)return;
  document.body.appendChild(layer);
  const style=document.createElement("style");style.textContent="@page{size:A4 landscape;margin:8mm;}";document.head.appendChild(style);
  const cleanup=()=>{layer.remove();style.remove();window.removeEventListener("afterprint",cleanup);};window.addEventListener("afterprint",cleanup);window.print();setTimeout(cleanup,3000);
}

const joyRecoveryFinalObserverV3=new MutationObserver(()=>{joyRecoveryFinalCleanupV3();joyRecoveryPrintAllRoomsV3();});
joyRecoveryFinalObserverV3.observe(document.documentElement,{childList:true,subtree:true});
joyRecoveryFinalCleanupV3();joyRecoveryPrintAllRoomsV3();
// END_JOY_RECOVERY_FINALIZER_V3
`;
await writeFile(livePath, live, "utf8");
console.log("Recovery V3 finalizer: left controls retained, right duplicate dropdown/buttons removed, All Rooms landscape prints overall employee rows room-by-room.");
