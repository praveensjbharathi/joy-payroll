export const ATTENDANCE_CODES = ["P", "HD", "A", "L", "WO", "H", "HP"] as const;

export type AttendanceCode = (typeof ATTENDANCE_CODES)[number];

export type AttendanceInput = {
  statusCode: string;
  overtimeHours: number;
};

export type PayrollRuleInput = {
  standardWorkingDays: number;
  pfRate: number;
  esiRate: number;
  professionalTax: number;
  lwf: number;
  overtimeHourlyRate: number;
  paidLeave: number;
  paidWeekOff: number;
};

export const defaultPayrollRules: PayrollRuleInput = {
  standardWorkingDays: 26,
  pfRate: 0,
  esiRate: 0,
  professionalTax: 0,
  lwf: 0,
  overtimeHourlyRate: 0,
  paidLeave: 0,
  paidWeekOff: 0,
};

export const earningFields = [
  "basic", "da", "hra", "conveyance", "foodAllowance", "nightAllowance",
  "overtimeWages", "attendanceBonus", "arrears", "holidayWages",
  "productionIncentive", "medicalAllowance",
] as const;

export const deductionFields = [
  "pfDeduction", "esiDeduction", "professionalTax", "lwf", "canteen",
  "snacks", "tent", "advance", "otherDeduction", "tds", "medicalInsurance",
] as const;

export type MonetaryField = (typeof earningFields)[number] | (typeof deductionFields)[number];

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function numberValue(value: unknown) {
  if (typeof value === "string") value = value.replace(/[₹,\s]/g, "");
  const number = Number(value);
  return Number.isFinite(number) ? roundMoney(number) : 0;
}

export function attendanceSummary(entries: AttendanceInput[], rules: PayrollRuleInput) {
  const presentDays = entries.filter((entry) => entry.statusCode === "P" || entry.statusCode === "HP").length + entries.filter((entry) => entry.statusCode === "HD").length * 0.5;
  const absentDays = entries.filter((entry) => entry.statusCode === "A").length + entries.filter((entry) => entry.statusCode === "HD").length * 0.5;
  const leaveDays = entries.filter((entry) => entry.statusCode === "L").length;
  const weekOffDays = entries.filter((entry) => entry.statusCode === "WO" || entry.statusCode === "H").length;
  const holidayPresentDays = entries.filter((entry) => entry.statusCode === "HP").length;
  const overtimeHours = roundMoney(entries.reduce((sum, entry) => sum + numberValue(entry.overtimeHours), 0));
  const payableDays = presentDays + (rules.paidLeave ? leaveDays : 0) + (rules.paidWeekOff ? weekOffDays : 0);

  return { presentDays, absentDays, leaveDays, weekOffDays, holidayPresentDays, payableDays, overtimeHours };
}

export function accommodationTotal(charge: Record<string, unknown> | null | undefined) {
  if (!charge) return { accommodationDeduction: 0, returnAmount: 0 };
  const fields = ["idCard", "rent", "bus", "medical", "ticket", "shoe", "advance", "food", "aadhaarUpdate", "bankAccountCharge", "tshirt", "oldPending", "gasShare", "rationShare", "provisionShare"];
  return {
    accommodationDeduction: roundMoney(fields.reduce((sum, field) => sum + numberValue(charge[field]), 0)),
    returnAmount: numberValue(charge.returnAmount),
  };
}

export function payrollTotals(item: Record<string, unknown>) {
  const grossEarnings = roundMoney(earningFields.reduce((sum, field) => sum + numberValue(item[field]), 0));
  const statutoryDeductions = roundMoney(numberValue(item.pfDeduction) + numberValue(item.esiDeduction) + numberValue(item.professionalTax) + numberValue(item.lwf) + numberValue(item.tds));
  const salaryDeductions = roundMoney(deductionFields.reduce((sum, field) => sum + numberValue(item[field]), 0));
  const accommodationDeduction = numberValue(item.accommodationDeduction);
  const returnAmount = numberValue(item.returnAmount);
  const totalDeductions = roundMoney(salaryDeductions + accommodationDeduction);
  const netPayable = roundMoney(grossEarnings - totalDeductions + returnAmount);

  return { grossEarnings, statutoryDeductions, salaryDeductions, totalDeductions, accommodationDeduction, returnAmount, netPayable };
}

export function validationForEmployee(
  employee: { paymentMode: string; bankAccountMasked: string | null; ifscMasked: string | null; uanMasked: string | null; esiMasked: string | null; salaryAmount: number; pfApplicable?: number; esiApplicable?: number },
  rules: PayrollRuleInput,
) {
  const missing: string[] = [];
  if (employee.paymentMode === "bank" && !employee.bankAccountMasked) missing.push("bank account");
  if (employee.paymentMode === "bank" && !employee.ifscMasked) missing.push("IFSC");
  if (rules.pfRate > 0 && employee.pfApplicable !== 0 && !employee.uanMasked) missing.push("UAN");
  if (rules.esiRate > 0 && employee.esiApplicable !== 0 && !employee.esiMasked) missing.push("ESI number");
  return {
    validationStatus: missing.length ? "review" : "ready",
    validationMessage: missing.length ? `${missing.join(", ")} pending` : null,
  };
}

export function salaryForAttendance(salaryAmount: number, salaryBasis: string, payableDays: number, rules: PayrollRuleInput) {
  if (salaryBasis === "daily") return roundMoney(salaryAmount * payableDays);
  return roundMoney((salaryAmount / Math.max(1, rules.standardWorkingDays)) * payableDays);
}
