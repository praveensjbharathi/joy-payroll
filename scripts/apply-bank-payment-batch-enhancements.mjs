import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const file = join(root, path);
  let source = await readFile(file, "utf8");
  const next = transform(source);
  if (next !== source) await writeFile(file, next, "utf8");
}

function replaceOnce(source, find, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(find)) throw new Error(`Unable to patch ${label}`);
  return source.replace(find, replacement);
}

await patch("db/schema.ts", (source) =>
  replaceOnce(
    source,
    '  bankName: text("bank_name"),\n  accommodationType:',
    '  bankName: text("bank_name"),\n  bankBranch: text("bank_branch"),\n  accommodationType:',
    "employee bank branch schema",
  ),
);

await patch("app/api/app-data/route.ts", (source) =>
  replaceOnce(
    source,
    '    bankName: optionalValue(payload.bankName),\n    accommodationType,',
    '    bankName: optionalValue(payload.bankName),\n    bankBranch: optionalValue(payload.bankBranch),\n    accommodationType,',
    "employee bank branch API mapping",
  ),
);

await patch("app/payroll-app.tsx", (source) => {
  source = replaceOnce(
    source,
    '  bankName: string | null;\n  accommodationType: string;',
    '  bankName: string | null;\n  bankBranch: string | null;\n  accommodationType: string;',
    "employee bank branch type",
  );

  source = replaceOnce(
    source,
    `              <label>\n                <span>Bank name</span>\n                <input\n                  name="bankName"\n                  defaultValue={employee?.bankName ?? ""}\n                />\n              </label>\n              <label>\n                <span>EPF applicable</span>`,
    `              <label>\n                <span>Bank name</span>\n                <input\n                  name="bankName"\n                  defaultValue={employee?.bankName ?? ""}\n                />\n              </label>\n              <label>\n                <span>Bank account branch / City</span>\n                <input\n                  name="bankBranch"\n                  defaultValue={employee?.bankBranch ?? ""}\n                  placeholder="Example: Coimbatore Main Branch"\n                />\n                <small>Used as City in Indian Bank bulk upload.</small>\n              </label>\n              <label>\n                <span>EPF applicable</span>`,
    "employee bank branch input",
  );

  source = replaceOnce(
    source,
    `  const bankItems = items.filter((item) => item.paymentMode === "bank");\n  const cashItems = items.filter((item) => item.paymentMode === "cash");`,
    `  const bankItems = items.filter((item) => item.paymentMode === "bank");\n  const cashItems = items.filter((item) => item.paymentMode === "cash");\n  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);\n  useEffect(() => {\n    setSelectedPaymentIds((current) => {\n      const valid = current.filter((id) => bankItems.some((item) => item.id === id));\n      return valid.length ? valid : bankItems.map((item) => item.id);\n    });\n  }, [run.id, items]);\n  const selectedBankItems = bankItems.filter((item) => selectedPaymentIds.includes(item.id));\n  const salaryDescription = `${vendor.legalName.toUpperCase()} SALARY ${monthLabel(run.payPeriod).toUpperCase()}`;`,
    "payment batch selection state",
  );

  source = source.replace(
    '    const rows = mode === "bank" ? bankItems : cashItems;',
    '    const rows = mode === "bank" ? selectedBankItems : cashItems;',
  );
  source = source.replace('    const rows = bankItems.map((item, index) => {', '    const rows = selectedBankItems.map((item, index) => {');
  source = source.replace('        unit.location,\n        item.bankAccountMasked ?? "",', '        employee?.bankBranch ?? unit.location,\n        item.bankAccountMasked ?? "",');
  source = source.replace('        `Salary ${monthLabel(run.payPeriod)}`,', '        salaryDescription,');
  source = source.replace('    const rows = bankItems\n      .filter(', '    const rows = selectedBankItems\n      .filter(', 1);
  source = source.replace(
    '          `NEFT~${item.ifscMasked ?? ""}~${item.netPayable.toFixed(2)}~10~${item.bankAccountMasked ?? ""}~${vendor.legalName.toUpperCase()}~0~SALARY ${run.payPeriod}`,',
    '          `NEFT~${item.ifscMasked ?? ""}~${item.netPayable.toFixed(2)}~10~${item.bankAccountMasked ?? ""}~${item.employeeName}~0~${salaryDescription}`,',
  );
  const cubToCubStart = '    const rows = bankItems\n      .filter((item) =>';
  if (source.includes(cubToCubStart)) source = source.replace(cubToCubStart, '    const rows = selectedBankItems\n      .filter((item) =>');
  source = source.replace(
    '          `${item.bankAccountMasked ?? ""}~${item.netPayable.toFixed(2)}~${vendor.name.toUpperCase()} ${run.payPeriod} SALARY`,',
    '          `${item.bankAccountMasked ?? ""}~${item.netPayable.toFixed(2)}~${salaryDescription}`,',
  );

  source = replaceOnce(
    source,
    `      <section className="panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">Bank bulk-upload formats</span>`,
    `      <section className="panel table-panel payment-batch-selector">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">Payment processing batch</span>\n            <h2>Select employees for this bank upload batch</h2>\n            <p>Tick only the employees to include. Every bank download below uses the same selected batch.</p>\n          </div>\n          <div className="record-actions">\n            <button className="secondary-button" type="button" onClick={() => setSelectedPaymentIds(bankItems.map((item) => item.id))}>Select all</button>\n            <button className="secondary-button" type="button" onClick={() => setSelectedPaymentIds([])}>Clear selection</button>\n          </div>\n        </div>\n        <div className="table-scroll">\n          <table className="data-table">\n            <thead><tr><th>Pay</th><th>Employee</th><th>Account holder</th><th>Account</th><th>IFSC</th><th>Bank / Branch</th><th>Amount</th></tr></thead>\n            <tbody>\n              {bankItems.map((item) => {\n                const employee = employees.find((row) => row.id === item.employeeId);\n                return (\n                  <tr key={item.id}>\n                    <td><input type="checkbox" checked={selectedPaymentIds.includes(item.id)} onChange={(event) => setSelectedPaymentIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} /></td>\n                    <td><strong>{item.employeeCode}</strong><small>{item.employeeName}</small></td>\n                    <td>{item.employeeName}</td>\n                    <td>{item.bankAccountMasked ?? "Pending"}</td>\n                    <td>{item.ifscMasked ?? "Pending"}</td>\n                    <td><strong>{employee?.bankName ?? "—"}</strong><small>{employee?.bankBranch ?? "Branch pending"}</small></td>\n                    <td><strong>{money(item.netPayable)}</strong></td>\n                  </tr>\n                );\n              })}\n            </tbody>\n          </table>\n        </div>\n        <div className="form-note"><strong>{selectedBankItems.length} employees selected</strong><span>Batch total: {money(selectedBankItems.reduce((sum, item) => sum + item.netPayable, 0))}</span></div>\n      </section>\n      <section className="panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">Bank bulk-upload formats</span>`,
    "payment batch selector UI",
  );

  source = source.replaceAll('disabled={!bankItems.length || !canExport}', 'disabled={!selectedBankItems.length || !canExport}');
  source = source.replace('          <span className="muted-label">{bankItems.length} bank employees</span>', '          <span className="muted-label">{selectedBankItems.length} selected · {bankItems.length} bank employees</span>');

  source = replaceOnce(
    source,
    `function PayslipSheet({\n  item,\n  vendor,\n  unit,\n  run,\n  period,\n}: {\n  item: PayrollItem;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n}) {`,
    `function PayslipSheet({\n  item,\n  employee,\n  vendor,\n  unit,\n  run,\n  period,\n}: {\n  item: PayrollItem;\n  employee?: Employee;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n}) {`,
    "payslip employee prop",
  );

  source = replaceOnce(
    source,
    `        <div>\n          <span>OT hours</span>\n          <strong>{item.overtimeHours}</strong>\n        </div>\n      </div>`,
    `        <div>\n          <span>OT hours</span>\n          <strong>{item.overtimeHours}</strong>\n        </div>\n        <div>\n          <span>UAN / EPF</span>\n          <strong>{employee?.uanMasked ?? "—"}</strong>\n        </div>\n        <div>\n          <span>ESI number</span>\n          <strong>{employee?.esiMasked ?? "—"}</strong>\n        </div>\n        <div>\n          <span>Bank account</span>\n          <strong>{employee?.bankAccountMasked ?? item.bankAccountMasked ?? "—"}</strong>\n        </div>\n        <div>\n          <span>IFSC</span>\n          <strong>{employee?.ifscMasked ?? item.ifscMasked ?? "—"}</strong>\n        </div>\n        <div>\n          <span>Bank name</span>\n          <strong>{employee?.bankName ?? "—"}</strong>\n        </div>\n        <div>\n          <span>Bank branch</span>\n          <strong>{employee?.bankBranch ?? "—"}</strong>\n        </div>\n      </div>`,
    "payslip compliance and bank meta",
  );

  source = replaceOnce(
    source,
    `function PayslipModal({\n  item,\n  vendor,`,
    `function PayslipModal({\n  item,\n  employee,\n  vendor,`,
    "payslip modal employee argument",
  );
  source = replaceOnce(
    source,
    `  item: PayrollItem;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n  canExport: boolean;`,
    `  item: PayrollItem;\n  employee?: Employee;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n  canExport: boolean;`,
    "payslip modal employee prop type",
  );
  source = source.replace(
    `        <PayslipSheet\n          item={item}\n          vendor={vendor}`,
    `        <PayslipSheet\n          item={item}\n          employee={employee}\n          vendor={vendor}`,
  );

  source = replaceOnce(
    source,
    `function BulkPayslipModal({\n  items,\n  vendor,`,
    `function BulkPayslipModal({\n  items,\n  employees,\n  vendor,`,
    "bulk payslip employees argument",
  );
  source = replaceOnce(
    source,
    `  items: PayrollItem[];\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun;`,
    `  items: PayrollItem[];\n  employees: Employee[];\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun;`,
    "bulk payslip employees prop type",
  );
  source = source.replace(
    `            <PayslipSheet\n              key={item.id}\n              item={item}\n              vendor={vendor}`,
    `            <PayslipSheet\n              key={item.id}\n              item={item}\n              employee={employees.find((employee) => employee.id === item.employeeId)}\n              vendor={vendor}`,
  );

  source = source.replace(
    `        <PayslipModal\n          item={payslipItem}\n          vendor={currentVendor}`,
    `        <PayslipModal\n          item={payslipItem}\n          employee={currentEmployees.find((employee) => employee.id === payslipItem.employeeId)}\n          vendor={currentVendor}`,
  );
  source = source.replace(
    `        <BulkPayslipModal\n          items={currentItems}\n          vendor={currentVendor}`,
    `        <BulkPayslipModal\n          items={currentItems}\n          employees={currentEmployees}\n          vendor={currentVendor}`,
  );

  if (!source.includes("JOY_BANK_PAYMENT_BATCH_ENHANCEMENTS_V1")) {
    source = source.replace('"use client";', '"use client";\n// JOY_BANK_PAYMENT_BATCH_ENHANCEMENTS_V1');
  }
  return source;
});

await patch("scripts/expand-employee-master-report.mjs", (source) => {
  source = source.replace(
    '"UAN / EPF", "ESI Number", "Bank Account", "IFSC", "Bank Name",',
    '"UAN / EPF", "ESI Number", "Bank Account", "IFSC", "Bank Name", "Bank Branch / City",',
  );
  source = source.replace(
    'employee.uanMasked ?? "", employee.esiMasked ?? "", employee.bankAccountMasked ?? "", employee.ifscMasked ?? "", employee.bankName ?? "",',
    'employee.uanMasked ?? "", employee.esiMasked ?? "", employee.bankAccountMasked ?? "", employee.ifscMasked ?? "", employee.bankName ?? "", employee.bankBranch ?? "",',
  );
  return source;
});

console.log("Applied bank branch, payslip bank/compliance details, exact CUB descriptions and selectable payment processing batches.");
