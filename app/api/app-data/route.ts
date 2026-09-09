// JOY_BANK_ONLY_POLICY_V1
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getAuthenticatedUser, type AuthenticatedUser } from "../../auth";
import { getDb, getRawDb } from "../../../db";
import {
  accommodationCharges,
  accommodationRoomExpenses,
  accommodationRooms,
  accommodationTypes,
  appUsers,
  attendanceEntries,
  auditEvents,
  clientUnits,
  employees,
  vehicles,
  vehicleRecords,
  utilityMeters,
  ebReadings,
  hostels,
  hostelUtilityReadings,
  payrollItems,
  payrollBatches,
  paymentExportBatches,
  paymentExportBatchItems,
  payrollRemarks,
  payrollRules,
  payrollRuns,
  recoveryEntries,
  recoveryFinalizations,
  shiftDefinitions,
  vendors,
} from "../../../db/schema";
import {
  ATTENDANCE_CODES,
  accommodationTotal,
  attendanceSummary,
  deductionFields,
  defaultPayrollRules,
  earningFields,
  numberValue,
  payrollTotals,
  roundMoney,
  salaryForAttendance,
  validationForEmployee,
} from "../../../lib/payroll-calculations";
import {
  ACCESS_MODULES,
  DEFAULT_PERMISSIONS,
  canManage,
  canView,
  normalizePermissions,
  normalizeRole,
  type AccessModule,
} from "../../../lib/access-control";
import {
  DEFAULT_ACCOMMODATION_TYPES,
  normalizeAccommodationType,
  normalizedScope,
  payrollPeriodRange,
  splitRoomExpenses,
} from "../../../lib/payroll-operations";

type Db = ReturnType<typeof getDb>;
type EmployeeRow = typeof employees.$inferSelect;
type PayrollRunRow = typeof payrollRuns.$inferSelect;
type PayrollItemRow = typeof payrollItems.$inferSelect;
type AppUserRow = typeof appUsers.$inferSelect;
type Payload = Record<string, unknown> & { action?: string; runId?: string };

type AppAccess = {
  identity: AuthenticatedUser;
  profile: ReturnType<typeof appUserProfile>;
};

class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function errorMessages(error: unknown) {
  const messages: string[] = [];
  let current = error;
  while (current instanceof Error && messages.length < 4) {
    messages.push(current.message);
    current = "cause" in current ? current.cause : null;
  }
  return messages;
}

// Missing account number and/or IFSC can be handled by the audited Cash
// Payment Excel route. Any salary, UAN, ESI or other validation issue must
// still block payroll approval.
function isCashFallbackOnlyValidation(input: {
  paymentMode: string;
  bankAccountMasked: string | null;
  ifscMasked: string | null;
  validationMessage: string | null;
}) {
  if (
    input.paymentMode !== "bank" ||
    (input.bankAccountMasked && input.ifscMasked)
  )
    return false;
  const unresolved = String(input.validationMessage ?? "")
    .toLowerCase()
    .replaceAll("bank account", "")
    .replaceAll("ifsc", "")
    .replaceAll("pending", "")
    .replace(/[\s,;]+/g, "");
  return unresolved.length === 0;
}

// JOY_CASH_APPROVAL_AND_DASHBOARD_SPLIT_V1
// The employee master continues to report missing bank fields, but a payroll
// row with no other issue is ready for the audited cash-payment route.
function payrollValidationForCashFallback(
  employee: {
    paymentMode: string;
    bankAccountMasked: string | null;
    ifscMasked: string | null;
  },
  validation: { validationStatus: string; validationMessage: string | null },
) {
  return isCashFallbackOnlyValidation({
    ...employee,
    validationMessage: validation.validationMessage,
  })
    ? { ...validation, validationStatus: "ready" }
    : validation;
}

const RUN_ID = "RUN-AUG26-JMS-WAT1";

function isAutomatedSiteIdentity(email: string) {
  return /^sites-[a-z0-9-]+-noreply@chatgpt\.com$/i.test(email);
}

function parsePermissionJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function appUserProfile(row: AppUserRow) {
  const role = normalizeRole(row.role);
  const permissions = normalizePermissions(
    role,
    parsePermissionJson(row.permissionsJson),
  );
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    employeeCode: row.employeeCode,
    department: row.department,
    dateOfJoining: row.dateOfJoining,
    mobileNumber: row.mobileNumber,
    role,
    status: row.status,
    permissions,
    clientScope: normalizedScope(row.clientScopeJson),
    unitScope: normalizedScope(row.unitScopeJson),
    hostelScope: normalizedScope(row.hostelScopeJson),
    canApprovePayroll: role === "super_admin" || Boolean(row.canApprovePayroll),
    approvalManagerEmail: row.approvalManagerEmail,
    approvalSequence: row.approvalSequence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

async function requireAppAccess(db: Db): Promise<AppAccess> {
  const identity = await getAuthenticatedUser();
  if (!identity)
    throw new RequestError(
      "Secure sign-in is required to access Joy Payroll Manager",
      401,
    );
  const email = identity.email.trim().toLowerCase();
  if (isAutomatedSiteIdentity(email))
    throw new RequestError(
      "Automated Site services cannot access confidential payroll records.",
      403,
    );
  let [row] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);
  if (!row) {
    const existingProfiles = await db.select().from(appUsers);
    const existingHuman = existingProfiles.find(
      (profile) => !isAutomatedSiteIdentity(profile.email),
    );
    if (!existingHuman) {
      const now = new Date().toISOString();
      const values = {
        email,
        fullName: identity.fullName,
        role: "super_admin",
        status: "active",
        permissionsJson: JSON.stringify(DEFAULT_PERMISSIONS.super_admin),
        canApprovePayroll: 1,
        createdBy: email,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      const automatedProfile = existingProfiles.find((profile) =>
        isAutomatedSiteIdentity(profile.email),
      );
      if (automatedProfile) {
        await db
          .update(appUsers)
          .set(values)
          .where(eq(appUsers.id, automatedProfile.id));
      } else {
        await db
          .insert(appUsers)
          .values({ id: `USER-${crypto.randomUUID()}`, ...values })
          .onConflictDoNothing();
      }
      [row] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);
    }
  }
  if (!row)
    throw new RequestError(
      "Your payroll access profile has not been created. Contact the Super Admin.",
      403,
    );
  if (row.status !== "active")
    throw new RequestError(
      "Your payroll access profile is inactive. Contact the Super Admin.",
      403,
    );
  const lastLoginAt = new Date().toISOString();
  await db
    .update(appUsers)
    .set({ fullName: identity.fullName ?? row.fullName, lastLoginAt })
    .where(eq(appUsers.id, row.id));
  return {
    identity,
    profile: appUserProfile({
      ...row,
      fullName: identity.fullName ?? row.fullName,
      lastLoginAt,
    }),
  };
}

function requireModule(
  access: AppAccess,
  module: AccessModule,
  level: "view" | "manage",
) {
  const allowed =
    level === "manage"
      ? canManage(access.profile.permissions, module)
      : canView(access.profile.permissions, module);
  if (!allowed)
    throw new RequestError(
      `Your ${access.profile.role.replaceAll("_", " ")} profile does not have ${level} access to ${ACCESS_MODULES.find((item) => item.id === module)?.label ?? module}.`,
      403,
    );
}

function requireSuperAdmin(access: AppAccess) {
  if (access.profile.role !== "super_admin")
    throw new RequestError(
      "Only a Super Admin can manage users and access profiles.",
      403,
    );
}

function requireClientScope(access: AppAccess, vendorId: string) {
  if (access.profile.role === "super_admin") return;
  if (!access.profile.clientScope.includes(vendorId)) {
    throw new RequestError(
      "Your access profile does not include this client.",
      403,
    );
  }
}

function requireUnitScope(access: AppAccess, unitId: string, vendorId: string) {
  requireClientScope(access, vendorId);
  if (
    (access.profile.role === "hr_team" || access.profile.role === "field_hr") &&
    !access.profile.unitScope.includes(unitId)
  ) {
    throw new RequestError(
      "Your HR access profile does not include this employer unit.",
      403,
    );
  }
}

async function enforceActionScope(
  db: Db,
  access: AppAccess,
  action: string,
  payload: Payload,
) {
  if (access.profile.role === "super_admin") return;
  if (access.profile.role === "hostel_incharge") {
    const allowed = new Set([
      "save-attendance",
      "delete-attendance",
      "save-room-expense",
      "save-hostel-utility",
    ]);
    if (!allowed.has(action))
      throw new RequestError(
        "Hostel In-charge access is limited to assigned-hostel residents, attendance, and non-statutory hostel deductions",
        403,
      );
    const hostelScope = new Set(access.profile.hostelScope);
    const employeeId = optionalValue(payload.employeeId);
    if (employeeId) {
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      const [room] = employee?.roomId
        ? await db
            .select()
            .from(accommodationRooms)
            .where(eq(accommodationRooms.id, employee.roomId))
            .limit(1)
        : [];
      if (!employee || !room?.hostelId || !hostelScope.has(room.hostelId))
        throw new RequestError(
          "This employee is not staying in your assigned hostel",
          403,
        );
    }
    const roomId = optionalValue(payload.roomId);
    if (roomId) {
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, roomId))
        .limit(1);
      if (!room?.hostelId || !hostelScope.has(room.hostelId))
        throw new RequestError("This room is not in your assigned hostel", 403);
    }
    return;
  }
  if (action === "create-vendor")
    throw new RequestError("Only a Super Admin can add a new client.", 403);

  const explicitVendor = optionalValue(payload.vendorId);
  if (explicitVendor) requireClientScope(access, explicitVendor);

  const explicitUnit = optionalValue(payload.unitId);
  if (explicitUnit) {
    const [unit] = await db
      .select()
      .from(clientUnits)
      .where(eq(clientUnits.id, explicitUnit))
      .limit(1);
    if (!unit) throw new RequestError("Employer unit not found", 404);
    requireUnitScope(access, unit.id, unit.vendorId);
  }

  const explicitRun = optionalValue(payload.runId);
  if (explicitRun) {
    const run = await requireRun(db, explicitRun);
    requireUnitScope(access, run.clientUnitId, run.vendorId);
  }

  const employeeId = optionalValue(payload.employeeId);
  if (employeeId) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!employee) throw new RequestError("Employee not found", 404);
    requireUnitScope(access, employee.clientUnitId, employee.vendorId);
  }

  const roomId = optionalValue(payload.roomId);
  if (roomId) {
    const [room] = await db
      .select()
      .from(accommodationRooms)
      .where(eq(accommodationRooms.id, roomId))
      .limit(1);
    if (!room) throw new RequestError("Accommodation room not found", 404);
    requireClientScope(access, room.vendorId);
  }

  const entityId =
    optionalValue(payload.entityId) ??
    ([
      "save-client",
      "save-unit",
      "save-shift",
      "save-remark",
      "save-accommodation-type",
      "save-room",
    ].includes(action)
      ? optionalValue(payload.id)
      : null);
  if (!entityId) return;
  const entityType =
    optionalValue(payload.entityType) ??
    (action === "save-client"
      ? "client"
      : action === "save-unit"
        ? "unit"
        : action === "save-shift"
          ? "shift"
          : action === "save-remark"
            ? "remark"
            : action === "save-accommodation-type"
              ? "accommodation_type"
              : action === "save-room"
                ? "room"
                : "");
  if (entityType === "client") requireClientScope(access, entityId);
  else if (entityType === "unit") {
    const [unit] = await db
      .select()
      .from(clientUnits)
      .where(eq(clientUnits.id, entityId))
      .limit(1);
    if (unit) requireUnitScope(access, unit.id, unit.vendorId);
  } else if (entityType === "employee") {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, entityId))
      .limit(1);
    if (employee)
      requireUnitScope(access, employee.clientUnitId, employee.vendorId);
  } else if (entityType === "shift") {
    const [shift] = await db
      .select()
      .from(shiftDefinitions)
      .where(eq(shiftDefinitions.id, entityId))
      .limit(1);
    if (shift) requireClientScope(access, shift.vendorId);
  } else if (entityType === "remark") {
    const [remark] = await db
      .select()
      .from(payrollRemarks)
      .where(eq(payrollRemarks.id, entityId))
      .limit(1);
    if (remark) requireClientScope(access, remark.vendorId);
  } else if (entityType === "accommodation_type") {
    const [type] = await db
      .select()
      .from(accommodationTypes)
      .where(eq(accommodationTypes.id, entityId))
      .limit(1);
    if (type) requireClientScope(access, type.vendorId);
  } else if (entityType === "room") {
    const [room] = await db
      .select()
      .from(accommodationRooms)
      .where(eq(accommodationRooms.id, entityId))
      .limit(1);
    if (room) requireClientScope(access, room.vendorId);
  }
}

function actionPermission(
  action: string,
  payload: Payload,
): { module: AccessModule; level: "manage" } | null {
  if (action === "save-own-profile") return null;
  if (
    action === "save-app-user" ||
    ((action === "set-record-status" || action === "delete-record") &&
      payload.entityType === "app_user")
  )
    return { module: "users", level: "manage" };
  if (
    ["create-vendor", "save-client", "create-unit", "save-unit"].includes(
      action,
    ) ||
    ((action === "set-record-status" || action === "delete-record") &&
      ["client", "unit"].includes(String(payload.entityType)))
  )
    return { module: "clients", level: "manage" };
  if (
    [
      "save-employee",
      "mark-employee-left",
      "reactivate-employee",
      "advance-employee-workflow",
    ].includes(action) ||
    ((action === "set-record-status" || action === "delete-record") &&
      payload.entityType === "employee")
  )
    return { module: "employees", level: "manage" };
  if (
    ["save-shift", "save-remark", "save-accommodation-type"].includes(action) ||
    ((action === "set-record-status" || action === "delete-record") &&
      ["shift", "remark", "accommodation_type"].includes(
        String(payload.entityType),
      ))
  )
    return { module: "masters", level: "manage" };
  if (["save-attendance", "delete-attendance"].includes(action))
    return { module: "attendance", level: "manage" };
  if (
    [
      "save-accommodation",
      "delete-accommodation",
      "save-recovery-entry",
      "delete-recovery-entry",
      "finalize-employee-recovery",
      "reopen-employee-recovery",
      "save-room",
      "allocate-room",
      "save-room-expense",
      "finalize-room-expense",
      "reopen-room-expense",
    ].includes(action) ||
    ((action === "set-record-status" || action === "delete-record") &&
      payload.entityType === "room")
  )
    return { module: "accommodation", level: "manage" };
  if (
    [
      "clear-payroll-batch",
      "reopen-payroll-batch",
      "lock-payment-batch",
      "unlock-payment-batch",
      "download-payment-batch",
    ].includes(action)
  )
    return { module: "payments", level: "manage" };
  if (
    [
      "save-vehicle",
      "save-vehicle-record",
      "save-utility-meter",
      "save-eb-reading",
      "approve-operation-record",
    ].includes(action)
  )
    return { module: "operations", level: "manage" };
  if (
    [
      "save-hostel",
      "delete-hostel",
      "assign-room-hostel",
      "save-hostel-utility",
      "approve-hostel-utility",
    ].includes(action)
  )
    return { module: "accommodation", level: "manage" };
  if (action === "save-rules") return { module: "settings", level: "manage" };
  if (action === "import-workbook")
    return {
      module:
        payload.sourceType === "salary"
          ? "payroll"
          : payload.sourceType === "csv"
            ? "employees"
            : "attendance",
      level: "manage",
    };
  if (
    [
      "create-run",
      "update-run-period",
      "prepare-payroll-batch",
      "prepare-payroll-batches",
      "save-payroll-item",
      "resolve-issues",
      "recalculate",
      "reopen",
      "reopen-payroll-for-recovery",
      "reset-demo",
      "delete-payroll-run",
    ].includes(action)
  )
    return { module: "payroll", level: "manage" };
  return null;
}

async function createDefaultShifts(db: Db, vendorId: string) {
  await db.insert(shiftDefinitions).values([
    {
      id: `SHIFT-${crypto.randomUUID()}`,
      vendorId,
      name: "General",
      startTime: "09:00",
      endTime: "18:00",
    },
    {
      id: `SHIFT-${crypto.randomUUID()}`,
      vendorId,
      name: "1st Shift",
      startTime: "06:00",
      endTime: "14:00",
    },
    {
      id: `SHIFT-${crypto.randomUUID()}`,
      vendorId,
      name: "2nd Shift",
      startTime: "14:00",
      endTime: "22:00",
    },
    {
      id: `SHIFT-${crypto.randomUUID()}`,
      vendorId,
      name: "3rd Shift",
      startTime: "22:00",
      endTime: "06:00",
    },
  ]);
}

async function createDefaultAccommodationTypes(db: Db, vendorId: string) {
  await db.insert(accommodationTypes).values(
    DEFAULT_ACCOMMODATION_TYPES.map((name) => ({
      id: `ACCTYPE-${crypto.randomUUID()}`,
      vendorId,
      name,
    })),
  );
}

async function ensureDemoData() {
  const db = getDb();
  const existingVendors = await db.select({ id: vendors.id }).from(vendors);
  const [existingRun] = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(eq(payrollRuns.id, RUN_ID))
    .limit(1);
  const [existingActivity] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .limit(1);
  if (existingRun || existingVendors.length || existingActivity) return;

  const vendorRows = [
    {
      id: "vendor-jms",
      code: "JMS",
      name: "Joy Manpower Service",
      legalName: "Joy Manpower Service",
      epfCode: "CBCBE1724259000",
      esiCode: "56001195190001001",
      gstin: "33AOAPR4773D1Z2",
    },
    {
      id: "vendor-jcs",
      code: "JCS",
      name: "Joy Corporate Solutions Private Limited",
      legalName: "Joy Corporate Solutions Private Limited",
      epfCode: "CBCBE3415419000",
      esiCode: "56001461400000999",
      gstin: "33AAGCJ6200N1ZL",
    },
  ];
  if (!existingVendors.length) {
    await db.insert(vendors).values(vendorRows);
    for (const vendor of vendorRows) {
      await createDefaultShifts(db, vendor.id);
      await createDefaultAccommodationTypes(db, vendor.id);
    }
  }

  const unitRows = [
    {
      id: "unit-watertec-1",
      vendorId: "vendor-jms",
      clientName: "Watertec India",
      unitName: "Unit I",
      location: "Coimbatore",
      employeeCount: 126,
    },
    {
      id: "unit-bull-1",
      vendorId: "vendor-jms",
      clientName: "Bull Machines",
      unitName: "Unit I",
      location: "Coimbatore",
      employeeCount: 98,
    },
    {
      id: "unit-propel-1",
      vendorId: "vendor-jcs",
      clientName: "Propel Industries",
      unitName: "Unit I",
      location: "Coimbatore",
      employeeCount: 74,
    },
    {
      id: "unit-velan-1",
      vendorId: "vendor-jcs",
      clientName: "Velan Valves",
      unitName: "Unit I",
      location: "Coimbatore",
      employeeCount: 62,
    },
  ];
  const currentUnits = await db
    .select({ id: clientUnits.id })
    .from(clientUnits);
  const unitIds = new Set(currentUnits.map((unit) => unit.id));
  const missingUnits = unitRows.filter((unit) => !unitIds.has(unit.id));
  if (missingUnits.length) await db.insert(clientUnits).values(missingUnits);

  const demoTypes = await db
    .select()
    .from(accommodationTypes)
    .where(eq(accommodationTypes.vendorId, "vendor-jms"));
  const typeId = (name: string) =>
    demoTypes.find((type) => type.name === name)?.id;
  const demoRoomRows = [
    {
      id: "room-jms-ar1",
      vendorId: "vendor-jms",
      accommodationTypeId: typeId("Joy Room"),
      roomNumber: "AR1",
      capacity: 6,
    },
    {
      id: "room-jms-or2",
      vendorId: "vendor-jms",
      accommodationTypeId: typeId("Outside Room"),
      roomNumber: "OR2",
      capacity: 6,
    },
    {
      id: "room-jms-tamil",
      vendorId: "vendor-jms",
      accommodationTypeId: typeId("Tamil"),
      roomNumber: "Tamil",
      capacity: 8,
    },
  ].filter((room): room is typeof room & { accommodationTypeId: string } =>
    Boolean(room.accommodationTypeId),
  );
  if (demoRoomRows.length)
    await db.insert(accommodationRooms).values(demoRoomRows);

  const employeeRows = [
    {
      id: "emp-1001",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1001",
      name: "Arun Kumar",
      department: "Production",
      dateOfJoining: "2024-02-12",
      uanMasked: "XXXXXXXX1204",
      esiMasked: "XXXXXX4102",
      bankAccountMasked: "XXXXXX4821",
      ifscMasked: "CUB000****",
      bankName: "City Union Bank",
      accommodationType: "Joy Room",
      roomId: "room-jms-ar1",
      roomNumber: "AR1",
      paymentMode: "bank",
      salaryAmount: 14560,
      complianceStatus: "ready",
    },
    {
      id: "emp-1002",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1002",
      name: "Meena Devi",
      department: "Packing",
      dateOfJoining: "2024-06-03",
      uanMasked: "XXXXXXXX2718",
      esiMasked: "XXXXXX6670",
      bankAccountMasked: "XXXXXX7135",
      ifscMasked: "HDFC00****",
      bankName: "HDFC Bank",
      accommodationType: "Outside Room",
      roomId: "room-jms-or2",
      roomNumber: "OR2",
      paymentMode: "bank",
      salaryAmount: 13720,
      complianceStatus: "ready",
    },
    {
      id: "emp-1003",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1003",
      name: "Karthik S",
      department: "Quality",
      dateOfJoining: "2025-01-20",
      uanMasked: null,
      esiMasked: "XXXXXX1038",
      bankAccountMasked: null,
      ifscMasked: null,
      bankName: null,
      accommodationType: "Tamil",
      roomId: "room-jms-tamil",
      roomNumber: "Tamil",
      paymentMode: "bank",
      salaryAmount: 12992,
      complianceStatus: "review",
    },
    {
      id: "emp-1004",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1004",
      name: "Priya M",
      department: "Assembly",
      dateOfJoining: "2023-11-09",
      uanMasked: "XXXXXXXX9952",
      esiMasked: "XXXXXX7814",
      bankAccountMasked: "XXXXXX2284",
      ifscMasked: "IOBA00****",
      bankName: "Indian Overseas Bank",
      accommodationType: "Joy Room",
      roomId: "room-jms-ar1",
      roomNumber: "AR1",
      paymentMode: "bank",
      salaryAmount: 15400,
      complianceStatus: "ready",
    },
    {
      id: "emp-1005",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1005",
      name: "Naveen R",
      department: "Machine Shop",
      dateOfJoining: "2024-08-18",
      uanMasked: "XXXXXXXX6307",
      esiMasked: "XXXXXX8421",
      bankAccountMasked: "XXXXXX3098",
      ifscMasked: "SBIN00****",
      bankName: "State Bank of India",
      accommodationType: "Tamil",
      roomId: "room-jms-tamil",
      roomNumber: "Tamil",
      paymentMode: "bank",
      salaryAmount: 16688,
      complianceStatus: "ready",
    },
    {
      id: "emp-1006",
      vendorId: "vendor-jms",
      clientUnitId: "unit-watertec-1",
      employeeCode: "J1006",
      name: "Divya K",
      department: "Stores",
      dateOfJoining: "2025-03-11",
      uanMasked: "XXXXXXXX3149",
      esiMasked: null,
      bankAccountMasked: "XXXXXX8091",
      ifscMasked: null,
      bankName: "Canara Bank",
      accommodationType: "Outside Room",
      roomId: "room-jms-or2",
      roomNumber: "OR2",
      paymentMode: "bank",
      salaryAmount: 12208,
      complianceStatus: "review",
    },
  ];
  const currentEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.clientUnitId, "unit-watertec-1"));
  const employeeIds = new Set(currentEmployees.map((employee) => employee.id));
  const missingEmployees = employeeRows.filter(
    (employee) => !employeeIds.has(employee.id),
  );
  for (let index = 0; index < missingEmployees.length; index += 3) {
    await db.insert(employees).values(missingEmployees.slice(index, index + 3));
  }

  const attendancePattern = [
    ["P", "P", "P", "WO", "P", "P", "P"],
    ["P", "P", "L", "P", "P", "WO", "P"],
    ["P", "A", "A", "P", "P", "P", "WO"],
    ["P", "P", "HP", "WO", "P", "P", "P"],
    ["P", "P", "P", "P", "WO", "P", "P"],
    ["P", "L", "P", "P", "P", "WO", "A"],
  ];
  const shifts = [
    "General",
    "1st Shift",
    "2nd Shift",
    "General",
    "3rd Shift",
    "1st Shift",
  ];
  const attendanceRows = employeeRows.flatMap((employee, employeeIndex) =>
    attendancePattern[employeeIndex].map((statusCode, dayIndex) => ({
      employeeId: employee.id,
      attendanceDate: `2026-08-${String(dayIndex + 1).padStart(2, "0")}`,
      statusCode,
      shiftCode: dayIndex === 4 ? "2nd Shift" : shifts[employeeIndex],
      overtimeHours:
        statusCode === "HP" ? 8 : dayIndex === 5 && statusCode === "P" ? 2 : 0,
      source: "demo",
    })),
  );
  const currentAttendance = await db
    .select()
    .from(attendanceEntries)
    .where(
      and(
        gte(attendanceEntries.attendanceDate, "2026-08-01"),
        lt(attendanceEntries.attendanceDate, "2026-09-01"),
      ),
    );
  const attendanceIds = new Set(
    currentAttendance.map(
      (entry) => `${entry.employeeId}:${entry.attendanceDate}`,
    ),
  );
  const missingAttendance = attendanceRows.filter(
    (entry) =>
      !attendanceIds.has(`${entry.employeeId}:${entry.attendanceDate}`),
  );
  for (let index = 0; index < missingAttendance.length; index += 10) {
    await db
      .insert(attendanceEntries)
      .values(missingAttendance.slice(index, index + 10));
  }

  await db.insert(payrollRuns).values({
    id: RUN_ID,
    vendorId: "vendor-jms",
    clientUnitId: "unit-watertec-1",
    payPeriod: "2026-08",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    workingDays: 26,
    status: "needs_review",
    employeeCount: 6,
    grossEarnings: 152800,
    statutoryDeductions: 16330,
    otherDeductions: 4450,
    accommodationDeductions: 7400,
    netPayable: 124870,
    bankPayable: 87130,
    cashPayable: 37740,
    issueCount: 2,
  });

  const demoItems = [
    payrollItem(
      "item-1001",
      "emp-1001",
      26,
      1,
      1,
      4,
      1,
      28,
      12,
      26000,
      2960,
      600,
      2200,
      0,
      20240,
      "ready",
      null,
    ),
    payrollItem(
      "item-1002",
      "emp-1002",
      25,
      1,
      2,
      4,
      0,
      27,
      8,
      24500,
      2790,
      450,
      1500,
      0,
      19760,
      "ready",
      null,
    ),
    payrollItem(
      "item-1003",
      "emp-1003",
      24,
      3,
      1,
      3,
      0,
      25,
      6,
      23200,
      1580,
      800,
      0,
      0,
      20820,
      "review",
      "UAN and bank details pending",
    ),
    payrollItem(
      "item-1004",
      "emp-1004",
      27,
      0,
      0,
      4,
      1,
      29,
      18,
      27500,
      3130,
      1200,
      2200,
      0,
      20970,
      "ready",
      null,
    ),
    payrollItem(
      "item-1005",
      "emp-1005",
      26,
      1,
      1,
      4,
      0,
      27,
      10,
      29800,
      3390,
      500,
      0,
      250,
      26160,
      "ready",
      null,
    ),
    payrollItem(
      "item-1006",
      "emp-1006",
      23,
      2,
      2,
      4,
      0,
      25,
      4,
      21800,
      2480,
      900,
      1500,
      0,
      16920,
      "review",
      "ESI number and IFSC pending",
    ),
  ];
  for (let index = 0; index < demoItems.length; index += 2) {
    await db.insert(payrollItems).values(demoItems.slice(index, index + 2));
  }

  await db.insert(accommodationCharges).values([
    {
      runId: RUN_ID,
      employeeId: "emp-1001",
      roomNumber: "AR1",
      rent: 1200,
      food: 700,
      rationShare: 300,
    },
    {
      runId: RUN_ID,
      employeeId: "emp-1002",
      roomNumber: "OR2",
      rent: 1000,
      bus: 300,
      rationShare: 200,
    },
    {
      runId: RUN_ID,
      employeeId: "emp-1004",
      roomNumber: "AR1",
      rent: 1200,
      advance: 500,
      rationShare: 300,
      oldPending: 200,
    },
    {
      runId: RUN_ID,
      employeeId: "emp-1006",
      roomNumber: "OR2",
      rent: 1000,
      bus: 300,
      food: 200,
    },
  ]);
}

