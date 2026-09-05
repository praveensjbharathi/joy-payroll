import { strFromU8, unzipSync } from "fflate";
import { numberValue } from "./payroll-calculations";

type CellValue = string | number;
type SheetRow = Map<number, CellValue>;

export type ImportedEmployee = {
  employeeCode: string;
  name: string;
  department: string;
  dateOfJoining: string;
  uanMasked: string | null;
  esiMasked: string | null;
  bankAccountMasked: string | null;
  ifscMasked: string | null;
  bankName: string | null;
  bankBranch?: string | null;
  accommodationType: string;
  hostelName?: string | null;
  roomNumber: string | null;
  roomRentAmount?: number;
  paymentMode: string;
  salaryAmount: number;
  salaryBasis: string;
  defaultShift: string;
  dateOfBirth?: string | null;
  mobileNumber?: string | null;
  emailAddress?: string | null;
  emergencyContactNumber?: string | null;
  addressLine?: string | null;
  district?: string | null;
  stateName?: string | null;
  pincode?: string | null;
  bloodGroup?: string | null;
  highestQualification?: string | null;
  fatherName?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  pfApplicable?: string;
  pfWageAmount?: number;
  esiApplicable?: string;
  esiWageAmount?: number;
  ptApplicable?: string;
  lwfApplicable?: string;
  shiftPattern?: string;
  applicableShiftsJson?: string;
  remarks?: string | null;
  employmentType?: string;
};

export const EMPLOYEE_IMPORT_HEADERS = [
  "Employee code",
  "Employee name",
  "Department",
  "Employment type",
  "Date of joining",
  "Date of birth",
  "Employee mobile number",
  "Employee email ID",
  "Emergency contact number",
  "Residential address",
  "District",
  "State",
  "Pincode",
  "Blood group",
  "Highest qualification",
  "Father name",
  "Marital status",
  "Spouse name",
  "Basic salary / daily rate",
  "Salary basis",
  "Default shift",
  "Shift pattern",
  "Applicable shifts",
  "Payment mode",
  "UAN",
  "ESI number",
  "Bank account number",
  "IFSC code",
  "Bank name",
  "Bank account branch / City",
  "EPF applicable",
  "Customized EPF wage",
  "ESI applicable",
  "Customized ESI wage",
  "Professional Tax",
  "Tamil Nadu LWF",
  "Accommodation type",
  "Hostel / area",
  "Room number",
  "Individual monthly rent",
  "Other remarks",
] as const;

export type ImportedAttendance = {
  employeeCode: string;
  attendanceDate: string;
  statusCode: string;
  shiftCode: string;
  overtimeHours: number;
};

export type ImportedSalaryItem = Record<string, string | number> & {
  employeeCode: string;
};

export type WorkbookImport = {
  sourceType: "attendance" | "salary" | "employee" | "csv" | "txt";
  sheetName: string;
  employees: ImportedEmployee[];
  attendance: ImportedAttendance[];
  salaryItems: ImportedSalaryItem[];
};

const validCodes = new Set([
  "P",
  "HD",
  "HALF DAY",
  "HALFDAY",
  "0.5P",
  "A",
  "L",
  "WO",
  "H",
  "HP",
]);

function xml(bytes: Uint8Array | undefined, name: string) {
  if (!bytes) throw new Error(`The workbook is missing ${name}.`);
  const document = new DOMParser().parseFromString(
    strFromU8(bytes),
    "application/xml",
  );
  if (document.getElementsByTagName("parsererror").length)
    throw new Error(`Unable to read ${name}.`);
  return document;
}

function columnIndex(address: string) {
  let result = 0;
  for (const character of address.replace(/\d/g, "").toUpperCase())
    result = result * 26 + character.charCodeAt(0) - 64;
  return result - 1;
}

function text(value: CellValue | undefined) {
  return value === undefined ? "" : String(value).trim();
}

function nullable(value: CellValue | undefined) {
  return text(value) || null;
}

