import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateRevenueProjection, calculateRevenueScenario, defaultRevenueMonth, monthDates, validateRevenueMonth } from '../lib/revenue-projection.ts';
import { projectionCsv, projectionGroups, projectionReportRows } from '../lib/revenue-projection-reports.ts';
import { ProjectionReport, RevenueProjectionPage } from '../app/revenue-projection.tsx';

const company = { id: 'joy', name: 'Joy test company', status: 'active' };
const unit = { id: 'u1', vendorId: 'joy', clientName: 'Test client', unitName: 'Factory', status: 'active', attendanceWorkingDays: 26, overtimeMultiplier: 2 };
const employee = { id: 'e1', vendorId: 'joy', clientUnitId: 'u1', status: 'active', employmentType: 'client', dateOfJoining: '2026-01-01', dateOfLeaving: null, salaryAmount: 800, salaryBasis: 'daily' };
const entry = (date, statusCode = 'P', overtimeHours = 0, employeeId = 'e1') => ({ employeeId, attendanceDate: date, statusCode, overtimeHours });
function fixture(month = '2026-10', configPatch = {}) {
  const config = { ...defaultRevenueMonth(month, unit), ...configPatch };
  const plan = { unitId: 'u1', month, config, revision: 1, updatedAt: '2026-09-13T00:00:00Z', confirmedAt: '2026-09-13T00:00:00Z' };
  return { companies: [company], units: [unit], employees: [employee], attendance: [], plans: [plan] };
}
const calculate = (source, month = '2026-10', cutoff = '2026-09-13') => calculateRevenueProjection('super_admin', source, month, cutoff, '2026-12-31');
function scenario(result, patch = {}) {
  return { direction: 'revenue_to_manpower', unitId: 'u1', joiningDate: result.month + '-16', targetRevenue: result.total.revenue + 30000, manpower: 0, countMode: 'additional', dailySalary: 800, attendancePercent: 100, otPerWorkedDay: 0, ...patch };
}

