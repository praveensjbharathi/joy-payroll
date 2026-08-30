import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/payroll-app.tsx");
let source = await readFile(file, "utf8");

// Ensure the selected employee is passed into the payslip modal.
const invocation = `<PayslipModal\n          item={payslipItem}\n`;
if (source.includes(invocation) && !source.includes(`<PayslipModal\n          item={payslipItem}\n          employee={`)) {
  source = source.replace(
    invocation,
    `<PayslipModal\n          item={payslipItem}\n          employee={data.employees.find((employee) => employee.id === payslipItem.employeeId)}\n`,
  );
}

// Force the sender to the dedicated salary-slip-mailer Edge Function.
source = source.replace(
  /      const mailEndpoint = apiEndpoint\.includes\("\/functions\/v1\/"\)[\s\S]*?      const response = await fetch\(mailEndpoint, \{\n/,
  `      const mailEndpoint = "https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer";\n      const response = await fetch(mailEndpoint, {\n`,
);
source = source.replace(
  `      const response = await fetch(apiEndpoint, {\n`,
  `      const mailEndpoint = "https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer";\n      const response = await fetch(mailEndpoint, {\n`,
);
source = source.replace(
  `        body: JSON.stringify({ action: "send-payslip-email", runId: run.id, employeeId: employee.id }),\n`,
  `        body: JSON.stringify({ itemId: item.id }),\n`,
);
source = source.replace(
  `      const payload = await response.json() as { ok?: boolean; error?: string; message?: string };\n      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to send salary slip email");\n      setEmailSent(true);\n      setEmailMessage(payload.message ?? \`Salary slip sent to \${employee.emailAddress}\`);\n`,
  `      const payload = await response.json() as { sent?: boolean; recipient?: string; error?: string };\n      if (!response.ok || !payload.sent) throw new Error(payload.error ?? "Unable to send salary slip email");\n      setEmailSent(true);\n      setEmailMessage(\`Salary slip sent to \${payload.recipient ?? employee.emailAddress}\`);\n`,
);

// Always show the action in the payslip toolbar, even when disabled.
if (!source.includes(`>\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Send salary slip email"}\n            </button>`)) {
  const modalStart = source.indexOf("function PayslipModal(");
  if (modalStart < 0) throw new Error("PayslipModal was not found");
  const exportAnchor = source.indexOf(`            {canExport ? (`, modalStart);
  if (exportAnchor < 0) throw new Error("Payslip export toolbar was not found");
  const button = `            <button\n              type="button"\n              className="primary-button"\n              disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}\n              title={!employee?.emailAddress ? "Add Employee Email ID in Employee Master" : run?.status !== "approved" ? "Approve payroll before sending salary slips" : "Send salary slip PDF directly by SMTP"}\n              onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sendSalarySlipEmail(); }}\n            >\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Send salary slip email"}\n            </button>\n`;
  source = source.slice(0, exportAnchor) + button + source.slice(exportAnchor);
}

// Upgrade any existing visible SMTP button so it cannot submit a parent form.
source = source.replace(
  `<button\n              className="primary-button"\n              disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}`,
  `<button\n              type="button"\n              className="primary-button"\n              disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}`,
);
source = source.replace(
  `              onClick={() => void sendSalarySlipEmail()}\n            >\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Send salary slip email"}`,
  `              onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sendSalarySlipEmail(); }}\n            >\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Send salary slip email"}`,
);

// Remove an older duplicate secondary-button email action if both exist.
const duplicate = `            <button\n              className="secondary-button"\n              disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}\n              title={!employee?.emailAddress ? "Add employee email ID in Employee Master" : run?.status !== "approved" ? "Approve payroll before sending salary slips" : "Send salary slip PDF by SMTP"}\n              onClick={() => void sendSalarySlipEmail()}\n            >\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Email salary slip"}\n            </button>\n`;
source = source.replace(duplicate, "");

if (!source.includes("Send salary slip email")) throw new Error("Visible salary-slip email action was not added");
if (!source.includes("salary-slip-mailer")) throw new Error("Salary-slip mailer endpoint is missing");
if (!source.includes("itemId: item.id")) throw new Error("Salary-slip mailer payload is missing itemId");
if (!source.includes('type="button"')) throw new Error("Salary-slip email button must not submit a parent form");

await writeFile(file, source, "utf8");
console.log("Salary-slip email action now uses the dedicated SMTP mailer and cannot trigger the payroll form submit path.");
