export {};

const style = document.createElement("style");
style.dataset.joyLiveEnhancements = "true";
style.textContent = `
.profile-password-panel{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important;width:100%!important;margin-top:24px!important;padding-top:22px!important;border-top:1px solid #e6ebf2!important}.profile-password-panel label{display:flex!important;flex-direction:column!important;gap:7px!important;width:100%!important}.profile-password-panel input[type=password]{width:100%!important;min-height:48px!important;box-sizing:border-box!important;padding:0 13px!important}.profile-password-panel>button{width:100%!important;min-height:46px!important}
.employee-id-card-set{display:flex!important;flex-wrap:wrap!important;gap:18px!important;align-items:flex-start!important;justify-content:center!important}.employee-id-card-set .id-card-front,.employee-id-card-set .id-card-back{display:flex!important}.id-card-front .id-card-company b{display:block!important;max-width:39mm!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;font-size:3.1mm!important;line-height:1.12!important}.id-card-front footer{display:none!important}
.hostel-hierarchy-guide{margin:0 0 18px!important;padding:16px 18px!important;border:1px solid #d8e5f7!important;border-radius:12px!important;background:#f8fbff!important}.hostel-hierarchy-guide strong{display:block;margin-bottom:10px;color:#172236}.hostel-hierarchy-guide ol{margin:0;padding-left:20px;display:grid;gap:6px;color:#455872}
.room-print-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.room-print-toolbar select{min-width:190px}.room-recovery-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:8px 0 12px}.room-recovery-summary div{border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;display:grid;gap:2px}.room-recovery-summary span{font-size:8pt;color:#64748b}.room-recovery-summary strong{font-size:10pt;color:#172236}
@media print{
  body *{visibility:hidden!important}
  .advance-voucher-layer,.advance-voucher-layer *,.room-recovery-print-layer,.room-recovery-print-layer *,.payslip-sheet,.payslip-sheet *,.bulk-payslip-pages,.bulk-payslip-pages *{visibility:visible!important}
  .advance-voucher-layer,.room-recovery-print-layer{position:absolute!important;inset:0!important;width:100%!important;background:#fff!important;padding:0!important;overflow:visible!important}.advance-voucher-layer .modal-scrim,.advance-voucher-layer .modal-toolbar,.room-recovery-print-layer .modal-toolbar{display:none!important}.advance-voucher-layer .room-report-modal{position:static!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;overflow:visible!important;background:#fff!important;box-shadow:none!important}
  .advance-voucher,.bulk-recovery-vouchers .advance-voucher{width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:12mm!important;box-sizing:border-box!important;font-size:12pt!important;break-after:page!important;page-break-after:always!important}.advance-voucher h2{font-size:20pt!important}.advance-voucher h3{font-size:15pt!important}
  .room-recovery-print-sheet{width:281mm!important;min-height:194mm!important;margin:0 auto!important;padding:7mm!important;box-sizing:border-box!important;break-after:page!important;page-break-after:always!important}.room-recovery-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}.room-recovery-print-sheet table{width:100%!important;border-collapse:collapse!important;font-size:6.8pt!important;table-layout:auto!important}.room-recovery-print-sheet th,.room-recovery-print-sheet td{border:1px solid #77869a!important;padding:3px!important;white-space:nowrap!important}.room-recovery-print-sheet h1{font-size:17pt!important;margin:0 0 4px!important}.room-recovery-print-sheet h2{font-size:13pt!important;margin:0 0 8px!important}
  body[data-print-target="payslip"] .payslip-sheet{position:absolute!important;inset:0!important;width:190mm!important;min-height:277mm!important;height:auto!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important;background:#fff!important;box-shadow:none!important}
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages{position:absolute!important;inset:0!important;width:100%!important;background:#fff!important}.bulk-payslip-pages .payslip-sheet,.bulk-payslip-pages .payslip-half-a4{width:190mm!important;min-height:277mm!important;height:auto!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important;break-after:page!important;page-break-after:always!important}.bulk-payslip-pages .payslip-sheet:last-child,.bulk-payslip-pages .payslip-half-a4:last-child{break-after:auto!important;page-break-after:auto!important}
}
`;
document.head.appendChild(style);

