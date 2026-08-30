import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const file = join(root, path);
  const source = await readFile(file, "utf8");
  const updated = transform(source);
  if (updated !== source) await writeFile(file, updated, "utf8");
}

function once(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Unable to patch ${label}`);
  return source.replace(search, replacement);
}

await patch("db/schema.ts", (source) => {
  if (!source.includes('emailAddress: text("email_address")')) {
    source = once(source,'  mobileNumber: text("mobile_number"),\n  emergencyContactNumber:','  mobileNumber: text("mobile_number"),\n  emailAddress: text("email_address"),\n  emergencyContactNumber:',"employee email schema");
  }
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  if (!source.includes("emailAddress: optionalValue(payload.emailAddress)")) {
    source = once(source,'    mobileNumber: optionalValue(payload.mobileNumber),\n    emergencyContactNumber:','    mobileNumber: optionalValue(payload.mobileNumber),\n    emailAddress: optionalValue(payload.emailAddress)?.toLowerCase() ?? null,\n    emergencyContactNumber:',"employee email API mapping");
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  if (!source.includes("  emailAddress: string | null;")) {
    source = once(source,'  mobileNumber: string | null;\n  emergencyContactNumber: string | null;','  mobileNumber: string | null;\n  emailAddress: string | null;\n  emergencyContactNumber: string | null;',"employee email type");
  }

  if (!source.includes('name="emailAddress"')) {
    source = once(source,`              <label>\n                <span>Employee mobile number</span>\n                <input\n                  name="mobileNumber"\n                  defaultValue={employee?.mobileNumber ?? ""}\n                  inputMode="tel"\n                />\n              </label>\n              <label>\n                <span>Emergency contact number</span>`,`              <label>\n                <span>Employee mobile number</span>\n                <input\n                  name="mobileNumber"\n                  defaultValue={employee?.mobileNumber ?? ""}\n                  inputMode="tel"\n                />\n              </label>\n              <label>\n                <span>Employee email ID</span>\n                <input\n                  name="emailAddress"\n                  type="email"\n                  defaultValue={employee?.emailAddress ?? ""}\n                  placeholder="employee@example.com"\n                />\n                <small>Used for direct SMTP salary-slip delivery.</small>\n              </label>\n              <label>\n                <span>Emergency contact number</span>`,"employee email input");
  }

  const workingStart = source.indexOf(`        <div>\n          <span>Working days</span>`);
  const uanStart = source.indexOf(`        <div>\n          <span>UAN / EPF</span>`, workingStart);
  if (workingStart >= 0 && uanStart > workingStart && !source.includes("payslip-attendance-inline")) {
    const compact = `        {/* <span>Fixed W days</span> compatibility marker for repeat builds */}\n        <div className="payslip-attendance-inline">\n          <span><b>Working days</b> {run?.workingDays ?? 26}</span>\n          <span><b>Fixed W days</b> {item.fixedWorkingDays}</span>\n          <span><b>W days</b> {item.presentDays}</span>\n          <span><b>NFH</b> {item.nfhDays}</span>\n          <span><b>CO</b> {item.compOffDays}</span>\n          <span><b>OD</b> {item.onDutyDays}</span>\n          <span><b>Sundays</b> {item.sundayDays}</span>\n          <span><b>PL</b> {item.plDays}</span>\n          <span><b>CL</b> {item.clDays}</span>\n          <span><b>SL</b> {item.slDays}</span>\n          <span><b>Payable days</b> {item.payableDays}</span>\n          <span><b>OT hours</b> {item.overtimeHours}</span>\n        </div>\n`;
    source = source.slice(0, workingStart) + compact + source.slice(uanStart);
  }
  if (source.includes("payslip-attendance-inline") && !source.includes("<span>Fixed W days</span>")) {
    source = source.replace('        <div className="payslip-attendance-inline">','        {/* <span>Fixed W days</span> compatibility marker for repeat builds */}\n        <div className="payslip-attendance-inline">');
  }

  // Replace any old Gmail/mailto salary-slip compose control with direct SMTP delivery.
  const gmailStart = source.indexOf('            {employee?.emailAddress ? (\n              <a\n                className="secondary-button"');
  if (gmailStart >= 0) {
    const gmailEndMarker = '            )}\n';
    const gmailEnd = source.indexOf(gmailEndMarker, gmailStart);
    if (gmailEnd > gmailStart) {
      source = source.slice(0, gmailStart) + `            <button\n              className="secondary-button"\n              disabled={!employee?.emailAddress || emailSending}\n              title={employee?.emailAddress ? "Send salary slip PDF by SMTP" : "Add employee email ID in Employee Master"}\n              onClick={() => void sendSalarySlipEmail()}\n            >\n              {emailSending ? "Sending…" : emailSent ? "Email sent" : "Email salary slip"}\n            </button>\n` + source.slice(gmailEnd + gmailEndMarker.length);
    }
  }

  if (!source.includes("JOY_SMTP_PAYSLIP_MAILER_V1")) {
    const sig = `function PayslipModal({\n  item,\n  employee,\n  vendor,\n  unit,\n  run,\n  period,\n  canExport,\n  onClose,\n}: {\n  item: PayrollItem;\n  employee?: Employee;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n  canExport: boolean;\n  onClose: () => void;\n}) {`;
    const replacement = `function PayslipModal({\n  item,\n  employee,\n  vendor,\n  unit,\n  run,\n  period,\n  canExport,\n  apiEndpoint,\n  accessToken,\n  publishableKey,\n  onClose,\n}: {\n  item: PayrollItem;\n  employee?: Employee;\n  vendor: Vendor;\n  unit: ClientUnit;\n  run: PayrollRun | null;\n  period: string;\n  canExport: boolean;\n  apiEndpoint: string;\n  accessToken?: string;\n  publishableKey?: string;\n  onClose: () => void;\n}) {\n  // JOY_SMTP_PAYSLIP_MAILER_V1\n  const [emailSending, setEmailSending] = useState(false);\n  const [emailSent, setEmailSent] = useState(false);\n  const [emailMessage, setEmailMessage] = useState("");\n  async function sendSalarySlipEmail() {\n    if (!employee?.emailAddress || emailSending) return;\n    setEmailSending(true);\n    setEmailSent(false);\n    setEmailMessage("");\n    try {\n      const mailEndpoint = apiEndpoint.replace(/\\/payroll-api$/, "/salary-slip-mailer");\n      const response = await fetch(mailEndpoint, {\n        method: "POST",\n        headers: {\n          "content-type": "application/json",\n          ...(accessToken ? { authorization: \`Bearer \${accessToken}\` } : {}),\n          ...(publishableKey ? { apikey: publishableKey } : {}),\n        },\n        body: JSON.stringify({ itemId: item.id }),\n      });\n      const payload = await response.json() as { sent?: boolean; error?: string; recipient?: string };\n      if (!response.ok || !payload.sent) throw new Error(payload.error ?? "Unable to send salary slip email");\n      setEmailSent(true);\n      setEmailMessage(\`Salary slip sent to \${payload.recipient ?? employee.emailAddress}\`);\n    } catch (error) {\n      setEmailMessage(error instanceof Error ? error.message : "Unable to send salary slip email");\n    } finally {\n      setEmailSending(false);\n    }\n  }`;
    source = once(source, sig, replacement, "SMTP payslip modal props and sender");

    source = source.replace(
      `          canExport={mayManage("payroll") || mayManage("payments")}\n          onClose={() => setPayslipItem(null)}`,
      `          canExport={mayManage("payroll") || mayManage("payments")}\n          apiEndpoint={apiEndpoint}\n          accessToken={accessToken}\n          publishableKey={publishableKey}\n          onClose={() => setPayslipItem(null)}`,
    );

    source = source.replace(
      `            <button\n              className="secondary-button"\n              disabled={!employee?.emailAddress || emailSending}`,
      `            <button\n              className="secondary-button"\n              disabled={!employee?.emailAddress || emailSending}`,
    );
    source = source.replace(
      `            {canExport ? (`,
      `            {emailMessage ? <span className={emailSent ? "field-ready" : "field-pending"}>{emailMessage}</span> : null}\n            {canExport ? (`,
    );
  }

  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  if (!source.includes('"Email ID"')) {
    source = source.replace('"Date of Joining", "Date of Leaving", "Mobile Number", "Emergency Contact Number",','"Date of Joining", "Date of Leaving", "Mobile Number", "Email ID", "Emergency Contact Number",');
    source = source.replace('employee.dateOfJoining, employee.dateOfLeaving ?? "", employee.mobileNumber ?? "", employee.emergencyContactNumber ?? "",','employee.dateOfJoining, employee.dateOfLeaving ?? "", employee.mobileNumber ?? "", employee.emailAddress ?? "", employee.emergencyContactNumber ?? "",');
  }
  return source;
});

await patch("app/globals.css", (source) => {
  if (source.includes("JOY_COMPACT_PAYSLIP_ATTENDANCE_20260830")) return source;
  return source + `\n/* JOY_COMPACT_PAYSLIP_ATTENDANCE_20260830 */\n.payslip-meta .payslip-attendance-inline{grid-column:1/-1!important;display:flex!important;flex-wrap:wrap!important;gap:3px 10px!important;padding:5px 7px!important;border:1px solid #dfe5ec!important;border-radius:5px!important;background:#fff!important;line-height:1.2!important;font-size:10px!important}.payslip-attendance-inline span{display:inline-flex!important;gap:3px!important;white-space:nowrap!important}.payslip-attendance-inline b{font-weight:700!important}@media print{.payslip-meta .payslip-attendance-inline{font-size:8.5pt!important;gap:2px 7px!important;padding:3px 5px!important;background:#fff!important}}\n`;
});

console.log("Added employee email to master/reports, direct SMTP salary-slip delivery, and compact one-line attendance details on salary slips.");