function payrollItem(
  id: string,
  employeeId: string,
  presentDays: number,
  absentDays: number,
  leaveDays: number,
  weekOffDays: number,
  holidayPresentDays: number,
  payableDays: number,
  overtimeHours: number,
  grossEarnings: number,
  statutoryDeductions: number,
  otherDeductions: number,
  accommodationDeduction: number,
  returnAmount: number,
  netPayable: number,
  validationStatus: string,
  validationMessage: string | null,
) {
  const basic = Math.round(grossEarnings * 0.56);
  const hra = Math.round(grossEarnings * 0.18);
  const overtimeWages = Math.round(overtimeHours * 96);
  const balanceEarnings = grossEarnings - basic - hra - overtimeWages;
  return {
    id,
    runId: RUN_ID,
    employeeId,
    presentDays,
    absentDays,
    leaveDays,
    weekOffDays,
    holidayPresentDays,
    payableDays,
    overtimeHours,
    basic,
    da: Math.round(balanceEarnings * 0.25),
    hra,
    conveyance: Math.round(balanceEarnings * 0.15),
    foodAllowance: Math.round(balanceEarnings * 0.15),
    nightAllowance: 0,
    overtimeWages,
    attendanceBonus: Math.round(balanceEarnings * 0.15),
    arrears: 0,
    holidayWages: holidayPresentDays ? Math.round(balanceEarnings * 0.1) : 0,
    productionIncentive: 0,
    medicalAllowance:
      balanceEarnings -
      Math.round(balanceEarnings * 0.25) -
      Math.round(balanceEarnings * 0.15) -
      Math.round(balanceEarnings * 0.15) -
      Math.round(balanceEarnings * 0.15) -
      (holidayPresentDays ? Math.round(balanceEarnings * 0.1) : 0),
    pfDeduction: Math.round(statutoryDeductions * 0.78),
    esiDeduction: Math.round(statutoryDeductions * 0.18),
    professionalTax:
      statutoryDeductions -
      Math.round(statutoryDeductions * 0.78) -
      Math.round(statutoryDeductions * 0.18),
    canteen: Math.round(otherDeductions * 0.35),
    advance: Math.round(otherDeductions * 0.45),
    otherDeduction:
      otherDeductions -
      Math.round(otherDeductions * 0.35) -
      Math.round(otherDeductions * 0.45),
    accommodationDeduction,
    returnAmount,
    grossEarnings,
    totalDeductions:
      statutoryDeductions + otherDeductions + accommodationDeduction,
    netPayable,
    validationStatus,
    validationMessage,
  };
}

async function loadAppData(access: AppAccess) {
  await ensureDemoData();
  const db = getDb();
  const [
    allVendorRows,
    allUnitRows,
    allEmployeeRows,
    allRunRows,
    allItemRows,
    allAttendanceRows,
    allChargeRows,
    allRecoveryRows,
    allRecoveryFinalizationRows,
    allAuditRows,
    allRuleRows,
    allShiftRows,
    allRemarkRows,
    userRows,
    allTypeRows,
    allRoomRows,
    allRoomExpenseRows,
    allBatchRows,
    allPaymentExportBatchRows,
    allPaymentExportBatchItemRows,
    allVehicles,
    allVehicleRecords,
    allMeters,
    allEbReadings,
    allHostels,
    allHostelReadings,
  ] = await Promise.all([
    db.select().from(vendors).orderBy(asc(vendors.name)),
    db.select().from(clientUnits).orderBy(asc(clientUnits.clientName)),
    db.select().from(employees).orderBy(asc(employees.employeeCode)),
    db.select().from(payrollRuns).orderBy(asc(payrollRuns.payPeriod)),
    db
      .select({
        id: payrollItems.id,
        runId: payrollItems.runId,
        employeeId: payrollItems.employeeId,
        employeeCode: employees.employeeCode,
        employeeName: employees.name,
        department: employees.department,
        accommodationType: employees.accommodationType,
        roomNumber: employees.roomNumber,
        paymentMode: employees.paymentMode,
        bankAccountMasked: employees.bankAccountMasked,
        ifscMasked: employees.ifscMasked,
        complianceStatus: employees.complianceStatus,
        presentDays: payrollItems.presentDays,
        absentDays: payrollItems.absentDays,
        leaveDays: payrollItems.leaveDays,
        weekOffDays: payrollItems.weekOffDays,
        holidayPresentDays: payrollItems.holidayPresentDays,
        payableDays: payrollItems.payableDays,
        overtimeHours: payrollItems.overtimeHours,
        salaryBasis: employees.salaryBasis,
        fixedWorkingDays: payrollItems.fixedWorkingDays,
        nfhDays: payrollItems.nfhDays,
        compOffDays: payrollItems.compOffDays,
        onDutyDays: payrollItems.onDutyDays,
        sundayDays: payrollItems.sundayDays,
        plDays: payrollItems.plDays,
        clDays: payrollItems.clDays,
        slDays: payrollItems.slDays,
        importedGrossEarnings: payrollItems.importedGrossEarnings,
        importedTotalDeductions: payrollItems.importedTotalDeductions,
        importedNetPayable: payrollItems.importedNetPayable,
        basic: payrollItems.basic,
        da: payrollItems.da,
        hra: payrollItems.hra,
        conveyance: payrollItems.conveyance,
        foodAllowance: payrollItems.foodAllowance,
        nightAllowance: payrollItems.nightAllowance,
        overtimeWages: payrollItems.overtimeWages,
        attendanceBonus: payrollItems.attendanceBonus,
        arrears: payrollItems.arrears,
        holidayWages: payrollItems.holidayWages,
        productionIncentive: payrollItems.productionIncentive,
        medicalAllowance: payrollItems.medicalAllowance,
        pfDeduction: payrollItems.pfDeduction,
        esiDeduction: payrollItems.esiDeduction,
        professionalTax: payrollItems.professionalTax,
        lwf: payrollItems.lwf,
        canteen: payrollItems.canteen,
        snacks: payrollItems.snacks,
        tent: payrollItems.tent,
        advance: payrollItems.advance,
        otherDeduction: payrollItems.otherDeduction,
        tds: payrollItems.tds,
        medicalInsurance: payrollItems.medicalInsurance,
        accommodationDeduction: payrollItems.accommodationDeduction,
        returnAmount: payrollItems.returnAmount,
        grossEarnings: payrollItems.grossEarnings,
        totalDeductions: payrollItems.totalDeductions,
        netPayable: payrollItems.netPayable,
        validationStatus: payrollItems.validationStatus,
        validationMessage: payrollItems.validationMessage,
      })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .orderBy(asc(employees.employeeCode)),
    db
      .select()
      .from(attendanceEntries)
      .orderBy(
        asc(attendanceEntries.attendanceDate),
        asc(attendanceEntries.employeeId),
      ),
    db
      .select()
      .from(accommodationCharges)
      .orderBy(asc(accommodationCharges.roomNumber)),
    db
      .select()
      .from(recoveryEntries)
      .orderBy(
        desc(recoveryEntries.recoveryDate),
        desc(recoveryEntries.createdAt),
      ),
    db
      .select()
      .from(recoveryFinalizations)
      .orderBy(desc(recoveryFinalizations.finalizedAt)),
    db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(30),
    db.select().from(payrollRules).orderBy(asc(payrollRules.vendorId)),
    db.select().from(shiftDefinitions).orderBy(asc(shiftDefinitions.name)),
    db
      .select()
      .from(payrollRemarks)
      .orderBy(asc(payrollRemarks.category), asc(payrollRemarks.title)),
    canView(access.profile.permissions, "users")
      ? db
          .select()
          .from(appUsers)
          .orderBy(asc(appUsers.fullName), asc(appUsers.email))
      : Promise.resolve([]),
    db.select().from(accommodationTypes).orderBy(asc(accommodationTypes.name)),
    db
      .select()
      .from(accommodationRooms)
      .orderBy(asc(accommodationRooms.roomNumber)),
    db
      .select()
      .from(accommodationRoomExpenses)
      .orderBy(desc(accommodationRoomExpenses.payPeriod)),
    db
      .select()
      .from(payrollBatches)
      .orderBy(asc(payrollBatches.accommodationType)),
    db
      .select()
      .from(paymentExportBatches)
      .orderBy(desc(paymentExportBatches.lockedAt)),
    db
      .select()
      .from(paymentExportBatchItems)
      .orderBy(asc(paymentExportBatchItems.createdAt)),
    db.select().from(vehicles).orderBy(asc(vehicles.registrationNumber)),
    db.select().from(vehicleRecords).orderBy(desc(vehicleRecords.recordDate)),
    db.select().from(utilityMeters).orderBy(asc(utilityMeters.locationName)),
    db.select().from(ebReadings).orderBy(desc(ebReadings.readingDate)),
    db.select().from(hostels).orderBy(asc(hostels.name)),
    db
      .select()
      .from(hostelUtilityReadings)
      .orderBy(desc(hostelUtilityReadings.readingDate)),
  ]);

  const unrestricted = access.profile.role === "super_admin";
  const clientScope = new Set(access.profile.clientScope);
  const unitScope = new Set(access.profile.unitScope);
  const hostelScope = new Set(access.profile.hostelScope);
  const vendorRows = unrestricted
    ? allVendorRows
    : allVendorRows.filter((vendor) => clientScope.has(vendor.id));
  const visibleVendorIds = new Set(vendorRows.map((vendor) => vendor.id));
  const unitRows = allUnitRows.filter(
    (unit) =>
      visibleVendorIds.has(unit.vendorId) &&
      (unrestricted ||
        (!["hr_team", "field_hr"].includes(access.profile.role)) ||
        unitScope.has(unit.id)),
  );
  const visibleUnitIds = new Set(unitRows.map((unit) => unit.id));
  const assignedHostelRoomIds = new Set(
    allRoomRows
      .filter((room) => room.hostelId && hostelScope.has(room.hostelId))
      .map((room) => room.id),
  );
  const employeeRows = allEmployeeRows.filter(
    (employee) =>
      visibleVendorIds.has(employee.vendorId) &&
      visibleUnitIds.has(employee.clientUnitId) &&
      (access.profile.role !== "hostel_incharge" ||
        Boolean(employee.roomId && assignedHostelRoomIds.has(employee.roomId))),
  );
  const visibleEmployeeIds = new Set(
    employeeRows.map((employee) => employee.id),
  );
  const runRows = allRunRows.filter(
    (run) =>
      visibleVendorIds.has(run.vendorId) &&
      visibleUnitIds.has(run.clientUnitId),
  );
  const visibleRunIds = new Set(runRows.map((run) => run.id));
  const itemRows = allItemRows.filter(
    (item) =>
      visibleRunIds.has(item.runId) && visibleEmployeeIds.has(item.employeeId),
  );
  const attendanceRows = allAttendanceRows.filter((entry) =>
    visibleEmployeeIds.has(entry.employeeId),
  );
  const chargeRows = allChargeRows.filter(
    (charge) =>
      visibleRunIds.has(charge.runId) &&
      visibleEmployeeIds.has(charge.employeeId),
  );
  const recoveryRows = allRecoveryRows.filter(
    (entry) =>
      visibleRunIds.has(entry.runId) &&
      visibleEmployeeIds.has(entry.employeeId),
  );
  const recoveryFinalizationRows = allRecoveryFinalizationRows.filter(
    (entry) =>
      visibleRunIds.has(entry.runId) &&
      visibleEmployeeIds.has(entry.employeeId),
  );
  const auditRows = unrestricted
    ? allAuditRows
    : allAuditRows.filter(
        (event) =>
          event.actorEmail?.toLowerCase() ===
          access.identity.email.toLowerCase(),
      );
  const ruleRows = allRuleRows.filter((rule) =>
    visibleVendorIds.has(rule.vendorId),
  );
  const shiftRows = allShiftRows.filter((shift) =>
    visibleVendorIds.has(shift.vendorId),
  );
  const remarkRows = allRemarkRows.filter((remark) =>
    visibleVendorIds.has(remark.vendorId),
  );
  const typeRows = allTypeRows.filter((type) =>
    visibleVendorIds.has(type.vendorId),
  );
  const roomRows = allRoomRows.filter((room) => {
    if (!visibleVendorIds.has(room.vendorId)) return false;
    if (access.profile.role === "hostel_incharge")
      return Boolean(room.hostelId && hostelScope.has(room.hostelId));
    if (unrestricted || access.profile.role !== "hr_team") return true;
    const occupants = allEmployeeRows.filter(
      (employee) => employee.roomId === room.id && employee.status === "active",
    );
    return (
      occupants.length === 0 ||
      occupants.some((employee) => visibleEmployeeIds.has(employee.id))
    );
  });
  const visibleRoomIds = new Set(roomRows.map((room) => room.id));
  const roomExpenseRows = allRoomExpenseRows.filter((expense) =>
    visibleRoomIds.has(expense.roomId),
  );
  const batchRows = allBatchRows.filter((batch) =>
    visibleRunIds.has(batch.runId),
  );
  const paymentExportBatchRows = allPaymentExportBatchRows.filter((batch) =>
    visibleRunIds.has(batch.runId),
  );
  const visiblePaymentExportBatchIds = new Set(
    paymentExportBatchRows.map((batch) => batch.id),
  );
  const paymentExportBatchItemRows = allPaymentExportBatchItemRows.filter(
    (item) =>
      visibleRunIds.has(item.runId) &&
      visibleEmployeeIds.has(item.employeeId) &&
      visiblePaymentExportBatchIds.has(item.batchId),
  );

  const permissions = access.profile.permissions;
  const seesAny = (modules: AccessModule[]) =>
    modules.some((module) => canView(permissions, module));
  const seesOrganisation = seesAny([
    "dashboard",
    "payroll",
    "attendance",
    "employees",
    "accommodation",
    "payments",
    "clients",
    "masters",
    "settings",
  ]);
  const seesEmployees = seesAny([
    "dashboard",
    "payroll",
    "attendance",
    "employees",
    "accommodation",
    "payments",
  ]);
  const seesFullEmployeeDetails =
    access.profile.role !== "hostel_incharge" &&
    seesAny(["dashboard", "payroll", "employees", "payments"]);
  const seesRuns = seesAny([
    "dashboard",
    "payroll",
    "attendance",
    "accommodation",
    "payments",
  ]);
  const seesPayrollItems = seesRuns;
  const seesFullPayrollDetails = seesAny(["payroll", "payments"]);
  const seesPayrollSummaryMoney = seesAny(["dashboard", "accommodation"]);
  const seesRunMoney = seesAny([
    "dashboard",
    "payroll",
    "accommodation",
    "payments",
  ]);

  const visibleEmployees = !seesEmployees
    ? []
    : seesFullEmployeeDetails
      ? employeeRows
      : employeeRows.map((employee) => ({
          ...employee,
          uanMasked: null,
          esiMasked: null,
          bankAccountMasked: null,
          ifscMasked: null,
          bankName: null,
          salaryAmount: 0,
          salaryBasis: "monthly",
          paymentMode: "bank",
          complianceStatus: "ready",
        }));

  const visibleRuns = !seesRuns
    ? []
    : seesRunMoney
      ? runRows
      : runRows.map((run) => ({
          ...run,
          grossEarnings: 0,
          statutoryDeductions: 0,
          otherDeductions: 0,
          accommodationDeductions: 0,
          netPayable: 0,
          bankPayable: 0,
          cashPayable: 0,
          issueCount: 0,
          approvedBy: null,
        }));

  const visibleItems = !seesPayrollItems
    ? []
    : itemRows.map((item) => {
        if (seesFullPayrollDetails) return item;
        const redacted = { ...item };
        for (const field of [...earningFields, ...deductionFields])
          redacted[field] = 0;
        redacted.bankAccountMasked = null;
        redacted.ifscMasked = null;
        redacted.paymentMode = "cash";
        if (!seesPayrollSummaryMoney) {
          redacted.accommodationDeduction = 0;
          redacted.returnAmount = 0;
          redacted.grossEarnings = 0;
          redacted.totalDeductions = 0;
          redacted.netPayable = 0;
        }
        if (!canView(permissions, "dashboard")) {
          redacted.validationStatus = "ready";
          redacted.validationMessage = null;
        }
        return redacted;
      });

  return {
    demo: vendorRows.every(
      (vendor) => vendor.id === "vendor-jms" || vendor.id === "vendor-jcs",
    ),
    vendors: seesOrganisation ? vendorRows : [],
    units: seesOrganisation ? unitRows : [],
    employees: visibleEmployees,
    runs: visibleRuns,
    payrollItems: visibleItems,
    attendance: canView(permissions, "attendance") ? attendanceRows : [],
    accommodationCharges: canView(permissions, "accommodation")
      ? chargeRows
      : [],
    recoveryEntries: canView(permissions, "accommodation") ? recoveryRows : [],
    recoveryFinalizations: canView(permissions, "accommodation")
      ? recoveryFinalizationRows
      : [],
    accommodationTypes: seesAny([
      "masters",
      "accommodation",
      "employees",
      "payroll",
      "payments",
    ])
      ? typeRows
      : [],
    accommodationRooms: seesAny(["accommodation", "employees", "payroll"])
      ? roomRows
      : [],
    roomExpenses: canView(permissions, "accommodation") ? roomExpenseRows : [],
    payrollBatches: seesAny(["payroll", "payments", "accommodation"])
      ? batchRows
      : [],
    paymentExportBatches: seesAny(["payroll", "payments"])
      ? paymentExportBatchRows
      : [],
    paymentExportBatchItems: seesAny(["payroll", "payments"])
      ? paymentExportBatchItemRows
      : [],
    auditEvents: seesAny(["dashboard", "users"]) ? auditRows.reverse() : [],
    rules: canView(permissions, "settings") ? ruleRows : [],
    shifts: seesAny(["masters", "attendance", "employees"]) ? shiftRows : [],
    remarks: seesAny(["clients", "masters", "attendance", "employees"])
      ? remarkRows
      : [],
    currentUser: access.profile,
    appUsers: userRows.map(appUserProfile),
    vehicles: canView(permissions, "operations")
      ? allVehicles.filter((vehicle) => visibleVendorIds.has(vehicle.vendorId))
      : [],
    vehicleRecords: canView(permissions, "operations")
      ? allVehicleRecords.filter((record) =>
          allVehicles.some(
            (vehicle) =>
              vehicle.id === record.vehicleId &&
              visibleVendorIds.has(vehicle.vendorId),
          ),
        )
      : [],
    utilityMeters: canView(permissions, "operations")
      ? allMeters.filter((meter) => visibleVendorIds.has(meter.vendorId))
      : [],
    ebReadings: canView(permissions, "operations")
      ? allEbReadings.filter((reading) =>
          allMeters.some(
            (meter) =>
              meter.id === reading.meterId &&
              visibleVendorIds.has(meter.vendorId),
          ),
        )
      : [],
    hostels: canView(permissions, "accommodation")
      ? allHostels.filter((hostel) => {
          if (access.profile.role === "hostel_incharge") return hostelScope.has(hostel.id);
          if (unrestricted) return true;
          let mappedUnits: string[] = [];
          try { const parsed = JSON.parse(hostel.clientScopeJson || "[]"); if (Array.isArray(parsed)) mappedUnits = parsed; } catch {}
          return visibleVendorIds.has(hostel.vendorId) || mappedUnits.some((unitId) => visibleUnitIds.has(unitId));
        })
      : [],
    hostelUtilityReadings: canView(permissions, "accommodation")
      ? allHostelReadings.filter((reading) =>
          allHostels.some(
            (hostel) =>
              hostel.id === reading.hostelId &&
              visibleVendorIds.has(hostel.vendorId),
          ),
        )
      : [],
  };
}

export async function GET() {
  try {
    const db = getDb();
    const access = await requireAppAccess(db);
    return Response.json(await loadAppData(access));
  } catch (error) {
    const messages = errorMessages(error);
    const status = error instanceof RequestError ? error.status : 500;
    const safeMessage =
      error instanceof RequestError
        ? error.message
        : (messages.at(-1) ?? "Unable to load payroll data");
    if (status >= 500)
      console.error(
        "Payroll application data failed to load",
        safeMessage.split("\n")[0],
      );
    return Response.json({ error: safeMessage }, { status });
  }
}

function textValue(value: unknown, label: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new RequestError(`${label} is required`);
  return result;
}

function optionalValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

function requiredStringArray(value: unknown, label: string, maximum = 500) {
  if (!Array.isArray(value))
    throw new RequestError(`${label} must be a list of employee selections`);
  const values = [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
  if (!values.length) throw new RequestError(`Select at least one ${label}`);
  if (values.length > maximum)
    throw new RequestError(
      `${label} cannot contain more than ${maximum} employees`,
    );
  return values;
}

// Drizzle returns D1Response.meta.changes on Cloudflare and RowList.count for
// postgres-js in the generated Supabase function. Keep the atomic download
// guard portable across both adapters.
function mutationChangedRows(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const candidate = result as {
    meta?: { changes?: unknown };
    count?: unknown;
  };
  const d1Changes = candidate.meta?.changes;
  if (typeof d1Changes === "number" && Number.isFinite(d1Changes))
    return d1Changes;
  if (
    typeof candidate.count === "number" &&
    Number.isFinite(candidate.count)
  )
    return candidate.count;
  return null;
}

async function downloadedPayrollItemIds(db: Db, runId: string) {
  const rows = await db
    .select({ payrollItemId: paymentExportBatchItems.payrollItemId })
    .from(paymentExportBatchItems)
    .innerJoin(
      paymentExportBatches,
      eq(paymentExportBatchItems.batchId, paymentExportBatches.id),
    )
    .where(
      and(
        eq(paymentExportBatchItems.runId, runId),
        eq(paymentExportBatches.status, "downloaded"),
      ),
    );
  return new Set(rows.map((row) => row.payrollItemId));
}

async function requirePayrollItemPaymentUnlocked(
  db: Db,
  runId: string,
  payrollItemId: string,
) {
  const downloadedIds = await downloadedPayrollItemIds(db, runId);
  if (downloadedIds.has(payrollItemId))
    throw new RequestError(
      "This employee is locked because their bank file was already downloaded. Edit only the newly added employee salary record.",
      409,
    );
}

function positiveValue(value: unknown, label: string, maximum = 100000000) {
  const result = numberValue(value);
  if (result < 0 || result > maximum)
    throw new RequestError(`${label} must be between 0 and ${maximum}`);
  return result;
}

function periodValue(value: unknown) {
  const result = textValue(value, "Payroll month");
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(result))
    throw new RequestError("Payroll month must be YYYY-MM");
  return result;
}

function periodRange(
  period: string,
  periodStart?: string | null,
  periodEnd?: string | null,
) {
  return payrollPeriodRange(period, periodStart, periodEnd);
}

function dateValue(value: unknown, label: string) {
  const result = textValue(value, label);
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  ) {
    throw new RequestError(`${label} must be a valid YYYY-MM-DD date`);
  }
  return result;
}

function runPeriodValues(
  period: string,
  payload: Record<string, unknown>,
  defaultWorkingDays: number,
) {
  const defaults = periodRange(period);
  const periodStart = payload.periodStart
    ? dateValue(payload.periodStart, "Payroll period start")
    : defaults.start;
  const periodEnd = payload.periodEnd
    ? dateValue(payload.periodEnd, "Payroll period end")
    : defaults.inclusiveEnd;
  const range = periodRange(period, periodStart, periodEnd);
  if (range.days < 1 || range.days > 62)
    throw new RequestError(
      "The selected payroll period must cover between 1 and 62 calendar days",
    );
  const workingDays =
    payload.workingDays === undefined ||
    payload.workingDays === null ||
    payload.workingDays === ""
      ? Math.min(defaultWorkingDays, range.days)
      : positiveValue(payload.workingDays, "Payroll working days", 62);
  if (
    !Number.isInteger(workingDays) ||
    workingDays < 1 ||
    workingDays > range.days
  ) {
    throw new RequestError(
      `Payroll working days must be a whole number between 1 and ${range.days}`,
    );
  }
  return { periodStart, periodEnd, workingDays };
}

function unitCycleRange(period: string, startDay: number, endDay: number) {
  const [year, month] = period.split("-").map(Number);
  const dayInMonth = (targetYear: number, targetMonth: number, day: number) => {
    const maximum = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, maximum)).padStart(2, "0")}`;
  };
  if (startDay <= endDay)
    return {
      periodStart: dayInMonth(year, month, startDay),
      periodEnd: dayInMonth(year, month, endDay),
    };
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return {
    periodStart: dayInMonth(
      previous.getUTCFullYear(),
      previous.getUTCMonth() + 1,
      startDay,
    ),
    periodEnd: dayInMonth(year, month, endDay),
  };
}

function selectedPayslipFields(
  value: unknown,
  allowed: readonly string[],
  label: string,
) {
  const values =
    value === undefined || value === null
      ? [...allowed]
      : Array.isArray(value)
        ? value.map(String)
        : typeof value === "string" && value
          ? value.split(",")
          : [];
  const selected = [
    ...new Set(values.filter((field) => allowed.includes(field))),
  ];
  if (!selected.length)
    throw new RequestError(`Select at least one ${label} field`);
  return JSON.stringify(selected);
}

async function activeRules(db: Db, vendorId: string) {
  const [rule] = await db
    .select()
    .from(payrollRules)
    .where(eq(payrollRules.vendorId, vendorId))
    .limit(1);
  return { ...defaultPayrollRules, ...rule };
}

async function requireRun(db: Db, runId: string, editable = false) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, runId))
    .limit(1);
  if (!run) throw new RequestError("Payroll run not found", 404);
  if (editable && run.status === "approved")
    throw new RequestError(
      "This payroll run is approved. Reopen it before making changes.",
      409,
    );
  return run;
}

async function writeAudit(
  db: Db,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  actorEmail: string | null,
) {
  await db
    .insert(auditEvents)
    .values({ action, entityType, entityId, summary, actorEmail });
}

async function recalculateRun(
  db: Db,
  runId: string,
  recomputeAttendance = false,
) {
  const run = await requireRun(db, runId);
  if (run.processingMode === "salary_import") recomputeAttendance = false;
  const { start, end } = periodRange(
    run.payPeriod,
    run.periodStart,
    run.periodEnd,
  );
  const [rows, unitEmployees, periodAttendance, charges, rules, unitRows] =
    await Promise.all([
      db.select().from(payrollItems).where(eq(payrollItems.runId, runId)),
      db
        .select()
        .from(employees)
        .where(eq(employees.clientUnitId, run.clientUnitId)),
      db
        .select()
        .from(attendanceEntries)
        .where(
          and(
            gte(attendanceEntries.attendanceDate, start),
            lt(attendanceEntries.attendanceDate, end),
          ),
        ),
      db
        .select()
        .from(accommodationCharges)
        .where(eq(accommodationCharges.runId, runId)),
      activeRules(db, run.vendorId),
      db
        .select()
        .from(clientUnits)
        .where(eq(clientUnits.id, run.clientUnitId))
        .limit(1),
    ]);
  const overtimeMultiplier = unitRows[0]?.overtimeMultiplier ?? 1;
  const effectiveRules = {
    ...rules,
    standardWorkingDays: run.workingDays || rules.standardWorkingDays,
  };
  const employeeMap = new Map(
    unitEmployees.map((employee) => [employee.id, employee]),
  );
  const chargeMap = new Map(
    charges.map((charge) => [charge.employeeId, charge]),
  );
  const attendanceMap = new Map<string, typeof periodAttendance>();
  for (const entry of periodAttendance) {
    const collection = attendanceMap.get(entry.employeeId) ?? [];
    collection.push(entry);
    attendanceMap.set(entry.employeeId, collection);
  }

  const updatedRows: Array<PayrollItemRow & { paymentMode: string }> = [];
  for (const row of rows) {
    const employee = employeeMap.get(row.employeeId);
    if (!employee) continue;
    const entries = attendanceMap.get(employee.id) ?? [];
    const isUnchangedDemo =
      run.id === RUN_ID &&
      entries.length > 0 &&
      entries.every((entry) => entry.source === "demo");
    const shouldRecompute =
      recomputeAttendance && entries.length > 0 && !isUnchangedDemo;
    const next = { ...row };
    if (shouldRecompute) {
      Object.assign(next, attendanceSummary(entries, effectiveRules));
      if (employee.salaryAmount > 0)
        next.basic = salaryForAttendance(
          employee.salaryAmount,
          employee.salaryBasis,
          next.payableDays,
          effectiveRules,
        );
      if (effectiveRules.overtimeHourlyRate > 0)
        next.overtimeWages = roundMoney(
          next.overtimeHours *
            overtimeMultiplier *
            effectiveRules.overtimeHourlyRate,
        );
      if (effectiveRules.pfRate > 0)
        next.pfDeduction = employee.pfApplicable
          ? roundMoney(
              (Math.min(employee.pfWageAmount || next.basic, 15000) *
                effectiveRules.pfRate) /
                100,
            )
          : 0;
      if (effectiveRules.professionalTax > 0)
        next.professionalTax = employee.ptApplicable
          ? effectiveRules.professionalTax
          : 0;
      if (effectiveRules.lwf > 0)
        next.lwf = employee.lwfApplicable ? effectiveRules.lwf : 0;
    }
    const accommodation = accommodationTotal(chargeMap.get(employee.id));
    if (chargeMap.has(employee.id)) Object.assign(next, accommodation);
    if (shouldRecompute && effectiveRules.esiRate > 0) {
      const gross = payrollTotals(next).grossEarnings;
      const esiWage = employee.esiWageAmount || gross;
      next.esiDeduction =
        employee.esiApplicable && esiWage <= 21000
          ? roundMoney((esiWage * effectiveRules.esiRate) / 100)
          : 0;
    }
    const totals = payrollTotals(next);
    const employeeValidation = validationForEmployee(employee, effectiveRules);
    const payrollValidation = payrollValidationForCashFallback(
      employee,
      employeeValidation,
    );
    const salaryValuesPending =
      run.processingMode === "salary_import" && totals.grossEarnings <= 0;
    Object.assign(next, {
      grossEarnings: totals.grossEarnings,
      totalDeductions: totals.totalDeductions,
      netPayable: totals.netPayable,
      accommodationDeduction: totals.accommodationDeduction,
      returnAmount: totals.returnAmount,
      validationStatus: salaryValuesPending
        ? "review"
        : payrollValidation.validationStatus,
      validationMessage: salaryValuesPending
        ? [employeeValidation.validationMessage, "salary values pending"]
            .filter(Boolean)
            .join("; ")
        : payrollValidation.validationMessage,
    });
    const {
      id,
      runId: ignoredRunId,
      employeeId: ignoredEmployeeId,
      ...values
    } = next;
    void ignoredRunId;
    void ignoredEmployeeId;
    await db.update(payrollItems).set(values).where(eq(payrollItems.id, id));
    // Bank readiness remains visible in Employee Master. Only the payroll row
    // becomes ready because its payment is explicitly routed through cash.
    if (employee.complianceStatus !== employeeValidation.validationStatus) {
      await db
        .update(employees)
        .set({ complianceStatus: employeeValidation.validationStatus })
        .where(eq(employees.id, employee.id));
    }
    updatedRows.push({ ...next, paymentMode: employee.paymentMode });
  }

  const grossEarnings = roundMoney(
    updatedRows.reduce((sum, row) => sum + row.grossEarnings, 0),
  );
  const statutoryDeductions = roundMoney(
    updatedRows.reduce(
      (sum, row) =>
        sum +
        row.pfDeduction +
        row.esiDeduction +
        row.professionalTax +
        row.lwf +
        row.tds,
      0,
    ),
  );
  const accommodationDeductions = roundMoney(
    updatedRows.reduce((sum, row) => sum + row.accommodationDeduction, 0),
  );
  const totalDeductions = roundMoney(
    updatedRows.reduce((sum, row) => sum + row.totalDeductions, 0),
  );
  const otherDeductions = roundMoney(
    totalDeductions - statutoryDeductions - accommodationDeductions,
  );
  const netPayable = roundMoney(
    updatedRows.reduce((sum, row) => sum + row.netPayable, 0),
  );
  const bankPayable = roundMoney(
    updatedRows
      .filter((row) => {
        const employee = employeeMap.get(row.employeeId);
        return Boolean(
          employee?.paymentMode === "bank" &&
            employee.bankAccountMasked &&
            employee.ifscMasked,
        );
      })
      .reduce((sum, row) => sum + row.netPayable, 0),
  );
  const cashPayable = roundMoney(netPayable - bankPayable);
  const issueCount = updatedRows.filter(
    (row) => {
      if (row.validationStatus === "ready") return false;
      const employee = employeeMap.get(row.employeeId);
      return !employee || !isCashFallbackOnlyValidation({
        paymentMode: employee.paymentMode,
        bankAccountMasked: employee.bankAccountMasked,
        ifscMasked: employee.ifscMasked,
        validationMessage: row.validationMessage,
      });
    },
  ).length;
  await db
    .update(payrollRuns)
    .set({
      employeeCount: updatedRows.length,
      grossEarnings,
      statutoryDeductions,
      otherDeductions,
      accommodationDeductions,
      netPayable,
      bankPayable,
      cashPayable,
      issueCount,
      status:
        run.status === "approved"
          ? "approved"
          : issueCount
            ? "needs_review"
            : "validated",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(payrollRuns.id, runId));
  const batches = await db
    .select()
    .from(payrollBatches)
    .where(eq(payrollBatches.runId, runId));
  for (const batch of batches.filter((entry) => entry.status !== "cleared")) {
    const grouped = updatedRows.filter(
      (row) =>
        employeeMap.get(row.employeeId)?.accommodationType ===
        batch.accommodationType,
    );
    await db
      .update(payrollBatches)
      .set({
        employeeCount: grouped.length,
        grossEarnings: roundMoney(
          grouped.reduce((sum, row) => sum + row.grossEarnings, 0),
        ),
        netPayable: roundMoney(
          grouped.reduce((sum, row) => sum + row.netPayable, 0),
        ),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payrollBatches.id, batch.id));
  }
}

async function addEmployeesToRun(
  db: Db,
  run: PayrollRunRow,
  employeeRows: EmployeeRow[],
) {
  if (!employeeRows.length) return 0;
  const existing = await db
    .select({ employeeId: payrollItems.employeeId })
    .from(payrollItems)
    .where(eq(payrollItems.runId, run.id));
  const existingIds = new Set(existing.map((row) => row.employeeId));
  const rules = await activeRules(db, run.vendorId);
  const values = employeeRows
    .filter(
      (employee) =>
        employee.status === "active" && !existingIds.has(employee.id),
    )
    .map((employee) => {
      const validation = payrollValidationForCashFallback(
        employee,
        validationForEmployee(employee, rules),
      );
      return {
        id: `ITEM-${crypto.randomUUID()}`,
        runId: run.id,
        employeeId: employee.id,
        ...validation,
      };
    });
  for (let index = 0; index < values.length; index += 2)
    await db.insert(payrollItems).values(values.slice(index, index + 2));
  return values.length;
}

async function createRun(
  db: Db,
  vendorId: string,
  unitId: string,
  period: string,
  options: Record<string, unknown> = {},
) {
  const [client] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  const [unit] = await db
    .select()
    .from(clientUnits)
    .where(eq(clientUnits.id, unitId))
    .limit(1);
  if (!client || !unit || unit.vendorId !== vendorId)
    throw new RequestError("Select a valid client and employer unit", 404);
  if (client.status !== "active" || unit.status !== "active")
    throw new RequestError(
      "Reactivate the client and employer unit before creating payroll",
      409,
    );
  const [existing] = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.clientUnitId, unitId),
        eq(payrollRuns.payPeriod, period),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const id = `RUN-${period.replace("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const rules = await activeRules(db, vendorId);
  const periodSettings = runPeriodValues(
    period,
    options,
    rules.standardWorkingDays,
  );
  const processingMode =
    options.processingMode === "salary_import" ? "salary_import" : "attendance";
  await db
    .insert(payrollRuns)
    .values({
      id,
      vendorId,
      clientUnitId: unitId,
      payPeriod: period,
      ...periodSettings,
      processingMode,
      status: "draft",
    });
  const run = await requireRun(db, id);
  const assigned = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.clientUnitId, unitId), eq(employees.status, "active")),
    );
  await addEmployeesToRun(db, run, assigned);
  await recalculateRun(db, id, true);
  return requireRun(db, id);
}

function isJoySharedAccommodation(value: string | null | undefined) {
  const name = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return name.includes("joy") &&
    (name.includes("hostel") || name.includes("room"));
}

function employeeValues(
  payload: Record<string, unknown>,
  vendorId: string,
  unitId: string,
) {
  const employeeCode = textValue(
    payload.employeeCode,
    "Employee code",
  ).toUpperCase();
  const name = textValue(payload.name, "Employee name");
  const paymentMode = "bank";
  const accommodationType = normalizeAccommodationType(
    payload.accommodationType,
  );
  const dateOfJoining = textValue(payload.dateOfJoining, "Date of joining");
  // Preserve stored applications when older clients/imports omit this field.
  let applicationJson: string | undefined;
  if (payload.applicationJson !== undefined) {
    if (typeof payload.applicationJson !== "string" || payload.applicationJson.length > 250000)
      throw new RequestError("Application details exceed the 250 KB limit");
    let application: unknown;
    try { application = JSON.parse(payload.applicationJson); }
    catch { throw new RequestError("Invalid application details"); }
    if (!application || typeof application !== "object" || Array.isArray(application) ||
        Object.entries(application).some(([key, value]) => key.length > 200 || typeof value !== "string" || (key !== "Signature image" && value.length > 2000)))
      throw new RequestError("Invalid application fields");
    applicationJson = JSON.stringify(application);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoining))
    throw new RequestError("Date of joining must be YYYY-MM-DD");
  return {
    vendorId,
    clientUnitId: unitId,
    employeeCode,
    name,
    department: textValue(payload.department, "Department"),
    dateOfJoining,
    uanMasked: optionalValue(payload.uanMasked),
    esiMasked: optionalValue(payload.esiMasked),
    bankAccountMasked: optionalValue(payload.bankAccountMasked),
    ifscMasked: optionalValue(payload.ifscMasked)?.toUpperCase() ?? null,
    bankName: optionalValue(payload.bankName),
    bankBranch: optionalValue(payload.bankBranch),
    accommodationType,
    roomId: optionalValue(payload.roomId),
    roomNumber: optionalValue(payload.roomNumber),
    roomRentAmount: positiveValue(
      payload.roomRentAmount ?? 0,
      "Individual room rent",
    ),
    photoDataUrl: optionalValue(payload.photoDataUrl),
    mobileNumber: optionalValue(payload.mobileNumber),
    emailAddress: optionalValue(payload.emailAddress)?.toLowerCase() ?? null,
    emergencyContactNumber: optionalValue(payload.emergencyContactNumber),
    addressLine: optionalValue(payload.addressLine),
    district: optionalValue(payload.district),
    stateName: optionalValue(payload.stateName),
    pincode: optionalValue(payload.pincode),
    bloodGroup: optionalValue(payload.bloodGroup),
    fatherName: optionalValue(payload.fatherName),
    spouseName: optionalValue(payload.spouseName),
    maritalStatus: optionalValue(payload.maritalStatus),
    dateOfBirth: optionalValue(payload.dateOfBirth),
    highestQualification: optionalValue(payload.highestQualification),
    ...(applicationJson !== undefined ? { applicationJson } : {}),
    pfApplicable: payload.pfApplicable === "no" ? 0 : 1,
    pfWageAmount: positiveValue(payload.pfWageAmount ?? 0, "PF wage"),
    esiApplicable: payload.esiApplicable === "no" ? 0 : 1,
    esiWageAmount: positiveValue(payload.esiWageAmount ?? 0, "ESI wage"),
    ptApplicable: payload.ptApplicable === "no" ? 0 : 1,
    lwfApplicable: payload.lwfApplicable === "no" ? 0 : 1,
    paymentMode,
    salaryAmount: positiveValue(payload.salaryAmount, "Salary amount"),
    salaryBasis: payload.salaryBasis === "daily" ? "daily" : "monthly",
    defaultShift: optionalValue(payload.defaultShift) ?? "General",
    shiftPattern:
      payload.shiftPattern === "rotational" ? "rotational" : "general",
    applicableShiftsJson:
      typeof payload.applicableShiftsJson === "string"
        ? payload.applicableShiftsJson
        : "[]",
    remarks: optionalValue(payload.remarks),
    employmentType: payload.employmentType === "direct" ? "direct" : "client",
  };
}

async function assignEmployeeAccommodation(
  db: Db,
  values: ReturnType<typeof employeeValues>,
  employeeId?: string | null,
) {
  const [type] = await db
    .select()
    .from(accommodationTypes)
    .where(
      and(
        eq(accommodationTypes.vendorId, values.vendorId),
        eq(accommodationTypes.name, values.accommodationType),
      ),
    )
    .limit(1);
  if (!type || type.status !== "active")
    throw new RequestError(
      "Choose an active accommodation type for this client",
      409,
    );

  let room = values.roomId
    ? (
        await db
          .select()
          .from(accommodationRooms)
          .where(eq(accommodationRooms.id, values.roomId))
          .limit(1)
      )[0]
    : values.roomNumber
      ? (
          await db
            .select()
            .from(accommodationRooms)
            .where(
              and(
                eq(accommodationRooms.vendorId, values.vendorId),
                eq(accommodationRooms.accommodationTypeId, type.id),
                eq(accommodationRooms.roomNumber, values.roomNumber),
              ),
            )
            .limit(1)
        )[0]
      : undefined;

  if (!room && values.roomNumber) {
    const id = `ROOM-${crypto.randomUUID()}`;
    await db.insert(accommodationRooms).values({
      id,
      vendorId: values.vendorId,
      accommodationTypeId: type.id,
      roomNumber: values.roomNumber,
    });
    [room] = await db
      .select()
      .from(accommodationRooms)
      .where(eq(accommodationRooms.id, id))
      .limit(1);
  }

  if (!room) return { ...values, roomId: null, roomNumber: null };
  const [roomType] = await db
    .select()
    .from(accommodationTypes)
    .where(eq(accommodationTypes.id, room.accommodationTypeId))
    .limit(1);
  const sharedJoyRoom = Boolean(
    roomType &&
      isJoySharedAccommodation(type.name) &&
      isJoySharedAccommodation(roomType.name),
  );
  if (
    (room.vendorId !== values.vendorId ||
      room.accommodationTypeId !== type.id) &&
    !sharedJoyRoom
  ) {
    throw new RequestError(
      "The selected room does not belong to this client and accommodation type",
      409,
    );
  }
  if (room.status !== "active")
    throw new RequestError(
      "Reactivate the room before assigning an employee",
      409,
    );
  if (room.capacity > 0) {
    const occupants = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(eq(employees.roomId, room.id), eq(employees.status, "active")),
      );
    if (
      occupants.filter((occupant) => occupant.id !== employeeId).length >=
      room.capacity
    ) {
      throw new RequestError(
        `Room ${room.roomNumber} is already at its capacity of ${room.capacity} employees`,
        409,
      );
    }
  }
  return { ...values, roomId: room.id, roomNumber: room.roomNumber };
}

