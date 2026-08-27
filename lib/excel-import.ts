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
  accommodationType: string;
  roomNumber: string | null;
  paymentMode: string;
  salaryAmount: number;
  salaryBasis: string;
  defaultShift: string;
};

export type ImportedAttendance = {
  employeeCode: string;
  attendanceDate: string;
  statusCode: string;
  shiftCode: string;
  overtimeHours: number;
};

export type ImportedSalaryItem = Record<string, string | number> & { employeeCode: string };

export type WorkbookImport = {
  sourceType: "attendance" | "salary" | "csv" | "txt";
  sheetName: string;
  employees: ImportedEmployee[];
  attendance: ImportedAttendance[];
  salaryItems: ImportedSalaryItem[];
};

const validCodes = new Set(["P", "HD", "HALF DAY", "HALFDAY", "0.5P", "A", "L", "WO", "H", "HP"]);

function xml(bytes: Uint8Array | undefined, name: string) {
  if (!bytes) throw new Error(`The workbook is missing ${name}.`);
  const document = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error(`Unable to read ${name}.`);
  return document;
}

function columnIndex(address: string) {
  let result = 0;
  for (const character of address.replace(/\d/g, "").toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
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
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : fallback;
}

function normalizeAccommodation(value: CellValue | undefined) {
  const name = text(value).toLowerCase();
  if (name.includes("outside")) return "Outside Room";
  if (name.includes("joy")) return "Joy Room";
  return "Tamil Own";
}

function worksheetRows(document: Document, strings: string[]) {
  const rows: SheetRow[] = [];
  for (const element of Array.from(document.getElementsByTagName("row"))) {
    const row = new Map<number, CellValue>();
    for (const cell of Array.from(element.getElementsByTagName("c"))) {
      const index = columnIndex(cell.getAttribute("r") ?? "");
      // The supplied salary workbook contains stray XFD cells. Stay sparse.
      if (index < 0 || index > 60) continue;
      const kind = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent;
      let value: CellValue | undefined;
      if (kind === "inlineStr") value = cell.getElementsByTagName("is")[0]?.textContent ?? "";
      else if (kind === "s") value = strings[Number(raw)] ?? "";
      else if (kind === "str") value = raw ?? "";
      else if (raw !== undefined && raw !== null) value = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw) ? Number(raw) : raw;
      if (value !== undefined && value !== "") row.set(index, value);
    }
    if (row.size) rows.push(row);
  }
  return rows;
}

function workbookSheets(buffer: ArrayBuffer) {
  const archive = unzipSync(new Uint8Array(buffer), {
    filter: (file) => file.name === "xl/workbook.xml" || file.name === "xl/_rels/workbook.xml.rels" || file.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name),
  });
  const workbook = xml(archive["xl/workbook.xml"], "workbook.xml");
  const relationships = xml(archive["xl/_rels/workbook.xml.rels"], "workbook relationships");
  const relationshipMap = new Map(Array.from(relationships.getElementsByTagName("Relationship")).map((relationship) => [relationship.getAttribute("Id"), relationship.getAttribute("Target") ?? ""]));
  const strings = archive["xl/sharedStrings.xml"]
    ? Array.from(xml(archive["xl/sharedStrings.xml"], "shared strings").getElementsByTagName("si"), (entry) => entry.textContent ?? "")
    : [];

  return Array.from(workbook.getElementsByTagName("sheet"), (sheet) => {
    const relationshipId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = relationshipMap.get(relationshipId) ?? "";
    const path = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
    return { name: sheet.getAttribute("name") ?? "Sheet", rows: archive[path] ? worksheetRows(xml(archive[path], path), strings) : [] };
  });
}

