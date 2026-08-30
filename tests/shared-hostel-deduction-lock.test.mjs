import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one physical hostel can span Joy group companies and employer units", async () => {
  const [schema, hostelUi, route, app] = await Promise.all([
    read("db/schema.ts"),
    read("app/hostel-master.tsx"),
    read("app/api/app-data/route.ts"),
    read("app/payroll-app.tsx"),
  ]);
  assert.match(schema, /groupCompanyScopeJson: text\("group_company_scope_json"\)/);
  assert.match(hostelUi, /Applicable Joy group companies/);
  assert.match(hostelUi, /name="groupCompanyScope"/);
  assert.match(hostelUi, /Map this .*client employer units/);
  assert.match(route, /groupCompanyScopeJson: JSON\.stringify\(groupCompanyScope\)/);
  assert.match(route, /physical hostel \/ area already exists/i);
  assert.match(app, /vendors=\{data\.vendors\}/);
  assert.match(app, /units=\{data\.units\}/);
});

test("day-wise employee and room deductions remain editable until deduction lock", async () => {
  const [schema, route, recoveryUi] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/app-data/route.ts"),
    read("app/reports-recovery.tsx"),
  ]);
  assert.match(schema, /export const roomRecoveryEntries/);
  assert.match(schema, /deductionsStatus: text\("deductions_status"\)/);
  assert.match(route, /action === "update-recovery-entry"/);
  assert.match(route, /action === "update-room-recovery-entry"/);
  assert.match(route, /action === "delete-room-recovery-entry"/);
  assert.match(route, /syncDatedRecoveries\(db, runId, employeeId\)/);
  assert.match(route, /syncRoomRecoveryLedger\(db, roomId, payPeriod\)/);
  assert.match(recoveryUi, /editRecovery\(entry\)/);
  assert.match(recoveryUi, /editRoomRecovery\(entry\)/);
  assert.match(recoveryUi, /Every save updates employee final payable live/);
});

test("deductions must lock before payroll approval", async () => {
  const [route, app] = await Promise.all([
    read("app/api/app-data/route.ts"),
    read("app/payroll-app.tsx"),
  ]);
  assert.match(route, /action === "lock-deductions"/);
  assert.match(route, /action === "reopen-deductions"/);
  assert.match(route, /Verify & Lock Deductions before final payroll approval/);
  assert.match(route, /deductionsStatus: "locked"/);
  assert.match(app, /Verify & lock deductions first/);
  assert.match(app, /label: "Deductions lock"/);
});

test("dashboard separates statutory deductions from company recoveries", async () => {
  const [app, calculations] = await Promise.all([
    read("app/payroll-app.tsx"),
    read("lib/payroll-calculations.ts"),
  ]);
  assert.match(app, /label="Statutory deductions"/);
  assert.match(app, /label="Company recoveries"/);
  assert.match(app, /EPF · ESI · PT · LWF · TDS · Insurance/);
  assert.match(calculations, /numberValue\(item\.medicalInsurance\)/);
  assert.match(calculations, /"otherShare"/);
});
