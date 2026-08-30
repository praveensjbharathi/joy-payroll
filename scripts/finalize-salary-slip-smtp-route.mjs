import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/payroll-app.tsx");
let source = await readFile(file, "utf8");

const modalStart = source.indexOf("function PayslipModal(");
if (modalStart < 0) throw new Error("PayslipModal not found");
const sendStart = source.indexOf("  async function sendSalarySlipEmail() {", modalStart);
if (sendStart < 0) throw new Error("sendSalarySlipEmail not found inside PayslipModal");
const sendEndMarker = "\n  }";
const sendEnd = source.indexOf(sendEndMarker, sendStart + 10);
if (sendEnd < 0) throw new Error("sendSalarySlipEmail end not found");

const replacement = `  async function sendSalarySlipEmail() {\n    if (!employee?.emailAddress || !run?.id || run.status !== "approved" || emailSending) return;\n    setEmailSending(true);\n    setEmailSent(false);\n    setEmailMessage("");\n    try {\n      const response = await fetch("https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer", {\n        method: "POST",\n        headers: {\n          "content-type": "application/json",\n          ...(accessToken ? { authorization: \`Bearer \${accessToken}\` } : {}),\n          ...(publishableKey ? { apikey: publishableKey } : {}),\n        },\n        body: JSON.stringify({ itemId: item.id }),\n      });\n      const payload = await response.json().catch(() => ({})) as { sent?: boolean; recipient?: string; error?: string; message?: string };\n      if (!response.ok || !payload.sent) throw new Error(payload.error ?? payload.message ?? \`SMTP mailer failed (HTTP \${response.status})\`);\n      setEmailSent(true);\n      setEmailMessage(\`Salary slip sent to \${payload.recipient ?? employee.emailAddress}\`);\n    } catch (error) {\n      setEmailMessage(error instanceof Error ? error.message : "Unable to send salary slip email");\n    } finally {\n      setEmailSending(false);\n    }\n  }`;
source = source.slice(0, sendStart) + replacement + source.slice(sendEnd + sendEndMarker.length);

// Make the visible salary-slip email control a non-submit button.
const modalEnd = source.indexOf("function ", modalStart + 20);
const scopeEnd = modalEnd > modalStart ? modalEnd : source.length;
let modal = source.slice(modalStart, scopeEnd);
modal = modal.replace(/<button\n\s+className="primary-button"\n\s+disabled=\{!employee\?\.emailAddress \|\| emailSending \|\| run\?\.status !== "approved"\}/,
  `<button\n              type="button"\n              className="primary-button"\n              disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}`);
modal = modal.replace(/onClick=\{\(\) => void sendSalarySlipEmail\(\)\}/g,
  `onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sendSalarySlipEmail(); }}`);
modal = modal.replace(/onClick=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); void sendSalarySlipEmail\(\); \}\}/g,
  `onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sendSalarySlipEmail(); }}`);
source = source.slice(0, modalStart) + modal + source.slice(scopeEnd);

const finalModal = source.slice(modalStart, scopeEnd);
if (!finalModal.includes('fetch("https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer"')) throw new Error("Payslip SMTP endpoint not finalized");
if (!finalModal.includes('body: JSON.stringify({ itemId: item.id })')) throw new Error("Payslip SMTP payload not finalized");
if (finalModal.includes('fetch(apiEndpoint')) throw new Error("Payslip modal still contains payroll-api fetch path");
if (!finalModal.includes('type="button"')) throw new Error("Payslip email button is still submit-capable");

await writeFile(file, source, "utf8");
console.log("Finalized salary-slip SMTP routing inside PayslipModal only; payroll-api cannot receive the email action anymore.");
