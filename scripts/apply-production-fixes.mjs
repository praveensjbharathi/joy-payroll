import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const fullPath = join(root, path);
  const source = await readFile(fullPath, "utf8");
  const updated = transform(source);
  if (updated !== source) await writeFile(fullPath, updated, "utf8");
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    throw new Error(`Unable to apply ${label}: expected source block was not found.`);
  }
  return source.replace(search, replacement);
}

const employerSalaryParser = String.raw`
function salarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {
  const normalizeHeader = (value: CellValue | undefined) =>
    text(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const headerIndex = rows.findIndex((row) => {
    const values = Array.from(row.values()).map(normalizeHeader);
    return values.includes("emp id") && values.includes("name");
  });
  if (headerIndex < 0)
    throw new Error("Salary Register sheet needs Emp ID and Name columns.");

  const headers = rows[headerIndex];
  const headerMap = new Map<string, number>();
  for (const [column, value] of headers) {
    const normalized = normalizeHeader(value);
    if (normalized && !headerMap.has(normalized)) headerMap.set(normalized, column);
  }
  const column = (...aliases: string[]) =>
    aliases.map((alias) => headerMap.get(normalizeHeader(alias))).find((value) => value !== undefined);

  const isEmployerPayrollFormat = [
    "pay monthly daily",
    "fixed w days",
    "w days",
    "payable days",
    "gross earnings",
    "total deductions",
    "net payable",
  ].every((header) => headerMap.has(header));
  if (!isEmployerPayrollFormat) return legacySalarySheet(name, rows, period);

  const codeColumn = column("Emp ID")!;
  const nameColumn = column("Name")!;
  const salaryBasisColumn = column("Pay Monthly/Daily");
  const fixedWorkingDaysColumn = column("Fixed W Days");
  const workedDaysColumn = column("W Days");
  const nfhColumn = column("NFH");
  const compOffColumn = column("CO");
  const onDutyColumn = column("OD");
  const sundayColumn = column("Sundays");
  const plColumn = column("PL");
  const clColumn = column("CL");
  const slColumn = column("SL");
  const payableDaysColumn = column("Payable Days");
  const overtimeHoursColumn = column("OT Hrs");
  const grossColumn = column("Gross Earnings");
  const totalDeductionColumn = column("Total Deductions");
  const netColumn = column("Net Payable");

  const monetaryColumns: Array<[number | undefined, string]> = [
    [column("Basic"), "basic"],
    [column("DA"), "da"],
    [column("HRA"), "hra"],
    [column("CA"), "conveyance"],
    [column("Food Allowance"), "foodAllowance"],
    [column("Night Allowance"), "nightAllowance"],
    [column("OT Wages"), "overtimeWages"],
    [column("Attendance Bonus"), "attendanceBonus"],
    [column("Arrears"), "arrears"],
    [column("Holiday Wages"), "holidayWages"],
    [column("Production Incentive"), "productionIncentive"],
    [column("Medical Allowance"), "medicalAllowance"],
    [column("PF Deductions", "PF Deduction"), "pfDeduction"],
    [column("ESI Deductions", "ESI Deduction"), "esiDeduction"],
    [column("Professional Tax"), "professionalTax"],
    [column("LWF"), "lwf"],
    [column("Canteen"), "canteen"],
    [column("Snacks"), "snacks"],
    [column("Tent"), "tent"],
    [column("Advance"), "advance"],
    [column("Others", "Other Deduction"), "otherDeduction"],
    [column("TDS"), "tds"],
    [column("Medical insurance", "Medical Insurance"), "medicalInsurance"],
  ];

  const imported: WorkbookImport = {
    sourceType: "salary",
    sheetName: name,
    employees: [],
    attendance: [],
    salaryItems: [],
  };

  for (const row of rows.slice(headerIndex + 1)) {
    const code = text(row.get(codeColumn));
    const employeeName = text(row.get(nameColumn));
    if (!code || !employeeName) continue;

    const employee = emptyEmployee(code, employeeName, period);
    const salaryBasisText = salaryBasisColumn === undefined ? "" : text(row.get(salaryBasisColumn));
    employee.salaryBasis = /daily|day/i.test(salaryBasisText) ? "daily" : "monthly";
    const basicColumn = column("Basic");
    employee.salaryAmount = basicColumn === undefined ? 0 : numberValue(row.get(basicColumn));
    imported.employees.push(employee);

    const co = compOffColumn === undefined ? 0 : numberValue(row.get(compOffColumn));
    const pl = plColumn === undefined ? 0 : numberValue(row.get(plColumn));
    const cl = clColumn === undefined ? 0 : numberValue(row.get(clColumn));
    const sl = slColumn === undefined ? 0 : numberValue(row.get(slColumn));
    const item: ImportedSalaryItem = {
      employeeCode: code,
      fixedWorkingDays: fixedWorkingDaysColumn === undefined ? 0 : numberValue(row.get(fixedWorkingDaysColumn)),
      presentDays: workedDaysColumn === undefined ? 0 : numberValue(row.get(workedDaysColumn)),
      holidayPresentDays: nfhColumn === undefined ? 0 : numberValue(row.get(nfhColumn)),
      compOffDays: co,
      onDutyDays: onDutyColumn === undefined ? 0 : numberValue(row.get(onDutyColumn)),
      weekOffDays: sundayColumn === undefined ? 0 : numberValue(row.get(sundayColumn)),
      plDays: pl,
      clDays: cl,
      slDays: sl,
      leaveDays: co + pl + cl + sl,
      payableDays: payableDaysColumn === undefined ? 0 : numberValue(row.get(payableDaysColumn)),
      overtimeHours: overtimeHoursColumn === undefined ? 0 : numberValue(row.get(overtimeHoursColumn)),
      sourceGrossEarnings: grossColumn === undefined ? 0 : numberValue(row.get(grossColumn)),
      sourceTotalDeductions: totalDeductionColumn === undefined ? 0 : numberValue(row.get(totalDeductionColumn)),
      sourceNetPayable: netColumn === undefined ? 0 : numberValue(row.get(netColumn)),
    };
    for (const [mappedColumn, field] of monetaryColumns) {
      item[field] = mappedColumn === undefined ? 0 : numberValue(row.get(mappedColumn));
    }
    imported.salaryItems.push(item);
  }
  return imported;
}
`;

