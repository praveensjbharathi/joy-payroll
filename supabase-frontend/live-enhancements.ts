export {};

// Runtime enhancements used by the self-hosted Cloudflare frontend.
// Keep critical production-only presentation fixes here so they apply to the
// shared React application, not only the Next.js shell.

const style = document.createElement("style");
style.dataset.joyLiveEnhancements = "true";
style.textContent = `
.profile-password-panel{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important;width:100%!important;margin-top:24px!important;padding-top:22px!important;border-top:1px solid #e6ebf2!important}
.profile-password-panel h3{margin:0!important;font-size:17px!important}.profile-password-panel label{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:7px!important;width:100%!important;margin:0!important}.profile-password-panel label>span{display:block!important;width:100%!important;font-size:13px!important;font-weight:700!important;text-align:left!important}.profile-password-panel input[type=password]{display:block!important;visibility:visible!important;opacity:1!important;position:static!important;width:100%!important;max-width:none!important;min-height:48px!important;height:48px!important;box-sizing:border-box!important;padding:0 13px!important;margin:0!important;border:1px solid #cbd5e1!important;border-radius:9px!important;background:#fff!important;color:#172236!important;font-size:14px!important}.profile-password-panel>button{width:100%!important;min-height:46px!important}
.employee-id-card-set{display:flex!important;flex-wrap:wrap!important;gap:18px!important;align-items:flex-start!important;justify-content:center!important}.employee-id-card-set .id-card-front,.employee-id-card-set .id-card-back{display:flex!important}.id-card-front .id-card-company b{display:block!important;max-width:39mm!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;font-size:3.1mm!important;line-height:1.12!important}.id-card-front footer{display:none!important}
.hostel-hierarchy-guide{margin:0 0 18px!important;padding:16px 18px!important;border:1px solid #d8e5f7!important;border-radius:12px!important;background:#f8fbff!important}.hostel-hierarchy-guide strong{display:block;margin-bottom:10px;color:#172236}.hostel-hierarchy-guide ol{margin:0;padding-left:20px;display:grid;gap:6px;color:#455872}.room-print-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.room-print-toolbar select{min-width:190px}
@media print{
  body *{visibility:hidden!important}
  .advance-voucher-layer,.advance-voucher-layer *,.room-recovery-print-layer,.room-recovery-print-layer *{visibility:visible!important}
  .advance-voucher-layer,.room-recovery-print-layer{position:absolute!important;inset:0!important;width:100%!important;background:#fff!important;padding:0!important;overflow:visible!important}
  .advance-voucher-layer .modal-scrim,.advance-voucher-layer .modal-toolbar,.room-recovery-print-layer .modal-toolbar{display:none!important}
  .advance-voucher-layer .room-report-modal{position:static!important;inset:auto!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;overflow:visible!important;background:#fff!important;box-shadow:none!important}
  .bulk-recovery-vouchers{display:block!important}
  .advance-voucher,.bulk-recovery-vouchers .advance-voucher{width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:12mm!important;box-sizing:border-box!important;font-size:12pt!important;break-after:page!important;page-break-after:always!important;overflow:visible!important}
  .bulk-recovery-vouchers .advance-voucher:last-child,.advance-voucher:last-child{break-after:auto!important;page-break-after:auto!important}.advance-voucher h2{font-size:20pt!important}.advance-voucher h3{font-size:15pt!important}
  .room-recovery-print-sheet{width:281mm!important;min-height:194mm!important;margin:0 auto!important;padding:7mm!important;box-sizing:border-box!important;break-after:page!important;page-break-after:always!important}.room-recovery-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}.room-recovery-print-sheet table{width:100%!important;border-collapse:collapse!important;font-size:9.5pt!important}.room-recovery-print-sheet th,.room-recovery-print-sheet td{border:1px solid #77869a!important;padding:5px 6px!important}.room-recovery-print-sheet h1{font-size:17pt!important;margin:0 0 4px!important}.room-recovery-print-sheet h2{font-size:13pt!important;margin:0 0 10px!important}
}
`;
document.head.appendChild(style);