function dateValue(value: CellValue | undefined, fallback: string) {
  if (typeof value === "number" && value > 25000) {
    const date = new Date(Math.round((value - 25569) * 86400000));
    return date.toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : fallback;
}

function normalizeAccommodation(value: CellValue | undefined) {
  const name = text(value);
  return name || "Tamil Own";
}

function normalizeHeader(value: CellValue | undefined) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function worksheetRows(document: Document, strings: string[]) {
  const rows: SheetRow[] = [];
  for (const element of Array.from(document.getElementsByTagName("row"))) {
    const row = new Map<number, CellValue>();
    for (const cell of Array.from(element.getElementsByTagName("c"))) {
      const index = columnIndex(cell.getAttribute("r") ?? "");
      if (index < 0 || index > 60) continue;
      const kind = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent;
      let value: CellValue | undefined;
      if (kind === "inlineStr")
        value = cell.getElementsByTagName("is")[0]?.textContent ?? "";
      else if (kind === "s") value = strings[Number(raw)] ?? "";
      else if (kind === "str") value = raw ?? "";
      else if (raw !== undefined && raw !== null)
        value = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw)
          ? Number(raw)
          : raw;
      if (value !== undefined && value !== "") row.set(index, value);
    }
    if (row.size) rows.push(row);
  }
  return rows;
}

function workbookSheets(buffer: ArrayBuffer) {
  const archive = unzipSync(new Uint8Array(buffer), {
    filter: (file) =>
      file.name === "xl/workbook.xml" ||
      file.name === "xl/_rels/workbook.xml.rels" ||
      file.name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name),
  });
  const workbook = xml(archive["xl/workbook.xml"], "workbook.xml");
  const relationships = xml(
    archive["xl/_rels/workbook.xml.rels"],
    "workbook relationships",
  );
  const relationshipMap = new Map(
    Array.from(relationships.getElementsByTagName("Relationship")).map(
      (relationship) => [
        relationship.getAttribute("Id"),
        relationship.getAttribute("Target") ?? "",
      ],
    ),
  );
  const strings = archive["xl/sharedStrings.xml"]
    ? Array.from(
        xml(archive["xl/sharedStrings.xml"], "shared strings").getElementsByTagName(
          "si",
        ),
        (entry) => entry.textContent ?? "",
      )
    : [];
  return Array.from(workbook.getElementsByTagName("sheet"), (sheet) => {
    const relationshipId =
      sheet.getAttribute("r:id") ??
      sheet.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      );
    const target = relationshipMap.get(relationshipId) ?? "";
    const path = target.startsWith("/")
      ? target.slice(1)
      : target.startsWith("xl/")
        ? target
        : `xl/${target.replace(/^\.\//, "")}`;
    return {
      name: sheet.getAttribute("name") ?? "Sheet",
      rows: archive[path]
        ? worksheetRows(xml(archive[path], path), strings)
        : [],
    };
  });
}

function emptyEmployee(
  code: string,
  name: string,
  period: string,
): ImportedEmployee {
  return {
    employeeCode: code,
    name,
    department: "General",
    dateOfJoining: `${period}-01`,
    uanMasked: null,
    esiMasked: null,
    bankAccountMasked: null,
    ifscMasked: null,
    bankName: null,
    accommodationType: "Tamil Own",
    roomNumber: null,
    paymentMode: "bank",
    salaryAmount: 0,
    salaryBasis: "monthly",
    defaultShift: "General",
  };
}

