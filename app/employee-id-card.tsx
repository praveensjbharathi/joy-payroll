"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ClientUnit, Employee, Vendor } from "./payroll-app";

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

async function downloadHighQualityJpeg(
  employee: Employee,
  vendor: Vendor | undefined,
  unit: ClientUnit | undefined,
  qr: string,
) {
  // 54 x 85.6 mm at approximately 300 DPI.
  const width = 638;
  const height = 1011;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create the ID-card JPG.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#145dc7";
  context.fillRect(0, 0, width, 130);

  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  let headerX = 34;
  if (vendor?.logoDataUrl) {
    try {
      const logo = await loadImage(vendor.logoDataUrl);
      context.fillStyle = "#ffffff";
      context.fillRect(28, 23, 104, 84);
      context.drawImage(logo, 35, 30, 90, 70);
      headerX = 150;
    } catch {
      headerX = 34;
    }
  }

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.font = "700 25px Arial, sans-serif";
  context.fillText(companyName.slice(0, 34), headerX, 61);
  context.font = "600 16px Arial, sans-serif";
  context.fillText("EMPLOYEE IDENTITY CARD", headerX, 91);

  const right = width - 36;
  context.textAlign = "right";
  context.fillStyle = "#13233a";
  context.font = "700 33px Arial, sans-serif";
  context.fillText(employee.name.slice(0, 28), right, 185);
  context.fillStyle = "#416080";
  context.font = "600 21px Arial, sans-serif";
  context.fillText(employee.department.slice(0, 30), right, 218);

  if (employee.photoDataUrl) {
    try {
      const photo = await loadImage(employee.photoDataUrl);
      context.drawImage(photo, 38, 178, 190, 235);
    } catch {
      context.fillStyle = "#e8f0ff";
      context.fillRect(38, 178, 190, 235);
    }
  } else {
    context.fillStyle = "#e8f0ff";
    context.fillRect(38, 178, 190, 235);
    context.fillStyle = "#145dc7";
    context.textAlign = "center";
    context.font = "700 58px Arial, sans-serif";
    context.fillText(initials(employee.name), 133, 318);
  }

  const detail = (label: string, value: string, y: number) => {
    context.textAlign = "right";
    context.fillStyle = "#354862";
    context.font = "700 19px Arial, sans-serif";
    context.fillText(label, right, y);
    context.fillStyle = "#101b2b";
    context.font = "700 27px Arial, sans-serif";
    context.fillText(value || "—", right, y + 31);
  };

  detail("Employee ID", employee.employeeCode, 290);
  detail("Client employer", unit?.clientName ?? "—", 403);
  detail("Blood group", employee.bloodGroup ?? "—", 516);

  if (qr) {
    const qrImage = await loadImage(qr);
    context.imageSmoothingEnabled = false;
    context.drawImage(qrImage, 38, 542, 215, 215);
    context.imageSmoothingEnabled = true;
  }
  context.textAlign = "left";
  context.fillStyle = "#5f7188";
  context.font = "600 16px Arial, sans-serif";
  context.fillText("Scan QR to verify employee ID", 38, 788);

  context.strokeStyle = "#d9e2ec";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(32, 835);
  context.lineTo(width - 32, 835);
  context.stroke();
  context.fillStyle = "#5b6c82";
  context.font = "600 15px Arial, sans-serif";
  context.fillText("JOY GROUPS · Employee identity", 36, 874);
  context.font = "14px Arial, sans-serif";
  context.fillText("High-resolution 638 × 1011 px front card", 36, 905);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.98),
  );
  if (!blob) throw new Error("Unable to create the ID-card JPG.");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    "ID-" +
    employee.employeeCode +
    "-" +
    employee.name.replace(/[^a-z0-9]+/gi, "-") +
    ".jpg";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EnhancedEmployeeIdCard({
  employee,
  vendor,
  unit,
  onClose,
}: {
  employee: Employee;
  vendor?: Vendor;
  unit?: ClientUnit;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    void QRCode.toDataURL(
      JSON.stringify({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        department: employee.department,
      }),
      { width: 600, margin: 1, errorCorrectionLevel: "H" },
    ).then(setQr);
  }, [employee]);

  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  const corporate = companyName.toLowerCase().includes("corporate");
  const companyEmail = corporate
    ? "info@joycorporatesolutions.com"
    : "operations@joyindia.in";
  const companyAddress =
    "8/40, 16 Krishna Complex, Thennampalayam, Arasur, Coimbatore - 641407";
  const homeAddress = [
    employee.addressLine,
    employee.district,
    employee.stateName,
    employee.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} aria-label="Close ID card" />
      <div className="id-card-modal">
        <div className="modal-toolbar">
          <strong>CR80 portrait employee ID card · 54 × 85.6 mm</strong>
          <div>
            <button className="secondary-button" onClick={preparePrint}>
              Print front only
            </button>
            <button
              className="primary-button"
              disabled={!qr || imageBusy}
              onClick={() => {
                setImageBusy(true);
                void downloadHighQualityJpeg(employee, vendor, unit, qr)
                  .catch((error) =>
                    window.alert(
                      error instanceof Error ? error.message : "Unable to create JPG",
                    ),
                  )
                  .finally(() => setImageBusy(false));
              }}
            >
              {imageBusy ? "Preparing JPG…" : "Download HQ JPG"}
            </button>
            <button className="icon-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="employee-id-card-set">
          <article className="employee-id-card id-card-front">
            <header className="id-card-company">
              {vendor?.logoDataUrl ? (
                <img src={vendor.logoDataUrl} alt={vendor.name + " logo"} />
              ) : null}
              <div>
                <b>{companyName}</b>
                <span>EMPLOYEE IDENTITY CARD</span>
              </div>
            </header>
            <div className="id-card-main">
              {employee.photoDataUrl ? (
                <img
                  className="employee-id-photo-image"
                  src={employee.photoDataUrl}
                  alt={employee.name + " photo"}
                />
              ) : (
                <div className="employee-id-photo">{initials(employee.name)}</div>
              )}
              <div className="id-card-person">
                <h2>{employee.name}</h2>
                <strong>{employee.department}</strong>
                <dl className="id-card-right-details">
                  <div>
                    <dt>Employee ID</dt>
                    <dd>{employee.employeeCode}</dd>
                  </div>
                  <div>
                    <dt>Client employer</dt>
                    <dd>{unit?.clientName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Blood group</dt>
                    <dd>{employee.bloodGroup ?? "—"}</dd>
                  </div>
                </dl>
              </div>
              {qr ? (
                <img
                  className="id-card-qr"
                  src={qr}
                  alt={"QR code for " + employee.employeeCode}
                />
              ) : null}
            </div>
          </article>

          <article className="employee-id-card id-card-back">
            <header>EMERGENCY &amp; ADDRESS DETAILS</header>
            <dl>
              <div><dt>Emergency contact</dt><dd>{employee.emergencyContactNumber ?? "—"}</dd></div>
              <div><dt>Date of birth</dt><dd>{employee.dateOfBirth ?? "—"}</dd></div>
              <div><dt>Address</dt><dd>{homeAddress || "—"}</dd></div>
              <div><dt>Father name</dt><dd>{employee.fatherName ?? "—"}</dd></div>
              <div><dt>Spouse name</dt><dd>{employee.spouseName ?? "—"}</dd></div>
              <div><dt>Marital status</dt><dd>{employee.maritalStatus ?? "—"}</dd></div>
            </dl>
            <section>
              <strong>{companyName}</strong>
              <span>{companyAddress}</span>
              <span>{companyEmail} · +91 90807 76580 · www.joyindia.in</span>
            </section>
            <small>If found, please return this card to the company address above.</small>
          </article>
        </div>
      </div>
    </div>
  );
}