test('every month requires an independently confirmed, complete client calendar', () => {
  assert.equal(monthDates('2026-10').length, 31);
  assert.equal(monthDates('2026-02').length, 28);
  assert.equal(monthDates('2028-02').length, 29);
  const source = fixture();
  source.plans[0].confirmedAt = null;
  assert.equal(calculate(source).ready, false);
  source.plans[0].confirmedAt = 'confirmed'; source.plans[0].month = '2026-09';
  assert.equal(calculate(source).ready, false);
  for (const bad of ['2026-00', '2026-13', '26-01', 'invalid']) assert.throws(() => monthDates(bad));
  const valid = fixture().plans[0].config;
  assert.throws(() => validateRevenueMonth('2026-10', { ...valid, days: valid.days.slice(1) }));
  assert.throws(() => validateRevenueMonth('2026-10', { ...valid, days: valid.days.map((d, i) => i === 1 ? valid.days[0] : d) }));
  assert.throws(() => validateRevenueMonth('2026-10', { ...valid, days: valid.days.map((d, i) => i === 0 ? { ...d, kind: 'government_holiday', label: '' } : d) }));
  for (const patch of [{ salaryDivisor: 0 }, { serviceChargePercent: -1 }, { standardHours: NaN }, { fallbackAttendancePercent: 101 }, { feeBasis: 'invalid' }, { fallbackOtHours: 24 }]) assert.throws(() => validateRevenueMonth('2026-10', { ...valid, ...patch }));
});
test('31-day operations, closed Sundays and government holidays follow each monthly calendar', () => {
  const source = fixture();
  const c = source.plans[0].config;
  c.days = c.days.map(d => ({ ...d, working: true }));
  let result = calculate(source);
  assert.equal(result.units[0].workingDays, 31);
  assert.equal(result.total.revenue, 31 * 800);
  c.days = c.days.map(d => new Date(d.date).getUTCDay() === 0 ? { ...d, working: false, paid: false } : d);
  result = calculate(source);
  assert.equal(result.units[0].workingDays, 27);
  assert.equal(result.total.revenue, 27 * 800);
  c.days[1] = { ...c.days[1], kind: 'government_holiday', label: 'Client-confirmed holiday', working: false, paid: true };
  result = calculate(source);
  assert.equal(result.units[0].workingDays, 26);
  assert.equal(result.units[0].paidClosedDays, 1);
  assert.equal(result.total.revenue, 27 * 800);
  assert.equal(result.total.workedDays, 26);
  c.days[1].paid = false;
  assert.equal(calculate(source).total.revenue, 26 * 800);
  c.days[1].working = true; c.holidayWorkMultiplier = 2;
  assert.equal(calculate(source).total.revenue, 28 * 800);
});
test('actuals, missing attendance and future forecast are separate; half day and OT are priced correctly', () => {
  const source = fixture('2026-09', { serviceChargePercent: 10 });
  source.plans[0].config.days = source.plans[0].config.days.map(d => ({ ...d, working: true }));
  source.attendance = [entry('2026-09-01', 'P', 2), entry('2026-09-02', 'HD', 1), entry('2026-09-05', 'P', 10)];
  const result = calculate(source, '2026-09', '2026-09-03');
  assert.equal(result.actual.salary, 1800); // 800 + 400 OT; 400 + 200 OT
  assert.equal(result.actual.revenue, 1980);
  assert.equal(result.actual.overtimeHours, 3);
  assert.equal(result.units[0].attendancePercent, 75);
  assert.equal(result.units[0].otPerWorkedDay, 2);
  assert.equal(result.pendingEntries, 1);
  assert.equal(result.pending.revenue, 990);
  assert.equal(result.future.revenue, 27 * 990);
  assert.equal(result.daily[4].actual.revenue, 0); // Future input never becomes an actual before cutoff.
  assert.equal(result.total.revenue, result.actual.revenue + result.pending.revenue + result.future.revenue);
});
test('actual holiday work survives a closed calendar; paid leave and individual week offs follow rules', () => {
  const source = fixture('2026-09', { paidLeave: true, paidWeekOff: true, holidayWorkMultiplier: 2 });
  source.attendance = [entry('2026-09-06', 'HP', 1), entry('2026-09-07', 'L'), entry('2026-09-08', 'WO'), entry('2026-09-09', 'A')];
  const result = calculate(source, '2026-09', '2026-09-09');
  assert.equal(result.actual.salary, 1800 + 800 + 800);
  assert.equal(result.actual.workedDays, 1);
  assert.equal(result.actual.payableDays, 3);
  assert.ok(result.warnings.some(w => w.includes('work on closed')));
});
test('joining and leaving dates preserve worked actuals but prevent revenue outside employment; direct staff are excluded', () => {
  const source = fixture('2026-09');
  source.plans[0].config.days = source.plans[0].config.days.map(d => ({ ...d, working: true }));
  source.employees = [
    { ...employee, status: 'left', dateOfLeaving: '2026-09-02' },
    { ...employee, id: 'e2', dateOfJoining: '2026-09-20' },
    { ...employee, id: 'direct', employmentType: 'direct', salaryAmount: 1000000 },
  ];
  source.attendance = [entry('2026-09-01'), entry('2026-09-02'), entry('2026-09-03'), entry('2026-09-01', 'P', 0, 'direct')];
  const result = calculate(source, '2026-09', '2026-09-10');
  assert.equal(result.actual.salary, 1600);
  assert.equal(result.liveEmployees, 0);
  assert.equal(result.future.salary, 11 * 800);
  assert.equal(result.pending.salary, 0);
});
test('missing rates block forecasts until an explicit fallback is saved and reported', () => {
  const source = fixture(); source.employees[0] = { ...employee, salaryAmount: 0 };
  assert.equal(calculate(source).ready, false);
  source.plans[0].config.fallbackDailySalary = 600;
  const result = calculate(source);
  assert.equal(result.ready, true);
  assert.equal(result.units[0].salaryFallbackEmployees, 1);
  assert.ok(result.warnings.some(w => w.includes('fallback salary')));
  assert.equal(result.total.salary, 27 * 600);
});
test('monthly salary divisor is independent of the client operating-day calendar', () => {
  const source = fixture('2026-10', { salaryDivisor: 31 });
  source.employees[0] = { ...employee, salaryAmount: 31000, salaryBasis: 'monthly' };
  source.plans[0].config.days = source.plans[0].config.days.map(d => ({ ...d, working: true }));
  assert.equal(calculate(source).total.salary, 31000);
});
test('salary, employer costs, service charge and contribution reconcile excluding GST', () => {
  const source = fixture('2026-09', { employerCostPercent: 10, serviceChargePercent: 10, feeBasis: 'salary_plus_employer_cost', otherBillingPerDay: 20, operatingCostPerDay: 10 });
  source.attendance = [entry('2026-09-01')];
  const actual = calculate(source, '2026-09', '2026-09-01').actual;
  assert.equal(actual.salary, 800); assert.equal(actual.employerCost, 80);
  assert.equal(actual.serviceCharge, 88); assert.equal(actual.otherBilling, 20);
  assert.equal(actual.revenue, 988); assert.equal(actual.contribution, 98);
});
test('mixed company/client rates aggregate independently without a blended recruitment rate', () => {
  const source = fixture();
  source.companies.push({ ...company, id: 'joy2', name: 'Second company' });
  source.units.push({ ...unit, id: 'u2', vendorId: 'joy2' });
  source.employees.push({ ...employee, id: 'e2', clientUnitId: 'u2', vendorId: 'joy2', salaryAmount: 1200 });
  source.plans.push({ ...source.plans[0], unitId: 'u2', config: structuredClone(source.plans[0].config) });
  const result = calculate(source);
  assert.equal(result.total.revenue, 27 * (800 + 1200));
  assert.equal(projectionGroups(result.units, 'company').length, 2);
  assert.equal(projectionGroups(result.units, 'client').length, 2);
  const plan = calculateRevenueScenario('super_admin', source, result, scenario(result));
  const days = source.plans[0].config.days.filter(d => d.date >= '2026-10-16' && d.working).length;
  assert.equal(plan.perRecruitRevenue, days * 800);
  assert.equal(plan.additionalRecruits, Math.ceil(30000 / (days * 800)));
  const totalScope = calculateRevenueScenario('super_admin', source, result, scenario(result, { direction: 'manpower_to_revenue', countMode: 'total', manpower: 5 }));
  assert.equal(totalScope.existingAtJoining, 2);
  assert.equal(totalScope.additionalRecruits, 3);
  assert.equal(totalScope.totalAtJoining, 5);
});
test('both calculators agree and prorate mid-month recruitment without adding existing employees twice', () => {
  const source = fixture('2026-09', { serviceChargePercent: 10, monthlyTarget: 50000 });
  const result = calculate(source, '2026-09', '2026-09-15');
  const desired = scenario(result, { joiningDate: '2026-09-20', targetRevenue: 80000 });
  const forward = calculateRevenueScenario('super_admin', source, result, desired);
  const reverse = calculateRevenueScenario('super_admin', source, result, { ...desired, direction: 'manpower_to_revenue', manpower: forward.additionalRecruits });
  assert.equal(reverse.achievableRevenue, forward.achievableRevenue);
  assert.equal(forward.totalAtJoining, 1 + forward.additionalRecruits);
  const total = calculateRevenueScenario('super_admin', source, result, { ...desired, direction: 'manpower_to_revenue', countMode: 'total', manpower: forward.totalAtJoining });
  assert.equal(total.additionalRecruits, forward.additionalRecruits);
  assert.ok(forward.perRecruitRevenue < 15 * 880);
  assert.equal(result.recruitmentPlans.length, 1);
  assert.equal(result.recruitmentPlans[0].joiningDate, '2026-09-16');
  assert.equal(forward.baselineRevenue, result.total.revenue);
  assert.throws(() => calculateRevenueScenario('super_admin', source, result, { ...desired, joiningDate: '2026-09-15' }));
  assert.throws(() => calculateRevenueScenario('super_admin', source, result, { ...desired, direction: 'manpower_to_revenue', countMode: 'total', manpower: 0 }));
});
test('zero remaining billable days, zero rates and already-achieved targets are handled without infinity', () => {
  const source = fixture('2026-09');
  source.plans[0].config.days = source.plans[0].config.days.map(d => d.date >= '2026-09-20' ? { ...d, working: false, paid: false } : d);
  const result = calculate(source, '2026-09', '2026-09-15');
  const input = scenario(result, { joiningDate: '2026-09-20' });
  const impossible = calculateRevenueScenario('super_admin', source, result, input);
  assert.equal(impossible.attainable, false); assert.equal(impossible.additionalRecruits, null);
  const achieved = calculateRevenueScenario('super_admin', source, result, { ...input, targetRevenue: 0 });
  assert.equal(achieved.additionalRecruits, 0); assert.equal(achieved.attainable, true);
  assert.equal(calculateRevenueScenario('super_admin', source, result, { ...input, dailySalary: 0 }).attainable, false);
  const closedMonth = calculate(source, '2026-09', '2026-09-30');
  assert.equal(closedMonth.future.revenue, 0);
  assert.equal(closedMonth.recruitmentPlans.length, 0);
});
test('invalid inputs, duplicates, future actuals and non-admin access cannot bypass the engine', () => {
  const source = fixture(), result = calculate(source), input = scenario(result);
  for (const role of ['field_hr', 'hr_team', 'payroll_team', 'hostel_incharge', 'unknown', '']) {
    assert.throws(() => calculateRevenueProjection(role, source, '2026-10', '2026-09-13'), /Super Admin/);
    assert.throws(() => calculateRevenueScenario(role, source, result, input), /Super Admin/);
    const denied = renderToStaticMarkup(React.createElement(RevenueProjectionPage, { role, endpoint: '/test', exportExcel() {} }));
    assert.ok(denied.includes('Only Super Admin')); assert.ok(!denied.includes('Calendar month'));
  }
  assert.throws(() => calculateRevenueProjection('super_admin', source, '2026-10', '2026-10-01', '2026-09-13'));
  for (const patch of [{ manpower: 1.5 }, { targetRevenue: Infinity }, { unitId: 'outside-scope' }, { joiningDate: '2026-11-01' }, { direction: 'invalid' }, { attendancePercent: 101 }]) assert.throws(() => calculateRevenueScenario('super_admin', source, result, { ...input, ...patch }));
  source.attendance = [entry('2026-09-01'), entry('2026-09-01')];
  assert.throws(() => calculate(source), /Duplicate/);
  source.attendance = []; source.employees.push(employee);
  assert.throws(() => calculate(source), /Duplicate/);
});
test('reports retain actual/forecast distinction, cutoff, calendar rules, both calculator directions and safe CSV text', () => {
  const source = fixture('2026-09', { monthlyTarget: 50000 });
  const result = calculate(source, '2026-09', '2026-09-15');
  result.scenario = calculateRevenueScenario('super_admin', source, result, scenario(result));
  const rows = projectionReportRows(result, source.plans);
  const text = JSON.stringify(rows);
  for (const value of ['Pending attendance estimate', '2026-09-15', 'Confirmed monthly setup', 'Actual OT hours', 'Automatic recruitment requirement', 'Manual scenario']) {
    assert.ok(text.includes(value), value);
  }
  const html = renderToStaticMarkup(React.createElement(ProjectionReport, { result, plans: source.plans }));
  for (const label of ['Actual earned revenue', 'Pending attendance estimate', 'Upcoming days forecast', 'Full-month revenue forecast', 'Manual scenario comparison', 'Group company revenue summary', 'Client revenue summary']) assert.ok(html.includes(label), label);
  assert.ok(projectionCsv([['=HYPERLINK("bad")', '@command', 'Plain text', 123]]).includes("'=HYPERLINK"));
  const route = readFileSync(new URL('../app/api/app-data/route.ts', import.meta.url), 'utf8');
  const block = route.slice(route.indexOf('if (["get-revenue-projection"'), route.indexOf('if (action === "calculate-revenue")'));
  assert.ok(block.indexOf('access.profile.role !== "super_admin"') < block.indexOf('db.select'));
  assert.ok(block.includes('setWhere: eq(revenueMonthPlans.revision, revision)'));
});