const idCardReplacement = String.raw`
function preparePrint(target: string) {
  document.body.dataset.printTarget = target;
  const cleanup = () => delete document.body.dataset.printTarget;
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1800);
}

function loadCardImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load ID-card image."));
    image.src = source;
  });
}

async function downloadIdCardJpeg(
  employee: Employee,
  vendor: Vendor | undefined,
  unit: ClientUnit | undefined,
  qr: string,
) {
  const width = 638;
  const height = 1011;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create the ID-card image.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#145dc7";
  context.fillRect(0, 0, width, 130);

  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  let headerX = 34;
  if (vendor?.logoDataUrl) {
    try {
      const logo = await loadCardImage(vendor.logoDataUrl);
      context.fillStyle = "#ffffff";
      context.fillRect(30, 25, 100, 80);
      context.drawImage(logo, 36, 31, 88, 68);
      headerX = 150;
    } catch {
      headerX = 34;
    }
  }
  context.fillStyle = "#ffffff";
  context.font = "700 25px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(companyName.slice(0, 34), headerX, 62);
  context.font = "600 16px Arial, sans-serif";
  context.fillText("EMPLOYEE IDENTITY CARD", headerX, 91);

  const right = width - 36;
  context.textAlign = "right";
  context.fillStyle = "#13233a";
  context.font = "700 33px Arial, sans-serif";
  context.fillText(employee.name.slice(0, 28), right, 190);
  context.fillStyle = "#416080";
  context.font = "600 21px Arial, sans-serif";
  context.fillText(employee.department.slice(0, 30), right, 222);

  if (employee.photoDataUrl) {
    try {
      const photo = await loadCardImage(employee.photoDataUrl);
      context.drawImage(photo, 38, 180, 190, 235);
    } catch {
      context.fillStyle = "#e8f0ff";
      context.fillRect(38, 180, 190, 235);
    }
  } else {
    context.fillStyle = "#e8f0ff";
    context.fillRect(38, 180, 190, 235);
    context.fillStyle = "#145dc7";
    context.font = "700 58px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(initials(employee.name), 133, 320);
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
  detail("Employee ID", employee.employeeCode, 292);
  detail("Client employer", unit?.clientName ?? "—", 405);
  detail("Blood group", employee.bloodGroup ?? "—", 518);

  if (qr) {
    const qrImage = await loadCardImage(qr);
    context.imageSmoothingEnabled = false;
    context.drawImage(qrImage, 38, 545, 210, 210);
    context.imageSmoothingEnabled = true;
  }
  context.textAlign = "left";
  context.fillStyle = "#5f7188";
  context.font = "600 16px Arial, sans-serif";
  context.fillText("Scan QR to verify employee ID", 38, 785);

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
  anchor.download = `ID-${employee.employeeCode}-${employee.name.replace(/[^a-z0-9]+/gi, "-")}.jpg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EmployeeIdCard({
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
  const corporate = (vendor?.legalName ?? vendor?.name ?? "")
    .toLowerCase()
    .includes("corporate");
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
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
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="Close ID card"
      />
      <div className="id-card-modal">
        <div className="modal-toolbar">
          <strong>CR80 portrait employee ID card · 54 × 85.6 mm</strong>
          <div>
            <button className="secondary-button" onClick={() => preparePrint("id-card")}>
              Print front only
            </button>
            <button
              className="primary-button"
              disabled={!qr || imageBusy}
              onClick={() => {
                setImageBusy(true);
                void downloadIdCardJpeg(employee, vendor, unit, qr)
                  .catch((error) => window.alert(error instanceof Error ? error.message : "Unable to create JPG"))
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
              {vendor?.logoDataUrl ? <img src={vendor.logoDataUrl} alt={`${vendor.name} logo`} /> : null}
              <div>
                <b>{companyName}</b>
                <span>EMPLOYEE IDENTITY CARD</span>
              </div>
            </header>
            <div className="id-card-main">
              {employee.photoDataUrl ? (
                <img className="employee-id-photo-image" src={employee.photoDataUrl} alt={`${employee.name} photo`} />
              ) : (
                <div className="employee-id-photo">{initials(employee.name)}</div>
              )}
              <div className="id-card-person">
                <h2>{employee.name}</h2>
                <strong>{employee.department}</strong>
                <dl className="id-card-right-details">
                  <div><dt>Employee ID</dt><dd>{employee.employeeCode}</dd></div>
                  <div><dt>Client employer</dt><dd>{unit?.clientName ?? "—"}</dd></div>
                  <div><dt>Blood group</dt><dd>{employee.bloodGroup ?? "—"}</dd></div>
                </dl>
              </div>
              {qr ? <img className="id-card-qr" src={qr} alt={`QR code for ${employee.employeeCode}`} /> : null}
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
`;

await patch("lib/excel-import.ts", (source) => {
  if (source.includes("isEmployerPayrollFormat")) return source;
  source = replaceOnce(
    source,
    "function salarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {",
    "function legacySalarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {",
    "legacy salary parser rename",
  );
  const marker = "function legacySalarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {";
  return source.replace(marker, `${employerSalaryParser}\n${marker}`);
});

await patch("db/schema.ts", (source) =>
  replaceOnce(
    source,
    '  dateOfJoining: text("date_of_joining").notNull(),\n  dateOfLeaving: text("date_of_leaving"),',
    '  dateOfJoining: text("date_of_joining").notNull(),\n  dateOfBirth: text("date_of_birth"),\n  dateOfLeaving: text("date_of_leaving"),',
    "employee date of birth schema",
  ),
);

await patch("app/api/app-data/route.ts", (source) => {
  source = replaceOnce(
    source,
    "    maritalStatus: optionalValue(payload.maritalStatus),\n    highestQualification: optionalValue(payload.highestQualification),",
    "    maritalStatus: optionalValue(payload.maritalStatus),\n    dateOfBirth: optionalValue(payload.dateOfBirth),\n    highestQualification: optionalValue(payload.highestQualification),",
    "employee date of birth API mapping",
  );
  if (!source.includes("Salary-register imports intentionally preserve employee master data")) {
    source = source.replace(
      /    if \(existing\) \{\n      if \(sourceType === "salary"\) \{\n        const update = await assignEmployeeAccommodation\([\s\S]*?      \}\n      continue;\n    \}/,
      `    if (existing) {\n      if (sourceType === "salary") {\n        // Salary-register imports intentionally preserve employee master data.\n        // The employer file is authoritative for this payroll run, not for bank,\n        // statutory, accommodation, joining-date, or other permanent fields.\n        const importedName = optionalValue(imported.name);\n        if (importedName && importedName !== existing.name)\n          await db\n            .update(employees)\n            .set({ name: importedName })\n            .where(eq(employees.id, existing.id));\n      }\n      continue;\n    }`,
    );
  }
  if (!source.includes("Send a first-login email OTP")) {
    source = source.replace(
      "  if (!response.ok) {\n    const detail = await response.text();",
      "  if (!response.ok) {\n    const detail = await response.text();",
    );
    const anchor = "  if (!response.ok) {\n    const detail = await response.text();\n    if (!detail.toLowerCase().includes(\"already\") && response.status !== 422)";
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error("Unable to locate Supabase user-creation response handling.");
    const functionEnd = source.indexOf("\n}\n", index);
    if (functionEnd < 0) throw new Error("Unable to locate Supabase user-creation function end.");
    const insertion = `\n  // Send a first-login email OTP. Supabase Auth delivers this through the\n  // project's protected custom SMTP configuration; no SMTP password is stored\n  // in this repository or exposed to the browser.\n  const otpResponse = await fetch(\`\${supabaseUrl}/auth/v1/otp\`, {\n    method: \"POST\",\n    headers: {\n      apikey: serviceKey,\n      Authorization: \`Bearer \${serviceKey}\`,\n      \"Content-Type\": \"application/json\",\n    },\n    body: JSON.stringify({ email, create_user: false }),\n  });\n  if (!otpResponse.ok) {\n    const otpDetail = await otpResponse.text();\n    throw new RequestError(\n      \`User created, but the first-login OTP email could not be sent: \${otpDetail.slice(0, 180)}\`,\n      502,\n    );\n  }`;
    source = source.slice(0, functionEnd) + insertion + source.slice(functionEnd);
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  source = replaceOnce(
    source,
    "  dateOfJoining: string;\n  dateOfLeaving: string | null;",
    "  dateOfJoining: string;\n  dateOfBirth: string | null;\n  dateOfLeaving: string | null;",
    "employee date of birth UI type",
  );
  if (!source.includes("name=\"dateOfBirth\"")) {
    const joiningBlock = `              <label>\n                <span>Date of joining *</span>\n                <input\n                  name=\"dateOfJoining\"\n                  type=\"date\"\n                  defaultValue={\n                    employee?.dateOfJoining ?? \`\${currentPeriod}-01\`\n                  }\n                  required\n                />\n              </label>`;
    if (!source.includes(joiningBlock)) throw new Error("Unable to locate Date of joining employee field.");
    source = source.replace(
      joiningBlock,
      `${joiningBlock}\n              <label>\n                <span>Date of birth</span>\n                <input\n                  name=\"dateOfBirth\"\n                  type=\"date\"\n                  max={new Date().toISOString().slice(0, 10)}\n                  defaultValue={employee?.dateOfBirth ?? \"\"}\n                />\n              </label>`,
    );
  }
  if (!source.includes("downloadIdCardJpeg(")) {
    const start = source.indexOf("function EmployeeIdCard({");
    const end = source.indexOf("function AccommodationView({", start);
    if (start < 0 || end < 0) throw new Error("Unable to locate EmployeeIdCard component.");
    source = source.slice(0, start) + idCardReplacement + "\n" + source.slice(end);
  }
  return source;
});

await patch("app/hostel-master.tsx", (source) =>
  replaceOnce(
    source,
    '<form className="form-grid" onSubmit={updateHostel}>',
    '<form key={selected.id} className="form-grid" onSubmit={updateHostel}>',
    "selected hostel edit remount",
  ),
);

await patch("app/reports-recovery.tsx", (source) => {
  if (!source.includes("function printTarget()")) {
    source = source.replace(
      "\nconst recoveryLabels: Record<string, string> = {",
      `\nfunction printTarget() {\n  const target = document.querySelector(\".bulk-recovery-vouchers\")\n    ? \"bulk-vouchers\"\n    : document.querySelector(\".room-report-modal .advance-voucher\")\n      ? \"voucher\"\n      : \"report\";\n  document.body.dataset.printTarget = target;\n  const cleanup = () => delete document.body.dataset.printTarget;\n  window.addEventListener(\"afterprint\", cleanup, { once: true });\n  window.print();\n  window.setTimeout(cleanup, 1800);\n}\n\nconst recoveryLabels: Record<string, string> = {`,
    );
  }
  return source.replaceAll("onClick={() => window.print()}", "onClick={() => printTarget()}");
});

await patch("app/globals.css", (source) => {
  if (source.includes("JOY_PRODUCTION_FIXES_20260827")) return source;
  return `${source}\n\n/* JOY_PRODUCTION_FIXES_20260827 */\n.id-card-right-details { width:100%; display:grid; gap:1.1mm; }\n.employee-id-card .id-card-right-details div { display:grid !important; grid-template-columns:1fr !important; justify-items:end !important; text-align:right !important; padding:.8mm 0 !important; }\n.employee-id-card .id-card-right-details dt { width:100%; flex:none !important; color:#354862; font-weight:800; font-size:7px; text-align:right; }\n.employee-id-card .id-card-right-details dd { width:100%; margin:0; color:#101b2b; font-weight:800; font-size:8px; text-align:right; }\n.employee-id-card .id-card-person { text-align:right; }\n.employee-id-card .id-card-person h2, .employee-id-card .id-card-person > strong { text-align:right; }\n.report-command { display:grid; grid-template-columns:minmax(280px,1fr) minmax(190px,260px) minmax(260px,360px) auto; align-items:end; gap:14px; }\n.report-command > label { min-width:0; display:grid; gap:6px; color:var(--muted); font-size:10px; font-weight:700; }\n.report-command > label > span { color:#4b5c72; font-size:10px; font-weight:750; }\n.report-command select { width:100%; min-height:42px; padding:0 38px 0 12px; border:1px solid var(--line-strong); border-radius:9px; background:#fff; color:var(--ink); font-size:11px; font-weight:650; }\n@media (max-width: 980px) { .report-command { grid-template-columns:1fr; align-items:stretch; } }\n@page joy-id-card { size:A4 portrait; margin:10mm; }\n@page joy-room-recovery { size:A4 landscape; margin:7mm; }\n@page joy-voucher { size:A4 portrait; margin:10mm; }\n@media print {\n  body[data-print-target] * { visibility:hidden !important; }\n  body[data-print-target=\"id-card\"] .id-card-front, body[data-print-target=\"id-card\"] .id-card-front * { visibility:visible !important; }\n  body[data-print-target=\"id-card\"] .id-card-front { page:joy-id-card; position:absolute !important; left:10mm !important; top:10mm !important; width:54mm !important; height:85.6mm !important; margin:0 !important; box-shadow:none !important; }\n  body[data-print-target=\"id-card\"] .id-card-back { display:none !important; }\n  body[data-print-target=\"report\"] .report-print-area, body[data-print-target=\"report\"] .report-print-area * { visibility:visible !important; }\n  body[data-print-target=\"report\"] .report-print-area { page:joy-room-recovery; position:absolute !important; inset:0 !important; width:100% !important; max-width:none !important; margin:0 !important; padding:0 !important; box-shadow:none !important; font-size:10.5pt !important; }\n  body[data-print-target=\"report\"] .report-print-area table { width:100% !important; table-layout:auto !important; font-size:10pt !important; }\n  body[data-print-target=\"report\"] .report-print-area th, body[data-print-target=\"report\"] .report-print-area td { padding:5px 6px !important; line-height:1.25 !important; }\n  body[data-print-target=\"report\"] .report-print-area h2 { font-size:16pt !important; }\n  body[data-print-target=\"voucher\"] .room-report-modal .advance-voucher, body[data-print-target=\"voucher\"] .room-report-modal .advance-voucher * { visibility:visible !important; }\n  body[data-print-target=\"voucher\"] .room-report-modal .advance-voucher { page:joy-voucher; position:absolute !important; inset:0 !important; margin:0 auto !important; }\n  body[data-print-target=\"bulk-vouchers\"] .bulk-recovery-vouchers, body[data-print-target=\"bulk-vouchers\"] .bulk-recovery-vouchers * { visibility:visible !important; }\n  body[data-print-target=\"bulk-vouchers\"] .bulk-recovery-vouchers { page:joy-voucher; position:absolute !important; inset:0 !important; width:100% !important; }\n}\n`;
});

console.log("Applied Joy Payroll production fixes: employer salary import, DOB, ID card, hostel editing, print isolation, reports layout, and first-login OTP trigger.");
