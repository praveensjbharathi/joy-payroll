import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "lib/excel-import.ts");
let source = await readFile(file, "utf8");

// Some of Joy's established Salary Register workbooks use a fixed legacy layout
// where only Emp ID / Name are labelled in the row detected as the header. Keep
// header-based imports as the preferred path, but fall back to the established
// fixed positions only when that legacy layout is clearly detected.
if (!source.includes("JOY_LEGACY_SALARY_REGISTER_V1")) {
  source = source.replace(
    '  const codeColumn = required("Emp ID", "Emp ID", "Employee ID", "Emp Code");\n  const nameColumn = required("Name", "Name", "Employee Name");\n  const departmentColumn = findColumn("Department", "Dept");',
    '  const codeColumn = required("Emp ID", "Emp ID", "Employee ID", "Emp Code");\n  const nameColumn = required("Name", "Name", "Employee Name");\n  // JOY_LEGACY_SALARY_REGISTER_V1\n  const legacyLayout = headerMap.size <= 6 && rows.slice(headerIndex + 1).some((row) => row.has(24));\n  const legacyColumn = (column: number | undefined, fallback: number) =>\n    column ?? (legacyLayout ? fallback : undefined);\n  const departmentColumn = legacyColumn(findColumn("Department", "Dept"), 3);',
  );

  source = source.replace(
    '  const accountColumn = findColumn("Bank Account", "Account No", "Account Number");\n  const ifscColumn = findColumn("IFSC", "IFSC Code");',
    '  const accountColumn = legacyColumn(findColumn("Bank Account", "Account No", "Account Number"), 8);\n  const ifscColumn = legacyColumn(findColumn("IFSC", "IFSC Code"), 10);',
  );

  source = source.replace(
    '  const accommodationColumn = findColumn("Accommodation Type");\n  const roomColumn = findColumn("Room", "Room Number");',
    '  const accommodationColumn = legacyColumn(findColumn("Accommodation Type"), 51);\n  const roomColumn = legacyColumn(findColumn("Room", "Room Number"), 53);',
  );

  source = source.replace(
    '  const extraAuditFields: Record<string, string[]> = {',
    '  const legacyItemColumns: Record<string, number> = {\n    basic: 24,\n    hra: 26,\n    pfDeduction: 38,\n  };\n  const extraAuditFields: Record<string, string[]> = {',
  );

  source = source.replace(
    '  const mappedFields = Object.entries(itemFields)\n    .map(([field, aliases]) => [field, findColumn(...aliases)] as const)',
    '  const mappedFields = Object.entries(itemFields)\n    .map(([field, aliases]) => [\n      field,\n      findColumn(...aliases) ?? (legacyLayout ? legacyItemColumns[field] : undefined),\n    ] as const)',
  );

  source = source.replace(
    '    const basicColumn = findColumn("Basic", "Basic Salary");',
    '    const basicColumn = findColumn("Basic", "Basic Salary") ??\n      (legacyLayout ? legacyItemColumns.basic : undefined);',
  );
}

if (!source.includes("JOY_LEGACY_SALARY_REGISTER_V1")) {
  throw new Error("Unable to apply legacy Salary Register compatibility");
}

await writeFile(file, source, "utf8");
console.log("Restored legacy Salary Register fixed-column compatibility with header-first imports.");
