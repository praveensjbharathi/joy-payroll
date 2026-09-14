/** Return changed collections only; unknown or cross-cutting actions keep the full response. */
export function mutationCollections(action: string, details: Record<string, unknown> = {}): string[] | undefined {
  const payroll = ["runs", "payrollItems", "payrollBatches", "paymentExportBatches", "paymentExportBatchItems"];
  const maps: Record<string, string[]> = {
    "save-employee": ["employees", "units", "runs", "payrollItems", "payrollBatches", "accommodationRooms", "accommodationCharges", "recoveryEntries", "recoveryFinalizations", "appUsers"],
    "save-hostel": ["hostels", "accommodationRooms"], "delete-hostel": ["hostels", "accommodationRooms", "hostelUtilityReadings", "employees"],
    "save-room": ["accommodationRooms", "employees", "accommodationCharges", ...payroll], "assign-room-hostel": ["accommodationRooms", "employees"],
    "save-accommodation": ["accommodationCharges", ...payroll], "delete-accommodation": ["accommodationCharges", ...payroll],
    "save-remark": ["remarks"], "save-shift": details.id ? ["shifts", "employees", "attendance"] : ["shifts"],
    "save-vehicle": ["vehicles"], "save-vehicle-record": ["vehicles", "vehicleRecords"],
    "save-utility-meter": ["utilityMeters"], "save-eb-reading": ["utilityMeters", "ebReadings"],
    "save-own-profile": ["appUsers"], "save-app-user": ["appUsers"],
    "save-attendance": ["attendance", ...payroll], "delete-attendance": ["attendance", ...payroll],
    "recalculate": payroll, "resolve-issues": payroll, "approve": payroll,
    "update-run-period": payroll, "update-salary": payroll,
    "save-recovery-entry": ["recoveryEntries", "recoveryFinalizations", ...payroll],
    "delete-recovery-entry": ["recoveryEntries", "recoveryFinalizations", ...payroll],
    "save-hostel-utility": ["hostelUtilityReadings"],
    "save-accommodation-type": details.id ? ["accommodationTypes", "accommodationRooms", "employees", "payrollItems", "runs"] : ["accommodationTypes"],
  };
  if (action === "delete-record" || action === "set-record-status") {
    const simple: Record<string,string[]> = {remark:["remarks"],app_user:["appUsers"],employee:["employees","units","runs","payrollItems"]};
    const keys=simple[String(details.entityType)];
    return keys ? [...keys,"auditEvents","currentUser"] : undefined;
  }
  return maps[action] ? [...new Set([...maps[action], "auditEvents", "currentUser"])] : undefined;
}
export function mergeAppUpdate<T extends object>(current: T, response: Partial<T> & {delta?: boolean}) {
  if (!response.delta) return response as T;
  const {delta: _delta, ...collections}=response;
  return {...current,...collections};
}
