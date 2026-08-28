"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ClientUnit, Employee, Vendor } from "./payroll-app";

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function preparePrint() {
  document.body.dataset.printTarget = "id-card";
  const cleanup = () => delete document.body.dataset.printTarget;
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1800);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load an ID-card image."));
    image.src = source;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min = 18) {
  let size = start;
  while (size > min) {
    ctx.font = `700 ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

async function saveJpeg(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.98));
  if (!blob) throw new Error("Unable to create the ID-card JPG.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadFrontJpeg(employee: Employee, vendor: Vendor | undefined, unit: ClientUnit | undefined, qr: string) {
  const width = 638, height = 1011;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create the ID-card JPG.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#145dc7"; ctx.fillRect(0, 0, width, 145);
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  let headerX = 34;
  if (vendor?.logoDataUrl) {
    try {
      const logo = await loadImage(vendor.logoDataUrl);
      ctx.fillStyle = "#fff"; ctx.fillRect(28, 23, 104, 90);
      ctx.drawImage(logo, 35, 30, 90, 76); headerX = 150;
    } catch { headerX = 34; }
  }
  ctx.fillStyle = "#fff"; ctx.textAlign = "left";
  fitText(ctx, companyName, width - headerX - 30, 25, 18);
  wrapText(ctx, companyName, headerX, 58, width - headerX - 30, 28, 2);
  ctx.font = "600 16px Arial, sans-serif"; ctx.fillText("EMPLOYEE IDENTITY CARD", headerX, 120);
  const right = width - 36;
  ctx.textAlign = "right"; ctx.fillStyle = "#13233a"; ctx.font = "700 31px Arial, sans-serif"; ctx.fillText(employee.name.slice(0, 30), right, 205);
  ctx.fillStyle = "#416080"; ctx.font = "600 20px Arial, sans-serif"; ctx.fillText(employee.department.slice(0, 30), right, 238);
  if (employee.photoDataUrl) {
    try { const photo = await loadImage(employee.photoDataUrl); ctx.drawImage(photo, 38, 185, 190, 235); }
    catch { ctx.fillStyle = "#e8f0ff"; ctx.fillRect(38, 185, 190, 235); }
  } else {
    ctx.fillStyle = "#e8f0ff"; ctx.fillRect(38, 185, 190, 235);
    ctx.fillStyle = "#145dc7"; ctx.textAlign = "center"; ctx.font = "700 58px Arial, sans-serif"; ctx.fillText(initials(employee.name), 133, 325);
  }
  const detail = (label: string, value: string, y: number) => {
    ctx.textAlign = "right"; ctx.fillStyle = "#354862"; ctx.font = "700 18px Arial, sans-serif"; ctx.fillText(label, right, y);
    ctx.fillStyle = "#101b2b"; ctx.font = "700 25px Arial, sans-serif"; ctx.fillText(value || "—", right, y + 30);
  };
  detail("Employee ID", employee.employeeCode, 315);
  detail("Client employer", unit ? `${unit.clientName}${unit.unitName ? ` · ${unit.unitName}` : ""}` : "—", 425);
  detail("Blood group", employee.bloodGroup ?? "—", 535);
  if (qr) { const image = await loadImage(qr); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 38, 560, 215, 215); ctx.imageSmoothingEnabled = true; }
  ctx.textAlign = "left"; ctx.fillStyle = "#5f7188"; ctx.font = "600 16px Arial, sans-serif"; ctx.fillText("Scan QR to verify employee ID", 38, 808);
  ctx.strokeStyle = "#d9e2ec"; ctx.beginPath(); ctx.moveTo(32, 850); ctx.lineTo(width - 32, 850); ctx.stroke();
  ctx.fillStyle = "#5b6c82"; ctx.font = "600 15px Arial, sans-serif"; ctx.fillText("JOY GROUPS · Employee identity", 36, 890);
  await saveJpeg(canvas, `ID-${employee.employeeCode}-${employee.name.replace(/[^a-z0-9]+/gi, "-")}-FRONT.jpg`);
}

async function downloadBackJpeg(employee: Employee, vendor: Vendor | undefined) {
  const width = 638, height = 1011;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create the ID-card back JPG.");
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  const corporate = companyName.toLowerCase().includes("corporate");
  const email = corporate ? "info@joycorporatesolutions.com" : "operations@joyindia.in";
  const address = "8/40, 16 Krishna Complex, Thennampalayam, Arasur, Coimbatore - 641407";
  const home = [employee.addressLine, employee.district, employee.stateName, employee.pincode].filter(Boolean).join(", ") || "—";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#b7c5d6"; ctx.lineWidth = 2; ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = "#145dc7"; ctx.fillRect(0, 0, width, 105);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "700 24px Arial, sans-serif"; ctx.fillText("EMERGENCY & ADDRESS DETAILS", width / 2, 64);
  const rows: Array<[string, string]> = [
    ["Emergency contact", employee.emergencyContactNumber ?? "—"],
    ["Date of birth", employee.dateOfBirth ?? "—"],
    ["Address", home],
    ["Father name", employee.fatherName ?? "—"],
    ["Spouse name", employee.spouseName ?? "—"],
    ["Marital status", employee.maritalStatus ?? "—"],
  ];
  let y = 150;
  ctx.textAlign = "left";
  for (const [label, value] of rows) {
    ctx.fillStyle = "#52657d"; ctx.font = "700 16px Arial, sans-serif"; ctx.fillText(label, 38, y);
    ctx.fillStyle = "#172236"; ctx.font = "600 19px Arial, sans-serif";
    wrapText(ctx, value, 38, y + 27, width - 76, 24, label === "Address" ? 3 : 2);
    y += label === "Address" ? 112 : 78;
  }
  ctx.strokeStyle = "#d9e2ec"; ctx.beginPath(); ctx.moveTo(36, 690); ctx.lineTo(width - 36, 690); ctx.stroke();
  ctx.fillStyle = "#172236"; ctx.font = "700 21px Arial, sans-serif"; fitText(ctx, companyName, width - 76, 21, 15); ctx.fillText(companyName, 38, 730);
  ctx.fillStyle = "#536076"; ctx.font = "15px Arial, sans-serif"; wrapText(ctx, address, 38, 765, width - 76, 22, 2);
  wrapText(ctx, `${email} · +91 90807 76580 · www.joyindia.in`, 38, 825, width - 76, 22, 2);
  ctx.fillStyle = "#6a7789"; ctx.font = "italic 14px Arial, sans-serif"; wrapText(ctx, "If found, please return this card to the company address above.", 38, 915, width - 76, 20, 2);
  await saveJpeg(canvas, `ID-${employee.employeeCode}-${employee.name.replace(/[^a-z0-9]+/gi, "-")}-BACK.jpg`);
}

export default function EnhancedEmployeeIdCard({ employee, vendor, unit, onClose }: { employee: Employee; vendor?: Vendor; unit?: ClientUnit; onClose: () => void; }) {
  const [qr, setQr] = useState("");
  const [imageBusy, setImageBusy] = useState<"front" | "back" | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(JSON.stringify({ employeeId: employee.id, employeeCode: employee.employeeCode, name: employee.name, department: employee.department }), { width: 600, margin: 1, errorCorrectionLevel: "H" }).then(setQr);
  }, [employee]);
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  const corporate = companyName.toLowerCase().includes("corporate");
  const companyEmail = corporate ? "info@joycorporatesolutions.com" : "operations@joyindia.in";
  const companyAddress = "8/40, 16 Krishna Complex, Thennampalayam, Arasur, Coimbatore - 641407";
  const homeAddress = [employee.addressLine, employee.district, employee.stateName, employee.pincode].filter(Boolean).join(", ");
  const runDownload = async (side: "front" | "back") => {
    setImageBusy(side);
    try {
      if (side === "front") await downloadFrontJpeg(employee, vendor, unit, qr);
      else await downloadBackJpeg(employee, vendor);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to create JPG");
    } finally { setImageBusy(null); }
  };
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} aria-label="Close ID card" />
      <div className="id-card-modal">
        <div className="modal-toolbar">
          <strong>CR80 portrait employee ID card · 54 × 85.6 mm</strong>
          <div>
            <button className="secondary-button" onClick={preparePrint}>Print front + back</button>
            <button className="secondary-button" disabled={!qr || imageBusy !== null} onClick={() => void runDownload("front")}>{imageBusy === "front" ? "Preparing front…" : "HR Download Front JPEG"}</button>
            <button className="primary-button" disabled={imageBusy !== null} onClick={() => void runDownload("back")}>{imageBusy === "back" ? "Preparing back…" : "HR Download Back JPEG"}</button>
            <button className="icon-button" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="employee-id-card-set">
          <article className="employee-id-card id-card-front">
            <header className="id-card-company">{vendor?.logoDataUrl ? <img src={vendor.logoDataUrl} alt={vendor.name + " logo"} /> : null}<div><b>{companyName}</b><span>EMPLOYEE IDENTITY CARD</span></div></header>
            <div className="id-card-main">
              {employee.photoDataUrl ? <img className="employee-id-photo-image" src={employee.photoDataUrl} alt={employee.name + " photo"} /> : <div className="employee-id-photo">{initials(employee.name)}</div>}
              <div className="id-card-person"><h2>{employee.name}</h2><strong>{employee.department}</strong><dl className="id-card-right-details"><div><dt>Employee ID</dt><dd>{employee.employeeCode}</dd></div><div><dt>Client employer</dt><dd>{unit ? `${unit.clientName}${unit.unitName ? ` · ${unit.unitName}` : ""}` : "—"}</dd></div><div><dt>Blood group</dt><dd>{employee.bloodGroup ?? "—"}</dd></div></dl></div>
              {qr ? <img className="id-card-qr" src={qr} alt={"QR code for " + employee.employeeCode} /> : null}
            </div>
          </article>
          <article className="employee-id-card id-card-back">
            <header>EMERGENCY &amp; ADDRESS DETAILS</header>
            <dl><div><dt>Emergency contact</dt><dd>{employee.emergencyContactNumber ?? "—"}</dd></div><div><dt>Date of birth</dt><dd>{employee.dateOfBirth ?? "—"}</dd></div><div><dt>Address</dt><dd>{homeAddress || "—"}</dd></div><div><dt>Father name</dt><dd>{employee.fatherName ?? "—"}</dd></div><div><dt>Spouse name</dt><dd>{employee.spouseName ?? "—"}</dd></div><div><dt>Marital status</dt><dd>{employee.maritalStatus ?? "—"}</dd></div></dl>
            <section><strong>{companyName}</strong><span>{companyAddress}</span><span>{companyEmail} · +91 90807 76580 · www.joyindia.in</span></section>
            <small>If found, please return this card to the company address above.</small>
          </article>
        </div>
      </div>
    </div>
  );
}