function addHierarchyGuide() {
  document.querySelectorAll<HTMLElement>(".section-stack").forEach((stack) => {
    if (!stack.querySelector(".hostel-selected-record") || stack.querySelector(".hostel-hierarchy-guide")) return;
    const guide = document.createElement("section");
    guide.className = "hostel-hierarchy-guide";
    guide.innerHTML = `<strong>Accommodation Type → Hostel / Local Area → Client Employer → Room → Employee</strong><ol><li>Select accommodation type.</li><li>Select or create hostel / local area.</li><li>Map client employer units.</li><li>Create rooms under the selected hostel.</li><li>Allocate only mapped room-unallocated employees.</li></ol>`;
    stack.prepend(guide);
  });
}

function cleanIdToolbar() {
  document.querySelectorAll<HTMLElement>(".id-card-modal .modal-toolbar div").forEach((bar) => {
    Array.from(bar.querySelectorAll("button")).forEach((button) => {
      const text = button.textContent?.trim() ?? "";
      if (["Print front + back", "Download front JPG", "Download back JPG", "HR Download Front JPEG", "HR Download Back JPEG"].includes(text)) button.remove();
    });
  });
}

function removeDuplicateRoomPrintToolbars() {
  document.querySelectorAll<HTMLElement>(".recovery-final-payable-panel").forEach((panel) => {
    const toolbars = Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));
    toolbars.slice(1).forEach((toolbar) => toolbar.remove());
  });
}

function improveVoucherButtons() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.trim();
    if (text === "Download all finalized vouchers") button.textContent = "Bulk recovery slips · A4 portrait";
    if (text === "Print / Save bulk PDF") button.textContent = "Bulk A4 portrait · Print / Save PDF";
    if (text === "Print / Save PDF" && button.closest(".room-report-modal")?.querySelector(".advance-voucher")) button.textContent = "Print recovery slip · A4 portrait";
    if (text === "Print / Save PDF" && button.closest(".modal-layer")?.querySelector(".payslip-sheet")) button.textContent = "Print payslip · A4 portrait";
  });
}

function preparePortraitPrint(event: Event) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
  if (!button) return;
  const modal = button.closest<HTMLElement>(".modal-layer");
  let target = "";
  if (modal?.querySelector(".advance-voucher")) target = "voucher";
  else if (modal?.querySelector(".bulk-payslip-pages")) target = "bulk-payslips";
  else if (modal?.querySelector(".payslip-sheet")) target = "payslip";
  if (!target) return;
  const text = button.textContent?.toLowerCase() ?? "";
  if (!text.includes("print") && !text.includes("save")) return;
  document.body.dataset.printTarget = target;
  const cleanup = () => { delete document.body.dataset.printTarget; window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 3000);
}
document.addEventListener("click", preparePortraitPrint, true);

