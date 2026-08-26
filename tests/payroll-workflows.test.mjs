import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare } from "miniflare";

const root = new URL("../", import.meta.url);
const adminEmail = "payroll-test@example.com";
const payrollEmail = "payroll-team@example.com";
const hrEmail = "hr-team@example.com";
const attendanceEmail = "attendance-view@example.com";
const automatedSiteEmail = "sites-screenshot-service-noreply@chatgpt.com";
const identityHeaders = (email = adminEmail) => ({
  "content-type": "application/json",
  "oai-authenticated-user-email": email,
});

test("client, employer, employee, shift, remark, payroll, and workbook management workflows", async () => {
  const worker = new Miniflare({
    name: "joy-payroll-workflow-test",
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
    scriptPath: fileURLToPath(new URL("dist/server/index.js", root)),
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
  });

  try {
    const database = await worker.getD1Database("DB");
    for (const migration of ["0000_superb_goblin_queen.sql", "0001_icy_tony_stark.sql", "0002_sparkling_dark_beast.sql", "0003_elite_maginty.sql", "0004_payroll_accommodation_access_enhancements.sql", "0005_unit_attendance_cycle_payslip_fields.sql", "0006_direct_employee_vehicle_utility_operations.sql", "0007_hostel_master_utilities.sql"]) {
      const sql = await readFile(new URL(`drizzle/${migration}`, root), "utf8");
      for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim()) await database.prepare(statement.trim()).run();
      }
    }

    async function actionAs(email, payload, expectedStatus = 200) {
      const response = await worker.dispatchFetch("https://payroll.test/api/app-data", {
        method: "POST",
        headers: identityHeaders(email),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      assert.equal(response.status, expectedStatus, JSON.stringify(data));
      return data;
    }

    async function action(payload, expectedStatus = 200) {
      return actionAs(adminEmail, payload, expectedStatus);
    }

    async function dataAs(email, expectedStatus = 200) {
      const response = await worker.dispatchFetch("https://payroll.test/api/app-data", { headers: identityHeaders(email) });
      const data = await response.json();
      assert.equal(response.status, expectedStatus, JSON.stringify(data));
      return data;
    }

    const automatedAccess = await dataAs(automatedSiteEmail, 403);
    assert.match(automatedAccess.error, /automated site services/i);
    const emptyProfiles = await database.prepare("SELECT COUNT(*) AS count FROM app_users").first();
    assert.equal(emptyProfiles.count, 0);

    await database.prepare("INSERT INTO app_users (id, email, full_name, role, status, permissions_json, can_approve_payroll, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("USER-SITE-AUTOMATION", automatedSiteEmail, "Sites Screenshot Service", "super_admin", "active", "{}", 1, automatedSiteEmail)
      .run();

    const startup = await worker.dispatchFetch("https://payroll.test/api/app-data", { headers: identityHeaders() });
    assert.equal(startup.status, 200, await startup.clone().text());
    const initial = await startup.json();
    assert.equal(initial.vendors.length, 2);
    assert.equal(initial.employees.length, 6);
    assert.equal(initial.shifts.length, 8);
    assert.equal(initial.remarks.length, 0);
    assert.equal(initial.currentUser.role, "super_admin");
    assert.equal(initial.currentUser.canApprovePayroll, true);
    assert.equal(initial.appUsers.length, 1);
    assert.equal(initial.appUsers[0].id, "USER-SITE-AUTOMATION");
    assert.equal(initial.appUsers[0].email, adminEmail);

    let userState = await action({ action: "save-app-user", email: payrollEmail, fullName: "Payroll Maker", role: "payroll_team", clientScope: ["vendor-jms"] });
    const payrollProfile = userState.appUsers.find((profile) => profile.email === payrollEmail);
    assert.ok(payrollProfile);
    assert.equal(payrollProfile.permissions.payroll, "manage");
    assert.equal(payrollProfile.permissions.attendance, "view");
    assert.equal(payrollProfile.canApprovePayroll, false);

    userState = await action({ action: "save-app-user", email: hrEmail, fullName: "HR Operator", role: "hr_team", unitScope: ["unit-watertec-1"] });
    const hrProfile = userState.appUsers.find((profile) => profile.email === hrEmail);
    assert.ok(hrProfile);
    assert.equal(hrProfile.permissions.employees, "manage");
    assert.equal(hrProfile.permissions.payments, "none");

    const attendanceOnlyPermissions = Object.fromEntries(Object.keys(initial.currentUser.permissions).map((module) => [module, module === "attendance" ? "view" : "none"]));
    userState = await action({ action: "save-app-user", email: attendanceEmail, fullName: "Attendance Viewer", role: "hr_team", unitScope: ["unit-watertec-1"], permissions: attendanceOnlyPermissions });
    const attendanceProfile = userState.appUsers.find((profile) => profile.email === attendanceEmail);
    assert.ok(attendanceProfile);

    await dataAs("unlisted@example.com", 403);
    const attendanceOnly = await dataAs(attendanceEmail);
    assert.ok(attendanceOnly.attendance.length > 0);
    assert.ok(attendanceOnly.runs.length > 0);
    assert.equal(attendanceOnly.employees[0].salaryAmount, 0);
    assert.equal(attendanceOnly.employees[0].bankAccountMasked, null);
    assert.equal(attendanceOnly.payrollItems[0].grossEarnings, 0);
    assert.equal(attendanceOnly.payrollItems[0].netPayable, 0);
    assert.equal(attendanceOnly.accommodationCharges.length, 0);
    assert.equal(attendanceOnly.appUsers.length, 0);

    const hrData = await dataAs(hrEmail);
    assert.equal(hrData.currentUser.role, "hr_team");
    assert.equal(hrData.appUsers.length, 0);
    assert.equal(hrData.rules.length, 0);
    await actionAs(hrEmail, { action: "recalculate", runId: "RUN-AUG26-JMS-WAT1" }, 403);
    await actionAs(hrEmail, { action: "save-app-user", email: "blocked@example.com", role: "hr_team" }, 403);
    await actionAs(hrEmail, { action: "save-attendance", runId: "RUN-AUG26-JMS-WAT1", employeeId: "emp-1001", attendanceDate: "2026-08-08", statusCode: "P", shiftCode: "General", overtimeHours: 0 });
    await actionAs(payrollEmail, { action: "recalculate", runId: "RUN-AUG26-JMS-WAT1" });

    await action({ action: "set-record-status", entityType: "app_user", entityId: attendanceProfile.id, status: "inactive" });
    await dataAs(attendanceEmail, 403);
    await action({ action: "delete-record", entityType: "app_user", entityId: initial.currentUser.id }, 409);

    let state = await action({ action: "create-vendor", code: "TST", name: "Test Payroll Services" });
    const vendor = state.vendors.find((entry) => entry.code === "TST");
    assert.ok(vendor);
    assert.equal(state.shifts.filter((entry) => entry.vendorId === vendor.id).length, 4);
    state = await action({ action: "save-client", id: vendor.id, code: "TST", name: "Test Payroll Client", legalName: "Test Payroll Client Private Limited", remarks: "Monthly attendance closes on the 25th" });
    assert.equal(state.vendors.find((entry) => entry.id === vendor.id).name, "Test Payroll Client");
    assert.equal(state.vendors.find((entry) => entry.id === vendor.id).remarks, "Monthly attendance closes on the 25th");
    state = await action({ action: "create-unit", vendorId: vendor.id, clientName: "Precision Factory", unitName: "Plant A", location: "Coimbatore" });
    const unit = state.units.find((entry) => entry.vendorId === vendor.id);
    assert.ok(unit);
    state = await action({ action: "save-unit", id: unit.id, vendorId: vendor.id, clientName: "Precision Engineering Factory", unitName: "Plant A", location: "Sulur, Coimbatore", remarks: "Report to Gate 2", attendanceCycleStartDay: 26, attendanceCycleEndDay: 25, attendanceWorkingDays: 26, payslipEarnings: ["basic", "overtimeWages"], payslipDeductions: ["pfDeduction", "accommodationDeduction"] });
    assert.equal(state.units.find((entry) => entry.id === unit.id).clientName, "Precision Engineering Factory");
    assert.equal(state.units.find((entry) => entry.id === unit.id).remarks, "Report to Gate 2");
    assert.equal(state.units.find((entry) => entry.id === unit.id).attendanceCycleStartDay, 26);
    assert.deepEqual(JSON.parse(state.units.find((entry) => entry.id === unit.id).payslipEarningsJson), ["basic", "overtimeWages"]);

    state = await action({ action: "save-shift", vendorId: vendor.id, name: "Weekend Shift", startTime: "07:30", endTime: "16:30", remarks: "Transport available" });
    const customShift = state.shifts.find((entry) => entry.vendorId === vendor.id && entry.name === "Weekend Shift");
    assert.ok(customShift);
    state = await action({ action: "save-shift", vendorId: vendor.id, id: customShift.id, name: "Weekend Production", startTime: "08:00", endTime: "17:00", remarks: "Bus leaves at 7:30" });
    assert.equal(state.shifts.find((entry) => entry.id === customShift.id).startTime, "08:00");
    state = await action({ action: "set-record-status", entityType: "shift", entityId: customShift.id, status: "inactive" });
    assert.equal(state.shifts.find((entry) => entry.id === customShift.id).status, "inactive");
    state = await action({ action: "set-record-status", entityType: "shift", entityId: customShift.id, status: "active" });

    state = await action({ action: "save-remark", vendorId: vendor.id, category: "attendance", title: "Late arrival", notes: "Supervisor approval required" });
    const remark = state.remarks.find((entry) => entry.title === "Late arrival");
    assert.ok(remark);
    state = await action({ action: "save-remark", vendorId: vendor.id, id: remark.id, category: "attendance", title: "Late arrival approved", notes: "Approved by shift supervisor" });
    assert.equal(state.remarks.find((entry) => entry.id === remark.id).notes, "Approved by shift supervisor");
    state = await action({ action: "set-record-status", entityType: "remark", entityId: remark.id, status: "inactive" });
    assert.equal(state.remarks.find((entry) => entry.id === remark.id).status, "inactive");
    state = await action({ action: "set-record-status", entityType: "remark", entityId: remark.id, status: "active" });

    state = await action({
      action: "save-employee",
      vendorId: vendor.id,
      unitId: unit.id,
      employee: {
        employeeCode: "T100",
        name: "Test Employee",
        department: "Production",
        dateOfJoining: "2026-09-01",
        salaryAmount: 26000,
        salaryBasis: "monthly",
        defaultShift: "1st Shift",
        paymentMode: "bank",
        bankAccountMasked: "1234567890",
        ifscMasked: "CUB0000123",
        bankName: "City Union Bank",
        uanMasked: "100200300400",
        esiMasked: "1234567890",
        accommodationType: "Joy Room",
        roomNumber: "A1",
        remarks: "Experienced CNC operator",
      },
    });
    const employee = state.employees.find((entry) => entry.employeeCode === "T100");
    assert.ok(employee);
    assert.equal(employee.remarks, "Experienced CNC operator");
    assert.equal(state.units.find((entry) => entry.id === unit.id).employeeCount, 1);

    state = await action({ action: "mark-employee-left", employeeId: employee.id, leftDate: "2026-09-15" });
    assert.equal(state.units.find((entry) => entry.id === unit.id).employeeCount, 0);
    state = await action({ action: "create-run", vendorId: vendor.id, unitId: unit.id, payPeriod: "2026-09" });
    const runId = state.selectedRunId;
    assert.equal(state.runs.find((entry) => entry.id === runId).periodStart, "2026-08-26");
    assert.equal(state.runs.find((entry) => entry.id === runId).periodEnd, "2026-09-25");
    assert.equal(state.runs.find((entry) => entry.id === runId).employeeCount, 0);
    state = await action({ action: "reactivate-employee", employeeId: employee.id });
    assert.equal(state.runs.find((entry) => entry.id === runId).employeeCount, 1);

    const firstShift = state.shifts.find((entry) => entry.vendorId === vendor.id && entry.name === "1st Shift");
    state = await action({ action: "save-shift", vendorId: vendor.id, id: firstShift.id, name: "Morning Production", startTime: "06:00", endTime: "14:00", remarks: "Main production shift" });
    assert.equal(state.employees.find((entry) => entry.id === employee.id).defaultShift, "Morning Production");

    state = await action({
      action: "save-rules",
      vendorId: vendor.id,
      rules: { standardWorkingDays: 26, pfRate: 12, esiRate: 0.75, professionalTax: 200, lwf: 10, overtimeHourlyRate: 100, paidLeave: 0, paidWeekOff: 1, effectiveFrom: "2026-09-01" },
    });
    assert.equal(state.rules.find((entry) => entry.vendorId === vendor.id).pfRate, 12);

    for (const [date, statusCode, overtimeHours] of [["2026-09-01", "P", 0], ["2026-09-02", "WO", 0], ["2026-09-03", "HP", 2]]) {
      state = await action({ action: "save-attendance", runId, employeeId: employee.id, attendanceDate: date, statusCode, shiftCode: "2nd Shift", overtimeHours, remarks: date === "2026-09-03" ? "Approved holiday work" : "" });
    }
    assert.equal(state.attendance.find((entry) => entry.employeeId === employee.id && entry.attendanceDate === "2026-09-03").remarks, "Approved holiday work");
    let item = state.payrollItems.find((entry) => entry.runId === runId && entry.employeeId === employee.id);
    assert.equal(item.presentDays, 2);
    assert.equal(item.weekOffDays, 1);
    assert.equal(item.holidayPresentDays, 1);
    assert.equal(item.payableDays, 3);
    assert.equal(item.basic, 3000);
    assert.equal(item.overtimeWages, 200);
    assert.equal(item.pfDeduction, 360);
    assert.equal(item.esiDeduction, 24);
    assert.equal(item.grossEarnings, 3200);

    state = await action({ action: "delete-attendance", runId, employeeId: employee.id, attendanceDate: "2026-09-03" });
    assert.equal(state.attendance.some((entry) => entry.employeeId === employee.id && entry.attendanceDate === "2026-09-03"), false);
    state = await action({ action: "save-attendance", runId, employeeId: employee.id, attendanceDate: "2026-09-03", statusCode: "HP", shiftCode: "2nd Shift", overtimeHours: 2, remarks: "Approved holiday work" });

    state = await action({ action: "save-payroll-item", runId, itemId: item.id, fields: { basic: 3000, hra: 500, overtimeWages: 200, pfDeduction: 360, esiDeduction: 24, professionalTax: 200, lwf: 10 } });
    item = state.payrollItems.find((entry) => entry.id === item.id);
    assert.equal(item.grossEarnings, 3700);

    state = await action({ action: "save-accommodation", runId, employeeId: employee.id, fields: { roomNumber: "A1", rent: 300, bus: 50, returnAmount: 20 } });
    item = state.payrollItems.find((entry) => entry.employeeId === employee.id && entry.runId === runId);
    assert.equal(item.accommodationDeduction, 350);
    assert.equal(item.returnAmount, 20);
    assert.equal(item.totalDeductions, 944);
    assert.equal(item.netPayable, 2776);

    state = await action({ action: "delete-accommodation", runId, employeeId: employee.id });
    item = state.payrollItems.find((entry) => entry.employeeId === employee.id && entry.runId === runId);
    assert.equal(item.accommodationDeduction, 0);
    assert.equal(item.returnAmount, 0);
    state = await action({ action: "save-accommodation", runId, employeeId: employee.id, fields: { roomNumber: "A1", rent: 300, bus: 50, returnAmount: 20 } });

    await actionAs(payrollEmail, { action: "approve", runId }, 403);
    await action({ action: "save-app-user", id: payrollProfile.id, email: payrollProfile.email, fullName: payrollProfile.fullName, role: payrollProfile.role, permissions: payrollProfile.permissions, clientScope: ["vendor-jms", vendor.id], canApprovePayroll: true });
    state = await actionAs(payrollEmail, { action: "approve", runId });
    assert.equal(state.runs.find((entry) => entry.id === runId).status, "approved");
    await action({ action: "save-attendance", runId, employeeId: employee.id, attendanceDate: "2026-09-04", statusCode: "P" }, 409);
    await action({ action: "delete-record", entityType: "employee", entityId: employee.id }, 409);
    await action({ action: "delete-payroll-run", runId }, 409);
    state = await action({ action: "reopen", runId });
    assert.equal(state.runs.find((entry) => entry.id === runId).status, "validated");

    state = await action({
      action: "import-workbook",
      vendorId: vendor.id,
      unitId: unit.id,
      payPeriod: "2026-10",
      sourceType: "attendance",
      employees: [{ employeeCode: "T101", name: "Imported Employee", department: "Packing", dateOfJoining: "2026-10-01", salaryAmount: 13000, salaryBasis: "monthly", paymentMode: "cash", accommodationType: "Tamil Own", defaultShift: "3rd Shift", uanMasked: "100200300401", esiMasked: "1234567891" }],
      attendance: [{ employeeCode: "T101", attendanceDate: "2026-10-01", statusCode: "P", shiftCode: "3rd Shift", overtimeHours: 0 }, { employeeCode: "T101", attendanceDate: "2026-10-02", statusCode: "WO", shiftCode: "General", overtimeHours: 0 }],
      salaryItems: [],
    });
    const importedEmployee = state.employees.find((entry) => entry.employeeCode === "T101");
    const octoberRun = state.runs.find((entry) => entry.payPeriod === "2026-10" && entry.clientUnitId === unit.id);
    const importedItem = state.payrollItems.find((entry) => entry.runId === octoberRun.id && entry.employeeId === importedEmployee.id);
    assert.equal(importedItem.payableDays, 2);
    assert.equal(importedItem.basic, 1000);

    await action({ action: "delete-record", entityType: "employee", entityId: importedEmployee.id }, 409);
    state = await action({ action: "mark-employee-left", employeeId: importedEmployee.id, leftDate: "2026-10-15" });
    assert.equal(state.employees.find((entry) => entry.id === importedEmployee.id).dateOfLeaving, "2026-10-15");
    assert.equal(state.payrollItems.some((entry) => entry.employeeId === importedEmployee.id), true);
    state = await action({ action: "delete-payroll-run", runId: octoberRun.id });
    assert.equal(state.runs.some((entry) => entry.id === octoberRun.id), false);

    state = await action({ action: "delete-record", entityType: "shift", entityId: customShift.id });
    assert.equal(state.shifts.some((entry) => entry.id === customShift.id), false);
    state = await action({ action: "delete-record", entityType: "remark", entityId: remark.id });
    assert.equal(state.remarks.some((entry) => entry.id === remark.id), false);

    state = await action({ action: "save-client", code: "TEMP", name: "Temporary Client" });
    const temporaryClient = state.vendors.find((entry) => entry.code === "TEMP");
    state = await action({ action: "save-unit", vendorId: temporaryClient.id, clientName: "Temporary Employer", unitName: "Unit B", location: "Hosur" });
    const temporaryUnit = state.units.find((entry) => entry.vendorId === temporaryClient.id);
    state = await action({ action: "set-record-status", entityType: "unit", entityId: temporaryUnit.id, status: "inactive" });
    assert.equal(state.units.find((entry) => entry.id === temporaryUnit.id).status, "inactive");
    state = await action({ action: "set-record-status", entityType: "unit", entityId: temporaryUnit.id, status: "active" });
    state = await action({ action: "set-record-status", entityType: "client", entityId: temporaryClient.id, status: "inactive" });
    assert.equal(state.vendors.find((entry) => entry.id === temporaryClient.id).status, "inactive");
    state = await action({ action: "set-record-status", entityType: "client", entityId: temporaryClient.id, status: "active" });
    await action({ action: "delete-record", entityType: "client", entityId: temporaryClient.id }, 409);
    state = await action({ action: "delete-record", entityType: "unit", entityId: temporaryUnit.id });
    state = await action({ action: "delete-record", entityType: "client", entityId: temporaryClient.id });
    assert.equal(state.vendors.some((entry) => entry.id === temporaryClient.id), false);
    assert.equal(state.shifts.some((entry) => entry.vendorId === temporaryClient.id), false);

    await action({ action: "create-vendor", code: "TST", name: "Duplicate client" }, 409);
  } finally {
    await worker.dispose();
  }
});