function addHierarchyGuide() {
  document.querySelectorAll<HTMLElement>(".section-stack").forEach((stack) => {
    if (!stack.querySelector(".hostel-selected-record") || stack.querySelector(".hostel-hierarchy-guide")) return;
    const guide = document.createElement("section");
    guide.className = "hostel-hierarchy-guide";
    guide.innerHTML = `<strong>Accommodation → Hostel / Local Area → Client Employer → Room → Employee</strong><ol><li>Select the Accommodation Type.</li><li>Select or create the Hostel / Local Area.</li><li>Map it to the required Client Employer unit(s).</li><li>Create rooms only under that selected hostel.</li><li>Allocate only mapped employees who are still room-unallocated.</li></ol>`;
    stack.prepend(guide);
  });
}

let lastHostel = "";
function refreshHostelEditForm() {
  const record = document.querySelector<HTMLElement>(".hostel-selected-record");
  if (!record) { lastHostel = ""; return; }
  const name = record.querySelector("h2")?.textContent?.trim() ?? "";
  if (!name || name === lastHostel) return;
  lastHostel = name;
  const form = record.querySelector<HTMLFormElement>("form");
  window.setTimeout(() => form?.reset(), 0);
}

function setupRoomRecoveryTools() {
  const headings = Array.from(document.querySelectorAll<HTMLElement>("h2"));
  const heading = headings.find((node) => node.textContent?.includes("Net salary") && node.textContent?.includes("final payable"));
  const panel = heading?.closest<HTMLElement>(".panel");
  if (!panel || panel.querySelector(".room-print-toolbar")) return;
  const table = panel.querySelector<HTMLTableElement>("table");
  if (!table) return;
  const rows = Array.from(table.tBodies[0]?.rows ?? []);
  const rooms = [...new Set(rows.map((row) => row.cells[1]?.textContent?.trim() || "—").filter(Boolean))];
  if (!rooms.length) return;
  const toolbar = document.createElement("div"); toolbar.className = "room-print-toolbar";
  const select = document.createElement("select"); rooms.forEach((room) => { const option = document.createElement("option"); option.value = room; option.textContent = room; select.appendChild(option); });
  const one = document.createElement("button"); one.type = "button"; one.className = "secondary-button"; one.textContent = "Selected room · Print / Save PDF";
  const all = document.createElement("button"); all.type = "button"; all.className = "primary-button"; all.textContent = "All rooms · Print / Save PDF";
  toolbar.append(select, one, all); panel.querySelector(".panel-heading")?.appendChild(toolbar);

  const printRooms = (selectedRooms: string[]) => {
    document.querySelector(".room-recovery-print-layer")?.remove();
    const layer = document.createElement("div"); layer.className = "room-recovery-print-layer";
    const title = document.createElement("div"); title.className = "modal-toolbar"; title.innerHTML = `<strong>Finalized room-wise salary recovery statement</strong><span>A4 landscape · 297 × 210 mm · one room per page</span>`; layer.appendChild(title);
    selectedRooms.forEach((roomName) => {
      const sheet = document.createElement("section"); sheet.className = "room-recovery-print-sheet";
      const h1 = document.createElement("h1"); h1.textContent = "FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";
      const h2 = document.createElement("h2"); h2.textContent = `Room: ${roomName}`;
      const clone = table.cloneNode(true) as HTMLTableElement;
      Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => { const room = row.cells[1]?.textContent?.trim() || "—"; if (room !== roomName) row.remove(); else if (row.cells.length) row.deleteCell(row.cells.length - 1); });
      const header = clone.tHead?.rows[0]; if (header?.cells.length) header.deleteCell(header.cells.length - 1);
      sheet.append(h1, h2, clone); layer.appendChild(sheet);
    });
    document.body.appendChild(layer);
    const pageStyle = document.createElement("style"); pageStyle.dataset.roomPrint = "true"; pageStyle.textContent = "@page{size:A4 landscape;margin:8mm;}"; document.head.appendChild(pageStyle);
    const cleanup = () => { layer.remove(); pageStyle.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup); window.print(); window.setTimeout(cleanup, 2500);
  };
  one.onclick = () => printRooms([select.value]); all.onclick = () => printRooms(rooms);
}

function improveVoucherButtons() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    if (button.textContent?.trim() === "Download all finalized vouchers") button.textContent = "Bulk A4 vouchers · Print / Save PDF";
    if (button.textContent?.trim() === "Print / Save bulk PDF") button.textContent = "Bulk A4 · Print / Save PDF";
  });
}

const observer = new MutationObserver(() => {
  addHierarchyGuide(); refreshHostelEditForm(); setupRoomRecoveryTools(); improveVoucherButtons();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
addHierarchyGuide(); refreshHostelEditForm(); setupRoomRecoveryTools(); improveVoucherButtons();
