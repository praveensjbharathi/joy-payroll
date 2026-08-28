const STYLE_ID = "joy-runtime-enhancements-style";

const runtimeStyles = String.raw`
  .runtime-flow-guide {
    margin: 0 0 18px;
    padding: 16px 18px;
    border: 1px solid #d7e4f6;
    border-radius: 14px;
    background: #f8fbff;
  }
  .runtime-flow-guide strong { display:block; margin-bottom:10px; color:#172236; font-size:14px; }
  .runtime-flow-steps { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .runtime-flow-steps span {
    display:inline-flex; align-items:center; gap:6px; min-height:34px; padding:7px 10px;
    border:1px solid #d8e3f1; border-radius:999px; background:#fff; color:#334a68;
    font-size:12px; font-weight:700;
  }
  .runtime-flow-steps i { color:#7b8aa0; font-style:normal; }
  .runtime-flow-note { margin:10px 0 0; color:#5d6d84; font-size:12px; line-height:1.5; }

  .runtime-payroll-input-guide {
    margin: 0 0 16px; padding:15px 17px; border:1px solid #d9e4f2; border-radius:12px;
    background:#fbfdff; color:#334a68;
  }
  .runtime-payroll-input-guide header { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; }
  .runtime-payroll-input-guide h3 { margin:0; font-size:15px; color:#172236; }
  .runtime-payroll-input-guide p { margin:8px 0 0; font-size:12px; line-height:1.5; color:#607089; }
  .runtime-payroll-input-guide .runtime-formula {
    margin-top:10px; padding:10px 12px; border-radius:9px; background:#f2f7ff; font-size:12px; line-height:1.55;
  }
  .runtime-single-entry-button { min-width:100px !important; width:auto !important; padding:7px 10px !important; font-size:12px !important; }

  .profile-password-panel {
    display:grid !important; grid-template-columns:minmax(0,1fr) !important; gap:14px !important;
    width:100% !important; margin-top:22px !important; padding-top:20px !important;
  }
  .profile-password-panel label { display:grid !important; grid-template-columns:1fr !important; gap:7px !important; width:100% !important; margin:0 !important; }
  .profile-password-panel label > span { width:100% !important; text-align:left !important; font-size:13px !important; font-weight:700 !important; }
  .profile-password-panel input[type="password"] {
    display:block !important; width:100% !important; max-width:none !important; min-width:0 !important;
    height:48px !important; padding:0 13px !important; margin:0 !important; box-sizing:border-box !important;
    border:1px solid #cbd5e1 !important; border-radius:9px !important; background:#fff !important; font-size:14px !important;
  }
  .profile-password-panel > button { width:100% !important; min-height:46px !important; }

  .id-card-front .id-card-company b {
    display:block !important; max-width:39mm !important; white-space:normal !important;
    overflow:visible !important; text-overflow:clip !important; line-height:1.12 !important;
  }
  .id-card-front footer { display:none !important; }
  .employee-id-card-set { display:flex !important; flex-wrap:wrap !important; gap:18px !important; justify-content:center !important; align-items:flex-start !important; }
  .employee-id-card-set .id-card-front, .employee-id-card-set .id-card-back { display:flex !important; }
  .id-runtime-download { white-space:nowrap; }

  .runtime-room-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
  .runtime-room-toolbar select { min-width:180px; min-height:38px; }
  .room-recovery-print-layer {
    position:fixed; inset:0; z-index:99999; overflow:auto; background:#eef2f7; padding:18px;
  }
  .room-recovery-screen-toolbar {
    position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center;
    gap:10px; margin:0 auto 14px; max-width:1180px; padding:10px 12px; border-radius:10px; background:#fff;
    box-shadow:0 4px 18px rgba(30,45,70,.12);
  }
  .room-recovery-print-sheet {
    width:297mm; min-height:210mm; margin:0 auto 14px; padding:9mm; box-sizing:border-box;
    background:#fff; color:#111827; page:roomRecovery;
  }
  .room-recovery-print-sheet header { display:flex; justify-content:space-between; gap:18px; border-bottom:2px solid #243b5a; padding-bottom:7mm; margin-bottom:5mm; }
  .room-recovery-print-sheet h1 { margin:0; font-size:19pt; }
  .room-recovery-print-sheet h2 { margin:2mm 0 0; font-size:13pt; }
  .room-recovery-print-sheet .runtime-sheet-meta { text-align:right; font-size:10pt; line-height:1.45; }
  .room-recovery-print-sheet table { width:100%; border-collapse:collapse; font-size:9.5pt; }
  .room-recovery-print-sheet th, .room-recovery-print-sheet td { border:1px solid #7b8797; padding:5px 6px; text-align:right; vertical-align:top; }
  .room-recovery-print-sheet th:first-child, .room-recovery-print-sheet td:first-child { text-align:left; }
  .room-recovery-print-sheet tfoot td { font-weight:800; background:#f3f6fa; }
  .room-recovery-print-sheet footer { display:flex; justify-content:space-between; gap:30px; margin-top:16mm; font-size:10pt; }

  @page voucherPage { size:210mm 297mm; margin:0; }
  @page roomRecovery { size:297mm 210mm; margin:0; }
  @media print {
    body.runtime-room-print #root { display:none !important; }
    body.runtime-room-print .room-recovery-print-layer { position:static !important; inset:auto !important; padding:0 !important; background:#fff !important; overflow:visible !important; }
    body.runtime-room-print .room-recovery-screen-toolbar { display:none !important; }
    .room-recovery-print-sheet { width:297mm !important; height:210mm !important; min-height:210mm !important; margin:0 !important; padding:9mm !important; break-after:page !important; page-break-after:always !important; box-sizing:border-box !important; }
    .room-recovery-print-sheet:last-child { break-after:auto !important; page-break-after:auto !important; }

    .advance-voucher, .bulk-recovery-vouchers .advance-voucher {
      page:voucherPage; width:210mm !important; height:297mm !important; min-height:297mm !important;
      margin:0 !important; padding:12mm !important; box-sizing:border-box !important; font-size:12pt !important;
      break-after:page !important; page-break-after:always !important;
    }
    .bulk-recovery-vouchers .advance-voucher:last-child { break-after:auto !important; page-break-after:auto !important; }
    .advance-voucher h2 { font-size:19pt !important; }
    .advance-voucher h3 { font-size:14pt !important; }
  }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = runtimeStyles;
  document.head.appendChild(style);
}

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").trim();
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "employee";
}

async function inlineImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) return;
    try {
      const response = await fetch(src, { mode: "cors", credentials: "omit" });
      if (!response.ok) return;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      img.setAttribute("src", dataUrl);
    } catch {
      // Keep the original image if the remote endpoint does not allow CORS.
    }
  }));
}

function copyComputedStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source);
  const style = (target as HTMLElement).style;
  for (const property of Array.from(computed)) {
    try { style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property)); } catch { /* ignore unsupported style */ }
  }
  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    if (targetChildren[index]) copyComputedStyles(child, targetChildren[index]);
  });
}

async function downloadCardJpeg(card: HTMLElement, side: "front" | "back") {
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const clone = card.cloneNode(true) as HTMLElement;
  copyComputedStyles(card, clone);
  await inlineImages(clone);
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  const outputWidth = 1050;
  const outputHeight = 1665;
  const scale = Math.min(outputWidth / rect.width, outputHeight / rect.height);
  const offsetX = (outputWidth - rect.width * scale) / 2;
  const offsetY = (outputHeight - rect.height * scale) / 2;
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}"><rect width="100%" height="100%" fill="white"/><foreignObject x="${offsetX}" y="${offsetY}" width="${rect.width * scale}" height="${rect.height * scale}"><div xmlns="http://www.w3.org/1999/xhtml" style="transform-origin:0 0;transform:scale(${scale});width:${rect.width}px;height:${rect.height}px;">${serialized}</div></foreignObject></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to render ID card"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(image, 0, 0, outputWidth, outputHeight);
    const employeeCode = text(card.querySelector(".id-card-person dd")) || text(card.querySelector("h2")) || "employee";
    canvas.toBlob((jpeg) => {
      if (!jpeg) return;
      const jpegUrl = URL.createObjectURL(jpeg);
      const link = document.createElement("a");
      link.href = jpegUrl;
      link.download = `joy-id-${safeFilePart(employeeCode)}-${side}.jpg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(jpegUrl), 1000);
    }, "image/jpeg", 0.98);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function enhanceIdCards() {
  document.querySelectorAll<HTMLElement>(".id-card-modal").forEach((modal) => {
    if (modal.dataset.runtimeIdEnhanced === "1") return;
    const toolbar = modal.querySelector<HTMLElement>(".modal-toolbar > div:last-child, .modal-toolbar");
    const front = modal.querySelector<HTMLElement>(".employee-id-card-set .id-card-front, .id-card-front.employee-id-card, .id-card-front");
    const back = modal.querySelector<HTMLElement>(".employee-id-card-set .id-card-back, .id-card-back.employee-id-card, .id-card-back");
    if (!toolbar || !front) return;
    modal.dataset.runtimeIdEnhanced = "1";

    const frontButton = document.createElement("button");
    frontButton.type = "button";
    frontButton.className = "secondary-button id-runtime-download";
    frontButton.textContent = "Download front JPG";
    frontButton.addEventListener("click", () => void downloadCardJpeg(front, "front"));
    toolbar.prepend(frontButton);

    if (back) {
      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = "primary-button id-runtime-download";
      backButton.textContent = "Download back JPG";
      backButton.addEventListener("click", () => void downloadCardJpeg(back, "back"));
      frontButton.insertAdjacentElement("afterend", backButton);
    }
  });
}