function attendanceSheet(
  name: string,
  rows: SheetRow[],
  period: string,
): WorkbookImport {
  const headerIndex = rows.findIndex((row) =>
    Array.from(row.values()).some((value) =>
      /^(emp\s*(no|id)|employee\s*(no|id))$/i.test(text(value)),
    ),
  );
  if (headerIndex < 0)
    throw new Error("Attendance sheet needs an EMP NO or Emp ID column.");
  const headers = rows[headerIndex];
  const employeeColumn =
    Array.from(headers).find(([, value]) =>
      /^(emp\s*(no|id)|employee\s*(no|id))$/i.test(text(value)),
    )?.[0] ?? 1;
  const nameColumn =
    Array.from(headers).find(([, value]) => /^name$/i.test(text(value)))?.[0] ??
    2;
  const departmentColumn =
    Array.from(headers).find(([, value]) => /department/i.test(text(value)))?.[0] ??
    4;
  const shiftColumn =
    Array.from(headers).find(([, value]) => /^shift$/i.test(text(value)))?.[0] ??
    5;
  const dateColumns = Array.from(headers)
    .map(([column, value]) => {
      const raw = text(value);
      const match = raw.match(/^(\d{1,2})(?:[-/ ]|$)/);
      return match ? { column, day: Number(match[1]) } : null;
    })
    .filter(
      (value): value is { column: number; day: number } =>
        Boolean(value) && value!.day >= 1 && value!.day <= 31,
    );
  if (!dateColumns.length)
    throw new Error("Attendance sheet needs day columns such as 1-Jul and 2-Jul.");

  const imported: WorkbookImport = {
    sourceType: "attendance",
    sheetName: name,
    employees: [],
    attendance: [],
    salaryItems: [],
  };
  for (const row of rows.slice(headerIndex + 1)) {
    const code = text(row.get(employeeColumn));
    const nameValue = text(row.get(nameColumn));
    if (!code || !nameValue) continue;
    const employee = emptyEmployee(code, nameValue, period);
    employee.department = text(row.get(departmentColumn)) || "General";
    employee.defaultShift = text(row.get(shiftColumn)) || "General";
    imported.employees.push(employee);
    for (const dateColumn of dateColumns) {
      const rawStatus = text(row.get(dateColumn.column)).toUpperCase();
      const status = ["HALF DAY", "HALFDAY", "0.5P"].includes(rawStatus)
        ? "HD"
        : rawStatus;
      if (!validCodes.has(status)) continue;
      imported.attendance.push({
        employeeCode: code,
        attendanceDate: `${period}-${String(dateColumn.day).padStart(2, "0")}`,
        statusCode: status,
        shiftCode: employee.defaultShift,
        overtimeHours: 0,
      });
    }
  }
  return imported;
}

function looksLikeEmployeeMaster(rows: SheetRow[]) {
  return rows.some((row) => {
    const headers = new Set(Array.from(row.values()).map(normalizeHeader));
    const hasCode = headers.has("employee code") || headers.has("employee id");
    const hasName = headers.has("employee name") || headers.has("name");
    return (
      hasCode &&
      hasName &&
      [
        "employee email id",
        "date of birth",
        "blood group",
        "pf applicable",
        "accommodation type",
      ].filter((header) => headers.has(header)).length >= 2
    );
  });
}

