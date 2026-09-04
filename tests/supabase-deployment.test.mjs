import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPaths = [
  join(root, "supabase/migrations/202608250001_joy_payroll.sql"),
  join(root, "supabase/migrations/20260825165413_payroll_accommodation_access_enhancements.sql"),
  join(root, "supabase/migrations/20260826043000_hostel_master_utilities_cumulative_deductions.sql"),
  join(root, "supabase/migrations/20260826080000_link_hostels_to_accommodation_types.sql"),
  join(root, "supabase/migrations/20260826090000_shift_assignments_hostel_activities.sql"),
  join(root, "supabase/migrations/20260826103000_direct_users_hostel_rent_and_deductions.sql"),
  join(root, "supabase/migrations/20260826143000_payroll_source_mode.sql"),
  join(root, "supabase/migrations/20260827090000_recovery_auth_branding.sql"),
  join(root, "supabase/migrations/20260827110000_client_ot_voucher_hostel_scope.sql"),
  join(root, "supabase/migrations/20260827130000_recovery_finalization.sql"),
  join(root, "supabase/migrations/20260827150000_employee_room_rent_photo.sql"),
  join(root, "supabase/migrations/20260827170000_employee_statutory_controls.sql"),
  join(root, "supabase/migrations/20260827190000_employee_identity_details.sql"),
  join(root, "supabase/migrations/20260827133444_employee_highest_qualification.sql"),
  join(root, "supabase/migrations/20260905010000_individual_payment_export_locks.sql"),
];
const payrollTables = [
  "app_users",
  "vendors",
  "client_units",
  "employees",
  "shift_definitions",
  "payroll_remarks",
  "payroll_rules",
  "attendance_entries",
  "payroll_runs",
  "payroll_items",
  "accommodation_charges",
  "accommodation_types",
  "accommodation_rooms",
  "accommodation_room_expenses",
  "hostels",
  "hostel_utility_readings",
  "payroll_batches",
  "payment_export_batches",
  "payment_export_batch_items",
  "audit_events",
];

test("Supabase migration creates and protects every payroll table", async () => {
  const sql = (await Promise.all(migrationPaths.map((path) => readFile(path, "utf8")))).join("\n");
  for (const table of payrollTables) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /revoke all on[\s\S]+from anon, authenticated/i);
  assert.match(sql, /praveen\.red\.07@gmail\.com/i);
  assert.match(sql, /'super_admin'/);
  assert.match(sql, /attendance_employee_date_unique/);
  assert.match(sql, /payroll_run_employee_unique/);
});

test("the generated Supabase API preserves payroll logic without demo seeding", async () => {
  const route = await readFile(
    join(root, "supabase/functions/payroll-api/generated/route.ts"),
    "utf8",
  );
  const schema = await readFile(
    join(root, "supabase/functions/payroll-api/generated/schema.ts"),
    "utf8",
  );
  assert.match(route, /export async function GET\(identity: AuthenticatedUser \| null\)/);
  assert.match(route, /export async function POST\(request: Request, identity: AuthenticatedUser \| null\)/);
  assert.match(route, /production databases intentionally start without demo payroll records/);
  assert.doesNotMatch(route, /await ensureDemoData\(\)/);
  assert.doesNotMatch(route, /getAuthenticatedUser/);
  assert.doesNotMatch(schema, /sqliteTable|drizzle-orm\/sqlite-core/);
  assert.match(schema, /generatedByDefaultAsIdentity/);
  assert.match(schema, /doublePrecision/);
  for (const action of [
    "save-app-user",
    "save-employee",
    "save-attendance",
    "save-accommodation",
    "save-room-expense",
    "finalize-room-expense",
    "save-hostel",
    "save-hostel-utility",
    "prepare-payroll-batches",
    "clear-payroll-batch",
    "reopen-payroll-for-recovery",
    "import-workbook",
    "lock-payment-batch",
    "unlock-payment-batch",
    "download-payment-batch",
    "approve",
  ]) {
    assert.match(route, new RegExp(`"${action}"`));
  }
});

test("Supabase browser configuration contains no privileged credentials", async () => {
  const configuration = await readFile(
    join(root, "supabase-frontend/public/config.js"),
    "utf8",
  );
  assert.match(configuration, /supabasePublishableKey/);
  assert.doesNotMatch(configuration, /sb_secret_[a-zA-Z0-9]+/);
  assert.match(configuration, /NEVER put a secret key/);
  const entrypoint = await readFile(
    join(root, "supabase/functions/payroll-api/index.ts"),
    "utf8",
  );
  assert.match(entrypoint, /admin\.auth\.getUser\(token\)/);
  assert.match(entrypoint, /data\.user\.email_confirmed_at/);
  assert.match(entrypoint, /https:\/\/payroll\.joycorporatesolutions\.com/);
  const functionConfig = await readFile(join(root, "supabase/config.toml"), "utf8");
  assert.match(functionConfig, /verify_jwt\s*=\s*true/);
});