function enhanceHostelHierarchy() {
  const stepOne = Array.from(document.querySelectorAll<HTMLElement>(".panel .eyebrow")).find((node) => text(node).toLowerCase().includes("step 1") && text(node).toLowerCase().includes("accommodation"));
  const firstPanel = stepOne?.closest<HTMLElement>(".panel");
  if (firstPanel && !document.querySelector(".runtime-flow-guide")) {
    const guide = document.createElement("section");
    guide.className = "runtime-flow-guide";
    guide.innerHTML = `<strong>Accommodation / Hostel / Room hierarchy</strong><div class="runtime-flow-steps"><span>1. Group company</span><i>→</i><span>2. Accommodation type</span><i>→</i><span>3. Hostel / Outside area</span><i>→</i><span>4. Client employer mapping</span><i>→</i><span>5. Room</span><i>→</i><span>6. Employee allocation</span><i>→</i><span>7. Monthly room recoveries</span></div><p class="runtime-flow-note">Only employees belonging to the client-employer units mapped to the selected hostel/area are shown for room allocation. Select the hostel first, then create/map rooms, then allocate employees.</p>`;
    firstPanel.parentElement?.insertBefore(guide, firstPanel);
  }

  document.querySelectorAll<HTMLElement>(".hostel-selected-record").forEach((record) => {
    const heading = record.querySelector("h2");
    const form = record.querySelector<HTMLFormElement>("form");
    if (!heading || !form) return;
    const currentName = text(heading);
    if (record.dataset.runtimeSelectedName !== currentName) {
      record.dataset.runtimeSelectedName = currentName;
      requestAnimationFrame(() => form.reset());
    }
  });
}