function emptyEmployee(code: string, name: string, period: string): ImportedEmployee {
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

function attendanceSheet(name: string, rows: SheetRow[], period: string): WorkbookImport {
  const headerIndex = rows.findIndex((row) => Array.from(row.values()).some((value) => /^(emp\s*(no|id)|employee\s*(no|id))$/i.test(text(value))));
  if (headerIndex < 0) throw new Error("Attendance sheet needs an EMP NO or Emp ID column.");
  const headers = rows[headerIndex];
  const employeeColumn = Array.from(headers).find(([, value]) => /^(emp\s*(no|id)|employee\s*(no|id))$/i.test(text(value)))?.[0] ?? 1;
  const nameColumn = Array.from(headers).find(([, value]) => /^name$/i.test(text(value)))?.[0] ?? 2;
  const departmentColumn = Array.from(headers).find(([, value]) => /department/i.test(text(value)))?.[0] ?? 4;
  const shiftColumn = Array.from(headers).find(([, value]) => /^shift$/i.test(text(value)))?.[0] ?? 5;
  const dateColumns = Array.from(headers)
    .map(([column, value]) => {
      const raw = text(value);
      const match = raw.match(/^(\d{1,2})(?:[-/ ]|$)/);
      return match ? { column, day: Number(match[1]) } : null;
    })
    .filter((value): value is { column: number; day: number } => Boolean(value) && value!.day >= 1 && value!.day <= 31);
  if (!dateColumns.length) throw new Error("Attendance sheet needs day columns such as 1-Jul and 2-Jul.");

  const imported: WorkbookImport = { sourceType: "attendance", sheetName: name, employees: [], attendance: [], salaryItems: [] };
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
      const status = ["HALF DAY", "HALFDAY", "0.5P"].includes(rawStatus) ? "HD" : rawStatus;
      if (!validCodes.has(status)) continue;
      imported.attendance.push({ employeeCode: code, attendanceDate: `${period}-${String(dateColumn.day).padStart(2, "0")}`, statusCode: status, shiftCode: employee.defaultShift, overtimeHours: 0 });
    }
  }
  return imported;
}

