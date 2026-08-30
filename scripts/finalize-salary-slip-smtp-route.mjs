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

// Find the exact end of sendSalarySlipEmail with brace counting so nested try/catch blocks cannot confuse the patch.
const firstBrace = source.indexOf("{", sendStart);
let depth = 0;
let sendEnd = -1;
for (let i = firstBrace; i < source.length; i += 1) {
  if (source[i] === "{") depth += 1;
  if (source[i] === "}") {
    depth -= 1;
    if (depth === 0) {
      sendEnd = i + 1;
      break;
    }
  }
}
if (sendEnd < 0) throw new Error("sendSalarySlipEmail end not found");

const replacement = `  async function sendSalarySlipEmail() {\n    if (!employee?.emailAddress || !run?.id || run.status !== "approved" || emailSending) return;\n    setEmailSending(true);\n    setEmailSent(false);\n    setEmailMessage("");\n    try {\n      const response = await fetch("https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer", {\n        method: "POST",\n        headers: {\n          "content-type": "application/json",\n          ...(accessToken ? { authorization: \`Bearer \${accessToken}\` } : {}),\n          ...(publishableKey ? { apikey: publishableKey } : {}),\n        },\n        body: JSON.stringify({ itemId: item.id }),\n      });\n      const payload = await response.json().catch(() => ({})) as { sent?: boolean; recipient?: string; error?: string; message?: string };\n      if (!response.ok || !payload.sent) throw new Error(payload.error ?? payload.message ?? \`SMTP mailer failed (HTTP \${response.status})\`);\n      setEmailSent(true);\n      setEmailMessage(\`Salary slip sent to \${payload.recipient ?? employee.emailAddress}\`);\n    } catch (error) {\n      setEmailMessage(error instanceof Error ? error.message : "Unable to send salary slip email");\n    } finally {\n      setEmailSending(false);\n    }\n  }`;
source = source.slice(0, sendStart) + replacement + source.slice(sendEnd);

// Make every salary-slip email action explicitly non-submit.
source = source.replace(
  /<button\n(\s+)className="primary-button"\n(\s+)disabled=\{!employee\?\.emailAddress \|\| emailSending \|\| run\?\.status !== "approved"\}/g,
  `<button\n$1type="button"\n$1className="primary-button"\n$2disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}`,
);
source = source.replace(
  /onClick=\{\(\) => void sendSalarySlipEmail\(\)\}/g,
  `onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sendSalarySlipEmail(); }}`,
);

const verifiedSend = source.slice(sendStart, sendStart + replacement.length + 80);
if (!verifiedSend.includes('fetch("https://fsiinadrkhsfzuheckbp.supabase.co/functions/v1/salary-slip-mailer"')) throw new Error("Payslip SMTP endpoint not finalized");
if (!verifiedSend.includes('body: JSON.stringify({ itemId: item.id })')) throw new Error("Payslip SMTP payload not finalized");
if (verifiedSend.includes("fetch(apiEndpoint")) throw new Error("Payslip email sender still points to payroll-api");
if (!source.includes('type="button"')) throw new Error("Salary-slip email button is still submit-capable");

await writeFile(file, source, "utf8");
console.log("Finalized salary-slip SMTP sender deterministically; the email action cannot route to payroll-api.");
