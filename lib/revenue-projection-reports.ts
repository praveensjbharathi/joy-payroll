import type { RevenueMonthPlan, RevenueProjection, UnitProjection } from "./revenue-projection";
export type ReportCell = string | number;
export type ReportRows = ReportCell[][];
export function projectionGroups(units: UnitProjection[], by: "company" | "client") {
  const groups = new Map<string, { label: string; live: number; actual: number; pending: number; future: number; total: number; target: number }>();
  for (const u of units) {
    const key = by === "company" ? u.vendorId : `${u.vendorId}|${u.client}`;
    const row = groups.get(key) || { label: by === "company" ? u.company : `${u.company} / ${u.client}`, live: 0, actual: 0, pending: 0, future: 0, total: 0, target: 0 };
    row.live += u.liveEmployees; row.actual += u.actual.revenue; row.pending += u.pending.revenue;
    row.future += u.future.revenue; row.total += u.total.revenue; row.target += u.target;
    groups.set(key, row);
  }
  return [...groups.values()];
}
export function projectionReportRows(result: RevenueProjection, plans: RevenueMonthPlan[]): ReportRows {
  const rows: ReportRows = [
    ["Joy Payroll — Revenue Projection"], ["Calendar month", result.month], ["Actuals cutoff", result.asOfDate],
    ["Generated at", result.generatedAt], ["Revenue definition", "Client billing excluding GST; attendance-based earned billing, subject to the confirmed client rates."],
    ["Scope", result.units.map(u => `${u.company} / ${u.client} / ${u.unit}`).join("; ")],
    ["Actual revenue", result.actual.revenue], ["Pending attendance estimate", result.pending.revenue],
    ["Upcoming days forecast", result.future.revenue], ["Full-month forecast", result.total.revenue],
    ["Monthly target", result.target], ["Target gap", Math.max(0, result.target - result.total.revenue)],
    ["Live employees at cutoff", result.liveEmployees], ["Pending employee-day entries", result.pendingEntries],
    ...result.warnings.map(w => ["Data note", w]), [],
  ];
  for (const group of ["company", "client"] as const) {
    rows.push([`${group === "company" ? "Group company" : "Client"} summary`], ["Scope", "Live employees", "Actual revenue", "Pending estimate", "Upcoming forecast", "Full month", "Target"]);
    for (const g of projectionGroups(result.units, group)) rows.push([g.label, g.live, g.actual, g.pending, g.future, g.total, g.target]);
    rows.push([]);
  }
  rows.push(["Daily report"], ["Date", "Recorded entries", "Pending entries", "Actual worked days", "Actual OT hours", "Actual revenue", "Pending estimate", "Upcoming forecast", "Estimated worked days", "Estimated OT hours", "Total revenue"]);
  for (const d of result.daily) rows.push([d.date, d.recordedEntries, d.pendingEntries, d.actual.workedDays, d.actual.overtimeHours, d.actual.revenue, d.pending.revenue, d.future.revenue, d.pending.workedDays + d.future.workedDays, d.pending.overtimeHours + d.future.overtimeHours, d.actual.revenue + d.pending.revenue + d.future.revenue]);
  rows.push([], ["Salary, billing and contribution"], ["Company", "Client", "Unit", "Actual salary", "Projected total salary", "Employer costs", "Service-charge income", "Other billing", "Operating costs", "Contribution", "Working days", "Paid closed days"]);
  for (const u of result.units) rows.push([u.company, u.client, u.unit, u.actual.salary, u.total.salary, u.total.employerCost, u.total.serviceCharge, u.total.otherBilling, u.total.operatingCost, u.total.contribution, u.workingDays, u.paidClosedDays]);
  rows.push([], ["Forecast assumptions"], ["Company", "Client", "Unit", "Attendance %", "Paid leave %", "OT per worked day", "History source", "Salary fallback employees", "Setup revision", "Confirmed at"]);
  for (const u of result.units) rows.push([u.company, u.client, u.unit, u.attendancePercent, u.paidLeavePercent, u.otPerWorkedDay, u.assumptionSource, u.salaryFallbackEmployees, u.planRevision, u.confirmedAt]);
  for (const scenario of [...result.recruitmentPlans, ...(result.scenario ? [result.scenario] : [])]) {
    rows.push([], [result.scenario === scenario ? "Manual scenario" : "Automatic recruitment requirement"],
      ["Calculator", scenario.direction], ["Deployment", scenario.client], ["Joining date", scenario.joiningDate],
      ["Target revenue", scenario.targetRevenue], ["Count mode", scenario.countMode], ["Entered manpower", scenario.manpower],
      ["New recruit daily salary", scenario.dailySalary], ["Expected attendance %", scenario.attendancePercent], ["OT per worked day", scenario.otPerWorkedDay],
      ["Remaining working days", scenario.remainingWorkingDays], ["Revenue per recruit", scenario.perRecruitRevenue],
      ["Existing employees in selected scope at joining", scenario.existingAtJoining], ["Additional recruits", scenario.additionalRecruits ?? "Not achievable"],
      ["Total employees in selected scope at joining", scenario.totalAtJoining ?? "Not achievable"], ["Baseline revenue", scenario.baselineRevenue],
      ["Additional revenue", scenario.additionalRevenue], ["Achievable revenue", scenario.achievableRevenue], ["Remaining target gap", scenario.targetGap], ["Explanation", scenario.explanation]);
  }
  for (const u of result.units) {
    const plan = plans.find(p => p.month === result.month && p.unitId === u.unitId);
    if (!plan) continue;
    rows.push([], ["Confirmed monthly setup", `${u.company} / ${u.client} / ${u.unit}`]);
    for (const [key, value] of Object.entries(plan.config)) if (key !== "days") rows.push([key, typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)]);
    rows.push(["Date", "Day type", "Client working", "Paid when closed", "Holiday / note"]);
    for (const d of plan.config.days) rows.push([d.date, d.kind, d.working ? "Yes" : "No", d.paid ? "Yes" : "No", d.label]);
  }
  return rows;
}
export function projectionCsv(rows: ReportRows) {
  return "\ufeff" + rows.map(row => row.map(cell => {
    const text = typeof cell === "string" && /^[\s]*[=+@-]/.test(cell) ? `'${cell}` : String(cell);
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
