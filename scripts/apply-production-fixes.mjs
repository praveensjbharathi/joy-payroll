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
  for (const [columnIndex, value] of headers) {
    const normalized = normalizeHeader(value);
    if (normalized && !headerMap.has(normalized)) headerMap.set(normalized, columnIndex);
  }
  const column = (...aliases: string[]) =>
    aliases
      .map((alias) => headerMap.get(normalizeHeader(alias)))
      .find((value) => value !== undefined);

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
    const salaryBasisText =
      salaryBasisColumn === undefined ? "" : text(row.get(salaryBasisColumn));
    employee.salaryBasis = /daily|day/i.test(salaryBasisText) ? "daily" : "monthly";
    const basicColumn = column("Basic");
    employee.salaryAmount =
      basicColumn === undefined ? 0 : numberValue(row.get(basicColumn));
    imported.employees.push(employee);

    const co = compOffColumn === undefined ? 0 : numberValue(row.get(compOffColumn));
    const pl = plColumn === undefined ? 0 : numberValue(row.get(plColumn));
    const cl = clColumn === undefined ? 0 : numberValue(row.get(clColumn));
    const sl = slColumn === undefined ? 0 : numberValue(row.get(slColumn));
    const item: ImportedSalaryItem = {
      employeeCode: code,
      fixedWorkingDays:
        fixedWorkingDaysColumn === undefined
          ? 0
          : numberValue(row.get(fixedWorkingDaysColumn)),
      presentDays:
        workedDaysColumn === undefined ? 0 : numberValue(row.get(workedDaysColumn)),
      holidayPresentDays:
        nfhColumn === undefined ? 0 : numberValue(row.get(nfhColumn)),
      compOffDays: co,
      onDutyDays:
        onDutyColumn === undefined ? 0 : numberValue(row.get(onDutyColumn)),
      weekOffDays:
        sundayColumn === undefined ? 0 : numberValue(row.get(sundayColumn)),
      plDays: pl,
      clDays: cl,
      slDays: sl,
      leaveDays: co + pl + cl + sl,
      payableDays:
        payableDaysColumn === undefined ? 0 : numberValue(row.get(payableDaysColumn)),
      overtimeHours:
        overtimeHoursColumn === undefined
          ? 0
          : numberValue(row.get(overtimeHoursColumn)),
      sourceGrossEarnings:
        grossColumn === undefined ? 0 : numberValue(row.get(grossColumn)),
      sourceTotalDeductions:
        totalDeductionColumn === undefined
          ? 0
          : numberValue(row.get(totalDeductionColumn)),
      sourceNetPayable:
        netColumn === undefined ? 0 : numberValue(row.get(netColumn)),
    };
    for (const [mappedColumn, field] of monetaryColumns) {
      item[field] =
        mappedColumn === undefined ? 0 : numberValue(row.get(mappedColumn));
    }
    imported.salaryItems.push(item);
  }
  return imported;
}
`;

const idCardWrapper = String.raw`function EmployeeIdCard({
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
  return (
    <EnhancedEmployeeIdCard
      employee={employee}
      vendor={vendor}
      unit={unit}
      onClose={onClose}
    />
  );
}

`;

const dateOfBirthField = String.raw`
              <label>
                <span>Date of birth</span>
                <input
                  name="dateOfBirth"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={employee?.dateOfBirth ?? ""}
                />
              </label>`;

const printAndLayoutCss = String.raw`

/* JOY_PRODUCTION_FIXES_20260827 */
.id-card-right-details { width:100%; display:grid; gap:1.1mm; }
.employee-id-card .id-card-right-details div {
  display:grid !important;
  grid-template-columns:1fr !important;
  justify-items:end !important;
  text-align:right !important;
  padding:.8mm 0 !important;
}
.employee-id-card .id-card-right-details dt {
  width:100%; flex:none !important; color:#354862; font-weight:800;
  font-size:7px; text-align:right;
}
.employee-id-card .id-card-right-details dd {
  width:100%; margin:0; color:#101b2b; font-weight:800;
  font-size:8px; text-align:right;
}
.employee-id-card .id-card-person,
.employee-id-card .id-card-person h2,
.employee-id-card .id-card-person > strong { text-align:right; }

.report-command {
  display:grid;
  grid-template-columns:minmax(280px,1fr) minmax(190px,260px) minmax(260px,360px) auto;
  align-items:end;
  gap:14px;
}
.report-command > label {
  min-width:0;
  display:grid;
  gap:6px;
  color:var(--muted);
  font-size:10px;
  font-weight:700;
}
.report-command > label > span { color:#4b5c72; font-size:10px; font-weight:750; }
.report-command select {
  width:100%; min-height:42px; padding:0 38px 0 12px;
  border:1px solid var(--line-strong); border-radius:9px;
  background:#fff; color:var(--ink); font-size:11px; font-weight:650;
}
@media (max-width:980px) {
  .report-command { grid-template-columns:1fr; align-items:stretch; }
}

@page joy-id-card { size:A4 portrait; margin:10mm; }
@page joy-room-recovery { size:A4 landscape; margin:7mm; }
@page joy-voucher { size:A4 portrait; margin:10mm; }

@media print {
  body[data-print-target] * { visibility:hidden !important; }

  body[data-print-target="id-card"] .id-card-front,
  body[data-print-target="id-card"] .id-card-front * { visibility:visible !important; }
  body[data-print-target="id-card"] .id-card-front {
    page:joy-id-card;
    position:absolute !important;
    left:10mm !important;
    top:10mm !important;
    width:54mm !important;
    height:85.6mm !important;
    margin:0 !important;
    box-shadow:none !important;
  }
  body[data-print-target="id-card"] .id-card-back { display:none !important; }

  body[data-print-target="report"] .report-print-area,
  body[data-print-target="report"] .report-print-area * { visibility:visible !important; }
  body[data-print-target="report"] .report-print-area {
    page:joy-room-recovery;
    position:absolute !important;
    inset:0 !important;
    width:100% !important;
    max-width:none !important;
    margin:0 !important;
    padding:0 !important;
    box-shadow:none !important;
    font-size:10.5pt !important;
  }
  body[data-print-target="report"] .report-print-area table {
    width:100% !important;
    table-layout:auto !important;
    font-size:10pt !important;
  }
  body[data-print-target="report"] .report-print-area th,
  body[data-print-target="report"] .report-print-area td {
    padding:5px 6px !important;
    line-height:1.25 !important;
  }
  body[data-print-target="report"] .report-print-area h2 { font-size:16pt !important; }

  body[data-print-target="voucher"] .room-report-modal .advance-voucher,
  body[data-print-target="voucher"] .room-report-modal .advance-voucher * {
    visibility:visible !important;
  }
  body[data-print-target="voucher"] .room-report-modal .advance-voucher {
    page:joy-voucher;
    position:absolute !important;
    inset:0 !important;
    margin:0 auto !important;
  }

  body[data-print-target="bulk-vouchers"] .bulk-recovery-vouchers,
  body[data-print-target="bulk-vouchers"] .bulk-recovery-vouchers * {
    visibility:visible !important;
  }
  body[data-print-target="bulk-vouchers"] .bulk-recovery-vouchers {
    page:joy-voucher;
    position:absolute !important;
    inset:0 !important;
    width:100% !important;
  }
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
  const marker =
    "function legacySalarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {";
  return source.replace(marker, employerSalaryParser + "\n" + marker);
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
    const pattern = /    if \(existing\) \{\n      if \(sourceType === "salary"\) \{\n        const update = await assignEmployeeAccommodation\([\s\S]*?      \}\n      continue;\n    \}/;
    if (!pattern.test(source))
      throw new Error("Unable to locate existing-employee salary-import block.");
    source = source.replace(
      pattern,
      String.raw`    if (existing) {
      if (sourceType === "salary") {
        // Salary-register imports intentionally preserve employee master data.
        // The employer file is authoritative for this payroll run, not for bank,
        // statutory, accommodation, joining-date, or other permanent fields.
        const importedName = optionalValue(imported.name);
        if (importedName && importedName !== existing.name)
          await db
            .update(employees)
            .set({ name: importedName })
            .where(eq(employees.id, existing.id));
      }
      continue;
    }`,
    );
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  if (!source.includes('import EnhancedEmployeeIdCard from "./employee-id-card";')) {
    source = source.replace(
      'import { OperationsView } from "./operations-view";',
      'import { OperationsView } from "./operations-view";\nimport EnhancedEmployeeIdCard from "./employee-id-card";',
    );
  }
  source = replaceOnce(
    source,
    "  dateOfJoining: string;\n  dateOfLeaving: string | null;",
    "  dateOfJoining: string;\n  dateOfBirth: string | null;\n  dateOfLeaving: string | null;",
    "employee date of birth UI type",
  );

  if (!source.includes('name="dateOfBirth"')) {
    const marker = "<span>Date of joining *</span>";
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) throw new Error("Unable to locate Date of joining field.");
    const labelEnd = source.indexOf("</label>", markerIndex);
    if (labelEnd < 0) throw new Error("Unable to locate Date of joining label end.");
    const insertionPoint = labelEnd + "</label>".length;
    source =
      source.slice(0, insertionPoint) +
      dateOfBirthField +
      source.slice(insertionPoint);
  }

  if (!source.includes("<EnhancedEmployeeIdCard")) {
    const start = source.indexOf("function EmployeeIdCard({");
    const end = source.indexOf("function AccommodationView({", start);
    if (start < 0 || end < 0)
      throw new Error("Unable to locate EmployeeIdCard component block.");
    source = source.slice(0, start) + idCardWrapper + source.slice(end);
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
      String.raw`
function printTarget() {
  const target = document.querySelector(".bulk-recovery-vouchers")
    ? "bulk-vouchers"
    : document.querySelector(".room-report-modal .advance-voucher")
      ? "voucher"
      : "report";
  document.body.dataset.printTarget = target;
  const cleanup = () => delete document.body.dataset.printTarget;
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1800);
}

const recoveryLabels: Record<string, string> = {`,
    );
  }
  return source.replaceAll(
    "onClick={() => window.print()}",
    "onClick={() => printTarget()}",
  );
});

await patch("app/globals.css", (source) =>
  source.includes("JOY_PRODUCTION_FIXES_20260827")
    ? source
    : source + printAndLayoutCss,
);

console.log(
  "Applied Joy Payroll production fixes: employer salary import, employee DOB, ID card, hostel editing, print isolation, room-recovery landscape printing, and Reports dropdown layout.",
);
