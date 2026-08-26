export const DEFAULT_ACCOMMODATION_TYPES = ["Tamil", "Outside Room", "Joy Room"] as const;

export function normalizeAccommodationType(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "Tamil";
  return normalized.toLowerCase() === "tamil own" ? "Tamil" : normalized;
}

export function normalizedScope(value: unknown): string[] {
  const parsed = typeof value === "string" ? parseScopeJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()))].sort();
}

function parseScopeJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return []; }
}

export function calendarPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: `${period}-${String(lastDay).padStart(2, "0")}`, days: lastDay };
}

export function payrollPeriodRange(period: string, periodStart?: string | null, periodEnd?: string | null) {
  const defaults = calendarPeriod(period);
  const start = periodStart || defaults.start;
  const inclusiveEnd = periodEnd || defaults.end;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${inclusiveEnd}T00:00:00.000Z`);
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString().slice(0, 10), inclusiveEnd, days: duration };
}

export function splitMoneyEqually(amount: number, count: number): number[] {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  const pennies = Math.round(Math.max(0, amount) * 100);
  const base = Math.floor(pennies / count);
  const remainder = pennies % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function splitRoomExpenses(amounts: { gasAmount: number; rationAmount: number; provisionAmount: number }, employeeIds: string[]) {
  const uniqueEmployees = [...new Set(employeeIds)].sort();
  const gas = splitMoneyEqually(amounts.gasAmount, uniqueEmployees.length);
  const ration = splitMoneyEqually(amounts.rationAmount, uniqueEmployees.length);
  const provision = splitMoneyEqually(amounts.provisionAmount, uniqueEmployees.length);
  return uniqueEmployees.map((employeeId, index) => ({
    employeeId,
    gasShare: gas[index],
    rationShare: ration[index],
    provisionShare: provision[index],
    total: Math.round((gas[index] + ration[index] + provision[index]) * 100) / 100,
  }));
}
