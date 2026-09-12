"use client";
import { useRef, useState } from "react";
import { referenceReport } from "../lib/referral-reports";
import type { calculateRevenue, RevenueAssumptions } from "../lib/revenue-calculator";
import { printIsolatedElement } from "../lib/print-document";
import type { AppData, PayrollRun } from "./payroll-app";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
type Row = (string | number)[];
function downloadRows(name: string, rows: Row[], excel = false) {
  const text = (v: string | number) => typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? `'${v}` : String(v);
  const escape = (v: string | number) => text(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const body = excel ? `\ufeff<html><head><meta charset="utf-8"></head><body><table>${rows.map(r => `<tr>${r.map(c => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</table></body></html>` : "\ufeff" + rows.map(r => r.map(c => `"${text(c).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: excel ? "application/vnd.ms-excel" : "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${name}.${excel ? "xls" : "csv"}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ReferenceReports({ data, run, vendorId, unitId }: { data: AppData; run: PayrollRun | null; vendorId: string; unitId: string }) {
  const [reference, setReference] = useState<1 | 2>(1);
  const [minimum, setMinimum] = useState(0), [bonus, setBonus] = useState(0);
  const [query, setQuery] = useState("");
  const print = useRef<HTMLDivElement>(null);
  const people = data.employees.filter(e => (!vendorId || e.vendorId === vendorId) && (!unitId || e.clientUnitId === unitId));
  const items = data.payrollItems.filter(i => i.runId === run?.id);
  const rows = referenceReport(people, items, reference, minimum, bonus).filter(r => `${r.referrerName} ${r.referrerCode} ${r.employeeName} ${r.employeeCode}`.toLowerCase().includes(query.toLowerCase()));
  const title = reference === 1 ? "Reference 1 — direct employee referral report" : "Reference 2 — other reference report";
  const headings = ["Referrer code", "Referrer name", ...(reference === 2 ? ["Phone", "Position", "Address"] : []), "Employee code", "Employee name", "Joining date", "Employee status", "Worked days", "Payable days", "Bonus estimate"];
  const values: Row[] = rows.map(r => [r.referrerCode, r.referrerName, ...(reference === 2 ? [r.phone, r.position, r.address] : []), r.employeeCode, r.employeeName, r.joiningDate, r.status, r.workedDays, r.payableDays, r.bonusEstimate]);
  const summaries = new Map<string, { name: string; count: number; eligible: number; total: number }>();
  for (const r of rows) { const key = r.referrerId || `${r.referrerName.trim().toLowerCase()}|${r.phone}`; const group = summaries.get(key) || { name: [r.referrerCode, r.referrerName].filter(Boolean).join(" · "), count: 0, eligible: 0, total: 0 }; group.count++; if (r.eligible) group.eligible++; group.total += r.bonusEstimate; summaries.set(key, group); }
  const exportRows: Row[] = [[title], ["Payroll period", run?.payPeriod || "No payroll selected"], ["Minimum worked days", minimum], ["Bonus per qualifying employee", bonus], ["Bonus estimates require review; no bonus payments are posted."], headings, ...values];
  return <section className="panel joy-referral-revenue"><h2>Reference reports &amp; team bonus</h2><p>Choose the company, location and payroll period at the top of the application. Each reference has its own detail and summary report.</p>
    <div className="joy-question-grid"><label>Report<select value={reference} onChange={e => setReference(Number(e.target.value) as 1 | 2)}><option value={1}>Reference 1 — Joy direct employee</option><option value={2}>Reference 2 — typed reference</option></select></label><label>Search referrer or employee<input value={query} onChange={e => setQuery(e.target.value)} /></label><label>Minimum worked days in selected payroll<input type="number" min={0} step="0.5" value={minimum} onChange={e => setMinimum(Math.max(0, Number(e.target.value) || 0))} /></label><label>Bonus per qualifying employee (₹)<input type="number" min={0} step="0.01" value={bonus} onChange={e => setBonus(Math.max(0, Number(e.target.value) || 0))} /></label></div>
    <p>Bonus is an estimate using the worked days in this payroll. Enter your team bonus rule here; payment approval and posting remain separate.</p>
    <div className="joy-report-actions"><button type="button" className="secondary-button" onClick={() => downloadRows(`reference-${reference}-${run?.payPeriod || "all"}`, exportRows)}>Download CSV</button><button type="button" className="secondary-button" onClick={() => downloadRows(`reference-${reference}-${run?.payPeriod || "all"}`, exportRows, true)}>Download Excel</button><button type="button" className="secondary-button" onClick={() => { if (print.current) void printIsolatedElement(print.current, "report"); }}>Print / Save PDF</button></div>
    <div ref={print}><h3>{title}</h3><p>Payroll: {run?.payPeriod || "Select a payroll to calculate worked days"} · {rows.length} referred employees · Total estimated bonus: {money(rows.reduce((n, r) => n + r.bonusEstimate, 0))}</p>
      <div className="joy-table-scroll"><table className="joy-input-table"><thead><tr>{headings.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{values.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headings.length}>No {reference === 1 ? "direct employee referrals" : "second references"} in this selection.</td></tr>}</tbody></table></div>
      {summaries.size > 0 && <><h3>Referrer summary</h3><div className="joy-table-scroll"><table className="joy-input-table"><thead><tr><th>Referrer</th><th>Referred employees</th><th>Qualifying employees</th><th>Estimated bonus</th></tr></thead><tbody>{[...summaries].map(([key, g]) => <tr key={key}><td>{g.name}</td><td>{g.count}</td><td>{g.eligible}</td><td>{money(g.total)}</td></tr>)}</tbody></table></div><button type="button" className="secondary-button" onClick={() => downloadRows(`reference-${reference}-summary`, [[title], ["Referrer", "Referred employees", "Qualifying employees", "Estimated bonus"], ...[...summaries.values()].map(g => [g.name, g.count, g.eligible, g.total])])}>Download summary CSV</button></>}
    </div>
  </section>;
}

export function RevenueCalculator({ endpoint, accessToken, publishableKey, run }: { endpoint: string; accessToken?: string; publishableKey?: string; run: PayrollRun | null }) {
  const [values, setValues] = useState<RevenueAssumptions>({ serviceChargePercent: 0, employerCost: 0, otherBilling: 0, operatingCost: 0, referralBonus: 0, gstPercent: 0, feeBasis: "salary" });
  const [result, setResult] = useState<ReturnType<typeof calculateRevenue> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const print = useRef<HTMLDivElement>(null);
  const labels = { serviceChargePercent: "Service charge (%)", employerCost: "Employer contributions / benefits billed (₹)", otherBilling: "Other billing (₹)", operatingCost: "Operating costs (₹)", referralBonus: "Team referral bonus cost (₹)", gstPercent: "Applicable GST (%)" };
  const resultLabels = { employeeCount: "Employees", payableDays: "Total payable days", overtimeHours: "Overtime hours", earnedSalary: "Earned gross salary", feeBasisAmount: "Service-charge basis", serviceCharge: "Service-charge income", revenueExcludingGst: "Billing revenue excluding GST", gst: "GST", invoiceTotal: "Invoice total", totalCost: "Total costs", contribution: "Estimated contribution", marginPercent: "Contribution margin (%)" };
  const rows: Row[] = result ? Object.entries(result).map(([key, amount]) => [resultLabels[key as keyof typeof resultLabels], amount]) : [];
  return <section className="panel joy-referral-revenue"><h2>Revenue calculator · Super Admin</h2><p>Uses the selected payroll’s earned gross salary and payable days, including its calculated or imported overtime. Enter the agreed billing and cost amounts for this payroll.</p><p>Selected payroll: <strong>{run?.payPeriod || "None"}</strong> · {run?.status || "Select a payroll"}</p>
    <form onSubmit={async e => { e.preventDefault(); if (!run || busy) return; setBusy(true); setError(""); setResult(null); try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...(publishableKey ? { apikey: publishableKey } : {}) }, body: JSON.stringify({ action: "calculate-revenue", runId: run.id, assumptions: values }) });
      const body = await response.json(); if (!response.ok) throw Error(body.error || "Unable to calculate revenue"); setResult(body.result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate revenue"); } finally { setBusy(false); } }}>
      <div className="joy-question-grid">{Object.entries(labels).map(([key, label]) => <label key={key}>{label}<input required disabled={busy} type="number" min={0} max={key.endsWith("Percent") ? 100 : 1e10} step="0.01" value={values[key as keyof typeof labels]} onChange={e => { setResult(null); setValues({ ...values, [key]: Number(e.target.value) }); }} /></label>)}<label>Service-charge basis<select disabled={busy} value={values.feeBasis} onChange={e => { setResult(null); setValues({ ...values, feeBasis: e.target.value as RevenueAssumptions["feeBasis"] }); }}><option value="salary">Earned salary</option><option value="salary_plus_employer_cost">Earned salary + employer contributions</option></select></label></div>
      <button className="primary-button" disabled={busy || !run}>{busy ? "Calculating…" : "Calculate revenue"}</button>
    </form>{error && <p role="alert">{error}</p>}
    <p>Billing = earned salary + billed employer contributions + service charge + other billing. Contribution = billing excluding GST − salary − employer contributions − operating costs − referral bonus. GST is entered by you and excluded from contribution.</p>
    {result && <><div ref={print}><h3>Revenue estimate · {run?.payPeriod}</h3><p>Payroll status: {run?.status}. These estimates do not change salaries, invoices or bonus payments.</p><table className="joy-input-table"><tbody>{rows.map(([label, amount], i) => <tr key={label}><th>{label}</th><td>{i < 3 || label === "Contribution margin (%)" ? amount : money(Number(amount))}</td></tr>)}</tbody></table></div><div className="joy-report-actions"><button className="secondary-button" onClick={() => downloadRows(`revenue-${run?.payPeriod}`, [["Revenue estimate", run?.payPeriod || ""], ...Object.entries(labels).map(([k, label]) => [label, values[k as keyof typeof labels]]), ["Service-charge basis", values.feeBasis], ...rows])}>Download calculation CSV</button><button className="secondary-button" onClick={() => { if (print.current) void printIsolatedElement(print.current, "report"); }}>Print / Save PDF</button></div></>}
  </section>;
}