const observer = new MutationObserver(() => {
  addHierarchyGuide();
  cleanIdToolbar();
  removeDuplicateRoomPrintToolbars();
  improveVoucherButtons();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
addHierarchyGuide();
cleanIdToolbar();
removeDuplicateRoomPrintToolbars();
improveVoucherButtons();


// JOY_PENDING_WORKFLOW_COMPLETION_V2
const pendingStyle=document.createElement("style");pendingStyle.textContent=`@page joy-payslip{size:A4 portrait;margin:10mm}@page joy-recovery-slip{size:A4 portrait;margin:10mm}.room-recovery-print-sheet table{font-size:7pt!important}.room-recovery-print-sheet th,.room-recovery-print-sheet td{padding:3px!important;white-space:nowrap}@media print{body[data-print-target=\"payslip\"] .payslip-sheet,body[data-print-target=\"payslip\"] .payslip-sheet *{visibility:visible!important}body[data-print-target=\"payslip\"] .payslip-sheet{page:joy-payslip;position:absolute!important;inset:0!important;width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important}body[data-print-target=\"recovery-slip\"] .advance-voucher,body[data-print-target=\"recovery-slip\"] .advance-voucher *{visibility:visible!important}body[data-print-target=\"recovery-slip\"] .advance-voucher{page:joy-recovery-slip;position:absolute!important;inset:0!important;width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important}}`;document.head.appendChild(pendingStyle);
function joyPortraitPrint(){document.querySelectorAll<HTMLElement>(".payslip-sheet").forEach(sheet=>{const toolbar=sheet.closest<HTMLElement>(".modal-layer")?.querySelector<HTMLElement>(".modal-toolbar div");if(toolbar&&!toolbar.querySelector(".joy-payslip-print")){const b=document.createElement("button");b.type="button";b.className="secondary-button joy-payslip-print";b.textContent="Print payslip · A4 portrait";b.onclick=()=>{document.body.dataset.printTarget="payslip";const c=()=>{delete document.body.dataset.printTarget;window.removeEventListener("afterprint",c)};window.addEventListener("afterprint",c);window.print();setTimeout(c,1800)};toolbar.prepend(b)}});document.querySelectorAll<HTMLElement>(".advance-voucher").forEach(sheet=>{const b=sheet.closest<HTMLElement>(".modal-layer")?.querySelector<HTMLButtonElement>(".modal-toolbar button.secondary-button");if(b&&!b.dataset.joyPortrait){b.dataset.joyPortrait="1";b.textContent="Print recovery slip · A4 portrait";b.onclick=()=>{document.body.dataset.printTarget="recovery-slip";const c=()=>{delete document.body.dataset.printTarget;window.removeEventListener("afterprint",c)};window.addEventListener("afterprint",c);window.print();setTimeout(c,1800)}}})}
const joyPortraitObserver=new MutationObserver(joyPortraitPrint);joyPortraitObserver.observe(document.documentElement,{childList:true,subtree:true});joyPortraitPrint();

// JOY_ROOM_RECOVERY_SUMMARY_20260828
const roomSummaryStyle=document.createElement("style");roomSummaryStyle.textContent=`.room-recovery-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:5px 0 8px}.room-recovery-summary div{border:1px solid #94a3b8;padding:5px 6px}.room-recovery-summary span{display:block;font-size:7.5pt;color:#64748b}.room-recovery-summary strong{display:block;font-size:9.5pt;color:#172236}`;document.head.appendChild(roomSummaryStyle);


function cleanupLegacyIdToolbar(){document.querySelectorAll<HTMLElement>(".id-card-modal .modal-toolbar").forEach(toolbar=>{toolbar.querySelectorAll<HTMLElement>("strong").forEach(el=>el.remove());toolbar.querySelectorAll<HTMLButtonElement>("button").forEach(button=>{const text=(button.textContent||"").replace(/\s+/g," ").trim().toLowerCase();const keep=text.includes("front hq jpg")||text.includes("back hq jpg")||text.includes("preparing front")||text.includes("preparing back")||text==="×"||button.classList.contains("icon-button");if(!keep)button.remove();});});}
const legacyIdToolbarObserver=new MutationObserver(cleanupLegacyIdToolbar);legacyIdToolbarObserver.observe(document.documentElement,{childList:true,subtree:true});cleanupLegacyIdToolbar();

const joyRecoveryDuplicateOnlyObserver = new MutationObserver(removeDuplicateRoomPrintToolbars);
joyRecoveryDuplicateOnlyObserver.observe(document.documentElement, { childList: true, subtree: true });
removeDuplicateRoomPrintToolbars();












// JOY_READABLE_PAYSLIP_ROOM_PRINT_V1
const joyReadablePayrollPrintStyle = document.createElement("style");
joyReadablePayrollPrintStyle.dataset.joyReadablePayrollPrint = "true";
joyReadablePayrollPrintStyle.textContent = [
  ".payslip-sheet h2{font-size:24px!important;line-height:1.2!important}",
  ".payslip-sheet header strong{font-size:12px!important}",
  ".payslip-company h3{font-size:17px!important;line-height:1.25!important}",
  ".payslip-company p{font-size:11px!important;line-height:1.45!important}",
  ".payslip-company span{font-size:10px!important}",
  ".payslip-meta span{font-size:10px!important;line-height:1.25!important}",
  ".payslip-meta strong{font-size:12px!important;line-height:1.3!important}",
  ".payslip-columns h4{font-size:11px!important}",
  ".payslip-columns section>div{font-size:11px!important;line-height:1.3!important}",
  ".payslip-columns section>footer{font-size:12px!important}",
  ".payslip-net>div span{font-size:12px!important}",
  ".payslip-net>div strong{font-size:22px!important}",
  ".payslip-net p{font-size:11px!important;line-height:1.4!important}",
  ".payslip-net p span{font-size:10px!important}",
  ".payslip-footnote{font-size:10px!important;line-height:1.4!important}",
  ".payslip-meta .payslip-attendance-inline{font-size:11px!important}",
  "@media print{",
  ".payslip-sheet h2{font-size:18pt!important}",
  ".payslip-sheet header strong{font-size:9.5pt!important}",
  ".payslip-company h3{font-size:13pt!important}",
  ".payslip-company p{font-size:9pt!important;line-height:1.35!important}",
  ".payslip-company span{font-size:8.5pt!important}",
  ".payslip-meta span{font-size:8.5pt!important}",
  ".payslip-meta strong{font-size:10pt!important}",
  ".payslip-columns h4{font-size:9.5pt!important}",
  ".payslip-columns section>div{font-size:9.5pt!important;line-height:1.25!important}",
  ".payslip-columns section>footer{font-size:10pt!important}",
  ".payslip-net>div span{font-size:10.5pt!important}",
  ".payslip-net>div strong{font-size:17pt!important}",
  ".payslip-net p{font-size:9.5pt!important}",
  ".payslip-net p span{font-size:8.5pt!important}",
  ".payslip-footnote{font-size:9pt!important}",
  ".payslip-meta .payslip-attendance-inline{font-size:9pt!important}",
  ".room-recovery-print-sheet h1{font-size:20pt!important;line-height:1.15!important}",
  ".room-recovery-print-sheet h2{font-size:15pt!important;line-height:1.2!important}",
  ".room-recovery-print-sheet .room-recovery-summary span{font-size:9pt!important}",
  ".room-recovery-print-sheet .room-recovery-summary strong{font-size:11pt!important}",
  ".room-recovery-print-sheet table{font-size:8pt!important;line-height:1.15!important}",
  ".room-recovery-print-sheet th,.room-recovery-print-sheet td{font-size:8pt!important;line-height:1.15!important;padding:2.5px 2px!important}",
  ".room-recovery-print-sheet footer{font-size:11pt!important}",
  "}",
].join("\n");
document.head.appendChild(joyReadablePayrollPrintStyle);
// END_JOY_READABLE_PAYSLIP_ROOM_PRINT_V1


// JOY_HANDWRITTEN_RECOVERY_PRINT_V1
const joyRecoveryReconciliationStyle = document.createElement("style");
joyRecoveryReconciliationStyle.dataset.joyRecoveryReconciliation = "true";
joyRecoveryReconciliationStyle.textContent = [
  ".room-recovery-period-summary{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}",
  ".room-recovery-date-summary th,.room-recovery-date-summary td{text-align:right}",
  ".room-recovery-date-summary th:first-child,.room-recovery-date-summary td:first-child,.room-recovery-date-summary th:nth-child(2),.room-recovery-date-summary td:nth-child(2){text-align:left}",
  ".payment-selection-controls select{min-width:220px}",
  ".payment-batch-selector input[type=checkbox]:disabled{cursor:not-allowed;opacity:.65}",
  "@media print{",
  ".room-recovery-print-sheet .room-recovery-summary{grid-template-columns:repeat(auto-fit,minmax(105px,1fr))!important}",
  ".room-recovery-print-sheet thead th:nth-child(2){min-width:130px!important}",
  ".room-recovery-print-sheet tbody td:nth-child(2) small{display:block!important;font-size:11pt!important;line-height:1.25!important;font-weight:900!important;letter-spacing:.35px!important;color:#0f172a!important;margin-top:2px!important}",
  ".room-recovery-print-sheet tfoot td{font-size:9pt!important;font-weight:900!important;background:#eef3f8!important;border-top:2px solid #334155!important}",
  "}",
].join("\n");
document.head.appendChild(joyRecoveryReconciliationStyle);
// END_JOY_HANDWRITTEN_RECOVERY_PRINT_V1
























































// JOY_RECOVERY_FINALIZER_V4
function joyRecoveryPanelV4(){return Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>p.querySelector("h2")?.textContent?.includes("final payable"))??null;}
function joyRecoveryToolbarV4(panel:HTMLElement){return panel.querySelector<HTMLElement>(".recovery-left-room-toolbar")??panel.querySelector<HTMLElement>(".room-print-toolbar");}
function joyRecoveryExactRoomFilterV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const toolbar=joyRecoveryToolbarV4(panel);const select=toolbar?.querySelector<HTMLSelectElement>("select");const table=panel.querySelector<HTMLTableElement>("table");if(!select||!table)return;const headers=Array.from(table.tHead?.rows[0]?.cells??[]).map((c)=>c.textContent?.trim()??"");const roomIndex=headers.findIndex((h)=>h==="Room");if(roomIndex<0)return;const selected=(select.value||"").trim();Array.from(table.tBodies[0]?.rows??[]).forEach((row)=>{const room=(row.cells[roomIndex]?.textContent?.trim()||"");row.style.display=!selected||room===selected?"":"none";});}
function joyRecoveryBindRoomFilterV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const select=joyRecoveryToolbarV4(panel)?.querySelector<HTMLSelectElement>("select");if(!select||select.dataset.joyRoomFilterV4==="1")return;select.dataset.joyRoomFilterV4="1";select.addEventListener("change",()=>requestAnimationFrame(joyRecoveryExactRoomFilterV4));joyRecoveryExactRoomFilterV4();}
function joyRecoveryCleanupV4(){const panel=joyRecoveryPanelV4();if(!panel)return;const toolbars=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));const keep=toolbars.find((t)=>t.classList.contains("recovery-left-room-toolbar"))??toolbars[0]??null;toolbars.forEach((t)=>{if(t!==keep)t.remove();});panel.querySelectorAll<HTMLSelectElement>("select").forEach((s)=>{if(keep?.contains(s))return;const roomish=(s.getAttribute("aria-label")||"").toLowerCase().includes("room")||Array.from(s.options).some((o)=>(o.textContent||"").toLowerCase().includes("select room"));if(roomish)s.remove();});panel.querySelectorAll<HTMLButtonElement>("button").forEach((b)=>{if(keep?.contains(b))return;const t=(b.textContent||"").toLowerCase();if((t.includes("selected room")||t.includes("all room"))&&t.includes("a4")&&t.includes("landscape"))b.remove();if(t.includes("bulk recovery slip")&&t.includes("a4")&&t.includes("portrait"))b.remove();if(t.includes("all room")&&t.includes("a4")&&t.includes("portrait"))b.remove();});}
function joyRecoveryPrintAllRoomsV4(){return;}
function joyBuildAllRoomSheetsV4(employeeTable:HTMLTableElement,sourceRows:HTMLTableRowElement[],roomIndex:number,voucherIndex:number){document.querySelector(".room-recovery-print-layer")?.remove();const sharedPanel=Array.from(document.querySelectorAll<HTMLElement>(".panel")).find((p)=>{const t=p.querySelector("h2")?.textContent||"";return t.includes("Gas, Ration")&&t.includes("Provision");});const sharedTable=sharedPanel?.querySelector<HTMLTableElement>("table")??null;const sharedHeaders=Array.from(sharedTable?.tHead?.rows[0]?.cells??[]).map((c)=>c.textContent?.trim()??"");const sharedRoomIndex=sharedHeaders.findIndex((h)=>h==="Room");const rooms=[...new Set([...sourceRows.map((r)=>r.cells[roomIndex]?.textContent?.trim()??"").filter((r)=>r&&r!=="—"),...Array.from(sharedTable?.tBodies[0]?.rows??[]).map((r)=>sharedRoomIndex>=0?r.cells[sharedRoomIndex]?.textContent?.trim()??"":"").filter((r)=>r&&r!=="—")])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const layer=document.createElement("div");layer.className="room-recovery-print-layer";rooms.forEach((roomName)=>{const employeeRows=sourceRows.filter((r)=>r.cells[roomIndex]?.textContent?.trim()===roomName);const sharedRow=sharedTable&&sharedRoomIndex>=0?Array.from(sharedTable.tBodies[0]?.rows??[]).find((r)=>r.cells[sharedRoomIndex]?.textContent?.trim()===roomName):undefined;if(!employeeRows.length&&!sharedRow)return;const sheet=document.createElement("section");sheet.className="room-recovery-print-sheet";const h1=document.createElement("h1");h1.textContent="FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";const h2=document.createElement("h2");h2.textContent="Room: "+roomName;sheet.append(h1,h2);if(sharedRow){const summary=document.createElement("div");summary.className="room-recovery-summary";["Gas","Ration","Provision","Occupants"].forEach((label)=>{const i=sharedHeaders.findIndex((h)=>h===label);const box=document.createElement("div");box.innerHTML="<span>"+(label==="Occupants"?"Roommates":label)+"</span><strong>"+(i>=0?sharedRow.cells[i]?.textContent?.trim()||"—":"—")+"</strong>";summary.appendChild(box);});sheet.appendChild(summary);}if(employeeRows.length){const clone=employeeTable.cloneNode(true) as HTMLTableElement;const body=clone.tBodies[0];if(body)body.innerHTML="";employeeRows.forEach((source)=>{const row=source.cloneNode(true) as HTMLTableRowElement;row.style.display="";if(voucherIndex>=0&&row.cells[voucherIndex])row.deleteCell(voucherIndex);body?.appendChild(row);});const head=clone.tHead?.rows[0];if(head&&voucherIndex>=0&&head.cells[voucherIndex])head.deleteCell(voucherIndex);sheet.appendChild(clone);}layer.appendChild(sheet);});if(!layer.children.length)return;document.body.appendChild(layer);const style=document.createElement("style");style.textContent="@page{size:A4 landscape;margin:7mm;}@media print{body>*:not(.room-recovery-print-layer){display:none!important}.room-recovery-print-layer{display:block!important}.room-recovery-print-sheet{display:block!important;break-after:page!important;page-break-after:always!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important}.room-recovery-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}.room-recovery-print-sheet:empty{display:none!important}}";document.head.appendChild(style);const cleanup=()=>{layer.remove();style.remove();window.removeEventListener("afterprint",cleanup);};window.addEventListener("afterprint",cleanup);window.print();setTimeout(cleanup,3000);}
const joyRecoveryObserverV4=new MutationObserver(()=>{joyRecoveryCleanupV4();joyRecoveryBindRoomFilterV4();joyRecoveryExactRoomFilterV4();joyRecoveryPrintAllRoomsV4();});joyRecoveryObserverV4.observe(document.documentElement,{childList:true,subtree:true});joyRecoveryCleanupV4();joyRecoveryBindRoomFilterV4();joyRecoveryExactRoomFilterV4();joyRecoveryPrintAllRoomsV4();
// END_JOY_RECOVERY_FINALIZER_V4

// JOY_PAYSLIP_PRINT_FINAL_V1
const joyPayslipPrintStyle = document.createElement("style");
joyPayslipPrintStyle.dataset.joyPayslipPrintFinal = "true";
joyPayslipPrintStyle.textContent = String.raw`
@page { size: A4 portrait; margin: 8mm; }
@media print {
  html, body { background: #fff !important; width: auto !important; height: auto !important; overflow: visible !important; }
  body[data-print-target="bulk-payslips"] .modal-layer,
  body[data-print-target="payslip"] .modal-layer { position: static !important; inset: auto !important; display: block !important; overflow: visible !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal,
  body[data-print-target="payslip"] .payslip-modal { position: static !important; inset: auto !important; transform: none !important; width: auto !important; max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-modal .modal-toolbar,
  body[data-print-target="payslip"] .payslip-modal .modal-toolbar,
  body[data-print-target="bulk-payslips"] .modal-scrim,
  body[data-print-target="payslip"] .modal-scrim { display: none !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages { position: static !important; display: block !important; width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: #fff !important; visibility: visible !important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-half-a4,
  body[data-print-target="payslip"] .payslip-sheet {
    position: relative !important; inset: auto !important; display: block !important;
    width: 194mm !important; height: 275mm !important; min-height: 275mm !important; max-height: 275mm !important;
    margin: 0 auto !important; padding: 7mm !important; overflow: hidden !important; box-sizing: border-box !important;
    background: #fff !important; visibility: visible !important; break-inside: avoid !important; page-break-inside: avoid !important;
    break-after: page !important; page-break-after: always !important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-sheet:last-child,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages .payslip-half-a4:last-child,
  body[data-print-target="payslip"] .payslip-sheet:last-child { break-after: auto !important; page-break-after: auto !important; }
}
`;
document.head.appendChild(joyPayslipPrintStyle);
function joyPayslipToolbarCleanupV1() {
  document.querySelectorAll<HTMLElement>(".bulk-payslip-modal").forEach((modal) => {
    modal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const label = (button.textContent || "").trim().toLowerCase();
      if (label === "print payslip · a4 portrait" || label === "print / save pdf") button.remove();
      if (label === "print / save bulk pdf" || label === "bulk a4 portrait · print / save pdf" || label === "bulk a5 portrait · print / save pdf") button.textContent = "Bulk A4 portrait · 1 employee per page · Print / Save PDF";
    });
  });
}
const joyPayslipToolbarObserverV1 = new MutationObserver(joyPayslipToolbarCleanupV1);
joyPayslipToolbarObserverV1.observe(document.documentElement, { childList: true, subtree: true });
joyPayslipToolbarCleanupV1();
// END_JOY_PAYSLIP_PRINT_FINAL_V1

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

