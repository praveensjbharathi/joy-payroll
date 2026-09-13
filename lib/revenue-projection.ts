/** Calendar-month revenue planning. All monetary output excludes GST. */
export type CalendarDay = {
  date: string;
  kind: "working" | "week_off" | "government_holiday" | "closure";
  working: boolean;
  paid: boolean;
  label: string;
};
export type RevenueMonthConfig = {
  days: CalendarDay[];
  salaryDivisor: number;
  standardHours: number;
  overtimeMultiplier: number;
  overtimeHourlyRate: number;
  holidayWorkMultiplier: number;
  paidLeave: boolean;
  paidWeekOff: boolean;
  paidHolidays: boolean;
  employerCostPercent: number;
  serviceChargePercent: number;
  feeBasis: "salary" | "salary_plus_employer_cost";
  otherBillingPerDay: number;
  operatingCostPerDay: number;
  fallbackDailySalary: number;
  recruitmentDailySalary: number;
  fallbackAttendancePercent: number;
  fallbackOtHours: number;
  monthlyTarget: number;
};
export type RevenueMonthPlan = {
  unitId: string; month: string; config: RevenueMonthConfig;
  revision: number; updatedAt: string; confirmedAt: string | null;
};
export type ProjectionUnit = {
  id: string; vendorId: string; clientName: string; unitName: string;
  status: string; attendanceWorkingDays: number; overtimeMultiplier: number;
};
export type ProjectionCompany = { id: string; name: string; status: string };
export type ProjectionEmployee = {
  id: string; vendorId: string; clientUnitId: string; status: string;
  employmentType: string; dateOfJoining: string; dateOfLeaving: string | null;
  salaryAmount: number; salaryBasis: string;
};
export type ProjectionAttendance = {
  employeeId: string; attendanceDate: string; statusCode: string; overtimeHours: number;
};
export type RevenueAmounts = {
  workedDays: number; payableDays: number; overtimeHours: number;
  salary: number; employerCost: number; serviceCharge: number;
  otherBilling: number; operatingCost: number; revenue: number; contribution: number;
};
export type RevenueDailyRow = {
  date: string; actual: RevenueAmounts; pending: RevenueAmounts; future: RevenueAmounts;
  recordedEntries: number; pendingEntries: number; expectedEmployees: number;
};
export type UnitProjection = {
  unitId: string; vendorId: string; company: string; client: string; unit: string;
  planRevision: number; confirmedAt: string; workingDays: number; paidClosedDays: number;
  liveEmployees: number; salaryFallbackEmployees: number; historyEntries: number;
  attendancePercent: number; paidLeavePercent: number; otPerWorkedDay: number;
  assumptionSource: string; recruitmentDailySalary: number; target: number;
  actual: RevenueAmounts; pending: RevenueAmounts; future: RevenueAmounts; total: RevenueAmounts;
  daily: RevenueDailyRow[];
};
export type RevenueScenarioInput = {
  direction: "revenue_to_manpower" | "manpower_to_revenue";
  unitId: string; joiningDate: string; targetRevenue: number; manpower: number;
  countMode: "additional" | "total";
  dailySalary: number; attendancePercent: number; otPerWorkedDay: number;
};
export type RevenueScenario = RevenueScenarioInput & {
  client: string; existingAtJoining: number; additionalRecruits: number | null;
  totalAtJoining: number | null; perRecruitRevenue: number; remainingWorkingDays: number;
  additionalRevenue: number; baselineRevenue: number; achievableRevenue: number;
  targetGap: number; attainable: boolean; explanation: string;
};
export type RevenueProjection = {
  month: string; asOfDate: string; generatedAt: string; ready: boolean;
  issues: string[]; warnings: string[]; units: UnitProjection[]; daily: RevenueDailyRow[];
  actual: RevenueAmounts; pending: RevenueAmounts; future: RevenueAmounts; total: RevenueAmounts;
  liveEmployees: number; pendingEntries: number; recordedEntries: number; target: number;
  recruitmentPlans: RevenueScenario[]; scenario: RevenueScenario | null;
};