function currency(value: string) {
  const number = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

type RoomRow = {
  employee: string;
  room: string;
  before: number;
  individual: number;
  shared: number;
  returned: number;
  final: number;
};

function recoveryRows(): RoomRow[] {
  const section = Array.from(document.querySelectorAll<HTMLElement>("section.panel")).find((panel) => text(panel.querySelector("h2")).includes("Net salary") && text(panel.querySelector("h2")).includes("final payable"));
  if (!section) return [];
  return Array.from(section.querySelectorAll<HTMLTableRowElement>("tbody tr")).flatMap((row) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));
    if (cells.length < 8) return [];
    const actionText = text(cells[7]).toLowerCase();
    const finalized = actionText.includes("generate voucher") || actionText.includes("reopen");
    if (!finalized) return [];
    return [{
      employee: text(cells[0]).replace(/\s+/g, " "),
      room: text(cells[1]) || "Unallocated",
      before: currency(text(cells[2])),
      individual: currency(text(cells[3])),
      shared: currency(text(cells[4])),
      returned: currency(text(cells[5])),
      final: currency(text(cells[6])),
    }];
  });
}

function openRoomRecoveryPrint(selectedRoom?: string) {
  const rows = recoveryRows();
  const grouped = new Map<string, RoomRow[]>();
  rows.forEach((row) => {
    if (selectedRoom && row.room !== selectedRoom) return;
    const list = grouped.get(row.room) ?? [];
    list.push(row);
    grouped.set(row.room, list);
  });
  if (!grouped.size) {
    window.alert("No finalized recovery employees are available for the selected room.");
    return;
  }
  document.querySelector(".room-recovery-print-layer")?.remove();
  const layer = document.createElement("div");
  layer.className = "room-recovery-print-layer";
  const payrollPeriod = text(document.querySelector(".period-selector select option:checked")) || text(document.querySelector(".period-selector")) || "Current payroll cycle";
  const groupCompany = (document.querySelector(".topbar-selectors label:first-child select") as HTMLSelectElement | null)?.selectedOptions?.[0]?.textContent?.trim() || "JOY GROUPS";
  const clientEmployer = (document.querySelector(".topbar-selectors label:nth-of-type(2) select") as HTMLSelectElement | null)?.selectedOptions?.[0]?.textContent?.trim() || "Client employer";

  const toolbar = document.createElement("div");
  toolbar.className = "room-recovery-screen-toolbar";
  toolbar.innerHTML = `<strong>Finalized room-wise salary recovery statement</strong><div><button type="button" class="primary-button runtime-print-now">Print / Save PDF</button> <button type="button" class="secondary-button runtime-close-room-print">Close</button></div>`;
  layer.appendChild(toolbar);

  grouped.forEach((roomRows, roomName) => {
    const totals = roomRows.reduce((sum, row) => ({
      before: sum.before + row.before,
      individual: sum.individual + row.individual,
      shared: sum.shared + row.shared,
      returned: sum.returned + row.returned,
      final: sum.final + row.final,
    }), { before:0, individual:0, shared:0, returned:0, final:0 });
    const sheet = document.createElement("section");
    sheet.className = "room-recovery-print-sheet";
    sheet.innerHTML = `<header><div><h1>${groupCompany}</h1><h2>FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT</h2><div>${clientEmployer}</div></div><div class="runtime-sheet-meta"><strong>Room: ${roomName}</strong><br/>Payroll cycle: ${payrollPeriod}<br/>Employees: ${roomRows.length}<br/>A4 Landscape · 297 × 210 mm</div></header><table><thead><tr><th>Employee</th><th>Net before recovery</th><th>Individual recovery</th><th>Gas / Ration / Provision</th><th>Return</th><th>Final payable</th></tr></thead><tbody>${roomRows.map((row) => `<tr><td>${row.employee}</td><td>${money(row.before)}</td><td>${money(row.individual)}</td><td>${money(row.shared)}</td><td>${money(row.returned)}</td><td><strong>${money(row.final)}</strong></td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td>${money(totals.before)}</td><td>${money(totals.individual)}</td><td>${money(totals.shared)}</td><td>${money(totals.returned)}</td><td>${money(totals.final)}</td></tr></tfoot></table><footer><span>Prepared by: ____________________</span><span>Verified by: ____________________</span><span>Authorized by: ____________________</span></footer>`;
    layer.appendChild(sheet);
  });
  document.body.appendChild(layer);
  toolbar.querySelector(".runtime-close-room-print")?.addEventListener("click", () => layer.remove());
  toolbar.querySelector(".runtime-print-now")?.addEventListener("click", () => {
    document.body.classList.add("runtime-room-print");
    const cleanup = () => document.body.classList.remove("runtime-room-print");
    window.addEventListener("afterprint", cleanup, { once:true });
    window.print();
    setTimeout(cleanup, 1500);
  });
}

function enhanceRecoveryCenter() {
  const section = Array.from(document.querySelectorAll<HTMLElement>("section.panel")).find((panel) => text(panel.querySelector("h2")).includes("Net salary") && text(panel.querySelector("h2")).includes("final payable"));
  if (section && !section.querySelector(".runtime-room-toolbar")) {
    const rows = recoveryRows();
    const rooms = Array.from(new Set(rows.map((row) => row.room))).sort();
    const toolbar = document.createElement("div");
    toolbar.className = "runtime-room-toolbar";
    const select = document.createElement("select");
    rooms.forEach((room) => {
      const option = document.createElement("option");
      option.value = room; option.textContent = room; select.appendChild(option);
    });
    const selectedButton = document.createElement("button");
    selectedButton.type = "button"; selectedButton.className = "secondary-button"; selectedButton.textContent = "Selected room · A4 landscape";
    selectedButton.addEventListener("click", () => openRoomRecoveryPrint(select.value));
    const bulkButton = document.createElement("button");
    bulkButton.type = "button"; bulkButton.className = "primary-button"; bulkButton.textContent = "All rooms · A4 landscape";
    bulkButton.addEventListener("click", () => openRoomRecoveryPrint());
    toolbar.append(select, selectedButton, bulkButton);
    section.querySelector(".panel-heading")?.appendChild(toolbar);
  }

  document.querySelectorAll<HTMLButtonElement>(".advance-voucher-layer .modal-toolbar button").forEach((button) => {
    if (text(button).toLowerCase().includes("print")) button.textContent = "Print / Save A4 PDF";
  });
}

function enhancePayrollInput() {
  const payrollTable = document.querySelector<HTMLElement>(".payroll-table");
  if (!payrollTable) return;
  const panel = payrollTable.closest<HTMLElement>("section.panel");
  if (panel && !panel.parentElement?.querySelector(".runtime-payroll-input-guide")) {
    const guide = document.createElement("section");
    guide.className = "runtime-payroll-input-guide";
    guide.innerHTML = `<header><h3>Payroll final-payment input</h3><span>Single entry + Bulk upload use the same payroll run</span></header><p><strong>Bulk upload:</strong> use the top <em>Bulk upload payroll / Excel</em> button for your 41-column Salary Register. <strong>Single entry:</strong> use the employee row’s <em>Open / Single entry</em> button and edit that employee’s salary.</p><div class="runtime-formula"><strong>Attached Salary Register calculation:</strong> Gross Earnings = Basic + DA + HRA + CA + Food Allowance + Night Allowance + OT Wages + Attendance Bonus + Arrears + Holiday Wages + Production Incentive + Medical Allowance. Total Deductions = PF + ESI + Professional Tax + LWF + Canteen + Snacks + Tent + Advance + Others + TDS + Medical Insurance. Net Payable = Gross Earnings − Total Deductions. Client-employer customized payslip fields remain controlled by the employer-unit payslip settings.</div>`;
    panel.parentElement?.insertBefore(guide, panel);
  }
  document.querySelectorAll<HTMLButtonElement>(".payroll-table .row-action").forEach((button) => {
    if (button.dataset.runtimeSingleEntry === "1") return;
    button.dataset.runtimeSingleEntry = "1";
    button.classList.add("runtime-single-entry-button");
    button.textContent = "Open / Single entry";
  });
}

function enhanceBulkImportLabel() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const label = text(button).toLowerCase();
    if (label === "import excel") button.textContent = "Bulk upload payroll / Excel";
  });
}

function runEnhancements() {
  ensureStyles();
  enhanceIdCards();
  enhanceHostelHierarchy();
  enhanceRecoveryCenter();
  enhancePayrollInput();
  enhanceBulkImportLabel();
}

let queued = false;
function queueEnhancements() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    runEnhancements();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", queueEnhancements, { once:true });
else queueEnhancements();

const observer = new MutationObserver(queueEnhancements);
observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true });

window.addEventListener("afterprint", () => document.body.classList.remove("runtime-room-print"));
