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

function moneyNumber(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/[^0-9.-]+/g, "");
  return Number(normalized) || 0;
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function setupRoomRecoveryTools() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find((node) => node.textContent?.includes("Net salary") && node.textContent?.includes("final payable"));
  const panel = heading?.closest<HTMLElement>(".panel");
  if (!panel || panel.querySelector(".room-print-toolbar")) return;
  const table = panel.querySelector<HTMLTableElement>("table");
  if (!table) return;
  const headerLabels = Array.from(table.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? "");
  const roomIndex = headerLabels.findIndex((label) => label === "Room");
  if (roomIndex < 0) return;
  const voucherIndex = headerLabels.findIndex((label) => label === "Voucher");
  const gasIndex = headerLabels.findIndex((label) => label === "Gas");
  const rationIndex = headerLabels.findIndex((label) => label === "Ration");
  const provisionIndex = headerLabels.findIndex((label) => label === "Provision");
  const rows = Array.from(table.tBodies[0]?.rows ?? []);
  const rooms = [...new Set(rows.map((row) => row.cells[roomIndex]?.textContent?.trim() || "—").filter(Boolean))];
  if (!rooms.length) return;

  const toolbar = document.createElement("div");
  toolbar.className = "room-print-toolbar";
  const select = document.createElement("select");
  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room;
    select.appendChild(option);
  });
  const one = document.createElement("button"); one.type = "button"; one.className = "secondary-button"; one.textContent = "Selected room · A4 landscape";
  const all = document.createElement("button"); all.type = "button"; all.className = "primary-button"; all.textContent = "All rooms · A4 landscape";
  toolbar.append(select, one, all);
  panel.querySelector(".panel-heading")?.appendChild(toolbar);

  const printRooms = (selectedRooms: string[]) => {
    document.querySelector(".room-recovery-print-layer")?.remove();
    const layer = document.createElement("div");
    layer.className = "room-recovery-print-layer";
    selectedRooms.forEach((roomName) => {
      const sourceRows = rows.filter((row) => (row.cells[roomIndex]?.textContent?.trim() || "—") === roomName);
      const gas = sourceRows.reduce((sum, row) => sum + (gasIndex >= 0 ? moneyNumber(row.cells[gasIndex]?.textContent) : 0), 0);
      const ration = sourceRows.reduce((sum, row) => sum + (rationIndex >= 0 ? moneyNumber(row.cells[rationIndex]?.textContent) : 0), 0);
      const provision = sourceRows.reduce((sum, row) => sum + (provisionIndex >= 0 ? moneyNumber(row.cells[provisionIndex]?.textContent) : 0), 0);
      const shared = gas + ration + provision;

      const sheet = document.createElement("section"); sheet.className = "room-recovery-print-sheet";
      const h1 = document.createElement("h1"); h1.textContent = "FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";
      const h2 = document.createElement("h2"); h2.textContent = `Room: ${roomName}`;
      const summary = document.createElement("div"); summary.className = "room-recovery-summary";
      summary.innerHTML = `<div><span>Gas</span><strong>${formatMoney(gas)}</strong></div><div><span>Ration</span><strong>${formatMoney(ration)}</strong></div><div><span>Provision</span><strong>${formatMoney(provision)}</strong></div><div><span>Roommates</span><strong>${sourceRows.length}</strong></div><div><span>Shared total</span><strong>${formatMoney(shared)}</strong></div>`;
      const clone = table.cloneNode(true) as HTMLTableElement;
      Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {
        const room = row.cells[roomIndex]?.textContent?.trim() || "—";
        if (room !== roomName) row.remove();
        else if (voucherIndex >= 0 && row.cells[voucherIndex]) row.deleteCell(voucherIndex);
      });
      const header = clone.tHead?.rows[0];
      if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);
      sheet.append(h1, h2, summary, clone);
      layer.appendChild(sheet);
    });
    document.body.appendChild(layer);
    const pageStyle = document.createElement("style");
    pageStyle.textContent = "@page{size:A4 landscape;margin:8mm;}";
    document.head.appendChild(pageStyle);
    const cleanup = () => { layer.remove(); pageStyle.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 2500);
  };
  one.onclick = () => printRooms([select.value]);
  all.onclick = () => printRooms(rooms);
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
  setupRoomRecoveryTools();
  improveVoucherButtons();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
addHierarchyGuide();
cleanIdToolbar();
setupRoomRecoveryTools();
improveVoucherButtons();