export const revenueMoney = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function requireRevenueAdmin(role: string) {
  if (role !== "super_admin") throw new Error("Only Super Admin can access revenue projections.");
}
function numeric(value: unknown, name: string, min = 0, max = 1e10) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
export function dateOnly(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new Error("Enter a valid calendar date.");
  return value;
}
export function shiftDate(value: string, days: number) {
  const date = new Date(`${dateOnly(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function monthDates(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a month between 2000 and 2099.");
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
export function indiaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function defaultRevenueMonth(month: string, unit: ProjectionUnit, rule?: { paidLeave?: number; paidWeekOff?: number; overtimeHourlyRate?: number }): RevenueMonthConfig {
  return {
    days: monthDates(month).map(date => {
      const sunday = new Date(date).getUTCDay() === 0;
      return { date, kind: sunday ? "week_off" : "working", working: !sunday, paid: !sunday || Boolean(rule?.paidWeekOff), label: sunday ? "Sunday" : "" };
    }),
    salaryDivisor: unit.attendanceWorkingDays || 26, standardHours: 8,
    overtimeMultiplier: Number(unit.overtimeMultiplier) || 1,
    overtimeHourlyRate: Number(rule?.overtimeHourlyRate) || 0, holidayWorkMultiplier: 1,
    paidLeave: Boolean(rule?.paidLeave), paidWeekOff: Boolean(rule?.paidWeekOff), paidHolidays: Boolean(rule?.paidWeekOff),
    employerCostPercent: 0, serviceChargePercent: 0, feeBasis: "salary",
    otherBillingPerDay: 0, operatingCostPerDay: 0, fallbackDailySalary: 0,
    recruitmentDailySalary: 0, fallbackAttendancePercent: 100, fallbackOtHours: 0, monthlyTarget: 0,
  };
}
export function validateRevenueMonth(month: string, value: unknown): RevenueMonthConfig {
  const dates = monthDates(month);
  if (!value || typeof value !== "object") throw new Error("Monthly calendar and billing setup are required.");
  const c = value as RevenueMonthConfig;
  if (!Array.isArray(c.days) || c.days.length !== dates.length) throw new Error("Configure every day in the calendar month.");
  const days = dates.map(date => {
    const matches = c.days.filter(d => d && d.date === date);
    if (matches.length !== 1) throw new Error("Each date must occur exactly once in this month.");
    const d = matches[0];
    if (!["working", "week_off", "government_holiday", "closure"].includes(d.kind) || typeof d.working !== "boolean" || typeof d.paid !== "boolean" || typeof d.label !== "string" || d.label.length > 120)
      throw new Error(`Invalid calendar setup for ${date}.`);
    if (d.kind === "government_holiday" && !d.label.trim()) throw new Error(`Enter the government holiday name for ${date}.`);
    return { date, kind: d.kind, working: d.working, paid: d.paid, label: d.label.trim() };
  });
  for (const k of ["paidLeave", "paidWeekOff", "paidHolidays"] as const)
    if (typeof c[k] !== "boolean") throw new Error("Confirm the paid leave and holiday rules.");
  if (!["salary", "salary_plus_employer_cost"].includes(c.feeBasis)) throw new Error("Choose a valid service-charge basis.");
  return {
    days, salaryDivisor: numeric(c.salaryDivisor, "Salary divisor", 1, 31),
    standardHours: numeric(c.standardHours, "Standard hours", 1, 24),
    overtimeMultiplier: numeric(c.overtimeMultiplier, "OT multiplier", 0, 5),
    overtimeHourlyRate: numeric(c.overtimeHourlyRate, "Base OT hourly rate", 0, 1e6),
    holidayWorkMultiplier: numeric(c.holidayWorkMultiplier, "Holiday work multiplier", 1, 5),
    paidLeave: c.paidLeave, paidWeekOff: c.paidWeekOff, paidHolidays: c.paidHolidays,
    employerCostPercent: numeric(c.employerCostPercent, "Employer cost percentage", 0, 100),
    serviceChargePercent: numeric(c.serviceChargePercent, "Service charge", 0, 100), feeBasis: c.feeBasis,
    otherBillingPerDay: numeric(c.otherBillingPerDay, "Other billing per payable day", 0, 1e6),
    operatingCostPerDay: numeric(c.operatingCostPerDay, "Operating cost per payable day", 0, 1e6),
    fallbackDailySalary: numeric(c.fallbackDailySalary, "Fallback daily salary", 0, 1e6),
    recruitmentDailySalary: numeric(c.recruitmentDailySalary, "New recruit daily salary", 0, 1e6),
    fallbackAttendancePercent: numeric(c.fallbackAttendancePercent, "Fallback attendance", 0, 100),
    fallbackOtHours: numeric(c.fallbackOtHours, "Fallback OT", 0, 24 - c.standardHours),
    monthlyTarget: numeric(c.monthlyTarget, "Monthly revenue target"),
  };
}
export function emptyAmounts(): RevenueAmounts {
  return { workedDays: 0, payableDays: 0, overtimeHours: 0, salary: 0, employerCost: 0, serviceCharge: 0, otherBilling: 0, operatingCost: 0, revenue: 0, contribution: 0 };
}
function addAmounts(target: RevenueAmounts, source: RevenueAmounts) {
  for (const key of Object.keys(target) as (keyof RevenueAmounts)[]) target[key] += source[key];
}
function rounded(a: RevenueAmounts) {
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, revenueMoney(v)])) as RevenueAmounts;
}
function dailyRow(date: string): RevenueDailyRow {
  return { date, actual: emptyAmounts(), pending: emptyAmounts(), future: emptyAmounts(), recordedEntries: 0, pendingEntries: 0, expectedEmployees: 0 };
}
function dailySalary(employee: ProjectionEmployee, config: RevenueMonthConfig) {
  const salary = Number(employee.salaryAmount);
  return salary > 0 ? (employee.salaryBasis === "daily" ? salary : salary / config.salaryDivisor) : config.fallbackDailySalary;
}
function inEmployment(employee: ProjectionEmployee, date: string) {
  return employee.dateOfJoining <= date && (!employee.dateOfLeaving || employee.dateOfLeaving >= date);
}
function eligibleEstimate(employee: ProjectionEmployee, date: string, cutoff: string) {
  return inEmployment(employee, date) && (employee.status === "active" || (date <= cutoff && Boolean(employee.dateOfLeaving)));
}
function bill(config: RevenueMonthConfig, rate: number, worked: number, paid: number, overtime: number, holidayWork = false): RevenueAmounts {
  const salary = rate * paid + (holidayWork ? rate * worked * (config.holidayWorkMultiplier - 1) : 0)
    + overtime * (config.overtimeHourlyRate || rate / config.standardHours) * config.overtimeMultiplier;
  const employerCost = salary * config.employerCostPercent / 100;
  const serviceCharge = (salary + (config.feeBasis === "salary_plus_employer_cost" ? employerCost : 0)) * config.serviceChargePercent / 100;
  const otherBilling = paid * config.otherBillingPerDay, operatingCost = paid * config.operatingCostPerDay;
  const revenue = salary + employerCost + serviceCharge + otherBilling;
  return { workedDays: worked, payableDays: paid, overtimeHours: overtime, salary, employerCost, serviceCharge, otherBilling, operatingCost, revenue, contribution: revenue - salary - employerCost - operatingCost };
}
function expectedDay(c: RevenueMonthConfig, day: CalendarDay, rate: number, attendance: number, leave: number, ot: number) {
  const worked = day.working ? attendance : 0;
  const paid = day.working ? attendance + leave : Number(day.paid);
  return bill(c, rate, worked, paid, worked * ot, day.kind === "government_holiday");
}

export type ProjectionSource = {
  companies: ProjectionCompany[]; units: ProjectionUnit[]; employees: ProjectionEmployee[];
  attendance: ProjectionAttendance[]; plans: RevenueMonthPlan[];
};
export function calculateRevenueProjection(role: string, source: ProjectionSource, month: string, asOfDate: string, today = indiaToday()): RevenueProjection {
  requireRevenueAdmin(role);
  const dates = monthDates(month), cutoff = dateOnly(asOfDate), last = dates[dates.length - 1];
  if (cutoff > dateOnly(today) || cutoff > last) throw new Error("Actuals cutoff cannot be after today or the end of the selected month.");
  const result: RevenueProjection = {
    month, asOfDate: cutoff, generatedAt: new Date().toISOString(), ready: false,
    issues: [], warnings: [], units: [], daily: dates.map(dailyRow), actual: emptyAmounts(), pending: emptyAmounts(), future: emptyAmounts(), total: emptyAmounts(),
    liveEmployees: 0, pendingEntries: 0, recordedEntries: 0, target: 0, recruitmentPlans: [], scenario: null,
  };
  if (!source.units.length) result.issues.push("No clients match this selection. Add a client before planning recruitment.");
  const configs = new Map<string, RevenueMonthConfig>();
  const uniqueEmployeeIds = new Set<string>(), attendanceIndex = new Map<string, ProjectionAttendance>();
  for (const e of source.employees) {
    if (uniqueEmployeeIds.has(e.id)) throw new Error("Duplicate employee in revenue data.");
    uniqueEmployeeIds.add(e.id);
  }
  for (const a of source.attendance) {
    const key = `${a.employeeId}|${a.attendanceDate}`;
    if (attendanceIndex.has(key)) throw new Error("Duplicate employee/date attendance. Resolve this before projecting revenue.");
    attendanceIndex.set(key, a);
  }
  for (const unit of source.units) {
    const name = `${unit.clientName} · ${unit.unitName}`;
    const plan = source.plans.find(p => p.unitId === unit.id && p.month === month);
    if (!plan?.confirmedAt) { result.issues.push(`${name}: confirm this month's calendar and billing setup.`); continue; }
    const config = validateRevenueMonth(month, plan.config);
    configs.set(unit.id, config);
    const people = source.employees.filter(e => e.clientUnitId === unit.id && e.employmentType !== "direct" && e.dateOfJoining <= last && (!e.dateOfLeaving || e.dateOfLeaving >= dates[0]));
    const missing = people.filter(e => dailySalary(e, config) <= 0 && (e.status === "active" || source.attendance.some(a => a.employeeId === e.id && a.attendanceDate >= dates[0] && a.attendanceDate <= cutoff)));
    if (missing.length) result.issues.push(`${name}: ${missing.length} employee(s) need a salary rate or an explicit fallback daily salary in monthly setup.`);
  }
  if (result.issues.length) return result;
  const historyStart = shiftDate(cutoff, -27);
  for (const unit of source.units) {
    const config = configs.get(unit.id)!;
    const plan = source.plans.find(p => p.unitId === unit.id && p.month === month)!;
    const allPeople = source.employees.filter(e => e.clientUnitId === unit.id && e.employmentType !== "direct");
    const people = allPeople.filter(e => e.dateOfJoining <= last && (!e.dateOfLeaving || e.dateOfLeaving >= dates[0]));
    const peopleById = new Map(allPeople.map(e => [e.id, e]));
    const history = source.attendance.filter(a => {
      const employee = peopleById.get(a.employeeId);
      const day = config.days.find(d => d.date === a.attendanceDate);
      return employee && inEmployment(employee, a.attendanceDate) && a.attendanceDate >= historyStart && a.attendanceDate <= cutoff &&
        (!day || day.working) && ["P", "HP", "HD", "A", "L"].includes(a.statusCode);
    });
    const present = (code: string) => code === "P" || code === "HP" ? 1 : code === "HD" ? 0.5 : 0;
    const historyWorked = history.reduce((sum, a) => sum + present(a.statusCode), 0);
    const attendance = history.length ? historyWorked / history.length : config.fallbackAttendancePercent / 100;
    const leave = config.paidLeave && history.length ? history.filter(a => a.statusCode === "L").length / history.length : 0;
    const ot = historyWorked ? history.reduce((sum, a) => sum + (present(a.statusCode) ? Number(a.overtimeHours) : 0), 0) / historyWorked : history.length ? 0 : config.fallbackOtHours;
    const livePeople = allPeople.filter(e => eligibleEstimate(e, cutoff, cutoff));
    const rates = people.filter(e => e.status === "active").map(e => dailySalary(e, config)).filter(r => r > 0);
    const recruitmentRate = config.recruitmentDailySalary || (rates.length ? rates.reduce((n, r) => n + r, 0) / rates.length : config.fallbackDailySalary);
    const u: UnitProjection = {
      unitId: unit.id, vendorId: unit.vendorId, company: source.companies.find(c => c.id === unit.vendorId)?.name || unit.vendorId,
      client: unit.clientName, unit: unit.unitName, planRevision: plan.revision, confirmedAt: plan.confirmedAt!,
      workingDays: config.days.filter(d => d.working).length, paidClosedDays: config.days.filter(d => !d.working && d.paid).length,
      liveEmployees: livePeople.length, salaryFallbackEmployees: people.filter(e => Number(e.salaryAmount) <= 0 && e.status === "active").length,
      historyEntries: history.length, attendancePercent: attendance * 100, paidLeavePercent: leave * 100, otPerWorkedDay: ot,
      assumptionSource: history.length ? `Recorded attendance in the 28 days ending ${cutoff} (${history.length} employee-day entries)` : "Monthly fallback assumptions; no usable attendance history in the last 28 days",
      recruitmentDailySalary: recruitmentRate, target: config.monthlyTarget,
      actual: emptyAmounts(), pending: emptyAmounts(), future: emptyAmounts(), total: emptyAmounts(), daily: dates.map(dailyRow),
    };
    let closedWork = 0, invalidEntries = 0;
    for (let i = 0; i < dates.length; i++) {
      const day = config.days[i], row = u.daily[i];
      for (const employee of people) {
        const entry = day.date <= cutoff ? attendanceIndex.get(`${employee.id}|${day.date}`) : undefined;
        if (entry && inEmployment(employee, day.date)) {
          if (!["P", "HP", "HD", "A", "L", "WO", "H"].includes(entry.statusCode) || !Number.isFinite(Number(entry.overtimeHours)) || Number(entry.overtimeHours) < 0 || Number(entry.overtimeHours) > 24) {
            invalidEntries++;
          } else {
            const worked = present(entry.statusCode);
            const paid = worked || (entry.statusCode === "L" && config.paidLeave ? 1 : ["WO", "H"].includes(entry.statusCode) ? Number(!day.working ? day.paid : entry.statusCode === "WO" ? config.paidWeekOff : config.paidHolidays) : 0);
            addAmounts(row.actual, bill(config, dailySalary(employee, config), worked, paid, Number(entry.overtimeHours), entry.statusCode === "HP" || (worked > 0 && day.kind === "government_holiday")));
            row.recordedEntries++;
            if (worked && !day.working) closedWork++;
            continue;
          }
        }
        if (!eligibleEstimate(employee, day.date, cutoff)) continue;
        if (day.working) row.expectedEmployees++;
        const amount = expectedDay(config, day, dailySalary(employee, config), attendance, leave, ot);
        if (day.date <= cutoff) {
          addAmounts(row.pending, amount);
          if (day.working || day.paid) row.pendingEntries++;
        } else addAmounts(row.future, amount);
      }
      row.actual = rounded(row.actual); row.pending = rounded(row.pending); row.future = rounded(row.future);
      addAmounts(u.actual, row.actual); addAmounts(u.pending, row.pending); addAmounts(u.future, row.future);
      const overall = result.daily[i];
      for (const key of ["actual", "pending", "future"] as const) addAmounts(overall[key], row[key]);
      overall.recordedEntries += row.recordedEntries; overall.pendingEntries += row.pendingEntries; overall.expectedEmployees += row.expectedEmployees;
    }
    for (const key of ["actual", "pending", "future"] as const) { u[key] = rounded(u[key]); addAmounts(u.total, u[key]); addAmounts(result[key], u[key]); }
    u.total = rounded(u.total);
    if (!history.length) result.warnings.push(`${u.client} · ${u.unit}: using confirmed monthly fallback attendance and OT assumptions.`);
    if (u.salaryFallbackEmployees) result.warnings.push(`${u.client} · ${u.unit}: ${u.salaryFallbackEmployees} employees use the configured fallback salary; billing remains provisional until their master rates are updated.`);
    if (closedWork) result.warnings.push(`${u.client} · ${u.unit}: ${closedWork} attendance entries show work on closed calendar days. Recorded work is included; review the calendar.`);
    if (invalidEntries) result.warnings.push(`${u.client} · ${u.unit}: ${invalidEntries} invalid attendance entries are treated as pending.`);
    if (people.some(e => e.status !== "active" && !e.dateOfLeaving)) result.warnings.push(`${u.client} · ${u.unit}: inactive employees without leaving dates contribute recorded actuals only.`);
    result.units.push(u); result.liveEmployees += u.liveEmployees; result.target += u.target;
  }
  for (const key of ["actual", "pending", "future"] as const) { result[key] = rounded(result[key]); addAmounts(result.total, result[key]); }
  result.total = rounded(result.total); result.target = revenueMoney(result.target);
  for (const row of result.daily) {
    row.actual = rounded(row.actual); row.pending = rounded(row.pending); row.future = rounded(row.future);
    result.pendingEntries += row.pendingEntries; result.recordedEntries += row.recordedEntries;
  }
  result.ready = true;
  const joining = cutoff < dates[0] ? dates[0] : shiftDate(cutoff, 1);
  if (joining <= last) for (const u of result.units.filter(u => u.target > 0)) {
    const unitResult = { ...result, units: [u], total: u.total };
    result.recruitmentPlans.push(calculateRevenueScenario(role, source, unitResult, {
      direction: "revenue_to_manpower", unitId: u.unitId, joiningDate: joining, targetRevenue: u.target,
      manpower: 0, countMode: "additional", dailySalary: u.recruitmentDailySalary,
      attendancePercent: u.attendancePercent, otPerWorkedDay: Math.min(otLimit(configs.get(u.unitId)!), u.otPerWorkedDay),
    }));
  }
  return result;
}
const otLimit = (c: RevenueMonthConfig) => 24 - c.standardHours;
export function calculateRevenueScenario(role: string, source: ProjectionSource, baseline: RevenueProjection, input: RevenueScenarioInput): RevenueScenario {
  requireRevenueAdmin(role);
  if (!baseline.ready) throw new Error("Confirm all monthly setups and resolve missing rates before planning recruitment.");
  if (!input || !["revenue_to_manpower", "manpower_to_revenue"].includes(input.direction) || !["additional", "total"].includes(input.countMode)) throw new Error("Choose a valid calculator and manpower count type.");
  const u = baseline.units.find(u => u.unitId === input.unitId);
  const plan = source.plans.find(p => p.unitId === input.unitId && p.month === baseline.month);
  if (!u || !plan?.confirmedAt) throw new Error("Choose a deployment client within the selected report scope.");
  const c = validateRevenueMonth(baseline.month, plan.config), join = dateOnly(input.joiningDate);
  const dates = monthDates(baseline.month);
  if (join <= baseline.asOfDate || join < dates[0] || join > dates[dates.length - 1]) throw new Error("Joining date must be after the actuals cutoff and within the selected month.");
  numeric(input.targetRevenue, "Target revenue"); numeric(input.manpower, "Manpower", 0, 1000000);
  if (!Number.isInteger(input.manpower)) throw new Error("Manpower must be a whole number.");
  numeric(input.dailySalary, "New recruit daily salary", 0, 1e6);
  numeric(input.attendancePercent, "Expected attendance", 0, 100);
  numeric(input.otPerWorkedDay, "OT per worked day", 0, otLimit(c));
  const scopeUnits = new Set(baseline.units.map(unit => unit.unitId));
  const existing = source.employees.filter(e => scopeUnits.has(e.clientUnitId) && e.employmentType !== "direct" && eligibleEstimate(e, join, baseline.asOfDate)).length;
  if (input.direction === "manpower_to_revenue" && input.countMode === "total" && input.manpower < existing) throw new Error(`Desired total must be at least ${existing}, the existing employees available on the joining date.`);
  // A recruit is priced once for the remaining calendar, then reused by both directions.
  // No full-month multiplier, blended cross-client rate, or double-counted existing workforce.
  const contribution = emptyAmounts();
  for (const day of c.days.filter(d => d.date >= join)) addAmounts(contribution, expectedDay(c, day, input.dailySalary, input.attendancePercent / 100, 0, input.otPerWorkedDay));
  const perRecruit = revenueMoney(contribution.revenue);
  const gap = Math.max(0, revenueMoney(input.targetRevenue - baseline.total.revenue));
  let recruits: number | null = input.direction === "revenue_to_manpower"
    ? gap === 0 ? 0 : perRecruit > 0 && input.dailySalary > 0 ? Math.ceil(gap / perRecruit) : null
    : input.countMode === "additional" ? input.manpower : input.manpower - existing;
  if (recruits !== null && recruits > 1000000) recruits = null;
  const attainable = recruits !== null && (recruits === 0 || (input.dailySalary > 0 && perRecruit > 0));
  const additional = attainable ? revenueMoney((recruits || 0) * perRecruit) : 0;
  return {
    ...input, client: `${u.company} / ${u.client} / ${u.unit}`, existingAtJoining: existing,
    additionalRecruits: attainable ? recruits : null, totalAtJoining: attainable ? existing + (recruits || 0) : null,
    perRecruitRevenue: perRecruit, remainingWorkingDays: c.days.filter(d => d.date >= join && d.working).length,
    additionalRevenue: additional, baselineRevenue: baseline.total.revenue,
    achievableRevenue: revenueMoney(baseline.total.revenue + additional),
    targetGap: revenueMoney(Math.max(0, input.targetRevenue - baseline.total.revenue - additional)), attainable,
    explanation: !attainable ? "No achievable recruitment result: check the salary rate, expected attendance and remaining payable days."
      : recruits === 0 ? "The baseline already meets this target or no additional recruitment is requested."
      : `Deploy ${recruits} additional employee(s) to ${u.client} · ${u.unit} from ${join}. Existing actuals and workforce forecast are preserved.`,
  };
}