function salarySheet(name: string, rows: SheetRow[], period: string): WorkbookImport {
  const headerIndex = rows.findIndex((row) => text(row.get(1)).toLowerCase() === "emp id" && text(row.get(2)).toLowerCase() === "name");
  if (headerIndex < 0) throw new Error("Salary Register sheet needs Emp ID and Name columns.");
  const imported: WorkbookImport = { sourceType: "salary", sheetName: name, employees: [], attendance: [], salaryItems: [] };
  const monetaryColumns: Array<[number, string]> = [[24,"basic"],[25,"da"],[26,"hra"],[27,"conveyance"],[28,"foodAllowance"],[29,"nightAllowance"],[31,"overtimeWages"],[32,"attendanceBonus"],[33,"arrears"],[34,"holidayWages"],[35,"productionIncentive"],[36,"medicalAllowance"],[38,"pfDeduction"],[39,"esiDeduction"],[40,"professionalTax"],[41,"lwf"],[42,"canteen"],[43,"snacks"],[44,"tent"],[45,"advance"],[46,"otherDeduction"],[47,"tds"],[48,"medicalInsurance"]];

  for (const row of rows.slice(headerIndex + 1)) {
    const code = text(row.get(1));
    const nameValue = text(row.get(2));
    if (!code || !nameValue) continue;
    const employee = emptyEmployee(code, nameValue, period);
    employee.department = text(row.get(3)) || "General";
    employee.dateOfJoining = dateValue(row.get(4), `${period}-01`);
    employee.uanMasked = nullable(row.get(6));
    employee.esiMasked = nullable(row.get(7));
    employee.bankAccountMasked = nullable(row.get(8));
    employee.bankName = nullable(row.get(9));
    employee.ifscMasked = nullable(row.get(10));
    employee.accommodationType = normalizeAccommodation(row.get(51));
    employee.roomNumber = nullable(row.get(53));
    employee.paymentMode = "bank";
    employee.salaryBasis = /daily/i.test(text(row.get(13))) ? "daily" : "monthly";
    employee.salaryAmount = numberValue(row.get(24)) || numberValue(row.get(37)) || monetaryColumns.filter(([column]) => column >= 24 && column <= 36).reduce((sum, [column]) => sum + numberValue(row.get(column)), 0);
    imported.employees.push(employee);

    const item: ImportedSalaryItem = { employeeCode: code, payableDays: numberValue(row.get(23)), presentDays: numberValue(row.get(15)), overtimeHours: numberValue(row.get(30)) };
    for (const [column, field] of monetaryColumns) item[field] = numberValue(row.get(column));
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
    if (character === '"' && quoted && source[index + 1] === '"') { value += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function delimitedSheet(filename: string, source: string, period: string, sourceType: "csv" | "txt") {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = sourceType === "txt" ? (["\t", "|", ",", ";"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0] ?? "\t") : ",";
  const rows = delimitedCells(source, delimiter).map((cells) => new Map(cells.map((value, index) => [index, value] as const)));
  const hasDates = rows.some((row) => Array.from(row.values()).some((value) => /^\d{1,2}[-/ ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text(value))));
  if (hasDates) return attendanceSheet(filename, rows, period);

  const headers = rows[0];
  if (!headers) throw new Error("The CSV file is empty.");
  const findColumn = (...patterns: RegExp[]) => Array.from(headers).find(([, value]) => patterns.some((pattern) => pattern.test(text(value))))?.[0];
  const codeColumn = findColumn(/^emp(?:loyee)?[ _-]?(?:no|id|code)$/i);
  const nameColumn = findColumn(/^(?:employee[ _-]?)?name$/i);
  if (codeColumn === undefined || nameColumn === undefined) throw new Error("CSV needs employee ID and name columns.");
  const departmentColumn = findColumn(/department/i);
  const salaryColumn = findColumn(/salary|gross|wage|rate|basic/i);
  const fieldAliases: Record<string, RegExp> = {
    basic: /^basic(?: salary| wage)?$/i, da: /^(?:da|dearness allowance)$/i, hra: /^(?:hra|house rent allowance)$/i,
    conveyance: /conveyance|transport allowance/i, foodAllowance: /food allowance/i, nightAllowance: /night allowance/i,
    overtimeWages: /^(?:ot|overtime)(?: wages| amount)?$/i, attendanceBonus: /attendance bonus/i, arrears: /arrears/i,
    holidayWages: /holiday wages/i, productionIncentive: /production incentive/i, medicalAllowance: /medical allowance/i,
    pfDeduction: /^(?:pf|epf)(?: deduction)?$/i, esiDeduction: /^esi(?: deduction)?$/i, professionalTax: /professional tax|^pt$/i,
    lwf: /^lwf$/i, canteen: /canteen/i, snacks: /snacks/i, tent: /tent/i, advance: /advance/i,
    otherDeduction: /other deduction|recovery/i, tds: /^tds$|income tax/i, medicalInsurance: /medical insurance/i,
    presentDays: /present days/i, payableDays: /payable days|paid days/i, overtimeHours: /ot hours|overtime hours/i,
  };
  const mappedFields = Object.entries(fieldAliases).map(([field, pattern]) => [field, findColumn(pattern)] as const).filter((entry): entry is readonly [string, number] => entry[1] !== undefined);
  const isSalary = mappedFields.some(([field]) => ["basic", "pfDeduction", "payableDays", "overtimeWages"].includes(field));
  const imported: WorkbookImport = { sourceType: isSalary ? "salary" : sourceType, sheetName: filename, employees: [], attendance: [], salaryItems: [] };
  for (const row of rows.slice(1)) {
    const code = text(row.get(codeColumn));
    const name = text(row.get(nameColumn));
    if (!code || !name) continue;
    const employee = emptyEmployee(code, name, period);
    employee.department = departmentColumn === undefined ? "General" : text(row.get(departmentColumn)) || "General";
    employee.salaryAmount = salaryColumn === undefined ? 0 : numberValue(row.get(salaryColumn));
    imported.employees.push(employee);
    if (isSalary) {
      const item: ImportedSalaryItem = { employeeCode: code };
      for (const [field, column] of mappedFields) item[field] = numberValue(row.get(column));
      imported.salaryItems.push(item);
    }
  }
  return imported;
}

export async function parsePayrollWorkbook(file: File, period: string): Promise<WorkbookImport> {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Choose the payroll month before importing.");
  if (/\.csv$/i.test(file.name)) return delimitedSheet(file.name, await file.text(), period, "csv");
  if (/\.txt$/i.test(file.name)) return delimitedSheet(file.name, await file.text(), period, "txt");
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Upload an .xlsx, .csv, or .txt file.");

  const sheets = workbookSheets(await file.arrayBuffer());
  const salary = sheets.find((sheet) => /^salary register$/i.test(sheet.name));
  if (salary) return salarySheet(salary.name, salary.rows, period);
  const attendance = sheets.find((sheet) => /^attendance input$/i.test(sheet.name)) ?? sheets.find((sheet) => /attendance/i.test(sheet.name));
  if (attendance) return attendanceSheet(attendance.name, attendance.rows, period);
  throw new Error("Workbook needs an ‘Attendance Input’ or ‘Salary Register’ worksheet.");
}