// JOY_PAYSLIP_ISOLATED_PRINT_V2
const joyIsolatedPayslipPrintStyle = document.createElement("style");
joyIsolatedPayslipPrintStyle.dataset.joyIsolatedPayslipPrint = "true";
joyIsolatedPayslipPrintStyle.textContent = String.raw`
#joy-payslip-print-root { display: none; }
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body.joy-isolated-payslip-print > *:not(#joy-payslip-print-root) { display: none !important; }
  body.joy-isolated-payslip-print #joy-payslip-print-root {
    display: block !important; position: static !important; width: 100% !important;
    height: auto !important; overflow: visible !important; background: white !important;
    visibility: visible !important; margin: 0 !important; padding: 0 !important;
  }
  body.joy-isolated-payslip-print #joy-payslip-print-root,
  body.joy-isolated-payslip-print #joy-payslip-print-root * { visibility: visible !important; }
  body.joy-isolated-payslip-print #joy-payslip-print-root > .payslip-sheet {
    display: block !important; position: relative !important; transform: none !important;
    width: 194mm !important; height: 275mm !important; min-height: 275mm !important;
    max-height: 275mm !important; margin: 0 auto !important; padding: 7mm !important;
    box-sizing: border-box !important; overflow: hidden !important; background: white !important;
    break-inside: avoid !important; page-break-inside: avoid !important;
    break-after: page !important; page-break-after: always !important;
  }
  body.joy-isolated-payslip-print #joy-payslip-print-root > .payslip-sheet:last-child {
    break-after: auto !important; page-break-after: auto !important;
  }
}
`;
document.head.appendChild(joyIsolatedPayslipPrintStyle);