async function finalizeRoomExpense(
  db: Db,
  expenseId: string,
  access: AppAccess,
) {
  const [expense] = await db
    .select()
    .from(accommodationRoomExpenses)
    .where(eq(accommodationRoomExpenses.id, expenseId))
    .limit(1);
  if (!expense) throw new RequestError("Room recovery entry not found", 404);
  const [room] = await db
    .select()
    .from(accommodationRooms)
    .where(eq(accommodationRooms.id, expense.roomId))
    .limit(1);
  if (!room) throw new RequestError("Accommodation room not found", 404);
  requireClientScope(access, room.vendorId);

  const ledger = await db
    .select()
    .from(accommodationRoomExpenses)
    .where(
      and(
        eq(accommodationRoomExpenses.roomId, expense.roomId),
        eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
      ),
    );
  if (!ledger.length)
    throw new RequestError("No room recovery entries were found", 404);
  if (ledger.every((entry) => entry.status === "finalized"))
    throw new RequestError(
      "This room recovery month has already been finalized",
      409,
    );

  const occupants = await db
    .select()
    .from(employees)
    .where(and(eq(employees.roomId, room.id), eq(employees.status, "active")));
  if (!occupants.length)
    throw new RequestError(
      "Allocate at least one active employee before finalizing room recoveries",
      409,
    );

  const affectedRuns = new Map<string, PayrollRunRow>();
  const runByEmployee = new Map<string, PayrollRunRow>();
  for (const employee of occupants) {
    requireUnitScope(access, employee.clientUnitId, employee.vendorId);
    const [run] = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.clientUnitId, employee.clientUnitId),
          eq(payrollRuns.payPeriod, expense.payPeriod),
        ),
      )
      .limit(1);
    if (!run)
      throw new RequestError(
        `Create ${expense.payPeriod} payroll for ${employee.employeeCode} before finalizing room ${room.roomNumber}`,
        409,
      );
    if (run.status === "approved")
      throw new RequestError(
        `Reopen ${employee.employeeCode}'s approved payroll before applying room recoveries`,
        409,
      );
    const [item] = await db
      .select({ id: payrollItems.id })
      .from(payrollItems)
      .where(
        and(
          eq(payrollItems.runId, run.id),
          eq(payrollItems.employeeId, employee.id),
        ),
      )
      .limit(1);
    if (!item)
      throw new RequestError(
        `${employee.employeeCode} is missing from the ${expense.payPeriod} payroll run`,
        409,
      );
    affectedRuns.set(run.id, run);
    runByEmployee.set(employee.id, run);
  }

  const aggregateExpense = {
    ...expense,
    gasAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.gasAmount), 0),
    ),
    rationAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.rationAmount), 0),
    ),
    provisionAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.provisionAmount), 0),
    ),
  };
  const shares = splitRoomExpenses(
    aggregateExpense,
    occupants.map((employee) => employee.id),
  );
  const anchorExpenseId = expense.id;
  for (const share of shares) {
    const run = runByEmployee.get(share.employeeId);
    if (!run) continue;
    const employee = occupants.find(
      (candidate) => candidate.id === share.employeeId,
    );
    const fullRent = employee
      ? positiveValue(employee.roomRentAmount ?? 0, "Room rent")
      : 0;
    const joinedLate = Boolean(
      employee?.dateOfJoining?.startsWith(expense.payPeriod + "-") &&
      Number(employee.dateOfJoining.slice(8, 10)) > room.rentCutoffDay,
    );
    const rent = roundMoney(
      fullRent * (joinedLate ? room.lateJoinRentPercent / 100 : 1),
    );
    const values = {
      roomExpenseId: anchorExpenseId,
      roomNumber: room.roomNumber,
      gasShare: share.gasShare,
      rationShare: share.rationShare,
      provisionShare: share.provisionShare,
      rent,
    };
    const [existing] = await db
      .select()
      .from(accommodationCharges)
      .where(
        and(
          eq(accommodationCharges.runId, run.id),
          eq(accommodationCharges.employeeId, share.employeeId),
        ),
      )
      .limit(1);
    if (existing)
      await db
        .update(accommodationCharges)
        .set(values)
        .where(eq(accommodationCharges.id, existing.id));
    else
      await db
        .insert(accommodationCharges)
        .values({ runId: run.id, employeeId: share.employeeId, ...values });
  }

  const finalizedAt = new Date().toISOString();
  await db
    .update(accommodationRoomExpenses)
    .set({
      occupantCount: occupants.length,
      status: "finalized",
      finalizedBy: access.identity.email,
      finalizedAt,
      updatedAt: finalizedAt,
    })
    .where(
      and(
        eq(accommodationRoomExpenses.roomId, expense.roomId),
        eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
      ),
    );
  for (const run of affectedRuns.values())
    await recalculateRun(db, run.id, false);
  return { expense, room, occupants, ledger };
}

async function updateUnitCount(db: Db, unitId: string) {
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(eq(employees.clientUnitId, unitId), eq(employees.status, "active")),
    );
  await db
    .update(clientUnits)
    .set({ employeeCount: rows.length })
    .where(eq(clientUnits.id, unitId));
}

async function importWorkbook(
  db: Db,
  payload: Payload,
  actorEmail: string | null,
) {
  const vendorId = textValue(payload.vendorId, "Payroll entity");
  const unitId = textValue(payload.unitId, "Client unit");
  const period = periodValue(payload.payPeriod);
  const sourceType = String(payload.sourceType ?? "attendance");
  const importedEmployees = Array.isArray(payload.employees)
    ? (payload.employees as Array<Record<string, unknown>>)
    : [];
  const importedAttendance = Array.isArray(payload.attendance)
    ? (payload.attendance as Array<Record<string, unknown>>)
    : [];
  const importedItems = Array.isArray(payload.salaryItems)
    ? (payload.salaryItems as Array<Record<string, unknown>>)
    : [];
  if (!importedEmployees.length)
    throw new RequestError("No employee rows were found in the uploaded file");
  if (importedEmployees.length > 1000 || importedAttendance.length > 35000)
    throw new RequestError(
      "Import exceeds the limit of 1,000 employees or 35,000 attendance entries",
    );
  const run = await createRun(db, vendorId, unitId, period, {
    processingMode: sourceType === "salary" ? "salary_import" : "attendance",
  });
  if (sourceType === "salary" && run.processingMode !== "salary_import") {
    await db
      .update(payrollRuns)
      .set({
        processingMode: "salary_import",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payrollRuns.id, run.id));
  }
  await requireRun(db, run.id, true);

  const [allEmployees, allAccommodationTypes, allHostels, allRooms] =
    await Promise.all([
      db.select().from(employees),
      db.select().from(accommodationTypes),
      db.select().from(hostels),
      db.select().from(accommodationRooms),
    ]);
  const existingByCode = new Map(
    allEmployees.map((employee) => [
      employee.employeeCode.toUpperCase(),
      employee,
    ]),
  );
  const newRows: Array<typeof employees.$inferInsert> = [];
  for (const imported of importedEmployees) {
    if (!imported.employeeCode || !imported.name) continue;
    const code = String(imported.employeeCode).trim().toUpperCase();
    const existing = existingByCode.get(code);
    if (existing && existing.clientUnitId !== unitId)
      throw new RequestError(
        `Employee ${code} is already assigned to another client unit`,
        409,
      );
    if (existing) {
      if (sourceType === "salary") {
        // Salary-register imports intentionally preserve employee master data.
        // The employer file is authoritative for this payroll run, not for bank,
        // statutory, accommodation, joining-date, or other permanent fields.
        const importedName = optionalValue(imported.name);
        if (importedName && importedName !== existing.name)
          await db
            .update(employees)
            .set({ name: importedName })
            .where(eq(employees.id, existing.id));
      }
      continue;
    }
    const importedAccommodationType = normalizeAccommodationType(
      imported.accommodationType,
    );
    const sharedJoyImport = isJoySharedAccommodation(
      importedAccommodationType,
    );
    const matchedType = allAccommodationTypes.find(
      (type) =>
        type.status === "active" &&
        type.vendorId === vendorId &&
        (type.name.toLowerCase() === importedAccommodationType.toLowerCase() ||
          (sharedJoyImport && isJoySharedAccommodation(type.name))),
    );
    let importedRoomId: string | null = null;
    let importedRoomNumber = optionalValue(imported.roomNumber);
    const importedHostelName = optionalValue(imported.hostelName);
    if (importedHostelName) {
      if (!matchedType)
        throw new RequestError(
          `Employee ${code}: accommodation type ${importedAccommodationType} is not active for this group company`,
          409,
        );
      const importedHostel = allHostels.find((hostel) => {
        if (
          hostel.status !== "active" ||
          hostel.name.toLowerCase() !== importedHostelName.toLowerCase()
        )
          return false;
        const hostelType = allAccommodationTypes.find(
          (type) => type.id === hostel.accommodationTypeId,
        );
        const compatibleType =
          hostel.accommodationTypeId === matchedType.id ||
          (sharedJoyImport &&
            hostelType &&
            isJoySharedAccommodation(hostelType.name));
        if (!compatibleType) return false;
        try {
          const scope = JSON.parse(hostel.clientScopeJson || "[]") as unknown;
          return (
            !Array.isArray(scope) ||
            scope.length === 0 ||
            scope.includes(unitId)
          );
        } catch {
          return true;
        }
      });
      if (!importedHostel)
        throw new RequestError(
          `Employee ${code}: hostel / area ${importedHostelName} is not mapped to this employer unit`,
          409,
        );
      if (!importedRoomNumber)
        throw new RequestError(
          `Employee ${code}: enter Room number for hostel / area ${importedHostelName}`,
          409,
        );
      const importedRoom = allRooms.find(
        (room) =>
          room.status === "active" &&
          room.hostelId === importedHostel.id &&
          room.roomNumber.toLowerCase() === importedRoomNumber!.toLowerCase(),
      );
      if (!importedRoom)
        throw new RequestError(
          `Employee ${code}: room ${importedRoomNumber} was not found in ${importedHostelName}`,
          409,
        );
      importedRoomId = importedRoom.id;
      importedRoomNumber = importedRoom.roomNumber;
    }
    const value = await assignEmployeeAccommodation(
      db,
      employeeValues(
        {
          department: "General",
          dateOfJoining: `${period}-01`,
          salaryAmount: 0,
          paymentMode: "bank",
          shiftPattern: "general",
          ...imported,
          accommodationType: matchedType?.name ?? importedAccommodationType,
          roomId: importedRoomId,
          roomNumber: importedRoomNumber,
        },
        vendorId,
        unitId,
      ),
    );
    const employee = {
      id: `EMP-${crypto.randomUUID()}`,
      ...value,
      complianceStatus: "ready",
      status: "active",
    };
    newRows.push(employee);
    existingByCode.set(code, employee as EmployeeRow);
  }
  for (let index = 0; index < newRows.length; index += 3)
    await db.insert(employees).values(newRows.slice(index, index + 3));

  const assigned = await db
    .select()
    .from(employees)
    .where(eq(employees.clientUnitId, unitId));
  const employeeByCode = new Map(
    assigned.map((employee) => [employee.employeeCode.toUpperCase(), employee]),
  );
  await addEmployeesToRun(db, run, assigned);
  const runItemIdentityRows = await db
    .select({ id: payrollItems.id, employeeId: payrollItems.employeeId })
    .from(payrollItems)
    .where(eq(payrollItems.runId, run.id));
  const downloadedItemIds = await downloadedPayrollItemIds(db, run.id);
  const downloadedEmployeeIds = new Set(
    runItemIdentityRows
      .filter((item) => downloadedItemIds.has(item.id))
      .map((item) => item.employeeId),
  );

  if (importedAttendance.length) {
    const { start, end } = periodRange(period, run.periodStart, run.periodEnd);
    const existingAttendance = await db
      .select()
      .from(attendanceEntries)
      .where(
        and(
          gte(attendanceEntries.attendanceDate, start),
          lt(attendanceEntries.attendanceDate, end),
        ),
      );
    const existingMap = new Map(
      existingAttendance.map((entry) => [
        `${entry.employeeId}:${entry.attendanceDate}`,
        entry.id,
      ]),
    );
    const statements: ReturnType<ReturnType<typeof getRawDb>["prepare"]>[] = [];
    const d1 = getRawDb();
    for (const entry of importedAttendance) {
      const employee = employeeByCode.get(
        String(entry.employeeCode ?? "")
          .trim()
          .toUpperCase(),
      );
      const date = String(entry.attendanceDate ?? "");
      const status = String(entry.statusCode ?? "").toUpperCase();
      if (
        !employee ||
        downloadedEmployeeIds.has(employee.id) ||
        date < start ||
        date >= end ||
        !ATTENDANCE_CODES.includes(status as (typeof ATTENDANCE_CODES)[number])
      )
        continue;
      const shift = optionalValue(entry.shiftCode) ?? employee.defaultShift;
      const overtime = positiveValue(entry.overtimeHours, "Overtime hours", 24);
      const current = existingMap.get(`${employee.id}:${date}`);
      if (current)
        statements.push(
          d1
            .prepare(
              "UPDATE attendance_entries SET status_code = ?, shift_code = ?, overtime_hours = ?, source = ?, updated_by = ?, updated_at = ? WHERE id = ?",
            )
            .bind(
              status,
              shift,
              overtime,
              "import",
              actorEmail,
              new Date().toISOString(),
              current,
            ),
        );
      else
        statements.push(
          d1
            .prepare(
              "INSERT INTO attendance_entries (employee_id, attendance_date, status_code, shift_code, overtime_hours, source, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              employee.id,
              date,
              status,
              shift,
              overtime,
              "import",
              actorEmail,
              new Date().toISOString(),
            ),
        );
    }
    for (let index = 0; index < statements.length; index += 75)
      await d1.batch(statements.slice(index, index + 75));
  }

  if (importedItems.length) {
    const itemRows = await db
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.runId, run.id));
    const itemByEmployee = new Map(
      itemRows.map((row) => [row.employeeId, row]),
    );
    for (const imported of importedItems) {
      const employee = employeeByCode.get(
        String(imported.employeeCode ?? "")
          .trim()
          .toUpperCase(),
      );
      const item = employee ? itemByEmployee.get(employee.id) : null;
      if (!employee || !item || downloadedItemIds.has(item.id)) continue;
      const update: Record<string, number> = {};
      for (const field of [...earningFields, ...deductionFields])
        if (Object.hasOwn(imported, field))
          update[field] = positiveValue(imported[field], field);
      for (const field of [
        "presentDays",
        "payableDays",
        "overtimeHours",
        "fixedWorkingDays",
        "nfhDays",
        "compOffDays",
        "onDutyDays",
        "sundayDays",
        "plDays",
        "clDays",
        "slDays",
      ] as const)
        if (Object.hasOwn(imported, field))
          update[field] = positiveValue(imported[field], field);
      const importedTotals = {
        importedGrossEarnings: Object.hasOwn(imported, "sourceGrossEarnings")
          ? positiveValue(imported.sourceGrossEarnings, "Gross Earnings")
          : item.importedGrossEarnings,
        importedTotalDeductions: Object.hasOwn(imported, "sourceTotalDeductions")
          ? positiveValue(imported.sourceTotalDeductions, "Total Deductions")
          : item.importedTotalDeductions,
        importedNetPayable: Object.hasOwn(imported, "sourceNetPayable")
          ? positiveValue(imported.sourceNetPayable, "Net Payable")
          : item.importedNetPayable,
      };
      const totals = payrollTotals({ ...item, ...update });
      await db
        .update(payrollItems)
        .set({
          ...update,
          ...importedTotals,
          grossEarnings: totals.grossEarnings,
          totalDeductions: totals.totalDeductions,
          netPayable: totals.netPayable,
        })
        .where(eq(payrollItems.id, item.id));
    }
  }

  await updateUnitCount(db, unitId);
  await recalculateRun(
    db,
    run.id,
    importedAttendance.length > 0 && downloadedItemIds.size === 0,
  );
  await writeAudit(
    db,
    "workbook_imported",
    "payroll_run",
    run.id,
    `Imported ${importedEmployees.length} employees and ${importedAttendance.length} attendance entries from ${sourceType} workbook`,
    actorEmail,
  );
  return run.id;
}

async function activeSuperAdminCount(db: Db, excludeId?: string) {
  const rows = await db
    .select({ id: appUsers.id, role: appUsers.role, status: appUsers.status })
    .from(appUsers);
  return rows.filter(
    (row) =>
      row.id !== excludeId &&
      row.role === "super_admin" &&
      row.status === "active",
  ).length;
}

function permissionPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function createSupabaseAuthUser(email: string, password: string) {
  const deno = (
    globalThis as unknown as {
      Deno?: { env: { get(name: string): string | undefined } };
    }
  ).Deno;
  const supabaseUrl = deno?.env.get("SUPABASE_URL");
  const serviceKey = deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (!detail.toLowerCase().includes("already") && response.status !== 422)
      throw new RequestError(
        "Supabase sign-in account could not be created",
        502,
      );
  }
}

const datedRecoveryFields = [
  "rent",
  "bus",
  "food",
  "advance",
  "idCard",
  "medical",
  "ticket",
  "shoe",
  "aadhaarUpdate",
  "bankAccountCharge",
  "tshirt",
  "oldPending",
  "returnAmount",
] as const;

async function syncDatedRecoveries(db: Db, runId: string, employeeId: string) {
  const rows = await db
    .select()
    .from(recoveryEntries)
    .where(
      and(
        eq(recoveryEntries.runId, runId),
        eq(recoveryEntries.employeeId, employeeId),
      ),
    );
  const totals = Object.fromEntries(
    datedRecoveryFields.map((field) => [
      field,
      roundMoney(
        rows
          .filter((entry) => entry.recoveryType === field)
          .reduce((sum, entry) => sum + entry.amount, 0),
      ),
    ]),
  ) as Record<(typeof datedRecoveryFields)[number], number>;
  const [existing] = await db
    .select()
    .from(accommodationCharges)
    .where(
      and(
        eq(accommodationCharges.runId, runId),
        eq(accommodationCharges.employeeId, employeeId),
      ),
    )
    .limit(1);
  if (existing)
    await db
      .update(accommodationCharges)
      .set(totals)
      .where(eq(accommodationCharges.id, existing.id));
  else if (rows.length)
    await db
      .insert(accommodationCharges)
      .values({ runId, employeeId, ...totals });
  await recalculateRun(db, runId, false);
}

