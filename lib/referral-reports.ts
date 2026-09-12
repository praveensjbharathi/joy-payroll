export function referenceReport(employees: { id: string; employeeCode: string; name: string; dateOfJoining: string; status: string; applicationJson?: string | null }[], items: { employeeId: string; presentDays: number; payableDays: number }[], reference: 1 | 2, minimumWorkedDays = 0, bonusPerEmployee = 0) {
  if (![minimumWorkedDays, bonusPerEmployee].every(v => Number.isFinite(v) && v >= 0)) throw new Error("Enter valid bonus assumptions.");
  const payroll = new Map(items.map(i => [i.employeeId, i]));
  return employees.flatMap(employee => {
    let data: Record<string, string> = {};
    try { data = JSON.parse(employee.applicationJson || "{}"); } catch { return []; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    const get = (key: string) => typeof data[key] === "string" ? data[key] : "";
    const name = get(`Reference ${reference} - Name`);
    if (!name) return [];
    const item = payroll.get(employee.id);
    const workedDays = item?.presentDays || 0;
    // Only employees with a payroll row and positive worked days qualify for this estimate.
    const eligible = Boolean(item && workedDays > 0 && workedDays >= minimumWorkedDays && (reference !== 1 || get("Reference 1 - Employee ID")));
    return [{ referrerId: get(`Reference ${reference} - Employee ID`), referrerCode: get(`Reference ${reference} - Employee Code`), referrerName: name, phone: get(`Reference ${reference} - Phone No`), position: get(`Reference ${reference} - Position`), address: get(`Reference ${reference} - Address`), employeeCode: employee.employeeCode, employeeName: employee.name, joiningDate: employee.dateOfJoining, status: employee.status, workedDays, payableDays: item?.payableDays || 0, eligible, bonusEstimate: eligible ? Math.round(bonusPerEmployee * 100) / 100 : 0 }];
  });
}