function joyPrepareIsolatedPayslipPrintV2() {
  const target = document.body.dataset.printTarget;
  if (target !== "bulk-payslips" && target !== "payslip") return;
  document.getElementById("joy-payslip-print-root")?.remove();
  const root = document.createElement("div");
  root.id = "joy-payslip-print-root";
  const selector = target === "bulk-payslips"
    ? ".bulk-payslip-modal .bulk-payslip-pages .payslip-sheet, .bulk-payslip-modal .bulk-payslip-pages .payslip-half-a4"
    : ".payslip-modal .payslip-sheet";
  const sheets = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const unique = sheets.filter((sheet, index) => !sheets.some((other, otherIndex) => otherIndex < index && other.contains(sheet)));
  unique.forEach((sheet) => {
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.classList.remove("payslip-half-a4");
    clone.classList.add("payslip-sheet");
    clone.style.removeProperty("transform");
    root.appendChild(clone);
  });
  if (!root.children.length) return;
  document.body.appendChild(root);
  document.body.classList.add("joy-isolated-payslip-print");
}
function joyCleanupIsolatedPayslipPrintV2() {
  document.body.classList.remove("joy-isolated-payslip-print");
  document.getElementById("joy-payslip-print-root")?.remove();
}
window.addEventListener("beforeprint", joyPrepareIsolatedPayslipPrintV2);
window.addEventListener("afterprint", joyCleanupIsolatedPayslipPrintV2);
// END_JOY_PAYSLIP_ISOLATED_PRINT_V2

// JOY_UNIFIED_PAYSLIP_OUTPUT_V1
// Preview, individual print/download and bulk print/download all clone the same
// .payslip-sheet DOM. This runtime guard also removes any stale run-level
// "Working days" entry produced by an older cached/generated build.
function joyNormalizePayslipSheetV1(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".payslip-sheet .payslip-attendance-inline span").forEach((node) => {
    const label = (node.querySelector("b")?.textContent ?? "").trim().toLowerCase();
    if (label === "working days") node.remove();
  });
}
const joyPayslipFormatObserverV1 = new MutationObserver(() => joyNormalizePayslipSheetV1());
joyPayslipFormatObserverV1.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", () => window.setTimeout(() => joyNormalizePayslipSheetV1(), 0), true);
window.addEventListener("beforeprint", () => joyNormalizePayslipSheetV1());
joyNormalizePayslipSheetV1();
// END_JOY_UNIFIED_PAYSLIP_OUTPUT_V1