async function saveAppUser(db: Db, payload: Payload, access: AppAccess) {
  requireSuperAdmin(access);
  const existingId = optionalValue(payload.id);
  const email = textValue(payload.email, "User email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new RequestError("Enter a valid user email address");
  const fullName = optionalValue(payload.fullName);
  const role = normalizeRole(payload.role);
  const permissions = normalizePermissions(
    role,
    permissionPayload(payload.permissions),
  );
  const canApprovePayroll =
    role === "super_admin" ||
    payload.canApprovePayroll === true ||
    payload.canApprovePayroll === 1 ||
    payload.canApprovePayroll === "on";
  let clientScope = normalizedScope(payload.clientScope ?? payload.clientIds);
  let unitScope = normalizedScope(payload.unitScope ?? payload.unitIds);
  let hostelScope = normalizedScope(payload.hostelScope ?? payload.hostelIds);
  if (role === "super_admin") {
    clientScope = [];
    unitScope = [];
    hostelScope = [];
  } else if (role === "payroll_team") {
    if (!clientScope.length)
      throw new RequestError(
        "Assign at least one client to a Payroll Team user",
      );
    const assignedClients = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(inArray(vendors.id, clientScope));
    if (assignedClients.length !== clientScope.length)
      throw new RequestError(
        "One or more assigned clients no longer exist",
        404,
      );
    unitScope = [];
    hostelScope = [];
  } else if (role === "hostel_incharge") {
    if (!hostelScope.length)
      throw new RequestError(
        "Assign at least one hostel to a Hostel In-charge user",
      );
    const assignedHostels = await db
      .select({ id: hostels.id, vendorId: hostels.vendorId })
      .from(hostels)
      .where(inArray(hostels.id, hostelScope));
    if (assignedHostels.length !== hostelScope.length)
      throw new RequestError(
        "One or more assigned hostels no longer exist",
        404,
      );
    clientScope = normalizedScope(
      assignedHostels.map((hostel) => hostel.vendorId),
    );
    unitScope = [];
  } else {
    if (!unitScope.length)
      throw new RequestError(
        "Assign at least one employer unit to this HR user",
      );
    const assignedUnits = await db
      .select({ id: clientUnits.id, vendorId: clientUnits.vendorId })
      .from(clientUnits)
      .where(inArray(clientUnits.id, unitScope));
    if (assignedUnits.length !== unitScope.length)
      throw new RequestError(
        "One or more assigned employer units no longer exist",
        404,
      );
    clientScope = normalizedScope(assignedUnits.map((unit) => unit.vendorId));
    hostelScope = [];
  }
  const now = new Date().toISOString();
  const values = {
    email,
    fullName,
    employeeCode: optionalValue(payload.employeeCode),
    department: optionalValue(payload.department),
    dateOfJoining: payload.dateOfJoining
      ? dateValue(payload.dateOfJoining, "Joining date")
      : null,
    mobileNumber: optionalValue(payload.mobileNumber),
    role,
    permissionsJson: JSON.stringify(permissions),
    clientScopeJson: JSON.stringify(clientScope),
    unitScopeJson: JSON.stringify(unitScope),
    hostelScopeJson: JSON.stringify(hostelScope),
    canApprovePayroll: canApprovePayroll ? 1 : 0,
    approvalManagerEmail: role === "super_admin" ? null : optionalValue(payload.approvalManagerEmail)?.toLowerCase() ?? null,
    approvalSequence: role === "super_admin" ? 999 : positiveValue(payload.approvalSequence ?? 0, "Approval sequence", 999),
    updatedAt: now,
  };
  const [emailOwner] = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);
  if (emailOwner && emailOwner.id !== existingId)
    throw new RequestError(
      "A user profile already exists for this email address",
      409,
    );
  if (existingId) {
    const [existing] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, existingId))
      .limit(1);
    if (!existing) throw new RequestError("User profile not found", 404);
    if (
      existing.email === access.identity.email.toLowerCase() &&
      (email !== existing.email || role !== "super_admin")
    )
      throw new RequestError(
        "You cannot change your own Super Admin identity or role",
        409,
      );
    if (
      existing.role === "super_admin" &&
      existing.status === "active" &&
      role !== "super_admin" &&
      (await activeSuperAdminCount(db, existing.id)) === 0
    )
      throw new RequestError(
        "Create another active Super Admin before changing this role",
        409,
      );
    await db.update(appUsers).set(values).where(eq(appUsers.id, existingId));
    await writeAudit(
      db,
      "user_updated",
      "app_user",
      existingId,
      `Updated ${email} as ${role.replaceAll("_", " ")}`,
      access.identity.email,
    );
    return;
  }
  const id = `USER-${crypto.randomUUID()}`;
  const temporaryPassword = textValue(
    payload.temporaryPassword,
    "Temporary password",
  );
  if (temporaryPassword.length < 12)
    throw new RequestError(
      "Temporary password must contain at least 12 characters",
    );
  await createSupabaseAuthUser(email, temporaryPassword);
  await db
    .insert(appUsers)
    .values({
      id,
      ...values,
      status: "active",
      createdBy: access.identity.email,
      createdAt: now,
    });
  await writeAudit(
    db,
    "user_created",
    "app_user",
    id,
    `Added ${email} as ${role.replaceAll("_", " ")}`,
    access.identity.email,
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    const action = textValue(payload.action, "Action");
    const db = getDb();
    const access = await requireAppAccess(db);
    await ensureDemoData();
    if (action === "approve") {
      requireModule(access, "payroll", "manage");
      if (!access.profile.canApprovePayroll)
        throw new RequestError(
          "Your profile can process payroll but does not have final approval authority",
          403,
        );
    } else if (action === "reopen-payroll-for-recovery") {
      requireModule(access, "payroll", "manage");
      requireModule(access, "payments", "manage");
      if (!access.profile.canApprovePayroll)
        throw new RequestError(
          "Only a Super Admin or authorised payroll approver can reopen cleared payments for recovery correction",
          403,
        );
    } else {
      const required = actionPermission(action, payload);
      if (required) requireModule(access, required.module, required.level);
    }
    if (
      action === "save-app-user" ||
      ((action === "set-record-status" || action === "delete-record") &&
        payload.entityType === "app_user")
    )
      requireSuperAdmin(access);
    await enforceActionScope(db, access, action, payload);
    const user = access.identity;
    const actorEmail = user.email;
    let runId = typeof payload.runId === "string" ? payload.runId : RUN_ID;
    const paymentProtectedActions = new Set([
      "update-run-period",
      "save-attendance",
      "delete-attendance",
      "save-accommodation",
      "delete-accommodation",
      "save-recovery-entry",
      "delete-recovery-entry",
      "finalize-employee-recovery",
      "reopen-employee-recovery",
      "save-room-expense",
      "finalize-room-expense",
      "reopen-room-expense",
      "delete-payroll-run",
    ]);
    if (
      paymentProtectedActions.has(action) &&
      (await downloadedPayrollItemIds(db, runId)).size
    )
      throw new RequestError(
        "A bank file was already downloaded for this payroll. Paid attendance and recovery records remain locked; update only the newly added employee salary row.",
        409,
      );

    if (action === "save-app-user") {
      await saveAppUser(db, payload, access);
    } else if (action === "save-own-profile") {
      const fullName = textValue(payload.fullName, "Full name");
      const department = optionalValue(payload.department);
      const mobileNumber = optionalValue(payload.mobileNumber);
      await db
        .update(appUsers)
        .set({
          fullName,
          department,
          mobileNumber,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(appUsers.id, access.profile.id));
      await writeAudit(
        db,
        "profile_updated",
        "app_user",
        access.profile.id,
        "Updated own profile details",
        actorEmail,
      );
    } else if (action === "create-vendor" || action === "save-client") {
      const code = textValue(payload.code, "Client code").toUpperCase();
      if (!/^[A-Z0-9_-]{2,15}$/.test(code))
        throw new RequestError(
          "Client code must contain 2–15 letters, numbers, underscores, or hyphens",
        );
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `CLIENT-${crypto.randomUUID()}`;
      const name = textValue(payload.name, "Client name");
      const logoDataUrl = optionalValue(payload.logoDataUrl);
      if (
        logoDataUrl &&
        (!logoDataUrl.startsWith("data:image/") || logoDataUrl.length > 500000)
      )
        throw new RequestError("Upload a JPG or PNG logo smaller than 350 KB");
      const values = {
        code,
        name,
        legalName: optionalValue(payload.legalName) ?? name,
        epfCode: optionalValue(payload.epfCode),
        esiCode: optionalValue(payload.esiCode),
        gstin: optionalValue(payload.gstin)?.toUpperCase() ?? null,
        remarks: optionalValue(payload.remarks),
        logoDataUrl,
      };
      if (existingId) {
        const [existing] = await db
          .select({ id: vendors.id })
          .from(vendors)
          .where(eq(vendors.id, existingId))
          .limit(1);
        if (!existing) throw new RequestError("Client not found", 404);
        await db.update(vendors).set(values).where(eq(vendors.id, existingId));
      } else {
        await db.insert(vendors).values({ id, ...values });
        await createDefaultShifts(db, id);
        await createDefaultAccommodationTypes(db, id);
      }
      await writeAudit(
        db,
        existingId ? "client_updated" : "client_created",
        "client",
        id,
        `${existingId ? "Updated" : "Added"} client ${name}`,
        actorEmail,
      );
    } else if (action === "create-unit" || action === "save-unit") {
      const vendorId = textValue(payload.vendorId, "Client");
      const [client] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);
      if (!client) throw new RequestError("Client not found", 404);
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `UNIT-${crypto.randomUUID()}`;
      const clientName = textValue(payload.clientName, "Employer name");
      const unitName = textValue(payload.unitName, "Unit name");
      const values = {
        vendorId,
        clientName,
        unitName,
        location: textValue(payload.location, "Location"),
        remarks: optionalValue(payload.remarks),
        attendanceCycleStartDay: positiveValue(
          payload.attendanceCycleStartDay ?? 1,
          "Attendance cycle start day",
          31,
        ),
        attendanceCycleEndDay: positiveValue(
          payload.attendanceCycleEndDay ?? 31,
          "Attendance cycle end day",
          31,
        ),
        attendanceWorkingDays: positiveValue(
          payload.attendanceWorkingDays ?? 26,
          "Attendance working days",
          31,
        ),
        overtimeMultiplier: positiveValue(
          payload.overtimeMultiplier ?? 1,
          "OT payment multiplier",
          2,
        ),
        voucherHeader: optionalValue(payload.voucherHeader),
        payslipTitle: optionalValue(payload.payslipTitle),
        payslipSubtitle: optionalValue(payload.payslipSubtitle),
        payslipAddress: optionalValue(payload.payslipAddress),
        payslipContact: optionalValue(payload.payslipContact),
        payslipFooter: optionalValue(payload.payslipFooter),
        payslipEarningsJson: selectedPayslipFields(
          payload.payslipEarnings,
          earningFields,
          "payslip earning",
        ),
        payslipDeductionsJson: selectedPayslipFields(
          payload.payslipDeductions,
          deductionFields,
          "payslip deduction",
        ),
      };
      if (
        ![
          values.attendanceCycleStartDay,
          values.attendanceCycleEndDay,
          values.attendanceWorkingDays,
        ].every((value) => Number.isInteger(value) && value >= 1)
      ) {
        throw new RequestError(
          "Attendance cycle days and working days must be whole numbers between 1 and 31",
        );
      }
      if (values.overtimeMultiplier < 1)
        throw new RequestError("OT payment multiplier must be between 1 and 2");
      if (existingId) {
        const [existing] = await db
          .select()
          .from(clientUnits)
          .where(eq(clientUnits.id, existingId))
          .limit(1);
        if (!existing) throw new RequestError("Employer unit not found", 404);
        if (existing.vendorId !== vendorId) {
          const assigned = await db
            .select({ id: employees.id })
            .from(employees)
            .where(eq(employees.clientUnitId, existingId))
            .limit(1);
          const runs = await db
            .select({ id: payrollRuns.id })
            .from(payrollRuns)
            .where(eq(payrollRuns.clientUnitId, existingId))
            .limit(1);
          if (assigned.length || runs.length)
            throw new RequestError(
              "An employer unit with employees or payroll history cannot be moved to another client.",
              409,
            );
        }
        await db
          .update(clientUnits)
          .set(values)
          .where(eq(clientUnits.id, existingId));
      } else {
        if (client.status !== "active")
          throw new RequestError(
            "Reactivate the client before adding an employer unit",
            409,
          );
        await db
          .insert(clientUnits)
          .values({ id, ...values, employeeCount: 0 });
      }
      await writeAudit(
        db,
        existingId ? "unit_updated" : "unit_created",
        "client_unit",
        id,
        `${existingId ? "Updated" : "Added"} ${clientName} · ${unitName}`,
        actorEmail,
      );
    } else if (action === "save-employee") {
      const vendorId = textValue(payload.vendorId, "Client");
      const unitId = textValue(payload.unitId, "Employer unit");
      const [unit] = await db
        .select()
        .from(clientUnits)
        .where(eq(clientUnits.id, unitId))
        .limit(1);
      if (!unit || unit.vendorId !== vendorId)
        throw new RequestError("Select a valid client and employer unit", 404);
      const form =
        typeof payload.employee === "object" && payload.employee !== null
          ? (payload.employee as Record<string, unknown>)
          : payload;
      const values = await assignEmployeeAccommodation(
        db,
        employeeValues(form, vendorId, unitId),
        optionalValue(form.id),
      );
      const rules = await activeRules(db, vendorId);
      const complianceStatus = validationForEmployee(
        { ...values, salaryAmount: values.salaryAmount },
        rules,
      ).validationStatus;
      const employeeId = optionalValue(form.id);
      const id = employeeId ?? `EMP-${crypto.randomUUID()}`;
      if (employeeId) {
        const [existing] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);
        if (!existing || existing.clientUnitId !== unitId)
          throw new RequestError(
            "Employee not found in the selected unit",
            404,
          );
        if (
          existing.roomId &&
          values.roomId &&
          existing.roomId !== values.roomId
        )
          throw new RequestError(
            "Remove the employee from the present room before allocating another room",
            409,
          );
        await db
          .update(employees)
          .set({ ...values, complianceStatus })
          .where(eq(employees.id, employeeId));
      } else {
        await db
          .insert(employees)
          .values({
            id,
            ...values,
            complianceStatus,
            processingStage: "field_hr_draft",
          });
      }
      const [saved] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1);
      const openRuns = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.clientUnitId, unitId));
      for (const run of openRuns.filter(
        (candidate) => candidate.status !== "approved",
      )) {
        await addEmployeesToRun(db, run, [saved]);
        await recalculateRun(db, run.id, true);
      }
      await updateUnitCount(db, unitId);
      await writeAudit(
        db,
        employeeId ? "employee_updated" : "employee_created",
        "employee",
        id,
        `${employeeId ? "Updated" : "Added"} ${values.name} (${values.employeeCode})`,
        actorEmail,
      );
    } else if (action === "save-accommodation-type") {
      const vendorId = textValue(payload.vendorId, "Client");
      const [client] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);
      if (!client) throw new RequestError("Client not found", 404);
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `ACCTYPE-${crypto.randomUUID()}`;
      const name = normalizeAccommodationType(
        textValue(payload.name, "Accommodation type"),
      );
      const values = {
        vendorId,
        name,
        remarks: optionalValue(payload.remarks),
      };
      if (existingId) {
        const [existing] = await db
          .select()
          .from(accommodationTypes)
          .where(eq(accommodationTypes.id, existingId))
          .limit(1);
        if (!existing || existing.vendorId !== vendorId)
          throw new RequestError(
            "Accommodation type not found for this client",
            404,
          );
        await db
          .update(accommodationTypes)
          .set(values)
          .where(eq(accommodationTypes.id, existingId));
        if (existing.name !== name) {
          await db
            .update(employees)
            .set({ accommodationType: name })
            .where(
              and(
                eq(employees.vendorId, vendorId),
                eq(employees.accommodationType, existing.name),
              ),
            );
        }
      } else {
        await db.insert(accommodationTypes).values({ id, ...values });
      }
      await writeAudit(
        db,
        existingId
          ? "accommodation_type_updated"
          : "accommodation_type_created",
        "accommodation_type",
        id,
        `${existingId ? "Updated" : "Added"} accommodation type ${name}`,
        actorEmail,
      );
    } else if (action === "save-room") {
      const vendorId = textValue(payload.vendorId, "Client");
      const accommodationTypeId = textValue(
        payload.accommodationTypeId,
        "Accommodation type",
      );
      const [type] = await db
        .select()
        .from(accommodationTypes)
        .where(eq(accommodationTypes.id, accommodationTypeId))
        .limit(1);
      if (!type || type.vendorId !== vendorId || type.status !== "active")
        throw new RequestError(
          "Choose an active accommodation type for this client",
          409,
        );
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `ROOM-${crypto.randomUUID()}`;
      const capacity = positiveValue(
        payload.capacity ?? 0,
        "Room capacity",
        1000,
      );
      if (!Number.isInteger(capacity))
        throw new RequestError("Room capacity must be a whole number");
      const hostelId = textValue(payload.hostelId, "Hostel / local area");
      {
        const [hostel] = await db
          .select()
          .from(hostels)
          .where(eq(hostels.id, hostelId))
          .limit(1);
        const [hostelAccommodationType] = hostel?.accommodationTypeId
          ? await db.select().from(accommodationTypes).where(eq(accommodationTypes.id, hostel.accommodationTypeId)).limit(1)
          : [];
        if (
          !hostel ||
          !hostelAccommodationType ||
          hostelAccommodationType.name !== type.name ||
          hostel.status !== "active"
        )
          throw new RequestError(
            "Choose an active shared hostel or local area under the same accommodation type",
            409,
          );
      }
      const values = {
        vendorId,
        accommodationTypeId,
        hostelId,
        rentSettingsJson:
          typeof payload.rentSettingsJson === "string"
            ? payload.rentSettingsJson
            : "{}",
        rentCutoffDay: Math.max(
          1,
          Math.min(
            31,
            Math.round(
              positiveValue(payload.rentCutoffDay ?? 25, "Rent cutoff day", 31),
            ),
          ),
        ),
        lateJoinRentPercent: positiveValue(
          payload.lateJoinRentPercent ?? 50,
          "Late joining rent percent",
          100,
        ),
        roomNumber: textValue(payload.roomNumber, "Room number"),
        capacity,
        address: optionalValue(payload.address),
        remarks: optionalValue(payload.remarks),
      };
      if (existingId) {
        const [existing] = await db
          .select()
          .from(accommodationRooms)
          .where(eq(accommodationRooms.id, existingId))
          .limit(1);
        if (!existing || existing.vendorId !== vendorId)
          throw new RequestError(
            "Accommodation room not found for this client",
            404,
          );
        const occupants = await db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.roomId, existing.id),
              eq(employees.status, "active"),
            ),
          );
        for (const occupant of occupants)
          requireUnitScope(access, occupant.clientUnitId, occupant.vendorId);
        if (capacity && occupants.length > capacity)
          throw new RequestError(
            `Room already has ${occupants.length} active employees`,
            409,
          );
        await db
          .update(accommodationRooms)
          .set(values)
          .where(eq(accommodationRooms.id, existing.id));
        await db
          .update(employees)
          .set({ roomNumber: values.roomNumber, accommodationType: type.name })
          .where(eq(employees.roomId, existing.id));
      } else {
        await db.insert(accommodationRooms).values({ id, ...values });
      }
      await writeAudit(
        db,
        existingId ? "room_updated" : "room_created",
        "room",
        id,
        `${existingId ? "Updated" : "Added"} ${type.name} room ${values.roomNumber}`,
        actorEmail,
      );
    } else if (action === "allocate-room") {
      const employeeId = textValue(payload.employeeId, "Employee");
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee) throw new RequestError("Employee not found", 404);
      requireUnitScope(access, employee.clientUnitId, employee.vendorId);
      const roomId = optionalValue(payload.roomId);
      if (!roomId) {
        await db
          .update(employees)
          .set({ roomId: null, roomNumber: null, roomRentAmount: 0 })
          .where(eq(employees.id, employee.id));
      } else {
        const [room] = await db
          .select()
          .from(accommodationRooms)
          .where(eq(accommodationRooms.id, roomId))
          .limit(1);
        const [type] = room
          ? await db
              .select()
              .from(accommodationTypes)
              .where(eq(accommodationTypes.id, room.accommodationTypeId))
              .limit(1)
          : [];
        if (!room || !type)
          throw new RequestError("Accommodation room not found", 404);
        if (employee.roomId && employee.roomId !== roomId)
          throw new RequestError(
            "Remove the employee from the present room before allocating another room",
            409,
          );
        if (
          employee.accommodationType !== type.name &&
          !(
            isJoySharedAccommodation(employee.accommodationType) &&
            isJoySharedAccommodation(type.name)
          )
        )
          throw new RequestError(
            `This room is under ${type.name}. Change the employee accommodation type first`,
            409,
          );
        const assigned = await assignEmployeeAccommodation(
          db,
          employeeValues(
            {
              ...employee,
              roomId,
              roomNumber: room.roomNumber,
              accommodationType: employee.accommodationType,
            },
            employee.vendorId,
            employee.clientUnitId,
          ),
          employee.id,
        );
        const roomRentAmount = positiveValue(
          payload.roomRentAmount ?? 0,
          "Individual room rent",
        );
        await db
          .update(employees)
          .set({
            roomId: assigned.roomId,
            roomNumber: assigned.roomNumber,
            roomRentAmount,
            accommodationType: assigned.accommodationType,
          })
          .where(eq(employees.id, employee.id));
      }
      const employeeRuns = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.clientUnitId, employee.clientUnitId));
      for (const run of employeeRuns.filter(
        (candidate) => candidate.status !== "approved",
      ))
        await recalculateRun(db, run.id, false);
      await writeAudit(
        db,
        "room_allocated",
        "employee",
        employee.id,
        `${roomId ? "Assigned" : "Removed"} room allocation for ${employee.employeeCode}`,
        actorEmail,
      );
    } else if (action === "save-room-expense") {
      const roomId = textValue(payload.roomId, "Accommodation room");
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, roomId))
        .limit(1);
      if (!room) throw new RequestError("Accommodation room not found", 404);
      requireClientScope(access, room.vendorId);
      if (room.status !== "active")
        throw new RequestError(
          "Reactivate the room before adding expenses",
          409,
        );
      const payPeriod = periodValue(payload.payPeriod);
      const gasAmount = positiveValue(payload.gasAmount, "Gas expense");
      const rationAmount = positiveValue(payload.rationAmount, "Ration expense");
      const provisionAmount = positiveValue(
        payload.provisionAmount,
        "Provision expense",
      );
      if (gasAmount + rationAmount + provisionAmount <= 0)
        throw new RequestError(
          "Enter at least one Gas, Ration, or Provision recovery amount",
        );
      const values = {
        gasAmount,
        gasDate: payload.gasDate
          ? dateValue(payload.gasDate, "Gas cylinder date")
          : null,
        gasCylinderCount: Math.round(
          positiveValue(payload.gasCylinderCount ?? 0, "Gas cylinder count"),
        ),
        gasPaymentReference: optionalValue(payload.gasPaymentReference),
        rationAmount,
        rationDate: payload.rationDate
          ? dateValue(payload.rationDate, "Ration date")
          : null,
        rationPaymentReference: optionalValue(payload.rationPaymentReference),
        provisionAmount,
        provisionDate: payload.provisionDate
          ? dateValue(payload.provisionDate, "Provision date")
          : null,
        provisionPaymentReference: optionalValue(
          payload.provisionPaymentReference,
        ),
        notes: optionalValue(payload.notes),
        updatedAt: new Date().toISOString(),
      };
      const expenseId = `ROOMEXP-${crypto.randomUUID()}`;
      await db
        .insert(accommodationRoomExpenses)
        .values({ id: expenseId, roomId, payPeriod, ...values });
      const entryDate =
        values.gasDate ?? values.rationDate ?? values.provisionDate ?? payPeriod;
      await writeAudit(
        db,
        "room_expense_saved",
        "room",
        room.id,
        `Added dated room recovery for ${room.roomNumber} on ${entryDate}: Gas ₹${gasAmount.toFixed(2)}, Ration ₹${rationAmount.toFixed(2)}, Provision ₹${provisionAmount.toFixed(2)}`,
        actorEmail,
      );
    } else if (action === "finalize-room-expense") {
      const expenseId = textValue(payload.expenseId, "Room expense");
      const result = await finalizeRoomExpense(db, expenseId, access);
      await writeAudit(
        db,
        "room_expense_finalized",
        "room",
        result.room.id,
        `Finalized ${result.room.roomNumber} shared expenses across ${result.occupants.length} employees`,
        actorEmail,
      );
    } else if (action === "reopen-room-expense") {
      const expenseId = textValue(payload.expenseId, "Room recovery entry");
      const [expense] = await db
        .select()
        .from(accommodationRoomExpenses)
        .where(eq(accommodationRoomExpenses.id, expenseId))
        .limit(1);
      if (!expense)
        throw new RequestError("Room recovery entry not found", 404);
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, expense.roomId))
        .limit(1);
      if (!room) throw new RequestError("Accommodation room not found", 404);
      requireClientScope(access, room.vendorId);
      const ledger = await db
        .select()
        .from(accommodationRoomExpenses)
        .where(
          and(
            eq(accommodationRoomExpenses.roomId, expense.roomId),
            eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
          ),
        );
      const ledgerIds = ledger.map((entry) => entry.id);
      const affected = ledgerIds.length
        ? await db
            .select()
            .from(accommodationCharges)
            .where(inArray(accommodationCharges.roomExpenseId, ledgerIds))
        : [];
      const affectedRuns = new Set(affected.map((charge) => charge.runId));
      for (const affectedRunId of affectedRuns) {
        const run = await requireRun(db, affectedRunId, true);
        requireUnitScope(access, run.clientUnitId, run.vendorId);
      }
      if (ledgerIds.length)
        await db
          .update(accommodationCharges)
          .set({
            roomExpenseId: null,
            gasShare: 0,
            rationShare: 0,
            provisionShare: 0,
          })
          .where(inArray(accommodationCharges.roomExpenseId, ledgerIds));
      await db
        .update(accommodationRoomExpenses)
        .set({
          status: "draft",
          occupantCount: 0,
          finalizedBy: null,
          finalizedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(accommodationRoomExpenses.roomId, expense.roomId),
            eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
          ),
        );
      for (const affectedRunId of affectedRuns)
        await recalculateRun(db, affectedRunId, false);
      await writeAudit(
        db,
        "room_expense_reopened",
        "room",
        room.id,
        `Reopened all ${expense.payPeriod} room recovery ledger entries for room ${room.roomNumber}`,
        actorEmail,
      );
    } else if (action === "save-shift") {
      const vendorId = textValue(payload.vendorId, "Client");
      const [client] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);
      if (!client) throw new RequestError("Client not found", 404);
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `SHIFT-${crypto.randomUUID()}`;
      const name = textValue(payload.name, "Shift name");
      const startTime = textValue(payload.startTime, "Shift start time");
      const endTime = textValue(payload.endTime, "Shift end time");
      if (
        ![startTime, endTime].every((value) =>
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
        )
      )
        throw new RequestError("Shift times must use the 24-hour HH:MM format");
      const clientUnitId = optionalValue(payload.clientUnitId);
      if (clientUnitId) {
        const [mappedUnit] = await db
          .select()
          .from(clientUnits)
          .where(eq(clientUnits.id, clientUnitId))
          .limit(1);
        if (!mappedUnit || mappedUnit.vendorId !== vendorId)
          throw new RequestError(
            "Choose a client location under this group company",
            409,
          );
      }
      const wholeMinutes = (value: unknown, label: string, maximum = 1440) =>
        Math.round(positiveValue(value ?? 0, label, maximum));
      const values = {
        vendorId,
        clientUnitId,
        name,
        startTime,
        endTime,
        breakMinutes: wholeMinutes(payload.breakMinutes, "Break minutes"),
        requiredWorkMinutes: wholeMinutes(
          payload.requiredWorkMinutes ?? 480,
          "Required work minutes",
        ),
        lateGraceMinutes: wholeMinutes(
          payload.lateGraceMinutes,
          "Late grace minutes",
        ),
        lateDeductionMinutes: wholeMinutes(
          payload.lateDeductionMinutes,
          "Late deduction minutes",
        ),
        earlyGraceMinutes: wholeMinutes(
          payload.earlyGraceMinutes,
          "Early grace minutes",
        ),
        earlyDeductionMinutes: wholeMinutes(
          payload.earlyDeductionMinutes,
          "Early deduction minutes",
        ),
        otMode: payload.otMode === "fixed" ? "fixed" : "approval",
        fixedOtHours: positiveValue(
          payload.fixedOtHours ?? 0,
          "Fixed OT hours",
          24,
        ),
        remarks: optionalValue(payload.remarks),
      };
      if (existingId) {
        const [existing] = await db
          .select()
          .from(shiftDefinitions)
          .where(eq(shiftDefinitions.id, existingId))
          .limit(1);
        if (!existing || existing.vendorId !== vendorId)
          throw new RequestError("Shift not found for this client", 404);
        await db
          .update(shiftDefinitions)
          .set(values)
          .where(eq(shiftDefinitions.id, existingId));
        if (existing.name !== name) {
          await db
            .update(employees)
            .set({ defaultShift: name })
            .where(
              and(
                eq(employees.vendorId, vendorId),
                eq(employees.defaultShift, existing.name),
              ),
            );
          const assigned = await db
            .select({ id: employees.id })
            .from(employees)
            .where(eq(employees.vendorId, vendorId));
          if (assigned.length)
            await db
              .update(attendanceEntries)
              .set({ shiftCode: name })
              .where(
                and(
                  eq(attendanceEntries.shiftCode, existing.name),
                  inArray(
                    attendanceEntries.employeeId,
                    assigned.map((employee) => employee.id),
                  ),
                ),
              );
        }
      } else {
        await db.insert(shiftDefinitions).values({ id, ...values });
      }
      await writeAudit(
        db,
        existingId ? "shift_updated" : "shift_created",
        "shift",
        id,
        `${existingId ? "Updated" : "Added"} ${name} (${startTime}–${endTime})`,
        actorEmail,
      );
    } else if (action === "save-remark") {
      const vendorId = textValue(payload.vendorId, "Client");
      const [client] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);
      if (!client) throw new RequestError("Client not found", 404);
      const existingId = optionalValue(payload.id);
      const id = existingId ?? `REMARK-${crypto.randomUUID()}`;
      const title = textValue(payload.title, "Remark title");
      const category = textValue(
        payload.category ?? "general",
        "Remark category",
      ).toLowerCase();
      if (
        ![
          "general",
          "attendance",
          "employee",
          "salary",
          "employer",
          "shift",
        ].includes(category)
      )
        throw new RequestError("Choose a supported remark category");
      const values = {
        vendorId,
        title,
        category,
        notes: optionalValue(payload.notes),
      };
      if (existingId) {
        const [existing] = await db
          .select()
          .from(payrollRemarks)
          .where(eq(payrollRemarks.id, existingId))
          .limit(1);
        if (!existing || existing.vendorId !== vendorId)
          throw new RequestError("Remark not found for this client", 404);
        await db
          .update(payrollRemarks)
          .set(values)
          .where(eq(payrollRemarks.id, existingId));
      } else {
        await db.insert(payrollRemarks).values({ id, ...values });
      }
      await writeAudit(
        db,
        existingId ? "remark_updated" : "remark_created",
        "remark",
        id,
        `${existingId ? "Updated" : "Added"} ${category} remark: ${title}`,
        actorEmail,
      );
    } else if (action === "advance-employee-workflow") {
      const employeeId = textValue(payload.employeeId, "Employee");
      const [record] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!record) throw new RequestError("Employee not found", 404);
      const transitions: Record<string, { next: string; roles: string[] }> = {
        field_hr_draft: {
          next: "field_hr_finalized",
          roles: ["field_hr", "hr_team", "super_admin"],
        },
        field_hr_finalized: {
          next: "payroll_processed",
          roles: ["payroll_team", "super_admin"],
        },
        payroll_processed: {
          next: "hr_manager_reviewed",
          roles: ["hr_team", "super_admin"],
        },
        hr_manager_reviewed: { next: "approved", roles: ["super_admin"] },
      };
      const transition = transitions[record.processingStage];
      if (!transition)
        throw new RequestError("Employee workflow is already approved", 409);
      if (!transition.roles.includes(access.profile.role))
        throw new RequestError(
          "This step requires the assigned hierarchy role",
          403,
        );
      await db
        .update(employees)
        .set({
          processingStage: transition.next,
          finalizedBy: actorEmail,
          finalizedAt: new Date().toISOString(),
        })
        .where(eq(employees.id, employeeId));
      await writeAudit(
        db,
        "employee_workflow_advanced",
        "employee",
        employeeId,
        `${record.name} moved to ${transition.next}`,
        actorEmail,
      );
    } else if (action === "mark-employee-left") {
      const employeeId = textValue(payload.employeeId, "Employee");
      const leftDate = dateValue(payload.leftDate, "Left date");
      const [record] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!record) throw new RequestError("Employee not found", 404);
      if (leftDate < record.dateOfJoining)
        throw new RequestError(
          "Left date cannot be earlier than the joining date",
        );
      await db
        .update(employees)
        .set({ status: "inactive", dateOfLeaving: leftDate })
        .where(eq(employees.id, employeeId));
      await updateUnitCount(db, record.clientUnitId);
      await writeAudit(
        db,
        "employee_left",
        "employee",
        employeeId,
        `Marked ${record.name} (${record.employeeCode}) as left on ${leftDate}; all history preserved`,
        actorEmail,
      );
    } else if (action === "reactivate-employee") {
      const employeeId = textValue(payload.employeeId, "Employee");
      const [record] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!record) throw new RequestError("Employee not found", 404);
      await db
        .update(employees)
        .set({ status: "active", dateOfLeaving: null })
        .where(eq(employees.id, employeeId));
      const [reactivated] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      const openRuns = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.clientUnitId, record.clientUnitId));
      for (const run of openRuns.filter(
        (candidate) => candidate.status !== "approved",
      )) {
        await addEmployeesToRun(db, run, [reactivated]);
        await recalculateRun(db, run.id, true);
      }
      await updateUnitCount(db, record.clientUnitId);
      await writeAudit(
        db,
        "employee_reactivated",
        "employee",
        employeeId,
        `Reactivated ${record.name} (${record.employeeCode})`,
        actorEmail,
      );
    } else if (action === "set-record-status") {
      const entityType = textValue(payload.entityType, "Record type");
      const entityId = textValue(payload.entityId, "Record");
      const status = textValue(payload.status, "Status");
      if (!["active", "inactive"].includes(status))
        throw new RequestError("Status must be active or inactive");
      if (entityType === "app_user") {
        const [record] = await db
          .select()
          .from(appUsers)
          .where(eq(appUsers.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("User profile not found", 404);
        if (
          record.email === access.identity.email.toLowerCase() &&
          status === "inactive"
        )
          throw new RequestError(
            "You cannot make your own Super Admin profile inactive",
            409,
          );
        if (
          record.role === "super_admin" &&
          record.status === "active" &&
          status === "inactive" &&
          (await activeSuperAdminCount(db, record.id)) === 0
        )
          throw new RequestError(
            "Create another active Super Admin before deactivating this profile",
            409,
          );
        await db
          .update(appUsers)
          .set({ status, updatedAt: new Date().toISOString() })
          .where(eq(appUsers.id, entityId));
        await writeAudit(
          db,
          `user_${status}`,
          "app_user",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} user ${record.email}`,
          actorEmail,
        );
      } else if (entityType === "client") {
        const [record] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Client not found", 404);
        await db
          .update(vendors)
          .set({ status })
          .where(eq(vendors.id, entityId));
        await writeAudit(
          db,
          `client_${status}`,
          "client",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} client ${record.name}`,
          actorEmail,
        );
      } else if (entityType === "unit") {
        const [record] = await db
          .select()
          .from(clientUnits)
          .where(eq(clientUnits.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Employer unit not found", 404);
        await db
          .update(clientUnits)
          .set({ status })
          .where(eq(clientUnits.id, entityId));
        await writeAudit(
          db,
          `unit_${status}`,
          "client_unit",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} employer unit ${record.clientName} · ${record.unitName}`,
          actorEmail,
        );
      } else if (entityType === "employee") {
        throw new RequestError(
          status === "inactive"
            ? "Use Put left date for employees."
            : "Use Reactivate employee to clear the left date.",
          409,
        );
      } else if (entityType === "accommodation_type") {
        const [record] = await db
          .select()
          .from(accommodationTypes)
          .where(eq(accommodationTypes.id, entityId))
          .limit(1);
        if (!record)
          throw new RequestError("Accommodation type not found", 404);
        if (status === "inactive") {
          const assigned = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
              and(
                eq(employees.vendorId, record.vendorId),
                eq(employees.accommodationType, record.name),
                eq(employees.status, "active"),
              ),
            )
            .limit(1);
          if (assigned.length)
            throw new RequestError(
              "Reassign active employees before deactivating this accommodation type",
              409,
            );
          await db
            .update(accommodationRooms)
            .set({ status: "inactive" })
            .where(eq(accommodationRooms.accommodationTypeId, record.id));
        }
        await db
          .update(accommodationTypes)
          .set({ status })
          .where(eq(accommodationTypes.id, entityId));
        await writeAudit(
          db,
          `accommodation_type_${status}`,
          "accommodation_type",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} accommodation type ${record.name}`,
          actorEmail,
        );
      } else if (entityType === "room") {
        const [record] = await db
          .select()
          .from(accommodationRooms)
          .where(eq(accommodationRooms.id, entityId))
          .limit(1);
        if (!record)
          throw new RequestError("Accommodation room not found", 404);
        if (status === "inactive") {
          const occupants = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
              and(
                eq(employees.roomId, record.id),
                eq(employees.status, "active"),
              ),
            )
            .limit(1);
          if (occupants.length)
            throw new RequestError(
              "Move all active employees before deactivating this room",
              409,
            );
        } else {
          const [type] = await db
            .select()
            .from(accommodationTypes)
            .where(eq(accommodationTypes.id, record.accommodationTypeId))
            .limit(1);
          if (!type || type.status !== "active")
            throw new RequestError(
              "Reactivate the accommodation type before reactivating this room",
              409,
            );
        }
        await db
          .update(accommodationRooms)
          .set({ status })
          .where(eq(accommodationRooms.id, entityId));
        await writeAudit(
          db,
          `room_${status}`,
          "room",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} room ${record.roomNumber}`,
          actorEmail,
        );
      } else if (entityType === "shift") {
        const [record] = await db
          .select()
          .from(shiftDefinitions)
          .where(eq(shiftDefinitions.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Shift not found", 404);
        if (status === "inactive") {
          const assigned = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
              and(
                eq(employees.vendorId, record.vendorId),
                eq(employees.defaultShift, record.name),
                eq(employees.status, "active"),
              ),
            );
          if (assigned.length) {
            const alternatives = await db
              .select()
              .from(shiftDefinitions)
              .where(
                and(
                  eq(shiftDefinitions.vendorId, record.vendorId),
                  eq(shiftDefinitions.status, "active"),
                ),
              );
            const replacement = alternatives.find(
              (shift) => shift.id !== record.id,
            );
            if (!replacement)
              throw new RequestError(
                "Create another active shift before deactivating a shift assigned to employees",
                409,
              );
            await db
              .update(employees)
              .set({ defaultShift: replacement.name })
              .where(
                and(
                  eq(employees.vendorId, record.vendorId),
                  eq(employees.defaultShift, record.name),
                  eq(employees.status, "active"),
                ),
              );
          }
        }
        await db
          .update(shiftDefinitions)
          .set({ status })
          .where(eq(shiftDefinitions.id, entityId));
        await writeAudit(
          db,
          `shift_${status}`,
          "shift",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} shift ${record.name}`,
          actorEmail,
        );
      } else if (entityType === "remark") {
        const [record] = await db
          .select()
          .from(payrollRemarks)
          .where(eq(payrollRemarks.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Remark not found", 404);
        await db
          .update(payrollRemarks)
          .set({ status })
          .where(eq(payrollRemarks.id, entityId));
        await writeAudit(
          db,
          `remark_${status}`,
          "remark",
          entityId,
          `${status === "active" ? "Reactivated" : "Made inactive"} remark ${record.title}`,
          actorEmail,
        );
      } else {
        throw new RequestError(`Unsupported record type: ${entityType}`);
      }
    } else if (action === "delete-record") {
      const entityType = textValue(payload.entityType, "Record type");
      const entityId = textValue(payload.entityId, "Record");
      if (entityType === "app_user") {
        const [record] = await db
          .select()
          .from(appUsers)
          .where(eq(appUsers.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("User profile not found", 404);
        if (record.email === access.identity.email.toLowerCase())
          throw new RequestError(
            "You cannot delete your own Super Admin profile",
            409,
          );
        if (
          record.role === "super_admin" &&
          record.status === "active" &&
          (await activeSuperAdminCount(db, record.id)) === 0
        )
          throw new RequestError(
            "Create another active Super Admin before deleting this profile",
            409,
          );
        await db.delete(appUsers).where(eq(appUsers.id, entityId));
        await writeAudit(
          db,
          "user_deleted",
          "app_user",
          entityId,
          `Deleted access profile ${record.email}`,
          actorEmail,
        );
      } else if (entityType === "employee") {
        throw new RequestError(
          "Employee records cannot be deleted. Enter a left date to preserve attendance and payroll history.",
          409,
        );
      } else if (entityType === "unit") {
        const [record] = await db
          .select()
          .from(clientUnits)
          .where(eq(clientUnits.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Employer unit not found", 404);
        const assigned = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.clientUnitId, entityId))
          .limit(1);
        const history = await db
          .select({ id: payrollRuns.id })
          .from(payrollRuns)
          .where(eq(payrollRuns.clientUnitId, entityId))
          .limit(1);
        if (assigned.length || history.length)
          throw new RequestError(
            "This employer unit has employees or payroll history. Remove those records first, or make the employer unit inactive.",
            409,
          );
        await db.delete(clientUnits).where(eq(clientUnits.id, entityId));
        await writeAudit(
          db,
          "unit_deleted",
          "client_unit",
          entityId,
          `Deleted employer unit ${record.clientName} · ${record.unitName}`,
          actorEmail,
        );
      } else if (entityType === "client") {
        const [record] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Client not found", 404);
        const units = await db
          .select({ id: clientUnits.id })
          .from(clientUnits)
          .where(eq(clientUnits.vendorId, entityId))
          .limit(1);
        if (units.length)
          throw new RequestError(
            "This client still has employer units. Delete the units first, or make the client inactive.",
            409,
          );
        const rooms = await db
          .select({ id: accommodationRooms.id })
          .from(accommodationRooms)
          .where(eq(accommodationRooms.vendorId, entityId));
        if (rooms.length) {
          const roomHistory = await db
            .select({ id: accommodationRoomExpenses.id })
            .from(accommodationRoomExpenses)
            .where(
              inArray(
                accommodationRoomExpenses.roomId,
                rooms.map((room) => room.id),
              ),
            )
            .limit(1);
          if (roomHistory.length)
            throw new RequestError(
              "This client has room expense history. Make the client inactive instead of deleting it.",
              409,
            );
          await db
            .delete(accommodationRooms)
            .where(eq(accommodationRooms.vendorId, entityId));
        }
        await db
          .delete(accommodationTypes)
          .where(eq(accommodationTypes.vendorId, entityId));
        await db
          .delete(payrollRules)
          .where(eq(payrollRules.vendorId, entityId));
        await db
          .delete(payrollRemarks)
          .where(eq(payrollRemarks.vendorId, entityId));
        await db
          .delete(shiftDefinitions)
          .where(eq(shiftDefinitions.vendorId, entityId));
        await db.delete(vendors).where(eq(vendors.id, entityId));
        await writeAudit(
          db,
          "client_deleted",
          "client",
          entityId,
          `Deleted client ${record.name}`,
          actorEmail,
        );
      } else if (entityType === "shift") {
        const [record] = await db
          .select()
          .from(shiftDefinitions)
          .where(eq(shiftDefinitions.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Shift not found", 404);
        const assigned = await db
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.vendorId, record.vendorId),
              eq(employees.defaultShift, record.name),
            ),
          );
        if (assigned.length) {
          const alternatives = await db
            .select()
            .from(shiftDefinitions)
            .where(
              and(
                eq(shiftDefinitions.vendorId, record.vendorId),
                eq(shiftDefinitions.status, "active"),
              ),
            );
          const replacement = alternatives.find(
            (shift) => shift.id !== record.id,
          );
          if (!replacement)
            throw new RequestError(
              "Create another active shift before deleting a shift assigned to employees",
              409,
            );
          await db
            .update(employees)
            .set({ defaultShift: replacement.name })
            .where(
              and(
                eq(employees.vendorId, record.vendorId),
                eq(employees.defaultShift, record.name),
              ),
            );
        }
        await db
          .delete(shiftDefinitions)
          .where(eq(shiftDefinitions.id, entityId));
        await writeAudit(
          db,
          "shift_deleted",
          "shift",
          entityId,
          `Deleted shift ${record.name}; existing attendance history was preserved`,
          actorEmail,
        );
      } else if (entityType === "remark") {
        const [record] = await db
          .select()
          .from(payrollRemarks)
          .where(eq(payrollRemarks.id, entityId))
          .limit(1);
        if (!record) throw new RequestError("Remark not found", 404);
        await db.delete(payrollRemarks).where(eq(payrollRemarks.id, entityId));
        await writeAudit(
          db,
          "remark_deleted",
          "remark",
          entityId,
          `Deleted ${record.category} remark ${record.title}`,
          actorEmail,
        );
      } else if (entityType === "accommodation_type") {
        const [record] = await db
          .select()
          .from(accommodationTypes)
          .where(eq(accommodationTypes.id, entityId))
          .limit(1);
        if (!record)
          throw new RequestError("Accommodation type not found", 404);
        const rooms = await db
          .select({ id: accommodationRooms.id })
          .from(accommodationRooms)
          .where(eq(accommodationRooms.accommodationTypeId, entityId))
          .limit(1);
        const assigned = await db
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.vendorId, record.vendorId),
              eq(employees.accommodationType, record.name),
            ),
          )
          .limit(1);
        if (rooms.length || assigned.length)
          throw new RequestError(
            "Remove related rooms and employee assignments before deleting this accommodation type",
            409,
          );
        await db
          .delete(accommodationTypes)
          .where(eq(accommodationTypes.id, entityId));
        await writeAudit(
          db,
          "accommodation_type_deleted",
          "accommodation_type",
          entityId,
          `Deleted accommodation type ${record.name}`,
          actorEmail,
        );
      } else if (entityType === "room") {
        const [record] = await db
          .select()
          .from(accommodationRooms)
          .where(eq(accommodationRooms.id, entityId))
          .limit(1);
        if (!record)
          throw new RequestError("Accommodation room not found", 404);
        const occupants = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.roomId, entityId))
          .limit(1);
        const history = await db
          .select({ id: accommodationRoomExpenses.id })
          .from(accommodationRoomExpenses)
          .where(eq(accommodationRoomExpenses.roomId, entityId))
          .limit(1);
        if (occupants.length || history.length)
          throw new RequestError(
            "Remove employee allocations and expense history before deleting this room; otherwise deactivate it",
            409,
          );
        await db
          .delete(accommodationRooms)
          .where(eq(accommodationRooms.id, entityId));
        await writeAudit(
          db,
          "room_deleted",
          "room",
          entityId,
          `Deleted accommodation room ${record.roomNumber}`,
          actorEmail,
        );
      } else {
        throw new RequestError(`Unsupported record type: ${entityType}`);
      }
    } else if (action === "create-run") {
      const vendorId = textValue(payload.vendorId, "Payroll entity");
      const unitId = textValue(payload.unitId, "Client unit");
      const period = periodValue(payload.payPeriod);
      const existing = await db
        .select()
        .from(payrollRuns)
        .where(
          and(
            eq(payrollRuns.clientUnitId, unitId),
            eq(payrollRuns.payPeriod, period),
          ),
        )
        .limit(1);
      if (existing.length)
        throw new RequestError(
          `A payroll run already exists for ${period}`,
          409,
        );
      const [unit] = await db
        .select()
        .from(clientUnits)
        .where(
          and(eq(clientUnits.id, unitId), eq(clientUnits.vendorId, vendorId)),
        )
        .limit(1);
      if (!unit) throw new RequestError("Employer unit not found", 404);
      const cycle = unitCycleRange(
        period,
        unit.attendanceCycleStartDay,
        unit.attendanceCycleEndDay,
      );
      const options = {
        ...payload,
        periodStart: payload.periodStart || cycle.periodStart,
        periodEnd: payload.periodEnd || cycle.periodEnd,
        workingDays: payload.workingDays || unit.attendanceWorkingDays,
      };
      const run = await createRun(db, vendorId, unitId, period, options);
      runId = run.id;
      await writeAudit(
        db,
        "run_created",
        "payroll_run",
        run.id,
        `Created ${period} payroll (${run.periodStart} to ${run.periodEnd}; ${run.workingDays} working days) with ${run.employeeCount} employees`,
        actorEmail,
      );
    } else if (action === "update-run-period") {
      const run = await requireRun(db, runId, true);
      const values = runPeriodValues(run.payPeriod, payload, run.workingDays);
      await db
        .update(payrollRuns)
        .set({ ...values, updatedAt: new Date().toISOString() })
        .where(eq(payrollRuns.id, run.id));
      await recalculateRun(db, run.id, true);
      await writeAudit(
        db,
        "payroll_period_updated",
        "payroll_run",
        run.id,
        `Updated payroll period to ${values.periodStart}–${values.periodEnd} with ${values.workingDays} working days`,
        actorEmail,
      );
    } else if (action === "save-attendance") {
      const run = await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const attendanceDate = textValue(
        payload.attendanceDate,
        "Attendance date",
      );
      const { start, end } = periodRange(
        run.payPeriod,
        run.periodStart,
        run.periodEnd,
      );
      if (attendanceDate < start || attendanceDate >= end)
        throw new RequestError(
          "Attendance date must belong to the selected custom payroll period",
        );
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee || employee.clientUnitId !== run.clientUnitId)
        throw new RequestError(
          "Employee does not belong to this payroll run",
          404,
        );
      const statusCode = textValue(
        payload.statusCode,
        "Attendance status",
      ).toUpperCase();
      if (
        !ATTENDANCE_CODES.includes(
          statusCode as (typeof ATTENDANCE_CODES)[number],
        )
      )
        throw new RequestError("Unsupported attendance status");
      if (employee.status !== "active")
        throw new RequestError(
          "Reactivate the employee before recording attendance",
          409,
        );
      const shiftCode =
        optionalValue(payload.shiftCode) ?? employee.defaultShift;
      const [shift] = await db
        .select()
        .from(shiftDefinitions)
        .where(
          and(
            eq(shiftDefinitions.vendorId, employee.vendorId),
            eq(shiftDefinitions.name, shiftCode),
          ),
        )
        .limit(1);
      const punchIn = optionalValue(payload.punchIn),
        punchOut = optionalValue(payload.punchOut);
      const minutes = (value: string) =>
        Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
      let workedMinutes = 0,
        deductionMinutes = 0;
      if (shift && punchIn && punchOut) {
        const start = minutes(shift.startTime),
          actualIn = minutes(punchIn);
        let end = minutes(shift.endTime),
          actualOut = minutes(punchOut);
        if (end <= start) end += 1440;
        if (actualOut <= actualIn) actualOut += 1440;
        workedMinutes = Math.max(0, actualOut - actualIn - shift.breakMinutes);
        if (actualIn - start > shift.lateGraceMinutes)
          deductionMinutes += shift.lateDeductionMinutes;
        if (end - actualOut > shift.earlyGraceMinutes)
          deductionMinutes += shift.earlyDeductionMinutes;
        if (workedMinutes < shift.requiredWorkMinutes)
          deductionMinutes += shift.requiredWorkMinutes - workedMinutes;
      }
      const requestedOt = positiveValue(
        payload.overtimeHours,
        "Overtime hours",
        24,
      );
      const overtimeHours =
        shift?.otMode === "fixed" ? shift.fixedOtHours : requestedOt;
      const values = {
        statusCode,
        shiftCode,
        punchIn,
        punchOut,
        workedHours: roundMoney(workedMinutes / 60),
        deductionHours: roundMoney(deductionMinutes / 60),
        overtimeHours,
        remarks: optionalValue(payload.remarks),
        source: "manual",
        updatedBy: actorEmail,
        updatedAt: new Date().toISOString(),
      };
      const [existing] = await db
        .select()
        .from(attendanceEntries)
        .where(
          and(
            eq(attendanceEntries.employeeId, employeeId),
            eq(attendanceEntries.attendanceDate, attendanceDate),
          ),
        )
        .limit(1);
      if (existing)
        await db
          .update(attendanceEntries)
          .set(values)
          .where(eq(attendanceEntries.id, existing.id));
      else
        await db
          .insert(attendanceEntries)
          .values({ employeeId, attendanceDate, ...values });
      await recalculateRun(db, runId, true);
      await writeAudit(
        db,
        "attendance_saved",
        "attendance",
        employeeId,
        `Updated ${employee.employeeCode} attendance on ${attendanceDate} to ${statusCode}`,
        actorEmail,
      );
    } else if (action === "delete-attendance") {
      const run = await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const attendanceDate = textValue(
        payload.attendanceDate,
        "Attendance date",
      );
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee || employee.clientUnitId !== run.clientUnitId)
        throw new RequestError(
          "Employee does not belong to this payroll run",
          404,
        );
      await db
        .delete(attendanceEntries)
        .where(
          and(
            eq(attendanceEntries.employeeId, employeeId),
            eq(attendanceEntries.attendanceDate, attendanceDate),
          ),
        );
      await recalculateRun(db, runId, true);
      await writeAudit(
        db,
        "attendance_deleted",
        "attendance",
        employeeId,
        `Deleted ${employee.employeeCode} attendance on ${attendanceDate}`,
        actorEmail,
      );
    } else if (action === "save-payroll-item") {
      await requireRun(db, runId, true);
      const itemId = textValue(payload.itemId, "Employee salary record");
      const [item] = await db
        .select()
        .from(payrollItems)
        .where(and(eq(payrollItems.id, itemId), eq(payrollItems.runId, runId)))
        .limit(1);
      if (!item) throw new RequestError("Salary record not found", 404);
      await requirePayrollItemPaymentUnlocked(db, runId, item.id);
      const fields =
        typeof payload.fields === "object" && payload.fields !== null
          ? (payload.fields as Record<string, unknown>)
          : {};
      const update: Record<string, number> = {};
      for (const field of [...earningFields, ...deductionFields])
        if (Object.hasOwn(fields, field))
          update[field] = positiveValue(fields[field], field);
      for (const field of [
        "presentDays",
        "payableDays",
        "overtimeHours",
        "fixedWorkingDays",
        "nfhDays",
        "compOffDays",
        "onDutyDays",
        "sundayDays",
        "plDays",
        "clDays",
        "slDays",
      ] as const)
        if (Object.hasOwn(fields, field))
          update[field] = positiveValue(fields[field], field);
      const totals = payrollTotals({ ...item, ...update });
      await db
        .update(payrollItems)
        .set({
          ...update,
          grossEarnings: totals.grossEarnings,
          totalDeductions: totals.totalDeductions,
          netPayable: totals.netPayable,
        })
        .where(eq(payrollItems.id, itemId));
      await recalculateRun(db, runId, false);
      await writeAudit(
        db,
        "salary_updated",
        "payroll_item",
        itemId,
        "Updated employee earnings and deductions",
        actorEmail,
      );
    } else if (action === "save-recovery-entry") {
      const run = await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const [finalized] = await db
        .select()
        .from(recoveryFinalizations)
        .where(
          and(
            eq(recoveryFinalizations.runId, runId),
            eq(recoveryFinalizations.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (finalized)
        throw new RequestError(
          "Reopen this employee recovery before adding or editing deductions",
          409,
        );
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee || employee.clientUnitId !== run.clientUnitId)
        throw new RequestError("Employee not found in this payroll unit", 404);
      const recoveryDate = dateValue(payload.recoveryDate, "Recovery date");
      const { start, end } = periodRange(
        run.payPeriod,
        run.periodStart,
        run.periodEnd,
      );
      if (recoveryDate < start || recoveryDate >= end)
        throw new RequestError(
          `Recovery date must be inside the salary cycle ${start} to ${new Date(new Date(`${end}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)}`,
        );
      const recoveryType = textValue(payload.recoveryType, "Recovery type");
      if (
        !datedRecoveryFields.includes(
          recoveryType as (typeof datedRecoveryFields)[number],
        )
      )
        throw new RequestError("Unsupported recovery type");
      const amount = positiveValue(payload.amount, "Recovery amount");
      if (amount <= 0)
        throw new RequestError("Recovery amount must be greater than zero");
      const id = `REC-${crypto.randomUUID()}`;
      await db
        .insert(recoveryEntries)
        .values({
          id,
          runId,
          employeeId,
          recoveryDate,
          recoveryType,
          amount,
          reference: optionalValue(payload.reference),
          notes: optionalValue(payload.notes),
          createdBy: actorEmail,
        });
      await syncDatedRecoveries(db, runId, employeeId);
      await writeAudit(
        db,
        "recovery_added",
        "employee",
        employeeId,
        `Added ${recoveryType} recovery ₹${amount.toFixed(2)} for ${employee.employeeCode} on ${recoveryDate}`,
        actorEmail,
      );
    } else if (action === "delete-recovery-entry") {
      await requireRun(db, runId, true);
      const recoveryId = textValue(payload.recoveryId, "Recovery entry");
      const [entry] = await db
        .select()
        .from(recoveryEntries)
        .where(
          and(
            eq(recoveryEntries.id, recoveryId),
            eq(recoveryEntries.runId, runId),
          ),
        )
        .limit(1);
      if (!entry) throw new RequestError("Recovery entry not found", 404);
      const [finalized] = await db
        .select()
        .from(recoveryFinalizations)
        .where(
          and(
            eq(recoveryFinalizations.runId, runId),
            eq(recoveryFinalizations.employeeId, entry.employeeId),
          ),
        )
        .limit(1);
      if (finalized)
        throw new RequestError(
          "Reopen this employee recovery before deleting deductions",
          409,
        );
      await db
        .delete(recoveryEntries)
        .where(eq(recoveryEntries.id, recoveryId));
      await syncDatedRecoveries(db, runId, entry.employeeId);
      await writeAudit(
        db,
        "recovery_deleted",
        "employee",
        entry.employeeId,
        `Deleted dated ${entry.recoveryType} recovery`,
        actorEmail,
      );
    } else if (action === "finalize-employee-recovery") {
      if (
        !access.profile.canApprovePayroll &&
        access.profile.role !== "super_admin"
      )
        throw new RequestError(
          "Final recovery approval requires Super Admin or authorised approval access",
          403,
        );
      const run = await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee || employee.clientUnitId !== run.clientUnitId)
        throw new RequestError("Employee not found in this payroll unit", 404);

      // Room recovery drafts belong to the room/month ledger. Allocate them
      // before employee finalization so the applicable occupant receives the
      // gas, ration and provision shares in this deduction voucher.
      if (employee.roomId) {
        const [draftRoomExpense] = await db
          .select({ id: accommodationRoomExpenses.id })
          .from(accommodationRoomExpenses)
          .where(
            and(
              eq(accommodationRoomExpenses.roomId, employee.roomId),
              eq(accommodationRoomExpenses.payPeriod, run.payPeriod),
              eq(accommodationRoomExpenses.status, "draft"),
            ),
          )
          .limit(1);
        if (draftRoomExpense) {
          const roomResult = await finalizeRoomExpense(
            db,
            draftRoomExpense.id,
            access,
          );
          await writeAudit(
            db,
            "room_expense_auto_finalized",
            "room",
            roomResult.room.id,
            `Allocated room-wise recovery before finalizing ${employee.employeeCode}`,
            actorEmail,
          );
        }
      }

      const entries = await db
        .select()
        .from(recoveryEntries)
        .where(
          and(
            eq(recoveryEntries.runId, runId),
            eq(recoveryEntries.employeeId, employeeId),
          ),
        );
      const [charge] = await db
        .select()
        .from(accommodationCharges)
        .where(
          and(
            eq(accommodationCharges.runId, runId),
            eq(accommodationCharges.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (!entries.length && !charge)
        throw new RequestError(
          "Add at least one recovery before finalizing",
          409,
        );
      const voucherNumber = `DRV-${run.payPeriod.replace("-", "")}-${employee.employeeCode}`;
      const [existing] = await db
        .select()
        .from(recoveryFinalizations)
        .where(
          and(
            eq(recoveryFinalizations.runId, runId),
            eq(recoveryFinalizations.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (!existing)
        await db
          .insert(recoveryFinalizations)
          .values({
            id: `RECFIN-${crypto.randomUUID()}`,
            runId,
            employeeId,
            voucherNumber,
            finalizedBy: actorEmail,
            finalizedAt: new Date().toISOString(),
          });
      await writeAudit(
        db,
        "recovery_finalized",
        "employee",
        employeeId,
        `Finalized deductions and generated voucher ${voucherNumber}`,
        actorEmail,
      );
    } else if (action === "reopen-employee-recovery") {
      if (
        !access.profile.canApprovePayroll &&
        access.profile.role !== "super_admin"
      )
        throw new RequestError(
          "Recovery reopening requires Super Admin or authorised approval access",
          403,
        );
      const employeeId = textValue(payload.employeeId, "Employee");
      await db
        .delete(recoveryFinalizations)
        .where(
          and(
            eq(recoveryFinalizations.runId, runId),
            eq(recoveryFinalizations.employeeId, employeeId),
          ),
        );
      await writeAudit(
        db,
        "recovery_reopened",
        "employee",
        employeeId,
        "Reopened finalized employee deductions for correction",
        actorEmail,
      );
    } else if (action === "save-accommodation") {
      const run = await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee || employee.clientUnitId !== run.clientUnitId)
        throw new RequestError("Employee not found in this unit", 404);
      const fields =
        typeof payload.fields === "object" && payload.fields !== null
          ? (payload.fields as Record<string, unknown>)
          : {};
      const numericFields = [
        "idCard",
        "rent",
        "bus",
        "medical",
        "ticket",
        "shoe",
        "advance",
        "food",
        "aadhaarUpdate",
        "bankAccountCharge",
        "tshirt",
        "oldPending",
        "gasShare",
        "rationShare",
        "provisionShare",
        "returnAmount",
      ] as const;
      const values: Record<string, string | number | null> = {
        roomNumber: optionalValue(fields.roomNumber) ?? employee.roomNumber,
      };
      for (const field of numericFields)
        values[field] = positiveValue(fields[field], field);
      const [existing] = await db
        .select()
        .from(accommodationCharges)
        .where(
          and(
            eq(accommodationCharges.runId, runId),
            eq(accommodationCharges.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (existing?.roomExpenseId) {
        values.gasShare = existing.gasShare;
        values.rationShare = existing.rationShare;
        values.provisionShare = existing.provisionShare;
      }
      if (existing)
        await db
          .update(accommodationCharges)
          .set(values)
          .where(eq(accommodationCharges.id, existing.id));
      else
        await db
          .insert(accommodationCharges)
          .values({ runId, employeeId, ...values });
      await recalculateRun(db, runId, false);
      await writeAudit(
        db,
        "accommodation_updated",
        "employee",
        employeeId,
        `Updated accommodation recoveries for ${employee.employeeCode}`,
        actorEmail,
      );
    } else if (action === "delete-accommodation") {
      await requireRun(db, runId, true);
      const employeeId = textValue(payload.employeeId, "Employee");
      const [existing] = await db
        .select()
        .from(accommodationCharges)
        .where(
          and(
            eq(accommodationCharges.runId, runId),
            eq(accommodationCharges.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (existing?.roomExpenseId)
        throw new RequestError(
          "Reopen the finalized room expense before deleting this employee's recovery",
          409,
        );
      await db
        .delete(accommodationCharges)
        .where(
          and(
            eq(accommodationCharges.runId, runId),
            eq(accommodationCharges.employeeId, employeeId),
          ),
        );
      await db
        .update(payrollItems)
        .set({ accommodationDeduction: 0, returnAmount: 0 })
        .where(
          and(
            eq(payrollItems.runId, runId),
            eq(payrollItems.employeeId, employeeId),
          ),
        );
      await recalculateRun(db, runId, false);
      await writeAudit(
        db,
        "accommodation_deleted",
        "employee",
        employeeId,
        "Deleted accommodation recoveries",
        actorEmail,
      );
    } else if (
      action === "prepare-payroll-batch" ||
      action === "prepare-payroll-batches"
    ) {
      const run = await requireRun(db, runId);
      const rows = await db
        .select({
          employeeId: payrollItems.employeeId,
          accommodationType: employees.accommodationType,
          grossEarnings: payrollItems.grossEarnings,
          netPayable: payrollItems.netPayable,
        })
        .from(payrollItems)
        .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
        .where(eq(payrollItems.runId, run.id));
      const types =
        action === "prepare-payroll-batch"
          ? [
              normalizeAccommodationType(
                textValue(payload.accommodationType, "Accommodation type"),
              ),
            ]
          : [...new Set(rows.map((row) => row.accommodationType))].sort();
      if (!types.length)
        throw new RequestError(
          "Add employees before preparing accommodation-wise payroll batches",
          409,
        );
      let prepared = 0;
      for (const accommodationType of types) {
        const grouped = rows.filter(
          (row) => row.accommodationType === accommodationType,
        );
        if (!grouped.length)
          throw new RequestError(
            `No payroll employees are assigned to ${accommodationType}`,
            409,
          );
        const [existing] = await db
          .select()
          .from(payrollBatches)
          .where(
            and(
              eq(payrollBatches.runId, run.id),
              eq(payrollBatches.accommodationType, accommodationType),
            ),
          )
          .limit(1);
        if (existing?.status === "cleared") {
          if (action === "prepare-payroll-batch")
            throw new RequestError(
              "This accommodation payroll batch has already been payment-cleared",
              409,
            );
          continue;
        }
        const now = new Date().toISOString();
        const values = {
          employeeCount: grouped.length,
          grossEarnings: roundMoney(
            grouped.reduce((sum, row) => sum + row.grossEarnings, 0),
          ),
          netPayable: roundMoney(
            grouped.reduce((sum, row) => sum + row.netPayable, 0),
          ),
          status: "prepared",
          preparedBy: actorEmail,
          preparedAt: now,
          updatedAt: now,
        };
        if (existing)
          await db
            .update(payrollBatches)
            .set(values)
            .where(eq(payrollBatches.id, existing.id));
        else
          await db
            .insert(payrollBatches)
            .values({
              id: `BATCH-${crypto.randomUUID()}`,
              runId: run.id,
              accommodationType,
              ...values,
            });
        prepared += 1;
      }
      await writeAudit(
        db,
        "payroll_batches_prepared",
        "payroll_run",
        run.id,
        `Prepared ${prepared} accommodation-wise payroll batch${prepared === 1 ? "" : "es"}`,
        actorEmail,
      );
    } else if (
      action === "clear-payroll-batch" ||
      action === "reopen-payroll-batch"
    ) {
      const run = await requireRun(db, runId);
      const batchId = textValue(payload.batchId, "Payroll batch");
      const [batch] = await db
        .select()
        .from(payrollBatches)
        .where(
          and(eq(payrollBatches.id, batchId), eq(payrollBatches.runId, run.id)),
        )
        .limit(1);
      if (!batch)
        throw new RequestError("Accommodation payroll batch not found", 404);
      if (action === "clear-payroll-batch") {
        if (run.status !== "approved")
          throw new RequestError(
            "Approve the payroll run before clearing an accommodation payment batch",
            409,
          );
        if (batch.status === "cleared")
          throw new RequestError(
            "This payment batch has already been cleared",
            409,
          );
        if (!batch.employeeCount)
          throw new RequestError("This payment batch has no employees", 409);
        await db
          .update(payrollBatches)
          .set({
            status: "cleared",
            paymentReference: optionalValue(payload.paymentReference),
            clearedBy: actorEmail,
            clearedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(payrollBatches.id, batch.id));
        await writeAudit(
          db,
          "payroll_batch_cleared",
          "payroll_batch",
          batch.id,
          `Cleared ${batch.accommodationType} payment batch for ${batch.employeeCount} employees`,
          actorEmail,
        );
      } else {
        if (batch.status !== "cleared")
          throw new RequestError(
            "Only a cleared payment batch can be reopened",
            409,
          );
        await db
          .update(payrollBatches)
          .set({
            status: "prepared",
            paymentReference: null,
            clearedBy: null,
            clearedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(payrollBatches.id, batch.id));
        await writeAudit(
          db,
          "payroll_batch_reopened",
          "payroll_batch",
          batch.id,
          `Reopened ${batch.accommodationType} payment clearance`,
          actorEmail,
        );
      }
    } else if (action === "save-hostel") {
      const vendorId = textValue(payload.vendorId, "Client");
      const id = optionalValue(payload.id) ?? `HOSTEL-${crypto.randomUUID()}`;
      const accommodationTypeId = textValue(
        payload.accommodationTypeId,
        "Accommodation type",
      );
      const [hostelType] = await db
        .select()
        .from(accommodationTypes)
        .where(eq(accommodationTypes.id, accommodationTypeId))
        .limit(1);
      if (!hostelType || hostelType.vendorId !== vendorId)
        throw new RequestError(
          "Select an accommodation type from this client",
          409,
        );
      const clientScope = Array.isArray(payload.clientScope)
        ? payload.clientScope.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const validUnits = await db
        .select({ id: clientUnits.id })
        .from(clientUnits);
      const validIds = new Set(validUnits.map((unit) => unit.id));
      if (clientScope.some((unitId) => !validIds.has(unitId)))
        throw new RequestError(
          "Hostel client mapping contains an invalid client unit",
          409,
        );
      const values = {
        vendorId,
        accommodationTypeId,
        name: textValue(payload.name, "Hostel name"),
        address: optionalValue(payload.address),
        inchargeName: optionalValue(payload.inchargeName),
        ebMeterNumber: optionalValue(payload.ebMeterNumber),
        clientScopeJson: JSON.stringify(clientScope),
        remarks: optionalValue(payload.remarks),
      };
      const [existing] = await db
        .select()
        .from(hostels)
        .where(eq(hostels.id, id))
        .limit(1);
      if (existing)
        await db.update(hostels).set(values).where(eq(hostels.id, id));
      else await db.insert(hostels).values({ id, ...values });
    } else if (action === "delete-hostel") {
      const id = textValue(payload.id, "Hostel");
      const [hostel] = await db
        .select()
        .from(hostels)
        .where(eq(hostels.id, id))
        .limit(1);
      if (!hostel) throw new RequestError("Hostel / local area not found", 404);
      const linkedRooms = await db
        .select({ id: accommodationRooms.id })
        .from(accommodationRooms)
        .where(eq(accommodationRooms.hostelId, id));
      const history = await db
        .select({ id: hostelUtilityReadings.id })
        .from(hostelUtilityReadings)
        .where(eq(hostelUtilityReadings.hostelId, id));
      if (linkedRooms.length || history.length)
        throw new RequestError(
          "Remove or remap all rooms and preserve/clear hostel history before deleting this record",
          409,
        );
      await db.delete(hostels).where(eq(hostels.id, id));
      await writeAudit(
        db,
        "hostel_deleted",
        "hostel",
        id,
        `Deleted unused hostel / local area ${hostel.name}`,
        actorEmail,
      );
    } else if (action === "assign-room-hostel") {
      const roomId = textValue(payload.roomId, "Room");
      const hostelId = textValue(payload.hostelId, "Hostel");
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, roomId))
        .limit(1);
      const [hostel] = await db
        .select()
        .from(hostels)
        .where(eq(hostels.id, hostelId))
        .limit(1);
      const [roomType] = room
        ? await db
            .select()
            .from(accommodationTypes)
            .where(eq(accommodationTypes.id, room.accommodationTypeId))
            .limit(1)
        : [];
      const [hostelType] = hostel?.accommodationTypeId
        ? await db
            .select()
            .from(accommodationTypes)
            .where(eq(accommodationTypes.id, hostel.accommodationTypeId))
            .limit(1)
        : [];
      const sharedJoyMapping = Boolean(
        roomType &&
          hostelType &&
          isJoySharedAccommodation(roomType.name) &&
          isJoySharedAccommodation(hostelType.name),
      );
      if (
        !room ||
        !hostel ||
        ((room.vendorId !== hostel.vendorId ||
          room.accommodationTypeId !== hostel.accommodationTypeId) &&
          !sharedJoyMapping)
      )
        throw new RequestError(
          "Room and hostel must use the same accommodation type",
          409,
        );
      await db
        .update(accommodationRooms)
        .set({ hostelId })
        .where(eq(accommodationRooms.id, roomId));
    } else if (action === "save-hostel-utility") {
      const hostelId = textValue(payload.hostelId, "Hostel");
      const readingDate = dateValue(payload.readingDate, "Reading date");
      const utilityType = textValue(payload.utilityType, "Utility type");
      if (
        !["eb", "water", "payment", "housekeeping", "other"].includes(
          utilityType,
        )
      )
        throw new RequestError("Unsupported hostel utility type");
      const readingValue = positiveValue(payload.readingValue ?? 0, "Reading");
      const [previous] = await db
        .select()
        .from(hostelUtilityReadings)
        .where(
          and(
            eq(hostelUtilityReadings.hostelId, hostelId),
            eq(hostelUtilityReadings.utilityType, utilityType),
            lt(hostelUtilityReadings.readingDate, readingDate),
          ),
        )
        .orderBy(desc(hostelUtilityReadings.readingDate))
        .limit(1);
      if (
        previous &&
        utilityType === "eb" &&
        readingValue < previous.readingValue
      )
        throw new RequestError("Reading cannot be below the previous reading");
      await db
        .insert(hostelUtilityReadings)
        .values({
          id: `HUTIL-${crypto.randomUUID()}`,
          hostelId,
          readingDate,
          utilityType,
          readingValue,
          consumption:
            previous && utilityType === "eb"
              ? roundMoney(readingValue - previous.readingValue)
              : 0,
          tankerQuantity: positiveValue(
            payload.tankerQuantity ?? 0,
            "Water quantity",
          ),
          amount: positiveValue(payload.amount ?? 0, "Paid amount"),
          activityName: optionalValue(payload.activityName),
          remarks: optionalValue(payload.remarks),
          enteredBy: actorEmail,
          status: "draft",
        });
    } else if (action === "approve-hostel-utility") {
      if (
        !access.profile.canApprovePayroll &&
        access.profile.role !== "hr_team"
      )
        throw new RequestError(
          "HR Manager or Super Admin approval is required",
          403,
        );
      const id = textValue(payload.id, "Reading");
      await db
        .update(hostelUtilityReadings)
        .set({
          status: "approved",
          approvedBy: actorEmail,
          approvedAt: new Date().toISOString(),
        })
        .where(eq(hostelUtilityReadings.id, id));
    } else if (action === "save-vehicle") {
      const vendorId = textValue(payload.vendorId, "Joy company");
      const id = optionalValue(payload.id) ?? `VEH-${crypto.randomUUID()}`;
      const values = {
        vendorId,
        registrationNumber: textValue(
          payload.registrationNumber,
          "Registration number",
        ).toUpperCase(),
        vehicleName: textValue(payload.vehicleName, "Vehicle name"),
        vehicleType: optionalValue(payload.vehicleType) ?? "car",
        currentOdometer: positiveValue(
          payload.currentOdometer ?? 0,
          "Current odometer",
        ),
        permitExpiry: optionalValue(payload.permitExpiry),
        insuranceExpiry: optionalValue(payload.insuranceExpiry),
        fcExpiry: optionalValue(payload.fcExpiry),
        pollutionExpiry: optionalValue(payload.pollutionExpiry),
        nextServiceDate: optionalValue(payload.nextServiceDate),
        nextServiceKm: payload.nextServiceKm
          ? positiveValue(payload.nextServiceKm, "Next service km")
          : null,
        tyreChangedDate: optionalValue(payload.tyreChangedDate),
        tyreChangedKm: payload.tyreChangedKm
          ? positiveValue(payload.tyreChangedKm, "Tyre changed km")
          : null,
        lastWaterWashDate: optionalValue(payload.lastWaterWashDate),
        lastWheelAlignmentDate: optionalValue(payload.lastWheelAlignmentDate),
        remarks: optionalValue(payload.remarks),
      };
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, id))
        .limit(1);
      if (existing)
        await db.update(vehicles).set(values).where(eq(vehicles.id, id));
      else await db.insert(vehicles).values({ id, ...values });
      await writeAudit(
        db,
        existing ? "vehicle_updated" : "vehicle_created",
        "vehicle",
        id,
        `${existing ? "Updated" : "Added"} vehicle ${values.registrationNumber}`,
        actorEmail,
      );
    } else if (action === "save-vehicle-record") {
      const vehicleId = textValue(payload.vehicleId, "Vehicle");
      const [vehicle] = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId))
        .limit(1);
      if (!vehicle) throw new RequestError("Vehicle not found", 404);
      const id = optionalValue(payload.id) ?? `VREC-${crypto.randomUUID()}`;
      const startKm = payload.startKm
        ? positiveValue(payload.startKm, "Start km")
        : null;
      const endKm = payload.endKm
        ? positiveValue(payload.endKm, "End km")
        : null;
      if (startKm !== null && endKm !== null && endKm < startKm)
        throw new RequestError("End km cannot be below start km");
      const values = {
        vehicleId,
        recordDate: dateValue(payload.recordDate, "Record date"),
        recordType: textValue(payload.recordType, "Record type"),
        tripFrom: optionalValue(payload.tripFrom),
        tripTo: optionalValue(payload.tripTo),
        purpose: optionalValue(payload.purpose),
        startKm,
        endKm,
        litres: positiveValue(payload.litres ?? 0, "Litres"),
        amount: positiveValue(payload.amount ?? 0, "Amount"),
        vendorName: optionalValue(payload.vendorName),
        nextDueDate: optionalValue(payload.nextDueDate),
        nextDueKm: payload.nextDueKm
          ? positiveValue(payload.nextDueKm, "Next due km")
          : null,
        remarks: optionalValue(payload.remarks),
        enteredBy: actorEmail,
        status: "draft",
      };
      await db.insert(vehicleRecords).values({ id, ...values });
      if (endKm !== null && endKm > vehicle.currentOdometer)
        await db
          .update(vehicles)
          .set({ currentOdometer: endKm })
          .where(eq(vehicles.id, vehicleId));
      await writeAudit(
        db,
        "vehicle_record_created",
        "vehicle_record",
        id,
        `Added ${values.recordType} record for ${vehicle.registrationNumber}`,
        actorEmail,
      );
    } else if (action === "save-utility-meter") {
      const vendorId = textValue(payload.vendorId, "Joy company");
      const id = optionalValue(payload.id) ?? `METER-${crypto.randomUUID()}`;
      const values = {
        vendorId,
        locationType: payload.locationType === "office" ? "office" : "hostel",
        locationName: textValue(payload.locationName, "Location name"),
        meterNumber: optionalValue(payload.meterNumber),
        remarks: optionalValue(payload.remarks),
      };
      const [existing] = await db
        .select()
        .from(utilityMeters)
        .where(eq(utilityMeters.id, id))
        .limit(1);
      if (existing)
        await db
          .update(utilityMeters)
          .set(values)
          .where(eq(utilityMeters.id, id));
      else await db.insert(utilityMeters).values({ id, ...values });
    } else if (action === "save-eb-reading") {
      const meterId = textValue(payload.meterId, "EB meter");
      const [meter] = await db
        .select()
        .from(utilityMeters)
        .where(eq(utilityMeters.id, meterId))
        .limit(1);
      if (!meter) throw new RequestError("EB meter not found", 404);
      const readingDate = dateValue(payload.readingDate, "Reading date");
      const readingValue = positiveValue(payload.readingValue, "Meter reading");
      const [previous] = await db
        .select()
        .from(ebReadings)
        .where(
          and(
            eq(ebReadings.meterId, meterId),
            lt(ebReadings.readingDate, readingDate),
          ),
        )
        .orderBy(desc(ebReadings.readingDate))
        .limit(1);
      if (previous && readingValue < previous.readingValue)
        throw new RequestError("Reading cannot be below the previous reading");
      await db
        .insert(ebReadings)
        .values({
          id: `EB-${crypto.randomUUID()}`,
          meterId,
          readingDate,
          readingValue,
          unitsConsumed: previous
            ? roundMoney(readingValue - previous.readingValue)
            : 0,
          amount: positiveValue(payload.amount ?? 0, "EB amount"),
          remarks: optionalValue(payload.remarks),
          enteredBy: actorEmail,
          status: "draft",
        });
    } else if (action === "approve-operation-record") {
      if (
        !access.profile.canApprovePayroll &&
        access.profile.role !== "hr_team"
      )
        throw new RequestError(
          "HR Manager or Super Admin approval is required",
          403,
        );
      const recordType = textValue(payload.recordType, "Record type");
      const id = textValue(payload.id, "Record");
      const approval = {
        status: "approved",
        approvedBy: actorEmail,
        approvedAt: new Date().toISOString(),
      };
      if (recordType === "vehicle")
        await db
          .update(vehicleRecords)
          .set(approval)
          .where(eq(vehicleRecords.id, id));
      else if (recordType === "eb")
        await db.update(ebReadings).set(approval).where(eq(ebReadings.id, id));
      else throw new RequestError("Unsupported approval record");
    } else if (action === "save-rules") {
      const vendorId = textValue(payload.vendorId, "Payroll entity");
      const fields =
        typeof payload.rules === "object" && payload.rules !== null
          ? (payload.rules as Record<string, unknown>)
          : {};
      const standardWorkingDays = positiveValue(
        fields.standardWorkingDays,
        "Working days",
        31,
      );
      if (standardWorkingDays < 1 || !Number.isInteger(standardWorkingDays))
        throw new RequestError(
          "Working days must be a whole number between 1 and 31",
        );
      const effectiveFrom = textValue(fields.effectiveFrom, "Effective date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))
        throw new RequestError("Effective date must be YYYY-MM-DD");
      const values = {
        standardWorkingDays,
        pfRate: positiveValue(fields.pfRate, "PF rate", 100),
        esiRate: positiveValue(fields.esiRate, "ESI rate", 100),
        professionalTax: positiveValue(
          fields.professionalTax,
          "Professional tax",
        ),
        lwf: positiveValue(fields.lwf, "LWF"),
        overtimeHourlyRate: positiveValue(
          fields.overtimeHourlyRate,
          "Overtime rate",
        ),
        paidLeave: fields.paidLeave ? 1 : 0,
        paidWeekOff: fields.paidWeekOff ? 1 : 0,
        effectiveFrom,
        updatedAt: new Date().toISOString(),
      };
      const [existing] = await db
        .select()
        .from(payrollRules)
        .where(eq(payrollRules.vendorId, vendorId))
        .limit(1);
      if (existing)
        await db
          .update(payrollRules)
          .set(values)
          .where(eq(payrollRules.id, existing.id));
      else
        await db
          .insert(payrollRules)
          .values({ id: `RULE-${crypto.randomUUID()}`, vendorId, ...values });
      await writeAudit(
        db,
        "rules_updated",
        "client",
        vendorId,
        "Updated client salary, statutory, overtime and attendance rules",
        actorEmail,
      );
    } else if (action === "import-workbook") {
      runId = await importWorkbook(db, payload, actorEmail);
    } else if (action === "lock-payment-batch") {
      const run = await requireRun(db, runId);
      if (run.status !== "approved")
        throw new RequestError(
          "Approve the payroll run before locking a bank upload batch",
          409,
        );
      const itemIds = requiredStringArray(payload.itemIds, "employee batch");
      const selectedRows = await db
        .select({
          id: payrollItems.id,
          employeeId: payrollItems.employeeId,
          employeeCode: employees.employeeCode,
          employeeName: employees.name,
          paymentMode: employees.paymentMode,
          bankAccountMasked: employees.bankAccountMasked,
          ifscMasked: employees.ifscMasked,
          netPayable: payrollItems.netPayable,
        })
        .from(payrollItems)
        .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
        .where(
          and(
            eq(payrollItems.runId, run.id),
            inArray(payrollItems.id, itemIds),
          ),
        );
      if (selectedRows.length !== itemIds.length)
        throw new RequestError(
          "One or more selected employees do not belong to this payroll run",
          409,
        );
      const invalidRows = selectedRows.filter(
        (row) =>
          row.paymentMode !== "bank" ||
          !row.bankAccountMasked ||
          !row.ifscMasked ||
          !Number.isFinite(row.netPayable) ||
          row.netPayable < 0,
      );
      if (invalidRows.length)
        throw new RequestError(
          `Complete bank account number and IFSC before locking: ${invalidRows
            .map((row) => row.employeeCode)
            .join(", ")}`,
          409,
        );
      const existingRows = await db
        .select({
          payrollItemId: paymentExportBatchItems.payrollItemId,
          batchId: paymentExportBatchItems.batchId,
          status: paymentExportBatches.status,
        })
        .from(paymentExportBatchItems)
        .innerJoin(
          paymentExportBatches,
          eq(paymentExportBatchItems.batchId, paymentExportBatches.id),
        )
        .where(
          and(
            eq(paymentExportBatchItems.runId, run.id),
            inArray(paymentExportBatchItems.payrollItemId, itemIds),
          ),
        );
      if (existingRows.length) {
        const existingCodes = selectedRows
          .filter((row) =>
            existingRows.some((entry) => entry.payrollItemId === row.id),
          )
          .map((row) => row.employeeCode)
          .join(", ");
        const downloaded = existingRows.some(
          (entry) => entry.status === "downloaded",
        );
        throw new RequestError(
          downloaded
            ? `A bank file was already downloaded for: ${existingCodes}`
            : `These employees are already locked in another bank batch: ${existingCodes}`,
          409,
        );
      }
      const now = new Date().toISOString();
      const batchId = `PAYMENT-${crypto.randomUUID()}`;
      await db.insert(paymentExportBatches).values({
        id: batchId,
        runId: run.id,
        status: "locked",
        exportFormat: null,
        employeeCount: selectedRows.length,
        totalPayable: roundMoney(
          selectedRows.reduce((sum, row) => sum + row.netPayable, 0),
        ),
        lockedBy: actorEmail,
        lockedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(paymentExportBatchItems).values(
        selectedRows.map((row) => ({
          id: `PAYMENT-ITEM-${crypto.randomUUID()}`,
          batchId,
          runId: run.id,
          payrollItemId: row.id,
          employeeId: row.employeeId,
          amount: row.netPayable,
          createdAt: now,
        })),
      );
      await writeAudit(
        db,
        "payment_batch_locked",
        "payment_export_batch",
        batchId,
        `Locked ${selectedRows.length} individual employee payment${selectedRows.length === 1 ? "" : "s"} for one bank upload batch (${roundMoney(selectedRows.reduce((sum, row) => sum + row.netPayable, 0))})`,
        actorEmail,
      );
    } else if (action === "unlock-payment-batch") {
      const run = await requireRun(db, runId);
      if (run.status !== "approved")
        throw new RequestError(
          "Approve the payroll run before changing a bank upload batch",
          409,
        );
      const batchId = textValue(payload.batchId, "Payment batch");
      const [batch] = await db
        .select()
        .from(paymentExportBatches)
        .where(
          and(
            eq(paymentExportBatches.id, batchId),
            eq(paymentExportBatches.runId, run.id),
          ),
        )
        .limit(1);
      if (!batch) throw new RequestError("Payment batch not found", 404);
      if (batch.status === "downloaded")
        throw new RequestError(
          "This bank file was already downloaded and cannot be unlocked; create a new payroll run for a corrected payment",
          409,
        );
      await db
        .delete(paymentExportBatchItems)
        .where(eq(paymentExportBatchItems.batchId, batch.id));
      await db
        .delete(paymentExportBatches)
        .where(eq(paymentExportBatches.id, batch.id));
      await writeAudit(
        db,
        "payment_batch_unlocked",
        "payment_export_batch",
        batch.id,
        "Unlocked the individual employee bank batch before download",
        actorEmail,
      );
    } else if (action === "download-payment-batch") {
      const run = await requireRun(db, runId);
      if (run.status !== "approved")
        throw new RequestError(
          "Approve the payroll run before downloading a payment batch",
          409,
        );
      const exportFormat = textValue(payload.exportFormat, "Payment export format");
      const allowedFormats = new Set([
        "bank_csv",
        "indian_bank_xlsx",
        "cub_any_bank_txt",
        "cub_to_cub_txt",
        "cash_xlsx",
      ]);
      if (!allowedFormats.has(exportFormat))
        throw new RequestError("Unsupported payment export format");
      const requestedItemIds = Array.isArray(payload.itemIds)
        ? requiredStringArray(payload.itemIds, "employee batch")
        : [];
      let batchId = optionalValue(payload.batchId);
      if (requestedItemIds.length) {
        const selectedRows = await db
          .select({
            id: payrollItems.id,
            employeeId: payrollItems.employeeId,
            employeeCode: employees.employeeCode,
            paymentMode: employees.paymentMode,
            bankAccountMasked: employees.bankAccountMasked,
            ifscMasked: employees.ifscMasked,
            netPayable: payrollItems.netPayable,
          })
          .from(payrollItems)
          .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
          .where(
            and(
              eq(payrollItems.runId, run.id),
              inArray(payrollItems.id, requestedItemIds),
            ),
          );
        if (selectedRows.length !== requestedItemIds.length)
          throw new RequestError(
            "One or more selected employees do not belong to this payroll run",
            409,
          );
        const isCashExport = exportFormat === "cash_xlsx";
        const invalidRows = selectedRows.filter((row) => {
          const invalidPayable =
            !Number.isFinite(row.netPayable) || row.netPayable <= 0;
          if (invalidPayable || row.paymentMode !== "bank") return true;
          const hasBankDetails = Boolean(
            row.bankAccountMasked && row.ifscMasked,
          );
          return isCashExport ? hasBankDetails : !hasBankDetails;
        });
        if (invalidRows.length)
          throw new RequestError(
            isCashExport
              ? `Cash Payment Excel is only for positive-pay employees missing account number or IFSC: ${invalidRows
                  .map((row) => row.employeeCode)
                  .join(", ")}`
              : `Complete bank account number and IFSC before downloading: ${invalidRows
                  .map((row) => row.employeeCode)
                  .join(", ")}`,
            409,
          );
        const existingRows = await db
          .select({
            payrollItemId: paymentExportBatchItems.payrollItemId,
            status: paymentExportBatches.status,
          })
          .from(paymentExportBatchItems)
          .innerJoin(
            paymentExportBatches,
            eq(paymentExportBatchItems.batchId, paymentExportBatches.id),
          )
          .where(
            and(
              eq(paymentExportBatchItems.runId, run.id),
              inArray(
                paymentExportBatchItems.payrollItemId,
                requestedItemIds,
              ),
            ),
          );
        if (existingRows.length) {
          const existingCodes = selectedRows
            .filter((row) =>
              existingRows.some((entry) => entry.payrollItemId === row.id),
            )
            .map((row) => row.employeeCode)
            .join(", ");
          throw new RequestError(
            `A payment file was already prepared or downloaded for: ${existingCodes}`,
            409,
          );
        }
        const now = new Date().toISOString();
        batchId = `PAYMENT-${crypto.randomUUID()}`;
        await db.insert(paymentExportBatches).values({
          id: batchId,
          runId: run.id,
          status: "locked",
          exportFormat: null,
          employeeCount: selectedRows.length,
          totalPayable: roundMoney(
            selectedRows.reduce((sum, row) => sum + row.netPayable, 0),
          ),
          lockedBy: actorEmail,
          lockedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        try {
          await db.insert(paymentExportBatchItems).values(
            selectedRows.map((row) => ({
              id: `PAYMENT-ITEM-${crypto.randomUUID()}`,
              batchId: batchId!,
              runId: run.id,
              payrollItemId: row.id,
              employeeId: row.employeeId,
              amount: row.netPayable,
              createdAt: now,
            })),
          );
        } catch {
          await db
            .delete(paymentExportBatches)
            .where(eq(paymentExportBatches.id, batchId));
          throw new RequestError(
            "Another session already prepared one of these employees; duplicate payment processing was blocked",
            409,
          );
        }
      }
      if (!batchId) throw new RequestError("Payment batch is required");
      const [batch] = await db
        .select()
        .from(paymentExportBatches)
        .where(
          and(
            eq(paymentExportBatches.id, batchId),
            eq(paymentExportBatches.runId, run.id),
          ),
        )
        .limit(1);
      if (!batch) throw new RequestError("Payment batch not found", 404);
      if (batch.status === "downloaded")
        throw new RequestError(
          "This payment batch was already downloaded and is protected from duplicate processing",
          409,
        );
      const batchItems = await db
        .select({ id: paymentExportBatchItems.id })
        .from(paymentExportBatchItems)
        .where(eq(paymentExportBatchItems.batchId, batch.id));
      if (batchItems.length !== batch.employeeCount)
        throw new RequestError(
          "The locked employee selection changed; unlock and create the batch again",
          409,
        );
      const now = new Date().toISOString();
      const downloadResult = await db
        .update(paymentExportBatches)
        .set({
          status: "downloaded",
          exportFormat,
          downloadedBy: actorEmail,
          downloadedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(paymentExportBatches.id, batch.id),
            eq(paymentExportBatches.status, "locked"),
          ),
        );
      const changedRows = mutationChangedRows(downloadResult);
      if (changedRows !== null && changedRows < 1)
        throw new RequestError(
          "This payment batch was already downloaded by another session; duplicate processing was blocked",
          409,
        );
      await writeAudit(
        db,
        "payment_batch_downloaded",
        "payment_export_batch",
        batch.id,
        `Downloaded ${exportFormat} for ${batch.employeeCount} individually selected employee${batch.employeeCount === 1 ? "" : "s"}; the reservation blocked duplicate processing`,
        actorEmail,
      );
    } else if (action === "resolve-issues" || action === "recalculate") {
      await requireRun(db, runId, true);
      await recalculateRun(db, runId, action === "recalculate");
      await writeAudit(
        db,
        action === "recalculate" ? "recalculated" : "validation_checked",
        "payroll_run",
        runId,
        action === "recalculate"
          ? "Recalculated attendance, earnings, deductions and net pay"
          : "Rechecked employee payroll and bank readiness",
        actorEmail,
      );
    } else if (action === "approve") {
      // JOY_PAYROLL_APPROVAL_QUALITY_GATE_V1: always recalculate and re-read payroll immediately before approval.
      // This prevents stale totals from being approved after attendance, salary,
      // employee bank/statutory data, accommodation or recovery changes.
      await requireRun(db, runId, true);
      await recalculateRun(db, runId, false);
      const run = await requireRun(db, runId, true);
      const approvalItems = await db
        .select({
          id: payrollItems.id,
          employeeId: payrollItems.employeeId,
          employeeCode: employees.employeeCode,
          paymentMode: employees.paymentMode,
          bankAccountMasked: employees.bankAccountMasked,
          ifscMasked: employees.ifscMasked,
          validationStatus: payrollItems.validationStatus,
          validationMessage: payrollItems.validationMessage,
          netPayable: payrollItems.netPayable,
        })
        .from(payrollItems)
        .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
        .where(eq(payrollItems.runId, runId));
      if (!run.employeeCount || !approvalItems.length)
        throw new RequestError("Add employees before approving payroll", 409);
      const reviewItems = approvalItems.filter(
        (item) =>
          item.validationStatus !== "ready" &&
          !isCashFallbackOnlyValidation(item),
      );
      if (reviewItems.length)
        throw new RequestError(
          "Payroll approval blocked: " +
            reviewItems.length +
            " employee record(s) still require salary or statutory review. Recheck PF/ESI and salary readiness first.",
          409,
        );
      if (run.grossEarnings <= 0)
        throw new RequestError(
          "Add attendance or salary amounts before approving payroll",
          409,
        );
      if (run.netPayable < 0)
        throw new RequestError("Payroll net payable cannot be negative", 409);
      if (Math.abs(run.netPayable - run.bankPayable - run.cashPayable) > 0.01)
        throw new RequestError(
          "Payroll approval blocked: bank payable (₹" +
            run.bankPayable.toFixed(2) +
            ") plus cash payable (₹" +
            run.cashPayable.toFixed(2) +
            ") does not match final net payable (₹" +
            run.netPayable.toFixed(2) +
            "). Recalculate before approval.",
          409,
        );
      const invalidPayables = approvalItems.filter(
        (item) => !Number.isFinite(item.netPayable) || item.netPayable < 0,
      );
      if (invalidPayables.length)
        throw new RequestError(
          "Payroll approval blocked: " +
            invalidPayables.length +
            " employee(s) have invalid final payable values.",
          409,
        );
      await db
        .update(payrollRuns)
        .set({
          status: "approved",
          approvedBy: user?.displayName ?? "Payroll approver",
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(payrollRuns.id, runId));
      await writeAudit(
        db,
        "approved",
        "payroll_run",
        runId,
        "Approved payroll and unlocked payment exports",
        actorEmail,
      );
    } else if (action === "reopen-payroll-for-recovery") {
      const run = await requireRun(db, runId);
      if (run.status !== "approved")
        throw new RequestError(
          "Only an approved payroll can be reopened for recovery correction",
          409,
        );
      const clearedBatches = await db
        .select({ id: payrollBatches.id })
        .from(payrollBatches)
        .where(
          and(
            eq(payrollBatches.runId, runId),
            eq(payrollBatches.status, "cleared"),
          ),
        );
      const now = new Date().toISOString();
      const paymentBatches = await db
        .select()
        .from(paymentExportBatches)
        .where(eq(paymentExportBatches.runId, runId));
      const downloadedPaymentBatches = paymentBatches.filter(
        (batch) => batch.status === "downloaded",
      );
      if (downloadedPaymentBatches.length)
        throw new RequestError(
          "This payroll already has a downloaded bank file. Duplicate-safe recovery changes require a new payroll run or an authorised payment reversal first",
          409,
        );
      const lockedPaymentBatches = paymentBatches.filter(
        (batch) => batch.status === "locked",
      );
      if (lockedPaymentBatches.length) {
        await db
          .delete(paymentExportBatchItems)
          .where(eq(paymentExportBatchItems.runId, runId));
        await db
          .delete(paymentExportBatches)
          .where(eq(paymentExportBatches.runId, runId));
      }
      if (clearedBatches.length)
        await db
          .update(payrollBatches)
          .set({
            status: "prepared",
            paymentReference: null,
            clearedBy: null,
            clearedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(payrollBatches.runId, runId),
              eq(payrollBatches.status, "cleared"),
            ),
          );
      await db
        .update(payrollRuns)
        .set({
          status: "draft",
          approvedBy: null,
          approvedAt: null,
          updatedAt: now,
        })
        .where(eq(payrollRuns.id, runId));
      await recalculateRun(db, runId, false);
      await writeAudit(
        db,
        "payroll_reopened_for_recovery",
        "payroll_run",
        runId,
        `Reopened ${clearedBatches.length} cleared accommodation payment batch(es), removed ${lockedPaymentBatches.length ? "the locked bank batch" : "no locked bank batch"}, and reopened payroll for recovery correction`,
        actorEmail,
      );
    } else if (action === "reopen" || action === "reset-demo") {
      const run = await requireRun(db, runId);
      if (run.status !== "approved")
        throw new RequestError("Only an approved payroll can be reopened", 409);
      const activeEmployees = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.clientUnitId, run.clientUnitId),
            eq(employees.status, "active"),
          ),
        );
      const existingItems = await db
        .select({ employeeId: payrollItems.employeeId })
        .from(payrollItems)
        .where(eq(payrollItems.runId, runId));
      const existingEmployeeIds = new Set(
        existingItems.map((item) => item.employeeId),
      );
      const missingEmployees = activeEmployees.filter(
        (employee) => !existingEmployeeIds.has(employee.id),
      );
      const clearedBatches = await db
        .select({ id: payrollBatches.id })
        .from(payrollBatches)
        .where(
          and(
            eq(payrollBatches.runId, runId),
            eq(payrollBatches.status, "cleared"),
          ),
        );
      const paymentBatches = await db
        .select()
        .from(paymentExportBatches)
        .where(eq(paymentExportBatches.runId, runId));
      const downloadedPaymentBatches = paymentBatches.filter(
        (batch) => batch.status === "downloaded",
      );
      if (downloadedPaymentBatches.length && !missingEmployees.length)
        throw new RequestError(
          "This payroll already has a downloaded bank file. Duplicate-safe corrections require a new payroll run or an authorised payment reversal first",
          409,
        );
      if (
        (downloadedPaymentBatches.length || clearedBatches.length) &&
        !access.profile.canApprovePayroll
      )
        throw new RequestError(
          "Only a Super Admin or authorised payroll approver can reopen a payment-protected payroll",
          403,
        );
      const lockedPaymentBatches = paymentBatches.filter(
        (batch) => batch.status === "locked",
      );
      if (lockedPaymentBatches.length) {
        await db
          .delete(paymentExportBatchItems)
          .where(
            inArray(
              paymentExportBatchItems.batchId,
              lockedPaymentBatches.map((batch) => batch.id),
            ),
          );
        await db
          .delete(paymentExportBatches)
          .where(
            inArray(
              paymentExportBatches.id,
              lockedPaymentBatches.map((batch) => batch.id),
            ),
          );
      }
      const reopeningClearedBatches =
        !downloadedPaymentBatches.length && clearedBatches.length > 0;
      if (reopeningClearedBatches) {
        requireModule(access, "payments", "manage");
        await db
          .update(payrollBatches)
          .set({
            status: "prepared",
            paymentReference: null,
            clearedBy: null,
            clearedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(payrollBatches.runId, runId),
              eq(payrollBatches.status, "cleared"),
            ),
          );
      }
      const addedEmployeeCount = await addEmployeesToRun(
        db,
        run,
        missingEmployees,
      );
      await db
        .update(payrollRuns)
        .set({
          status: "draft",
          approvedBy: null,
          approvedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(payrollRuns.id, runId));
      await recalculateRun(db, runId, false);
      await writeAudit(
        db,
        "reopened",
        "payroll_run",
        runId,
        downloadedPaymentBatches.length
          ? `Reopened payroll in supplementary mode and added ${addedEmployeeCount} missed employee(s); ${downloadedPaymentBatches.length} downloaded bank batch(es) and paid employee records remain locked`
          : `Reopened payroll for corrections, added ${addedEmployeeCount} missed employee(s), reopened ${clearedBatches.length} cleared accommodation batch(es), and removed ${lockedPaymentBatches.length} undownloaded bank batch(es)`,
        actorEmail,
      );
    } else if (action === "delete-payroll-run") {
      const run = await requireRun(db, runId, true);
      await db
        .delete(paymentExportBatchItems)
        .where(eq(paymentExportBatchItems.runId, runId));
      await db
        .delete(paymentExportBatches)
        .where(eq(paymentExportBatches.runId, runId));
      await db.delete(payrollBatches).where(eq(payrollBatches.runId, runId));
      await db.delete(recoveryEntries).where(eq(recoveryEntries.runId, runId));
      await db
        .delete(accommodationCharges)
        .where(eq(accommodationCharges.runId, runId));
      await db.delete(payrollItems).where(eq(payrollItems.runId, runId));
      await db.delete(payrollRuns).where(eq(payrollRuns.id, runId));
      await writeAudit(
        db,
        "run_deleted",
        "payroll_run",
        runId,
        `Deleted ${run.payPeriod} payroll calculations; attendance records were preserved`,
        actorEmail,
      );
    } else {
      throw new RequestError(`Unsupported action: ${action}`);
    }

    return Response.json({
      ...(await loadAppData(access)),
      selectedRunId: runId,
    });
  } catch (error) {
    const messages = errorMessages(error);
    const combined = messages.join(" ");
    if (/UNIQUE constraint failed: vendors\.code/i.test(combined))
      return Response.json(
        { error: "This client code already exists" },
        { status: 409 },
      );
    if (
      /UNIQUE constraint failed: shift_definitions\.vendor_id, shift_definitions\.name/i.test(
        combined,
      )
    )
      return Response.json(
        { error: "This shift name already exists for the selected client" },
        { status: 409 },
      );
    if (/UNIQUE constraint failed: employees\.employee_code/i.test(combined))
      return Response.json(
        { error: "This employee code already exists" },
        { status: 409 },
      );
    if (
      /payment_export_batch_run_item_unique|payment_export_batch_items_run_id_payroll_item_id/i.test(
        combined,
      )
    )
      return Response.json(
        {
          error:
            "One or more selected employees are already locked or downloaded in another bank batch",
        },
        { status: 409 },
      );
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : (messages.at(-1) ?? "Unable to update payroll");
    if (status >= 500)
      console.error(
        "Payroll application action failed",
        message.split("\n")[0],
      );
    return Response.json({ error: message }, { status });
  }
}