function employeeMasterSheet(
  name: string,
  rows: SheetRow[],
  period: string,
): WorkbookImport {
  const headerIndex = rows.findIndex((row) => {
    const headers = new Set(Array.from(row.values()).map(normalizeHeader));
    return (
      (headers.has("employee code") || headers.has("employee id")) &&
      (headers.has("employee name") || headers.has("name"))
    );
  });
  if (headerIndex < 0)
    throw new Error("Employee Master needs Employee code and Employee name columns.");
  const headerMap = new Map<string, number>();
  for (const [column, cellValue] of rows[headerIndex]) {
    const header = normalizeHeader(cellValue);
    if (header && !headerMap.has(header)) headerMap.set(header, column);
  }
  const column = (...aliases: string[]) => {
    for (const alias of aliases) {
      const match = headerMap.get(normalizeHeader(alias));
      if (match !== undefined) return match;
    }
    return undefined;
  };
  const value = (row: SheetRow, ...aliases: string[]) => {
    const index = column(...aliases);
    return index === undefined ? undefined : row.get(index);
  };
  const yesNo = (input: CellValue | undefined, fallback = "yes") => {
    const normalized = text(input).toLowerCase();
    if (!normalized) return fallback;
    return ["no", "n", "false", "0", "not required", "not applicable"].includes(
      normalized,
    )
      ? "no"
      : "yes";
  };
  const imported: WorkbookImport = {
    sourceType: "employee",
    sheetName: name,
    employees: [],
    attendance: [],
    salaryItems: [],
  };
  for (const row of rows.slice(headerIndex + 1)) {
    const code = text(value(row, "Employee code", "Employee ID", "Emp ID"));
    const employeeName = text(value(row, "Employee name", "Name"));
    if (!code || !employeeName) continue;
    const employee = emptyEmployee(code, employeeName, period);
    employee.department = text(value(row, "Department")) || "General";
    employee.employmentType = /direct/i.test(
      text(value(row, "Employment type")),
    )
      ? "direct"
      : "client";
    employee.dateOfJoining = dateValue(
      value(row, "Date of joining", "DOJ"),
      `${period}-01`,
    );
    const birthDate = value(row, "Date of birth", "DOB");
    employee.dateOfBirth = birthDate ? dateValue(birthDate, "") || null : null;
    employee.mobileNumber = nullable(value(row, "Employee mobile number", "Mobile number"));
    employee.emailAddress = nullable(value(row, "Employee email ID", "Email", "Email ID"));
    employee.emergencyContactNumber = nullable(
      value(row, "Emergency contact number"),
    );
    employee.addressLine = nullable(value(row, "Residential address", "Address"));
    employee.district = nullable(value(row, "District"));
    employee.stateName = nullable(value(row, "State"));
    employee.pincode = nullable(value(row, "Pincode", "PIN code"));
    employee.bloodGroup = nullable(value(row, "Blood group"));
    employee.highestQualification = nullable(value(row, "Highest qualification"));
    employee.fatherName = nullable(value(row, "Father name"));
    employee.maritalStatus = nullable(value(row, "Marital status"));
    employee.spouseName = nullable(value(row, "Spouse name"));
    employee.salaryAmount = numberValue(
      value(row, "Basic salary / daily rate", "Salary amount", "Basic salary"),
    );
    employee.salaryBasis = /daily/i.test(text(value(row, "Salary basis")))
      ? "daily"
      : "monthly";
    employee.defaultShift = text(value(row, "Default shift")) || "General";
    employee.shiftPattern = /rotational/i.test(
      text(value(row, "Shift pattern")),
    )
      ? "rotational"
      : "general";
    const applicableShifts = text(value(row, "Applicable shifts"))
      .split(/[,|;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    employee.applicableShiftsJson = JSON.stringify(
      applicableShifts.length ? applicableShifts : [employee.defaultShift],
    );
    employee.paymentMode = "bank";
    employee.uanMasked = nullable(value(row, "UAN", "UAN / EPF"));
    employee.esiMasked = nullable(value(row, "ESI number", "ESI No"));
    employee.bankAccountMasked = nullable(
      value(row, "Bank account number", "Bank account", "Account number"),
    );
    employee.ifscMasked = nullable(value(row, "IFSC code", "IFSC"));
    employee.bankName = nullable(value(row, "Bank name"));
    employee.bankBranch = nullable(
      value(row, "Bank account branch / City", "Bank branch", "City"),
    );
    employee.pfApplicable = yesNo(value(row, "EPF applicable", "PF applicable"));
    employee.pfWageAmount = numberValue(value(row, "Customized EPF wage", "PF wage"));
    employee.esiApplicable = yesNo(value(row, "ESI applicable"));
    employee.esiWageAmount = numberValue(value(row, "Customized ESI wage", "ESI wage"));
    employee.ptApplicable = yesNo(value(row, "Professional Tax", "PT applicable"));
    employee.lwfApplicable = yesNo(value(row, "Tamil Nadu LWF", "LWF applicable"));
    employee.accommodationType = normalizeAccommodation(
      value(row, "Accommodation type"),
    );
    employee.hostelName = nullable(value(row, "Hostel / area", "Hostel", "Area"));
    employee.roomNumber = nullable(value(row, "Room number", "Existing room"));
    employee.roomRentAmount = numberValue(
      value(row, "Individual monthly rent", "Room rent amount"),
    );
    employee.remarks = nullable(value(row, "Other remarks", "Remarks"));
    imported.employees.push(employee);
  }
  return imported;
}

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

function legacySalarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {
  const headerIndex = rows.findIndex((row) => {
    const values = Array.from(row.values()).map(normalizeHeader);
    return values.includes("emp id") && values.includes("name");
  });
  if (headerIndex < 0)
    throw new Error("Salary Register sheet needs Emp ID and Name columns.");

  const headers = rows[headerIndex];
  const headerMap = new Map<string, number>();
  for (const [column, value] of headers) headerMap.set(normalizeHeader(value), column);
  const findColumn = (...aliases: string[]) => {
    for (const alias of aliases) {
      const exact = headerMap.get(normalizeHeader(alias));
      if (exact !== undefined) return exact;
    }
    return undefined;
  };
  const required = (label: string, ...aliases: string[]) => {
    const column = findColumn(...aliases);
    if (column === undefined)
      throw new Error(`Salary Register is missing the ${label} column.`);
    return column;
  };

  const codeColumn = required("Emp ID", "Emp ID", "Employee ID", "Emp Code");
  const nameColumn = required("Name", "Name", "Employee Name");
  // JOY_LEGACY_SALARY_REGISTER_V1
  const legacyLayout = headerMap.size <= 6 && rows.slice(headerIndex + 1).some((row) => row.has(24));
  const legacyColumn = (column: number | undefined, fallback: number) =>
    column ?? (legacyLayout ? fallback : undefined);
  const departmentColumn = legacyColumn(findColumn("Department", "Dept"), 3);
  const joiningColumn = findColumn("Date of Joining", "DOJ");
  const uanColumn = findColumn("UAN", "UAN No");
  const esiNumberColumn = findColumn("ESI No", "ESI Number");
  const accountColumn = legacyColumn(findColumn("Bank Account", "Account No", "Account Number"), 8);
  const ifscColumn = legacyColumn(findColumn("IFSC", "IFSC Code"), 10);
  const bankNameColumn = findColumn("Bank Name");
  const accommodationColumn = legacyColumn(findColumn("Accommodation Type"), 51);
  const roomColumn = legacyColumn(findColumn("Room", "Room Number"), 53);
  const basisColumn = findColumn("Pay Monthly/Daily", "Salary Basis", "Pay Basis");

  const itemFields: Record<string, string[]> = {
    presentDays: ["W Days", "Working Days", "Present Days"],
    payableDays: ["Payable Days", "Paid Days"],
    overtimeHours: ["OT Hrs", "OT Hours", "Overtime Hours"],
    basic: ["Basic", "Basic Salary"],
    da: ["DA", "Dearness Allowance"],
    hra: ["HRA", "House Rent Allowance"],
    conveyance: ["CA", "Conveyance", "Conveyance Allowance"],
    foodAllowance: ["Food Allowance"],
    nightAllowance: ["Night Allowance"],
    overtimeWages: ["OT Wages", "Overtime Wages", "OT Amount"],
    attendanceBonus: ["Attendance Bonus"],
    arrears: ["Arrears"],
    holidayWages: ["Holiday Wages"],
    productionIncentive: ["Production Incentive"],
    medicalAllowance: ["Medical Allowance"],
    pfDeduction: ["PF Deductions", "PF Deduction", "PF", "EPF"],
    esiDeduction: ["ESI Deductions", "ESI Deduction", "ESI"],
    professionalTax: ["Professional Tax", "PT"],
    lwf: ["LWF"],
    canteen: ["Canteen"],
    snacks: ["Snacks"],
    tent: ["Tent"],
    advance: ["Advance"],
    otherDeduction: ["Others", "Other Deduction", "Other Deductions"],
    tds: ["TDS"],
    medicalInsurance: ["Medical insurance", "Medical Insurance"],
  };
  const legacyItemColumns: Record<string, number> = {
    basic: 24,
    hra: 26,
    pfDeduction: 38,
  };
  const extraAuditFields: Record<string, string[]> = {
    fixedWorkingDays: ["Fixed W Days", "Fixed Working Days"],
    nfhDays: ["NFH"],
    compOffDays: ["CO", "Comp Off"],
    onDutyDays: ["OD", "On Duty"],
    sundayDays: ["Sundays", "Sunday"],
    plDays: ["PL"],
    clDays: ["CL"],
    slDays: ["SL"],
  };
  const mappedFields = Object.entries(itemFields)
    .map(([field, aliases]) => [
      field,
      findColumn(...aliases) ?? (legacyLayout ? legacyItemColumns[field] : undefined),
    ] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== undefined);
  const mappedAudit = Object.entries(extraAuditFields)
    .map(([field, aliases]) => [field, findColumn(...aliases)] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== undefined);

  const imported: WorkbookImport = {
    sourceType: "salary",
    sheetName: name,
    employees: [],
    attendance: [],
    salaryItems: [],
  };
  for (const row of rows.slice(headerIndex + 1)) {
    const code = text(row.get(codeColumn));
    const nameValue = text(row.get(nameColumn));
    if (!code || !nameValue) continue;
    const employee = emptyEmployee(code, nameValue, period);
    if (departmentColumn !== undefined)
      employee.department = text(row.get(departmentColumn)) || "General";
    if (joiningColumn !== undefined)
      employee.dateOfJoining = dateValue(row.get(joiningColumn), `${period}-01`);
    if (uanColumn !== undefined) employee.uanMasked = nullable(row.get(uanColumn));
    if (esiNumberColumn !== undefined)
      employee.esiMasked = nullable(row.get(esiNumberColumn));
    if (accountColumn !== undefined)
      employee.bankAccountMasked = nullable(row.get(accountColumn));
    if (ifscColumn !== undefined) employee.ifscMasked = nullable(row.get(ifscColumn));
    if (bankNameColumn !== undefined)
      employee.bankName = nullable(row.get(bankNameColumn));
    if (accommodationColumn !== undefined)
      employee.accommodationType = normalizeAccommodation(row.get(accommodationColumn));
    if (roomColumn !== undefined) employee.roomNumber = nullable(row.get(roomColumn));
    employee.paymentMode = "bank";
    employee.salaryBasis =
      basisColumn !== undefined && /daily/i.test(text(row.get(basisColumn)))
        ? "daily"
        : "monthly";

    const basicColumn = findColumn("Basic", "Basic Salary") ??
      (legacyLayout ? legacyItemColumns.basic : undefined);
    const grossColumn = findColumn("Gross Earnings", "Gross Salary", "Gross");
    employee.salaryAmount =
      (basicColumn === undefined ? 0 : numberValue(row.get(basicColumn))) ||
      (grossColumn === undefined ? 0 : numberValue(row.get(grossColumn)));
    imported.employees.push(employee);

    const item: ImportedSalaryItem = { employeeCode: code };
    for (const [field, column] of mappedFields)
      item[field] = numberValue(row.get(column));
    for (const [field, column] of mappedAudit)
      item[field] = numberValue(row.get(column));
    const gross = findColumn("Gross Earnings");
    const totalDeductions = findColumn("Total Deductions");
    const netPayable = findColumn("Net Payable");
    if (gross !== undefined) item.importedGrossEarnings = numberValue(row.get(gross));
    if (totalDeductions !== undefined)
      item.importedTotalDeductions = numberValue(row.get(totalDeductions));
    if (netPayable !== undefined)
      item.importedNetPayable = numberValue(row.get(netPayable));
    imported.salaryItems.push(item);
  }
  return imported;
}

function delimitedCells(source: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      value += '"';
      index++;
    } else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function delimitedSheet(
  filename: string,
  source: string,
  period: string,
  sourceType: "csv" | "txt",
) {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    sourceType === "txt"
      ? (["\t", "|", ",", ";"].sort(
          (a, b) => firstLine.split(b).length - firstLine.split(a).length,
        )[0] ?? "\t")
      : ",";
  const rows = delimitedCells(source, delimiter).map(
    (cells) => new Map(cells.map((value, index) => [index, value] as const)),
  );
  const hasDates = rows.some((row) =>
    Array.from(row.values()).some((value) =>
      /^\d{1,2}[-/ ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
        text(value),
      ),
    ),
  );
  if (looksLikeEmployeeMaster(rows))
    return employeeMasterSheet(filename, rows, period);
  if (hasDates) return attendanceSheet(filename, rows, period);
  return salarySheet(filename, rows, period);
}

export async function parsePayrollWorkbook(
  file: File,
  period: string,
): Promise<WorkbookImport> {
  if (!/^\d{4}-\d{2}$/.test(period))
    throw new Error("Choose the payroll month before importing.");
  if (/\.csv$/i.test(file.name))
    return delimitedSheet(file.name, await file.text(), period, "csv");
  if (/\.txt$/i.test(file.name))
    return delimitedSheet(file.name, await file.text(), period, "txt");
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Upload an .xlsx, .csv, or .txt file.");

  const sheets = workbookSheets(await file.arrayBuffer());
  const employeeMaster =
    sheets.find((sheet) => /employee.*(master|import)/i.test(sheet.name)) ??
    sheets.find((sheet) => looksLikeEmployeeMaster(sheet.rows));
  if (employeeMaster)
    return employeeMasterSheet(employeeMaster.name, employeeMaster.rows, period);
  const salary = sheets.find((sheet) => /^salary register$/i.test(sheet.name));
  if (salary) return salarySheet(salary.name, salary.rows, period);
  const attendance =
    sheets.find((sheet) => /^attendance input$/i.test(sheet.name)) ??
    sheets.find((sheet) => /attendance/i.test(sheet.name));
  if (attendance) return attendanceSheet(attendance.name, attendance.rows, period);
  throw new Error(
    "Workbook needs an ‘Employee Master’, ‘Attendance Input’, or ‘Salary Register’ worksheet.",
  );
}
