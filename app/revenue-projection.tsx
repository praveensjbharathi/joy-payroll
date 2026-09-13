"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultRevenueMonth, indiaToday, monthDates, shiftDate,
  type CalendarDay, type ProjectionCompany, type ProjectionUnit, type RevenueMonthConfig,
  type RevenueMonthPlan, type RevenueProjection, type RevenueScenarioInput,
} from "../lib/revenue-projection";
import { projectionCsv, projectionGroups, projectionReportRows, type ReportRows } from "../lib/revenue-projection-reports";
import { printIsolatedElement } from "../lib/print-document";

type Metadata = {
  month: string; today: string; companies: ProjectionCompany[]; units: ProjectionUnit[];
  plans: RevenueMonthPlan[]; defaults: Record<string, RevenueMonthConfig>;
};
type Props = {
  role: string; endpoint: string; accessToken?: string; publishableKey?: string;
  exportExcel: (filename: string, rows: ReportRows, sheetName: string) => void;
};
const money = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
const decimal = (v: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v);
const dayLabel = (date: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
type RequestData = <T>(action: string, details: Record<string, unknown>, signal?: AbortSignal) => Promise<T>;

export function RevenueProjectionPage(props: Props) {
  return props.role === "super_admin" ? <RevenueProjectionWorkspace {...props} /> : <p role="alert">Only Super Admin can access revenue projections.</p>;
}
function RevenueProjectionWorkspace({ endpoint, accessToken, publishableKey, exportExcel }: Props) {
  const [month, setMonth] = useState(indiaToday().slice(0, 7));
  const [asOfDate, setAsOfDate] = useState(indiaToday());
  const [vendorId, setVendorId] = useState(""), [clientName, setClientName] = useState(""), [unitId, setUnitId] = useState("");
  const [tab, setTab] = useState<"forecast" | "setup" | "planning">("forecast");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [result, setResult] = useState<RevenueProjection | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false), [scenarioBusy, setScenarioBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const print = useRef<HTMLDivElement>(null), generation = useRef(0), lastCalculationScope = useRef("");
  const request = useCallback<RequestData>(async (action, details, signal) => {
    const response = await fetch(endpoint, {
      method: "POST", signal,
      headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...(publishableKey ? { apikey: publishableKey } : {}) },
      body: JSON.stringify({ action, ...details }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load revenue projection.");
    return body;
  }, [endpoint, accessToken, publishableKey]);
  useEffect(() => {
    const controller = new AbortController();
    setMetadata(null); setResult(null); setError("");
    request<Metadata>("get-revenue-projection", { month }, controller.signal).then(setMetadata).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load monthly setup.");
    });
    return () => controller.abort();
  }, [request, month]);
  useEffect(() => {
    const requestId = ++generation.current;
    if (!metadata || metadata.month !== month) return;
    const controller = new AbortController();
    const scope = JSON.stringify([month, asOfDate, vendorId, clientName, unitId, metadata.plans.map(p => [p.unitId, p.revision])]);
    if (lastCalculationScope.current !== scope) { setResult(null); lastCalculationScope.current = scope; }
    setLoading(true); setError("");
    request<{ result: RevenueProjection }>("calculate-revenue-projection", { month, asOfDate, vendorId, clientName, unitId }, controller.signal)
      .then(body => { if (requestId === generation.current) setResult(body.result); })
      .catch(e => { if (!controller.signal.aborted) { setResult(null); setError(e instanceof Error ? e.message : "Unable to calculate revenue."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [metadata, month, asOfDate, vendorId, clientName, unitId, refresh, request]);
  useEffect(() => {
    if (tab !== "forecast" || result?.scenario) return;
    const timer = setInterval(() => { if (!document.hidden) setRefresh(v => v + 1); }, 60000);
    return () => clearInterval(timer);
  }, [tab, result?.scenario]);
  const units = metadata?.units.filter(u => (!vendorId || u.vendorId === vendorId) && (!clientName || u.clientName === clientName) && (!unitId || u.id === unitId)) || [];
  const clients = [...new Set(metadata?.units.filter(u => !vendorId || u.vendorId === vendorId).map(u => u.clientName) || [])];
  const dates = monthDates(month), end = dates[dates.length - 1];
  const maxCutoff = end < (metadata?.today || indiaToday()) ? end : (metadata?.today || indiaToday());
  const scopeKey = `${month}|${asOfDate}|${vendorId}|${clientName}|${unitId}`;
  const canExport = Boolean(result?.ready && !loading && !scenarioBusy);
  async function runScenario(scenario: RevenueScenarioInput) {
    const requestId = generation.current;
    setScenarioBusy(true); setError("");
    try {
      const body = await request<{ result: RevenueProjection }>("calculate-revenue-projection", { month, asOfDate, vendorId, clientName, unitId, scenario });
      if (requestId === generation.current) setResult(body.result);
    } catch (e) { if (requestId === generation.current) setError(e instanceof Error ? e.message : "Unable to calculate the scenario."); }
    finally { setScenarioBusy(false); }
  }
  function exportReport(excel: boolean) {
    if (!result?.ready || !metadata) return;
    const rows = projectionReportRows(result, metadata.plans), filename = `joy-revenue-${month}-${asOfDate}`;
    if (excel) return exportExcel(`${filename}.xlsx`, rows, "Revenue projection");
    const url = URL.createObjectURL(new Blob([projectionCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="joy-revenue-page">
    <section className="panel rp-controls">
      <div className="rp-intro"><div><span className="rp-kicker">SUPER ADMIN · MONTHLY PLANNING</span><h2>From daily attendance to your revenue goal</h2><p>Confirm each client’s calendar and rates every month. Actuals, estimates and recruitment plans use the same selected scope.</p></div><span className="rp-badge">Revenue excludes GST</span></div>
      <div className="rp-field-grid">
        <label>Calendar month<input type="month" min="2000-01" max="2099-12" value={month} onChange={e => { if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) return; const next = e.target.value, days = monthDates(next); setMonth(next); setAsOfDate(days[days.length - 1] < indiaToday() ? days[days.length - 1] : indiaToday()); }} /></label>
        <label>Actuals through<input type="date" value={asOfDate} max={maxCutoff} onChange={e => { if (e.target.value) setAsOfDate(e.target.value); }} /></label>
        <label>Group company<select value={vendorId} onChange={e => { setVendorId(e.target.value); setClientName(""); setUnitId(""); }}><option value="">Overall · all group companies</option>{metadata?.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Client<select value={clientName} onChange={e => { setClientName(e.target.value); setUnitId(""); }}><option value="">All clients</option>{clients.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Client unit<select value={unitId} onChange={e => setUnitId(e.target.value)}><option value="">All matching units</option>{metadata?.units.filter(u => (!vendorId || u.vendorId === vendorId) && (!clientName || u.clientName === clientName)).map(u => <option key={u.id} value={u.id}>{u.clientName} · {u.unitName}</option>)}</select></label>
      </div>
      <div className="rp-toolbar"><div className="rp-tabs" role="tablist" aria-label="Revenue planning pages">{([['forecast', 'Actuals & forecast'], ['setup', 'Monthly client setup'], ['planning', 'Recruitment calculators']] as const).map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={tab === id} className={tab === id ? "rp-tab active" : "rp-tab"} onClick={() => setTab(id)}>{label}</button>)}</div><button type="button" className="secondary-button" disabled={loading || scenarioBusy || !metadata} onClick={() => setRefresh(v => v + 1)}>Refresh live data</button></div>
    </section>
    {error && <div className="rp-notice error" role="alert">{error}<button type="button" className="secondary-button" onClick={() => { setRefresh(v => v + 1); if (!metadata) void request<Metadata>("get-revenue-projection", { month }).then(setMetadata).catch(e => setError(e.message)); }}>Retry</button></div>}
    {!metadata && !error && <p role="status">Loading monthly client setup…</p>}
    {result && !result.ready && <section className="rp-notice"><h3>Monthly setup required before calculating</h3><ul>{result.issues.map(issue => <li key={issue}>{issue}</li>)}</ul><button type="button" className="primary-button" onClick={() => setTab("setup")}>Open monthly client setup</button></section>}
    {tab === "setup" && metadata && <MonthlySetup key={month} metadata={metadata} units={units} request={request} onSaved={plan => setMetadata(previous => previous && ({ ...previous, plans: [...previous.plans.filter(p => p.unitId !== plan.unitId), plan] }))} />}
    {loading && tab !== "setup" && <p role="status">Calculating from the latest employee and attendance records…</p>}
    {tab === "planning" && result?.ready && <RecruitmentPlanner key={scopeKey} result={result} plans={metadata?.plans || []} busy={scenarioBusy} onCalculate={runScenario} onInvalidate={() => setResult(previous => previous?.scenario ? { ...previous, scenario: null } : previous)} />}
    {tab !== "setup" && result?.ready && <>
      <div className="rp-toolbar rp-export"><span>Updated {new Date(result.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span><div><button type="button" className="secondary-button" disabled={!canExport} onClick={() => exportReport(false)}>Download CSV</button><button type="button" className="secondary-button" disabled={!canExport} onClick={() => exportReport(true)}>Download Excel</button><button type="button" className="secondary-button" disabled={!canExport} onClick={() => { if (print.current) void printIsolatedElement(print.current, "report"); }}>Print / Save PDF</button></div></div>
      <div ref={print} className="rp-print-report"><ProjectionReport result={result} plans={metadata?.plans || []} /></div>
    </>}
  </div>;
}

function MonthlySetup({ metadata, units, request, onSaved }: { metadata: Metadata; units: ProjectionUnit[]; request: RequestData; onSaved: (plan: RevenueMonthPlan) => void }) {
  const [unitId, setUnitId] = useState(units[0]?.id || "");
  const unit = units.find(u => u.id === unitId) || units[0];
  const saved = metadata.plans.find(p => p.unitId === unit?.id);
  const [draft, setDraft] = useState<RevenueMonthConfig | null>(null), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(""), [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDraft(unit ? structuredClone(saved?.config || metadata.defaults[unit.id]) : null);
    setConfirmed(Boolean(saved?.confirmedAt)); setDirty(false); setMessage(""); setError("");
  }, [unit?.id, saved?.revision, metadata.month]);
  function update(next: RevenueMonthConfig) { setDraft(next); setConfirmed(false); setDirty(true); setMessage(""); }
  function updateDay(index: number, patch: Partial<CalendarDay>) { if (draft) update({ ...draft, days: draft.days.map((d, i) => i === index ? { ...d, ...patch } : d) }); }
  if (!unit || !draft) return <section className="panel"><h2>Monthly client setup</h2><p>No clients match this selection. Add a client in Group Companies &amp; Clients.</p></section>;
  const fields: { key: keyof RevenueMonthConfig; label: string; help?: string; min?: number; max?: number }[] = [
    { key: "salaryDivisor", label: "Monthly salary divisor (days)", min: 1, max: 31, help: "Used only for monthly salaries. Keep the agreed client divisor even when calendar working days differ." },
    { key: "standardHours", label: "Standard hours per day", min: 1, max: 24 },
    { key: "overtimeHourlyRate", label: "Base OT hourly rate (₹)", help: "0 uses each employee’s daily salary ÷ standard hours. The OT multiplier applies to this rate." },
    { key: "overtimeMultiplier", label: "OT multiplier", max: 5 },
    { key: "holidayWorkMultiplier", label: "Holiday work wage multiplier", min: 1, max: 5, help: "Applies to holiday-present attendance and projected work on marked government holidays." },
    { key: "employerCostPercent", label: "Billed employer costs (% of earned wages)", max: 100 },
    { key: "serviceChargePercent", label: "Service charge (%)", max: 100 },
    { key: "otherBillingPerDay", label: "Other billing per employee payable day (₹)" },
    { key: "operatingCostPerDay", label: "Operating cost per employee payable day (₹)" },
    { key: "fallbackDailySalary", label: "Fallback daily salary for missing master rates (₹)", help: "0 requires employee master rates. A positive amount is an explicit planning assumption, identified in reports." },
    { key: "recruitmentDailySalary", label: "Expected new recruit daily salary (₹)", help: "0 uses the average daily salary of active employees at this client unit." },
    { key: "fallbackAttendancePercent", label: "Attendance assumption when history is missing (%)", max: 100 },
    { key: "fallbackOtHours", label: "OT hours per worked day when history is missing", max: 24 - draft.standardHours },
    { key: "monthlyTarget", label: "This unit’s monthly revenue target (₹)", help: "Targets are added for client, company and overall views. Leave 0 if no target is set." },
  ];
  return <section className="panel rp-setup"><h2>Set the calendar before starting each month</h2><p>Review government holidays with the client, then mark whether work continues and whether closed days are paid. Every new month needs confirmation, including clients operating all 31 days.</p>
    <div className="rp-field-grid"><label>Client setup<select disabled={busy} value={unit.id} onChange={e => setUnitId(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>{metadata.companies.find(c => c.id === u.vendorId)?.name} / {u.clientName} / {u.unitName} · {metadata.plans.find(p => p.unitId === u.id)?.confirmedAt ? "Confirmed" : "Setup pending"}</option>)}</select></label><div className="rp-setup-status"><strong>{saved?.confirmedAt && !dirty ? "Confirmed" : "Needs confirmation"}</strong><span>{metadata.month} · {draft.days.filter(d => d.working).length} working days · {draft.days.filter(d => !d.working && d.paid).length} paid closed days</span>{saved && <small>Saved revision {saved.revision}</small>}</div></div>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
      try { const body = await request<{ plan: RevenueMonthPlan }>("save-revenue-month-plan", { month: metadata.month, unitId: unit.id, config: draft, confirmed, revision: saved?.revision || 0 }); onSaved(body.plan); setDirty(false); setMessage(confirmed ? "Monthly calendar and rates confirmed. Forecasts will use this setup." : "Draft saved. Confirm this month’s setup to enable forecasts."); }
      catch (error) { setError(error instanceof Error ? error.message : "Unable to save monthly setup."); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}>
        <div className="rp-toolbar"><h3>{metadata.month} · Working calendar</h3><div><button type="button" className="secondary-button" onClick={() => update({ ...draft, days: draft.days.map(d => ({ ...d, working: true, paid: true })) })}>All {draft.days.length} days working</button><button type="button" className="secondary-button" onClick={() => update({ ...draft, days: draft.days.map(d => new Date(d.date).getUTCDay() === 0 ? { ...d, kind: d.kind === "government_holiday" ? d.kind : "week_off", working: false, paid: draft.paidWeekOff, label: d.label || "Sunday" } : d) })}>Sundays off</button><button type="button" className="secondary-button" onClick={async () => {
          setBusy(true); setError("");
          try {
            const previousMonth = shiftDate(`${metadata.month}-01`, -1).slice(0, 7);
            const previous = await request<Metadata>("get-revenue-projection", { month: previousMonth });
            const old = previous.plans.find(p => p.unitId === unit.id);
            if (!old) throw new Error("No previous month setup exists for this client unit.");
            const fresh = defaultRevenueMonth(metadata.month, unit, { paidLeave: Number(old.config.paidLeave), paidWeekOff: Number(old.config.paidWeekOff) });
            update({ ...old.config, days: fresh.days, monthlyTarget: 0 }); setMessage("Previous rates copied. Review this month’s Sundays, holiday dates and target before confirming.");
          } catch (e) { setError(e instanceof Error ? e.message : "Unable to copy previous rates."); } finally { setBusy(false); }
        }}>Copy previous month’s rates</button></div></div>
        <div className="rp-calendar" aria-label="Client daily working calendar">{draft.days.map((day, i) => <div key={day.date} className={`rp-day ${day.working ? "working" : day.paid ? "paid" : "closed"}`}>
          <strong>{dayLabel(day.date)}</strong><label>Day type<select value={day.kind} onChange={e => { const kind = e.target.value as CalendarDay["kind"]; updateDay(i, { kind, working: kind === "working", paid: kind === "government_holiday" ? draft.paidHolidays : kind === "week_off" ? draft.paidWeekOff : kind === "working", label: kind === "week_off" && new Date(day.date).getUTCDay() === 0 ? "Sunday" : "" }); }}><option value="working">Regular day</option><option value="week_off">Weekly off / Sunday</option><option value="government_holiday">Government holiday</option><option value="closure">Client closure</option></select></label>
          <div className="rp-check-row"><label><input type="checkbox" checked={day.working} onChange={e => updateDay(i, { working: e.target.checked, ...(e.target.checked ? { paid: true } : {}) })} />Client working</label><label><input type="checkbox" checked={day.paid} disabled={day.working || busy} onChange={e => updateDay(i, { paid: e.target.checked })} />Paid when closed</label></div>
          <label>{day.kind === "government_holiday" ? "Government holiday name" : "Calendar note"}<input maxLength={120} required={day.kind === "government_holiday"} value={day.label} placeholder={day.kind === "government_holiday" ? "Enter the client-observed holiday" : "Optional note"} onChange={e => updateDay(i, { label: e.target.value })} /></label>
        </div>)}</div>
        <h3>Salary, OT and agreed billing rules</h3><p>Billing = earned salary including OT + billed employer costs + service charge + other billing. The calendar controls projected working days; it does not change payroll attendance cycles.</p>
        <div className="rp-field-grid rp-rates">{fields.map(field => <label key={field.key}>{field.label}<input type="number" required min={field.min || 0} max={field.max ?? (field.key === "monthlyTarget" ? 1e10 : 1e6)} step="any" value={draft[field.key] as number} onChange={e => update({ ...draft, [field.key]: Number(e.target.value) })} />{field.help && <small>{field.help}</small>}</label>)}<label>Service-charge basis<select value={draft.feeBasis} onChange={e => update({ ...draft, feeBasis: e.target.value as RevenueMonthConfig["feeBasis"] })}><option value="salary">Earned salary including OT</option><option value="salary_plus_employer_cost">Earned salary + employer costs</option></select></label></div>
        <div className="rp-check-row">{([["paidLeave", "Leave is paid"], ["paidWeekOff", "Individual weekly offs are paid"], ["paidHolidays", "Holidays are paid by default"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={e => update({ ...draft, [key]: e.target.checked })} />{label}</label>)}</div><p className="rp-small">Paid-day defaults apply to attendance and newly marked calendar days. Review the paid checkbox on each closed date. Government holiday dates are confirmed by you for each client.</p>
        <div className="rp-confirm"><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have reviewed this client’s {metadata.month} calendar, Sunday working, government holidays, billing rates and fallback assumptions.</label><button className="primary-button" disabled={busy}>{busy ? "Saving…" : confirmed ? "Save & confirm this month" : "Save draft"}</button>{dirty && <span>Unsaved changes</span>}</div>
      </fieldset>
    </form>{error && <p className="rp-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}

function RecruitmentPlanner({ result, plans, busy, onCalculate, onInvalidate }: { result: RevenueProjection; plans: RevenueMonthPlan[]; busy: boolean; onCalculate: (input: RevenueScenarioInput) => Promise<void>; onInvalidate: () => void }) {
  const first = result.units[0];
  const [input, setInput] = useState<RevenueScenarioInput>(() => ({ direction: "revenue_to_manpower", unitId: first?.unitId || "", joiningDate: result.asOfDate < `${result.month}-01` ? `${result.month}-01` : shiftDate(result.asOfDate, 1), targetRevenue: result.target || result.total.revenue, manpower: 0, countMode: "additional", dailySalary: first?.recruitmentDailySalary || 0, attendancePercent: first?.attendancePercent || 0, otPerWorkedDay: first?.otPerWorkedDay || 0 }));
  const config = plans.find(p => p.unitId === input.unitId)?.config;
  const days = monthDates(result.month), end = days[days.length - 1];
  function update(patch: Partial<RevenueScenarioInput>) { setInput(previous => ({ ...previous, ...patch })); onInvalidate(); }
  if (result.asOfDate >= end) return <section className="panel"><h2>Recruitment calculators</h2><p>This month has no upcoming days after the selected actuals cutoff. Choose an earlier cutoff for a historical scenario or select an upcoming month.</p></section>;
  return <section className="panel rp-planning"><span className="rp-kicker">MANUAL WHAT-IF PLANNING</span><h2>Plan recruitment around your target</h2><p>Baseline for this scope: <strong>{money(result.total.revenue)}</strong>. New recruits are assigned to the selected client unit and contribute from their joining date.</p>
    <form onSubmit={e => { e.preventDefault(); if (!busy) void onCalculate(input); }}><fieldset disabled={busy}><div className="rp-field-grid">
      <label>Calculator<select value={input.direction} onChange={e => update({ direction: e.target.value as RevenueScenarioInput["direction"] })}><option value="revenue_to_manpower">Target revenue → required manpower</option><option value="manpower_to_revenue">Planned manpower → achievable revenue</option></select></label>
      <label>Recruitment deployment<select value={input.unitId} onChange={e => { const u = result.units.find(u => u.unitId === e.target.value)!; update({ unitId: u.unitId, dailySalary: u.recruitmentDailySalary, attendancePercent: u.attendancePercent, otPerWorkedDay: u.otPerWorkedDay }); }}>{result.units.map(u => <option key={u.unitId} value={u.unitId}>{u.company} / {u.client} / {u.unit}</option>)}</select></label>
      <label>Expected joining date<input type="date" required min={result.asOfDate < days[0] ? days[0] : shiftDate(result.asOfDate, 1)} max={end} value={input.joiningDate} onChange={e => update({ joiningDate: e.target.value })} /></label>
      <label>Target revenue for selected scope (₹)<input type="number" required min={0} max={1e10} step="0.01" value={input.targetRevenue} onChange={e => update({ targetRevenue: Number(e.target.value) })} /></label>
      {input.direction === "manpower_to_revenue" && <><label>Manpower entry type<select value={input.countMode} onChange={e => update({ countMode: e.target.value as RevenueScenarioInput["countMode"] })}><option value="additional">Additional recruits at this unit</option><option value="total">Desired total in selected scope</option></select></label><label>{input.countMode === "additional" ? "Additional recruits" : "Desired total manpower in selected scope"}<input type="number" required min={0} max={1000000} step={1} value={input.manpower} onChange={e => update({ manpower: Number(e.target.value) })} /></label></>}
      <label>New recruit daily salary (₹)<input type="number" required min={0.01} max={1e6} step="any" value={input.dailySalary} onChange={e => update({ dailySalary: Number(e.target.value) })} /></label>
      <label>Expected attendance (%)<input type="number" required min={0} max={100} step="any" value={input.attendancePercent} onChange={e => update({ attendancePercent: Number(e.target.value) })} /></label>
      <label>OT hours per worked day<input type="number" required min={0} max={24 - (config?.standardHours || 8)} step="any" value={input.otPerWorkedDay} onChange={e => update({ otPerWorkedDay: Number(e.target.value) })} /></label>
    </div><button className="primary-button" disabled={busy}>{busy ? "Calculating…" : input.direction === "revenue_to_manpower" ? "Calculate required manpower" : "Calculate achievable revenue"}</button></fieldset></form>
    {result.scenario && <div className="rp-scenario" aria-live="polite"><h3>Scenario result</h3><p>{result.scenario.explanation}</p>{result.scenario.attainable && <div className="rp-stat-grid"><Stat label="Additional recruits" value={String(result.scenario.additionalRecruits)} tone="blue" /><Stat label="Total manpower in selected scope" value={String(result.scenario.totalAtJoining)} /><Stat label="Revenue per new recruit" value={money(result.scenario.perRecruitRevenue)} /><Stat label="Additional revenue" value={money(result.scenario.additionalRevenue)} /><Stat label="Achievable month revenue" value={money(result.scenario.achievableRevenue)} tone="violet" /><Stat label="Remaining target gap" value={money(result.scenario.targetGap)} tone="amber" /></div>}<p>{result.scenario.remainingWorkingDays} remaining client working days from {result.scenario.joiningDate}. The month’s paid closed days also follow the confirmed calendar.</p></div>}
  </section>;
}

function Stat({ label, value, tone = "green" }: { label: string; value: string; tone?: string }) {
  return <div className={`rp-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
function Table({ headings, rows }: { headings: string[]; rows: ReportRows }) {
  return <div className="rp-table-scroll"><table><thead><tr>{headings.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headings.length}>No entries for this selection.</td></tr>}</tbody></table></div>;
}
export function ProjectionReport({ result, plans }: { result: RevenueProjection; plans: RevenueMonthPlan[] }) {
  return <>
    <section className="panel rp-summary"><h2>Joy Payroll · Revenue projection · {result.month}</h2><p>Calendar {result.month}-01 to {monthDates(result.month).at(-1)} · Actuals through {result.asOfDate} · Revenue excluding GST</p><p className="rp-small">Scope: {result.units.map(u => `${u.company} / ${u.client} / ${u.unit}`).join("; ")}</p>
      <div className="rp-stat-grid"><Stat label="Live manpower at cutoff" value={decimal(result.liveEmployees)} /><Stat label="Actual earned revenue" value={money(result.actual.revenue)} tone="green" /><Stat label="Pending attendance estimate" value={money(result.pending.revenue)} tone="amber" /><Stat label="Upcoming days forecast" value={money(result.future.revenue)} tone="blue" /><Stat label="Full-month revenue forecast" value={money(result.total.revenue)} tone="violet" /><Stat label="Monthly revenue target" value={money(result.target)} /></div>
      <p><strong>{result.recordedEntries} recorded employee-day entries · {result.pendingEntries} pending employee-day entries.</strong> Full-month forecast = actual earned revenue + pending attendance estimate + upcoming days forecast.</p>
      {result.target > 0 && <div className="rp-target"><label>Projected target achievement · {decimal(result.total.revenue / result.target * 100)}%<progress max={100} value={Math.min(100, result.total.revenue / result.target * 100)} /></label><strong>{money(Math.max(0, result.target - result.total.revenue))} target gap</strong></div>}
      {!!result.warnings.length && <div className="rp-notice"><h3>Data and assumptions</h3><ul>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
    </section>
    {(["company", "client"] as const).map(group => <section key={group} className="panel"><h3>{group === "company" ? "Group company" : "Client"} revenue summary</h3><Table headings={[group === "company" ? "Group company" : "Company / client", "Live manpower", "Actual", "Pending estimate", "Upcoming forecast", "Full month", "Target"]} rows={projectionGroups(result.units, group).map(g => [g.label, g.live, money(g.actual), money(g.pending), money(g.future), money(g.total), money(g.target)])} /></section>)}
    <section className="panel"><h3>Daily attendance, OT and revenue</h3><p className="rp-small">Green: recorded actuals. Amber: estimates for pending past attendance. Blue: upcoming days. Closed unpaid days can have zero revenue.</p><div className="rp-table-scroll"><table className="rp-daily"><thead><tr>{["Date", "Actual worked days", "Actual OT hours", "Actual revenue", "Pending estimate", "Upcoming forecast", "Estimated OT hours", "Pending entries"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{result.daily.map(d => <tr key={d.date}><td>{dayLabel(d.date)}</td><td>{decimal(d.actual.workedDays)}</td><td>{decimal(d.actual.overtimeHours)}</td><td className="rp-actual">{money(d.actual.revenue)}</td><td className="rp-pending">{money(d.pending.revenue)}</td><td className="rp-future">{money(d.future.revenue)}</td><td>{decimal(d.pending.overtimeHours + d.future.overtimeHours)}</td><td>{d.pendingEntries}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h3>Automatic recruitment requirement</h3><p>Uses each unit’s saved target, current workforce forecast and earliest upcoming joining date. Set a monthly target in client setup to populate this report.</p><Table headings={["Company / client / unit", "Joining date", "Target", "Revenue per recruit", "Additional recruits", "Expected revenue"]} rows={result.recruitmentPlans.map(s => [s.client, s.joiningDate, money(s.targetRevenue), money(s.perRecruitRevenue), s.additionalRecruits ?? "Not achievable", money(s.achievableRevenue)])} /></section>
    {result.scenario && <section className="panel"><h3>Manual scenario comparison</h3><p>{result.scenario.explanation}</p><Table headings={["Deployment", "Joining date", "Baseline revenue", "Additional recruits", "Additional revenue", "Achievable revenue", "Target gap"]} rows={[[result.scenario.client, result.scenario.joiningDate, money(result.scenario.baselineRevenue), result.scenario.additionalRecruits ?? "Not achievable", money(result.scenario.additionalRevenue), money(result.scenario.achievableRevenue), money(result.scenario.targetGap)]]} /><p className="rp-small">Daily salary {money(result.scenario.dailySalary)} · Attendance {decimal(result.scenario.attendancePercent)}% · OT {decimal(result.scenario.otPerWorkedDay)} hours per worked day · {result.scenario.remainingWorkingDays} remaining working days.</p></section>}
    <section className="panel"><h3>Month-end billing and contribution estimate</h3><Table headings={["Client / unit", "Earned salary incl. OT", "Employer costs", "Service-charge income", "Other billing", "Operating costs", "Contribution"]} rows={result.units.map(u => [`${u.company} / ${u.client} / ${u.unit}`, money(u.total.salary), money(u.total.employerCost), money(u.total.serviceCharge), money(u.total.otherBilling), money(u.total.operatingCost), money(u.total.contribution)])} /><p className="rp-small">Contribution subtracts earned salary, billed employer costs and the configured operating costs from revenue. Actuals represent attendance-based earned billing; no invoices, payroll payments or recruitment records are created by these estimates.</p></section>
    <section className="panel"><h3>Client calendar and forecast assumptions</h3><Table headings={["Client / unit", "Working / paid closed days", "Attendance / paid leave", "OT per worked day", "History source", "Monthly setup"]} rows={result.units.map(u => [`${u.company} / ${u.client} / ${u.unit}`, `${u.workingDays} / ${u.paidClosedDays}`, `${decimal(u.attendancePercent)}% / ${decimal(u.paidLeavePercent)}%`, decimal(u.otPerWorkedDay), u.assumptionSource, `Revision ${u.planRevision}; ${u.confirmedAt}`])} />
      <details open className="rp-calendar-details"><summary>View confirmed calendar exceptions and billing rates</summary>{result.units.map(u => { const p = plans.find(p => p.unitId === u.unitId && p.month === result.month); return p && <div key={u.unitId}><h4>{u.company} / {u.client} / {u.unit}</h4><p>Salary divisor: {p.config.salaryDivisor}; standard hours: {p.config.standardHours}; base OT rate: {p.config.overtimeHourlyRate ? money(p.config.overtimeHourlyRate) : "daily salary ÷ standard hours"}; OT multiplier: {p.config.overtimeMultiplier}; holiday wage multiplier: {p.config.holidayWorkMultiplier}; employer costs: {p.config.employerCostPercent}%; service charge: {p.config.serviceChargePercent}% on {p.config.feeBasis === "salary" ? "salary" : "salary + employer costs"}; other billing / payable day: {money(p.config.otherBillingPerDay)}; operating cost / payable day: {money(p.config.operatingCostPerDay)}; missing-rate fallback salary: {money(p.config.fallbackDailySalary)}.</p><Table headings={["Date", "Day type", "Working", "Paid when closed", "Holiday / note"]} rows={p.config.days.filter(d => !d.working || d.kind !== "working" || d.label).map(d => [d.date, d.kind.replaceAll("_", " "), d.working ? "Yes" : "No", d.paid ? "Yes" : "No", d.label])} /></div>; })}</details>
    </section>
  </>;
}
