"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { strToU8, zipSync } from "fflate";
import { parsePayrollWorkbook, type WorkbookImport } from "../lib/excel-import";
import {
  defaultPayrollRules,
  deductionFields,
  earningFields,
} from "../lib/payroll-calculations";
import { calendarPeriod, payrollPeriodRange } from "../lib/payroll-operations";
import {
  AccommodationControlCenter,
  PayrollBatchPanel,
  PayrollPeriodEditor,
  WorkforceDashboard,
} from "./payroll-enhancements";
import { OperationsView } from "./operations-view";
import { HostelMaster } from "./hostel-master";
import { RecoveryCenter, ReportsCenter } from "./reports-recovery";
import {
  ACCESS_MODULES,
  DEFAULT_APPROVAL_ACCESS,
  DEFAULT_PERMISSIONS,
  ROLE_LABELS,
  canManage,
  canView,
  type AccessModule,
  type PermissionMap,
  type UserRole,
} from "../lib/access-control";

type Section =
  | "dashboard"
  | "payroll"
  | "attendance"
  | "employees"
  | "accommodation"
  | "recoveries"
  | "hostels"
  | "payments"
  | "vendors"
  | "masters"
  | "operations"
  | "reports"
  | "users"
  | "settings";

export type AppUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  employeeCode: string | null;
  department: string | null;
  dateOfJoining: string | null;
  mobileNumber: string | null;
  role: UserRole;
  status: string;
  permissions: PermissionMap;
  clientScope: string[];
  unitScope: string[];
  hostelScope: string[];
  canApprovePayroll: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type Vendor = {
  id: string;
  code: string;
  name: string;
  legalName: string;
  epfCode: string | null;
  esiCode: string | null;
  gstin: string | null;
  remarks: string | null;
  logoDataUrl: string | null;
  status: string;
};

export type ClientUnit = {
  id: string;
  vendorId: string;
  clientName: string;
  unitName: string;
  location: string;
  employeeCount: number;
  remarks: string | null;
  attendanceCycleStartDay: number;
  attendanceCycleEndDay: number;
  attendanceWorkingDays: number;
  overtimeMultiplier: number;
  voucherHeader: string | null;
  payslipTitle: string | null;
  payslipSubtitle: string | null;
  payslipAddress: string | null;
  payslipContact: string | null;
  payslipFooter: string | null;
  payslipEarningsJson: string;
  payslipDeductionsJson: string;
  status: string;
};

export type Employee = {
  id: string;
  vendorId: string;
  clientUnitId: string;
  employeeCode: string;
  name: string;
  department: string;
  dateOfJoining: string;
  dateOfLeaving: string | null;
  uanMasked: string | null;
  esiMasked: string | null;
  bankAccountMasked: string | null;
  ifscMasked: string | null;
  bankName: string | null;
  accommodationType: string;
  roomId: string | null;
  roomNumber: string | null;
  roomRentAmount: number;
  photoDataUrl: string | null;
  mobileNumber: string | null;
  emergencyContactNumber: string | null;
  addressLine: string | null;
  district: string | null;
  stateName: string | null;
  pincode: string | null;
  bloodGroup: string | null;
  fatherName: string | null;
  spouseName: string | null;
  maritalStatus: string | null;
  highestQualification: string | null;
  pfApplicable: number;
  pfWageAmount: number;
  esiApplicable: number;
  esiWageAmount: number;
  ptApplicable: number;
  lwfApplicable: number;
  paymentMode: string;
  salaryAmount: number;
  salaryBasis: string;
  defaultShift: string;
  shiftPattern: string;
  applicableShiftsJson: string;
  remarks: string | null;
  complianceStatus: string;
  status: string;
  employmentType: string;
  processingStage: string;
  finalizedBy: string | null;
  finalizedAt: string | null;
};

export type Vehicle = {
  id: string;
  vendorId: string;
  registrationNumber: string;
  vehicleName: string;
  vehicleType: string;
  currentOdometer: number;
  permitExpiry: string | null;
  insuranceExpiry: string | null;
  fcExpiry: string | null;
  pollutionExpiry: string | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  tyreChangedDate: string | null;
  tyreChangedKm: number | null;
  lastWaterWashDate: string | null;
  lastWheelAlignmentDate: string | null;
  status: string;
  remarks: string | null;
};
export type VehicleRecord = {
  id: string;
  vehicleId: string;
  recordDate: string;
  recordType: string;
  tripFrom: string | null;
  tripTo: string | null;
  purpose: string | null;
  startKm: number | null;
  endKm: number | null;
  litres: number;
  amount: number;
  nextDueDate: string | null;
  nextDueKm: number | null;
  remarks: string | null;
  status: string;
};
export type UtilityMeter = {
  id: string;
  vendorId: string;
  locationType: string;
  locationName: string;
  meterNumber: string | null;
  status: string;
  remarks: string | null;
};
export type EbReading = {
  id: string;
  meterId: string;
  readingDate: string;
  readingValue: number;
  unitsConsumed: number;
  amount: number;
  remarks: string | null;
  status: string;
};

export type PayrollRun = {
  id: string;
  vendorId: string;
  clientUnitId: string;
  payPeriod: string;
  periodStart: string | null;
  periodEnd: string | null;
  workingDays: number;
  processingMode: "attendance" | "salary_import";
  status: string;
  employeeCount: number;
  grossEarnings: number;
  statutoryDeductions: number;
  otherDeductions: number;
  accommodationDeductions: number;
  netPayable: number;
  bankPayable: number;
  cashPayable: number;
  issueCount: number;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type PayrollItem = {
  id: string;
  runId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  accommodationType: string;
  roomNumber: string | null;
  paymentMode: string;
  bankAccountMasked: string | null;
  ifscMasked: string | null;
  complianceStatus: string;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  weekOffDays: number;
  holidayPresentDays: number;
  payableDays: number;
  overtimeHours: number;
  punchIn: string | null;
  punchOut: string | null;
  workedHours: number;
  deductionHours: number;
  basic: number;
  da: number;
  hra: number;
  conveyance: number;
  foodAllowance: number;
  nightAllowance: number;
  overtimeWages: number;
  attendanceBonus: number;
  arrears: number;
  holidayWages: number;
  productionIncentive: number;
  medicalAllowance: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  lwf: number;
  canteen: number;
  snacks: number;
  tent: number;
  advance: number;
  otherDeduction: number;
  tds: number;
  medicalInsurance: number;
  accommodationDeduction: number;
  returnAmount: number;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  validationStatus: string;
  validationMessage: string | null;
};

type AttendanceEntry = {
  id: number;
  employeeId: string;
  attendanceDate: string;
  statusCode: string;
  shiftCode: string;
  overtimeHours: number;
  punchIn: string | null;
  punchOut: string | null;
  workedHours: number;
  deductionHours: number;
  remarks: string | null;
};

type ShiftDefinition = {
  id: string;
  vendorId: string;
  clientUnitId: string | null;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  requiredWorkMinutes: number;
  lateGraceMinutes: number;
  lateDeductionMinutes: number;
  earlyGraceMinutes: number;
  earlyDeductionMinutes: number;
  otMode: string;
  fixedOtHours: number;
  remarks: string | null;
  status: string;
};

type PayrollRemark = {
  id: string;
  vendorId: string;
  title: string;
  category: string;
  notes: string | null;
  status: string;
};

export type AccommodationCharge = {
  id: number;
  runId: string;
  employeeId: string;
  roomExpenseId: string | null;
  roomNumber: string | null;
  idCard: number;
  rent: number;
  bus: number;
  medical: number;
  ticket: number;
  shoe: number;
  advance: number;
  food: number;
  aadhaarUpdate: number;
  bankAccountCharge: number;
  tshirt: number;
  oldPending: number;
  gasShare: number;
  rationShare: number;
  provisionShare: number;
  returnAmount: number;
};

export type RecoveryEntry = {
  id: string;
  runId: string;
  employeeId: string;
  recoveryDate: string;
  recoveryType: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};
export type RecoveryFinalization = {
  id: string;
  runId: string;
  employeeId: string;
  voucherNumber: string;
  finalizedBy: string | null;
  finalizedAt: string;
};

export type AccommodationType = {
  id: string;
  vendorId: string;
  name: string;
  remarks: string | null;
  status: string;
};

export type AccommodationRoom = {
  id: string;
  vendorId: string;
  accommodationTypeId: string;
  hostelId: string | null;
  rentSettingsJson: string;
  rentCutoffDay: number;
  lateJoinRentPercent: number;
  roomNumber: string;
  capacity: number;
  address: string | null;
  remarks: string | null;
  status: string;
};

export type RoomExpense = {
  id: string;
  roomId: string;
  payPeriod: string;
  gasAmount: number;
  gasDate: string | null;
  gasCylinderCount: number;
  gasPaymentReference: string | null;
  rationAmount: number;
  rationDate: string | null;
  rationPaymentReference: string | null;
  provisionAmount: number;
  provisionDate: string | null;
  provisionPaymentReference: string | null;
  occupantCount: number;
  status: string;
  notes: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
};

export type Hostel = {
  id: string;
  vendorId: string;
  accommodationTypeId: string | null;
  name: string;
  address: string | null;
  inchargeName: string | null;
  ebMeterNumber: string | null;
  clientScopeJson: string;
  status: string;
  remarks: string | null;
};
export type HostelUtilityReading = {
  id: string;
  hostelId: string;
  readingDate: string;
  utilityType: "eb" | "water" | "payment" | "housekeeping" | "other";
  readingValue: number;
  consumption: number;
  tankerQuantity: number;
  amount: number;
  activityName: string | null;
  remarks: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type PayrollBatch = {
  id: string;
  runId: string;
  accommodationType: string;
  employeeCount: number;
  grossEarnings: number;
  netPayable: number;
  status: string;
  paymentReference: string | null;
  preparedBy: string | null;
  preparedAt: string | null;
  clearedBy: string | null;
  clearedAt: string | null;
};

type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorEmail: string | null;
  createdAt: string;
};

type PayrollRule = {
  id: string;
  vendorId: string;
  standardWorkingDays: number;
  pfRate: number;
  esiRate: number;
  professionalTax: number;
  lwf: number;
  overtimeHourlyRate: number;
  paidLeave: number;
  paidWeekOff: number;
  effectiveFrom: string;
};

export type AppData = {
  demo: boolean;
  vendors: Vendor[];
  units: ClientUnit[];
  employees: Employee[];
  runs: PayrollRun[];
  payrollItems: PayrollItem[];
  attendance: AttendanceEntry[];
  accommodationCharges: AccommodationCharge[];
  recoveryEntries: RecoveryEntry[];
  recoveryFinalizations: RecoveryFinalization[];
  accommodationTypes: AccommodationType[];
  accommodationRooms: AccommodationRoom[];
  roomExpenses: RoomExpense[];
  hostels: Hostel[];
  hostelUtilityReadings: HostelUtilityReading[];
  payrollBatches: PayrollBatch[];
  auditEvents: AuditEvent[];
  rules: PayrollRule[];
  shifts: ShiftDefinition[];
  remarks: PayrollRemark[];
  currentUser: AppUserProfile;
  appUsers: AppUserProfile[];
  vehicles: Vehicle[];
  vehicleRecords: VehicleRecord[];
  utilityMeters: UtilityMeter[];
  ebReadings: EbReading[];
  selectedRunId?: string;
};

type ActiveModal =
  | { kind: "vendor"; vendor?: Vendor }
  | { kind: "unit"; unit?: ClientUnit }
  | { kind: "employee"; employee?: Employee }
  | { kind: "employee-left"; employee: Employee }
  | { kind: "shift"; shift?: ShiftDefinition }
  | { kind: "accommodation-type"; accommodationType?: AccommodationType }
  | { kind: "remark"; remark?: PayrollRemark }
  | { kind: "app-user"; profile?: AppUserProfile }
  | { kind: "run" }
  | {
      kind: "attendance";
      employee: Employee;
      date: string;
      entry?: AttendanceEntry;
    }
  | { kind: "salary"; item: PayrollItem }
  | { kind: "accommodation"; employee?: Employee; charge?: AccommodationCharge }
  | { kind: "import" };

const navItems: Array<{ id: Section; label: string; icon: string }> = [
  { id: "dashboard", label: "Overview", icon: "grid" },
  { id: "payroll", label: "Payroll Run", icon: "calculator" },
  { id: "attendance", label: "Attendance", icon: "calendar" },
  { id: "employees", label: "Employees", icon: "users" },
  { id: "accommodation", label: "Accommodation", icon: "home" },
  { id: "recoveries", label: "Recoveries", icon: "calculator" },
  { id: "hostels", label: "Hostel Master", icon: "building" },
  { id: "payments", label: "Payments & Payslips", icon: "bank" },
  { id: "vendors", label: "Group Companies & Clients", icon: "building" },
  { id: "masters", label: "Operational Masters", icon: "calendar" },
  { id: "operations", label: "Vehicle Monitoring", icon: "building" },
  { id: "reports", label: "Reports", icon: "file" },
  { id: "users", label: "Users & Access", icon: "users" },
  { id: "settings", label: "Rules & Settings", icon: "settings" },
];

const sectionPermission: Record<Section, AccessModule> = {
  dashboard: "dashboard",
  payroll: "payroll",
  attendance: "attendance",
  employees: "employees",
  accommodation: "accommodation",
  recoveries: "accommodation",
  hostels: "accommodation",
  payments: "payments",
  vendors: "clients",
  masters: "masters",
  operations: "operations",
  reports: "dashboard",
  users: "users",
  settings: "settings",
};

const sectionTitles: Record<
  Section,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: "Workforce and payroll control centre",
    title: "Manpower & payroll dashboard",
    description:
      "Client-wise and unit-wise manpower, joining, compliance, payroll, and payment visibility.",
  },
  payroll: {
    eyebrow: "Salary processing",
    title: "Payroll run",
    description:
      "Review every employee calculation before approval and payment.",
  },
  attendance: {
    eyebrow: "Daily workforce",
    title: "Attendance & shift register",
    description:
      "Day-wise status, changing shifts, week offs and holiday work.",
  },
  employees: {
    eyebrow: "Employee master",
    title: "Employee compliance readiness",
    description:
      "Identity, statutory, bank and assignment information used by payroll.",
  },
  accommodation: {
    eyebrow: "Accommodation rooms & recoveries",
    title: "Room allocations & shared deductions",
    description:
      "Accommodation-type masters, room allocations, gas, ration, provision, and printable room-wise breakups.",
  },
  recoveries: {
    eyebrow: "Salary recovery control",
    title: "Employee & room-wise recoveries",
    description:
      "Maintain individual deductions separately from shared Gas, Ration and Provision room deductions.",
  },
  hostels: {
    eyebrow: "Hostel hierarchy & utilities",
    title: "Hostel master",
    description:
      "Select accommodation type first, create hostels beneath it, map rooms, and track hostel-wise EB and water daily.",
  },
  payments: {
    eyebrow: "Disbursement",
    title: "Payments & payslips",
    description:
      "Bank-ready rows, cash list and employee salary slips after approval.",
  },
  vendors: {
    eyebrow: "Organisation structure",
    title: "Group companies, clients & locations",
    description:
      "Joy companies are group companies; their customer employers are clients with operating locations.",
  },
  masters: {
    eyebrow: "Operational master data",
    title: "Accommodation, shifts & remarks",
    description:
      "Add, edit, deactivate, or remove accommodation types, shift timings, and reusable remarks for each client.",
  },
  operations: {
    eyebrow: "Administration controls",
    title: "Vehicle monitoring",
    description:
      "Trips, fuel, mileage, compliance reminders, service follow-ups and vehicle expenses.",
  },
  reports: {
    eyebrow: "Management information",
    title: "Reports & downloads",
    description:
      "Payroll, attendance, employee, compliance, recovery, hostel and vehicle reports in Excel, CSV and PDF.",
  },
  users: {
    eyebrow: "Security & responsibility",
    title: "Users & access",
    description:
      "Assign roles and customize what each person can view or manage.",
  },
  settings: {
    eyebrow: "Calculation governance",
    title: "Payroll rules & settings",
    description:
      "Configurable earning, deduction, attendance and approval rules.",
  },
};

const statusMeta: Record<string, { label: string; className: string }> = {
  P: { label: "Present", className: "status-present" },
  HD: { label: "Half Day Present", className: "status-leave" },
  A: { label: "Absent", className: "status-absent" },
  L: { label: "Leave", className: "status-leave" },
  WO: { label: "Week off", className: "status-weekoff" },
  H: { label: "Holiday", className: "status-holiday" },
  HP: { label: "Holiday present", className: "status-holiday-present" },
};

const iconPaths: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  calculator:
    "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01",
  calendar: "M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  home: "M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7",
  bank: "M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3 3 8h18Z",
  building: "M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.56-1.03H5.3v-3h.08A1.7 1.7 0 0 0 6.94 9.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V4.3h3v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v3h-.08A1.7 1.7 0 0 0 19.4 15Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  alert: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
  chevron: "m9 18 6-6-6-6",
  check: "m5 12 4 4L19 6",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  refresh:
    "M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5",
  close: "M18 6 6 18M6 6l12 12",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  file: "M14 2H6a2 2 0 0 0-2 2v16h16V8Zm0 0v6h6M8 13h8M8 17h6",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name] ?? iconPaths.grid} />
    </svg>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function PayrollApp({
  displayName,
  apiEndpoint = "/api/app-data",
  accessToken,
  publishableKey,
  onSignOut,
  onChangePassword,
}: {
  displayName: string;
  apiEndpoint?: string;
  accessToken?: string;
  publishableKey?: string;
  onSignOut?: () => void | Promise<void>;
  onChangePassword?: (password: string) => Promise<void>;
}) {
  const [data, setData] = useState<AppData | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [activeVendorId, setActiveVendorId] = useState("");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [activePeriod, setActivePeriod] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);
  const [payslipItem, setPayslipItem] = useState<PayrollItem | null>(null);
  const [bulkPayslipsOpen, setBulkPayslipsOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    fetch(apiEndpoint, {
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(publishableKey ? { apikey: publishableKey } : {}),
      },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error ?? "Unable to load application");
        return payload as AppData;
      })
      .then((payload) => {
        setData(payload);
        const firstAllowedSection =
          navItems.find((item) =>
            canView(
              payload.currentUser.permissions,
              sectionPermission[item.id],
            ),
          )?.id ?? "attendance";
        setActiveSection(firstAllowedSection);
        const firstRun = payload.runs.findLast(
          (run) =>
            payload.vendors.some(
              (client) =>
                client.id === run.vendorId && client.status === "active",
            ) &&
            payload.units.some(
              (unit) =>
                unit.id === run.clientUnitId && unit.status === "active",
            ),
        );
        const firstClient = payload.vendors.find(
          (client) => client.status === "active",
        );
        const firstUnit = payload.units.find(
          (unit) =>
            unit.vendorId === firstClient?.id && unit.status === "active",
        );
        setActiveVendorId(firstRun?.vendorId ?? firstClient?.id ?? "");
        setActiveUnitId(firstRun?.clientUnitId ?? firstUnit?.id ?? "");
        setActivePeriod(
          firstRun?.payPeriod ?? new Date().toISOString().slice(0, 7),
        );
      })
      .catch((error) =>
        setAccessError(
          error instanceof Error ? error.message : "Unable to load application",
        ),
      );
  }, [apiEndpoint, accessToken, publishableKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const vendorUnits = useMemo(
    () =>
      data?.units.filter(
        (unit) => unit.vendorId === activeVendorId && unit.status === "active",
      ) ?? [],
    [data, activeVendorId],
  );
  const currentUnit =
    data?.units.find((unit) => unit.id === activeUnitId) ?? null;
  const currentVendor =
    data?.vendors.find((vendor) => vendor.id === activeVendorId) ?? null;
  const unitRuns =
    data?.runs
      .filter((run) => run.clientUnitId === activeUnitId)
      .sort((left, right) => right.payPeriod.localeCompare(left.payPeriod)) ??
    [];
  const currentRun =
    unitRuns.find((run) => run.payPeriod === activePeriod) ??
    unitRuns[0] ??
    null;
  const currentItems = currentRun
    ? (data?.payrollItems.filter((item) => item.runId === currentRun.id) ?? [])
    : [];
  const currentEmployees =
    data?.employees.filter(
      (employee) => employee.clientUnitId === activeUnitId,
    ) ?? [];
  const operationalEmployees = currentEmployees.filter(
    (employee) => employee.status === "active",
  );
  const currentRules =
    data?.rules.find((rule) => rule.vendorId === activeVendorId) ?? null;
  const currentShifts =
    data?.shifts.filter((shift) => shift.vendorId === activeVendorId) ?? [];
  const currentRemarks =
    data?.remarks.filter((remark) => remark.vendorId === activeVendorId) ?? [];
  const currentTypes =
    data?.accommodationTypes.filter(
      (type) => type.vendorId === activeVendorId,
    ) ?? [];
  const title = sectionTitles[activeSection];
  const visibleNavItems = data
    ? navItems.filter((item) =>
        canView(data.currentUser.permissions, sectionPermission[item.id]),
      )
    : [];
  const mayView = (section: Section) =>
    Boolean(
      data && canView(data.currentUser.permissions, sectionPermission[section]),
    );
  const mayManage = (section: Section) =>
    Boolean(
      data &&
      canManage(data.currentUser.permissions, sectionPermission[section]),
    );

  async function performAction(
    action: string,
    successMessage: string,
    details: Record<string, unknown> = {},
  ) {
    if (isActing) return false;
    setIsActing(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(publishableKey ? { apikey: publishableKey } : {}),
        },
        body: JSON.stringify({
          action,
          runId: currentRun?.id,
          vendorId: activeVendorId,
          unitId: activeUnitId,
          ...details,
        }),
      });
      const payload = (await response.json()) as AppData & { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Action could not be completed");
      setData(payload);
      const selectedRun = payload.runs.find(
        (run) => run.id === payload.selectedRunId,
      );
      if (["create-run", "import-workbook"].includes(action) && selectedRun) {
        setActiveVendorId(selectedRun.vendorId);
        setActiveUnitId(selectedRun.clientUnitId);
        setActivePeriod(selectedRun.payPeriod);
      }
      if (["create-vendor", "save-client"].includes(action) && !details.id) {
        const vendor = payload.vendors.find(
          (item) => item.code === String(details.code ?? "").toUpperCase(),
        );
        if (vendor) {
          setActiveVendorId(vendor.id);
          setActiveUnitId("");
        }
      }
      if (["create-unit", "save-unit"].includes(action) && !details.id) {
        const unit = payload.units.find(
          (item) =>
            item.vendorId === details.vendorId &&
            item.clientName === details.clientName &&
            item.unitName === details.unitName,
        );
        if (unit) {
          setActiveVendorId(unit.vendorId);
          setActiveUnitId(unit.id);
        }
      }
      if (["set-record-status", "delete-record"].includes(action)) {
        const currentClient = payload.vendors.find(
          (client) =>
            client.id === activeVendorId && client.status === "active",
        );
        const nextClient =
          currentClient ??
          payload.vendors.find((client) => client.status === "active");
        const currentEmployer = payload.units.find(
          (unit) =>
            unit.id === activeUnitId &&
            unit.vendorId === nextClient?.id &&
            unit.status === "active",
        );
        const nextEmployer =
          currentEmployer ??
          payload.units.find(
            (unit) =>
              unit.vendorId === nextClient?.id && unit.status === "active",
          );
        setActiveVendorId(nextClient?.id ?? "");
        setActiveUnitId(nextEmployer?.id ?? "");
      }
      setModal(null);
      setSelectedItem(null);
      setToast(successMessage);
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Action could not be completed",
      );
      return false;
    } finally {
      setIsActing(false);
    }
  }

  function selectVendor(vendorId: string) {
    setActiveVendorId(vendorId);
    const firstUnit = data?.units.find(
      (unit) => unit.vendorId === vendorId && unit.status === "active",
    );
    setActiveUnitId(firstUnit?.id ?? "");
  }

  async function updateRecordStatus(
    entityType: string,
    entityId: string,
    currentStatus: string,
    label: string,
  ) {
    const status = currentStatus === "active" ? "inactive" : "active";
    if (
      status === "inactive" &&
      !window.confirm(
        `Make ${label} inactive? Existing payroll history will be preserved.`,
      )
    )
      return;
    await performAction(
      "set-record-status",
      `${label} ${status === "active" ? "reactivated" : "made inactive"}`,
      { entityType, entityId, status },
    );
  }

  async function deleteRecord(
    entityType: string,
    entityId: string,
    label: string,
  ) {
    if (
      !window.confirm(
        `Permanently delete ${label}? This cannot be undone. Approved payroll history cannot be deleted.`,
      )
    )
      return;
    await performAction("delete-record", `${label} deleted`, {
      entityType,
      entityId,
    });
  }

  if (!data && accessError) {
    return (
      <main className="access-denied-page">
        <div className="access-denied-card">
          <span>
            <Icon name="alert" size={28} />
          </span>
          <h1>Payroll access unavailable</h1>
          <p>{accessError}</p>
          <small>
            Ask your Super Admin to add or reactivate your email under Users &
            Access.
          </small>
          {onSignOut ? (
            <button
              className="secondary-button"
              onClick={() => void onSignOut()}
            >
              Sign out and use another account
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="loading-page">
        <div className="loading-mark">
          <span>J</span>
        </div>
        <div className="loading-copy">
          <strong>Preparing your payroll workspace</strong>
          <span>Mapping attendance, salary and payment controls…</span>
        </div>
      </main>
    );
  }

  if (!visibleNavItems.length) {
    return (
      <main className="access-denied-page">
        <div className="access-denied-card">
          <span>
            <Icon name="alert" size={28} />
          </span>
          <h1>No modules assigned</h1>
          <p>
            Your payroll profile is active, but every module is set to No
            access.
          </p>
          <small>
            Ask your Super Admin to enable at least one module under Users &
            Access.
          </small>
          {onSignOut ? (
            <button
              className="secondary-button"
              onClick={() => void onSignOut()}
            >
              Sign out and use another account
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <span>J</span>
          </div>
          <div>
            <strong>JOY</strong>
            <small>Payroll Manager</small>
          </div>
        </div>
        <div className="sidebar-context">
          <span>WORKSPACE</span>
          <strong>People · Payroll · Digital</strong>
        </div>
        <nav aria-label="Application navigation">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              className={
                activeSection === item.id ? "nav-item nav-active" : "nav-item"
              }
              onClick={() => {
                setActiveSection(item.id);
                setMobileNavOpen(false);
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === "payroll" && currentRun?.issueCount ? (
                <b>{currentRun.issueCount}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <span className="help-icon">?</span>
          <div>
            <strong>Need a payroll check?</strong>
            <small>Review exceptions before approval.</small>
          </div>
        </div>
        <div className="sidebar-footer">
          <span>joycorporatesolutions.com</span>
          <span>v1.0</span>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-selectors">
            <label>
              <span>Group of company</span>
              <select
                value={activeVendorId}
                onChange={(event) => selectVendor(event.target.value)}
              >
                {!data.vendors.some((client) => client.status === "active") ? (
                  <option value="">Add a group company</option>
                ) : null}
                {data.vendors
                  .filter((client) => client.status === "active")
                  .map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
              </select>
            </label>
            <span className="selector-divider" />
            <label>
              <span>Client name / location</span>
              <select
                value={activeUnitId}
                onChange={(event) => setActiveUnitId(event.target.value)}
              >
                {!vendorUnits.length ? (
                  <option value="">Add a client location</option>
                ) : null}
                {vendorUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.clientName} · {unit.unitName}
                  </option>
                ))}
              </select>
            </label>
            {unitRuns.length ? (
              <>
                <span className="selector-divider period-divider" />
                <label className="period-selector">
                  <span>Payroll month</span>
                  <select
                    value={currentRun?.payPeriod ?? ""}
                    onChange={(event) => setActivePeriod(event.target.value)}
                  >
                    {unitRuns.map((run) => (
                      <option key={run.id} value={run.payPeriod}>
                        {monthLabel(run.payPeriod)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <div className="topbar-actions">
            {mayView("payroll") ? (
              <button
                className="icon-button"
                aria-label="Payroll issues"
                onClick={() => setActiveSection("payroll")}
              >
                <Icon name="alert" />
                <i>{currentRun?.issueCount ?? 0}</i>
              </button>
            ) : null}
            <button
              className="user-chip user-chip-button"
              onClick={() => setProfileOpen(true)}
            >
              <span>
                {initials(data.currentUser.fullName ?? displayName) || "PA"}
              </span>
              <div>
                <strong>{data.currentUser.fullName ?? displayName}</strong>
                <small>
                  {ROLE_LABELS[data.currentUser.role]} · Edit profile
                </small>
              </div>
            </button>
            {onSignOut ? (
              <button
                className="secondary-button"
                onClick={() => void onSignOut()}
              >
                Sign out
              </button>
            ) : null}
          </div>
        </header>

        <main className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">{title.eyebrow}</span>
              <h1>{title.title}</h1>
              <p>{title.description}</p>
            </div>
            <div className="heading-actions">
              {(mayManage("attendance") ||
                mayManage("payroll") ||
                mayManage("employees")) &&
              !["users", "vendors", "masters", "settings"].includes(
                activeSection,
              ) ? (
                <button
                  className="secondary-button"
                  onClick={() => setModal({ kind: "import" })}
                  disabled={!currentUnit}
                >
                  <Icon name="file" size={16} />
                  Import Excel
                </button>
              ) : null}
              {mayManage("payroll") &&
              !["users", "vendors", "masters", "settings"].includes(
                activeSection,
              ) ? (
                <button
                  className="period-chip period-button"
                  onClick={() => setModal({ kind: "run" })}
                  disabled={!currentUnit}
                >
                  <Icon name="calendar" size={17} />
                  <span>
                    {currentRun
                      ? `${monthLabel(currentRun.payPeriod)} · New month`
                      : "Create payroll month"}
                  </span>
                </button>
              ) : null}
            </div>
          </section>

          <div className="demo-banner">
            <span>
              <Icon name="file" size={17} />
            </span>
            <p>
              <strong>Excel-connected payroll workspace.</strong> Add or manage
              clients, employers and employees; import Attendance Input or
              Salary Register workbooks; edit attendance, salary and room
              recoveries before approval.
            </p>
          </div>

          {!currentRun &&
          ![
            "dashboard",
            "accommodation",
            "recoveries",
            "hostels",
            "reports",
            "vendors",
            "settings",
            "employees",
            "masters",
            "users",
          ].includes(activeSection) ? (
            <EmptyPayroll
              unit={currentUnit}
              canCreate={mayManage("payroll")}
              canImport={mayManage("attendance") || mayManage("payroll")}
              canOpenClients={mayView("vendors")}
              onGoToVendors={() => setActiveSection("vendors")}
              onCreate={() => setModal({ kind: "run" })}
              onImport={() => setModal({ kind: "import" })}
            />
          ) : null}

          {activeSection === "dashboard" ? (
            <>
              <WorkforceDashboard data={data} />
              {currentRun ? (
                <Dashboard
                  run={currentRun}
                  items={currentItems}
                  employees={operationalEmployees}
                  data={data}
                  onNavigate={(section) =>
                    mayView(section)
                      ? setActiveSection(section)
                      : setToast(
                          "Your profile does not have access to that module",
                        )
                  }
                />
              ) : null}
            </>
          ) : null}
          {activeSection === "payroll" && currentRun ? (
            <>
              <PayrollPeriodEditor
                key={currentRun.id}
                run={currentRun}
                canManage={mayManage("payroll")}
                isActing={isActing}
                onAction={performAction}
              />
              <PayrollRunView
                run={currentRun}
                items={currentItems}
                isActing={isActing}
                canManage={mayManage("payroll")}
                canManageEmployees={mayManage("employees")}
                canApprove={data.currentUser.canApprovePayroll}
                onAction={performAction}
                onSelect={setSelectedItem}
                onEmployees={() => setActiveSection("employees")}
              />
              <PayrollBatchPanel
                run={currentRun}
                items={currentItems}
                batches={data.payrollBatches.filter(
                  (batch) => batch.runId === currentRun.id,
                )}
                canPrepare={mayManage("payroll")}
                canClear={mayManage("payments")}
                isActing={isActing}
                onAction={performAction}
              />
            </>
          ) : null}
          {activeSection === "attendance" && currentRun ? (
            <AttendanceView
              period={currentRun.payPeriod}
              periodStart={currentRun.periodStart}
              periodEnd={currentRun.periodEnd}
              items={currentItems}
              employees={operationalEmployees}
              attendance={data.attendance.filter((entry) => {
                const range = payrollPeriodRange(
                  currentRun.payPeriod,
                  currentRun.periodStart,
                  currentRun.periodEnd,
                );
                return (
                  entry.attendanceDate >= range.start &&
                  entry.attendanceDate < range.end &&
                  operationalEmployees.some(
                    (employee) => employee.id === entry.employeeId,
                  )
                );
              })}
              canManage={mayManage("attendance")}
              onEdit={(employee, date, entry) =>
                setModal({ kind: "attendance", employee, date, entry })
              }
              onImport={() => setModal({ kind: "import" })}
              locked={
                currentRun.status === "approved" || !mayManage("attendance")
              }
            />
          ) : null}
          {activeSection === "employees" && currentUnit ? (
            <EmployeesView
              employees={currentEmployees}
              vendors={data.vendors}
              units={data.units}
              canManage={mayManage("employees")}
              onAdd={() => setModal({ kind: "employee" })}
              onEdit={(employee) => setModal({ kind: "employee", employee })}
              onImport={() => setModal({ kind: "import" })}
              onLeft={(employee) =>
                setModal({ kind: "employee-left", employee })
              }
              onReactivate={(employee) =>
                void performAction(
                  "reactivate-employee",
                  `${employee.name} reactivated`,
                  { employeeId: employee.id },
                )
              }
              onWorkflow={(employee) =>
                void performAction(
                  "advance-employee-workflow",
                  `${employee.name} moved to the next approval stage`,
                  { employeeId: employee.id },
                )
              }
            />
          ) : null}
          {activeSection === "employees" && !currentUnit ? (
            <EmptyPayroll
              unit={null}
              canCreate={mayManage("payroll")}
              canImport={mayManage("employees")}
              canOpenClients={mayView("vendors")}
              onGoToVendors={() => setActiveSection("vendors")}
              onCreate={() => setModal({ kind: "run" })}
              onImport={() => setModal({ kind: "import" })}
            />
          ) : null}
          {activeSection === "hostels" && currentVendor ? (
            <HostelMaster
              vendorId={activeVendorId}
              units={data.units.filter(
                (unit) => unit.vendorId === activeVendorId,
              )}
              types={currentTypes}
              hostels={data.hostels}
              rooms={data.accommodationRooms}
              employees={data.employees}
              readings={data.hostelUtilityReadings}
              expenses={data.roomExpenses}
              payPeriod={
                currentRun?.payPeriod ??
                activePeriod ??
                new Date().toISOString().slice(0, 7)
              }
              canManage={mayManage("accommodation")}
              canApprove={
                data.currentUser.role === "super_admin" ||
                data.currentUser.role === "hr_team"
              }
              isActing={isActing}
              onAction={performAction}
            />
          ) : null}
          {activeSection === "accommodation" && currentVendor ? (
            <>
              <AccommodationControlCenter
                vendorId={activeVendorId}
                types={currentTypes}
                hostels={data.hostels}
                units={data.units.filter(
                  (entry) => entry.vendorId === activeVendorId,
                )}
                rooms={data.accommodationRooms}
                employees={data.employees}
                expenses={data.roomExpenses}
                charges={data.accommodationCharges}
                runs={data.runs}
                payrollItems={data.payrollItems}
                payPeriod={
                  currentRun?.payPeriod ??
                  activePeriod ??
                  new Date().toISOString().slice(0, 7)
                }
                canManage={mayManage("accommodation")}
                isActing={isActing}
                onAction={performAction}
                onRoomStatus={(room) =>
                  updateRecordStatus(
                    "room",
                    room.id,
                    room.status,
                    `room ${room.roomNumber}`,
                  )
                }
                onDeleteRoom={(room) =>
                  deleteRecord("room", room.id, `room ${room.roomNumber}`)
                }
              />
              {currentRun ? (
                <AccommodationView
                  types={currentTypes}
                  items={currentItems}
                  employees={currentEmployees}
                  charges={data.accommodationCharges.filter(
                    (charge) => charge.runId === currentRun.id,
                  )}
                  canManage={mayManage("accommodation")}
                  onAdd={() => setModal({ kind: "accommodation" })}
                  onEdit={(employee, charge) =>
                    setModal({ kind: "accommodation", employee, charge })
                  }
                  locked={
                    currentRun.status === "approved" ||
                    !mayManage("accommodation")
                  }
                />
              ) : null}
            </>
          ) : null}
          {activeSection === "recoveries" ? (
            <RecoveryCenter
              run={currentRun}
              employees={currentEmployees}
              items={currentItems}
              charges={data.accommodationCharges}
              data={data}
              canManage={
                mayManage("recoveries") && currentRun?.status !== "approved"
              }
              canApprove={
                data.currentUser.role === "super_admin" ||
                data.currentUser.canApprovePayroll
              }
              isActing={isActing}
              onAction={performAction}
            />
          ) : null}
          {activeSection === "payments" && currentRun ? (
            <>
              <PaymentsView
                run={currentRun}
                items={currentItems}
                employees={currentEmployees}
                vendor={currentVendor!}
                unit={currentUnit!}
                canExport={mayManage("payments")}
                onPayslip={setPayslipItem}
                onBulkPayslips={() => setBulkPayslipsOpen(true)}
              />
              <PayrollBatchPanel
                run={currentRun}
                items={currentItems}
                batches={data.payrollBatches.filter(
                  (batch) => batch.runId === currentRun.id,
                )}
                canPrepare={mayManage("payroll")}
                canClear={mayManage("payments")}
                isActing={isActing}
                onAction={performAction}
              />
            </>
          ) : null}
          {activeSection === "vendors" ? (
            <VendorsView
              vendors={data.vendors}
              units={data.units}
              activeVendorId={activeVendorId}
              canManage={mayManage("vendors")}
              onSelect={(vendorId, unitId) => {
                setActiveVendorId(vendorId);
                setActiveUnitId(unitId);
              }}
              onAddVendor={() => setModal({ kind: "vendor" })}
              onEditVendor={(vendor) => setModal({ kind: "vendor", vendor })}
              onAddUnit={() => setModal({ kind: "unit" })}
              onEditUnit={(unit) => setModal({ kind: "unit", unit })}
              onVendorStatus={(vendor) =>
                updateRecordStatus(
                  "client",
                  vendor.id,
                  vendor.status,
                  vendor.name,
                )
              }
              onDeleteVendor={(vendor) =>
                deleteRecord("client", vendor.id, vendor.name)
              }
              onUnitStatus={(unit) =>
                updateRecordStatus(
                  "unit",
                  unit.id,
                  unit.status,
                  `${unit.clientName} · ${unit.unitName}`,
                )
              }
              onDeleteUnit={(unit) =>
                deleteRecord(
                  "unit",
                  unit.id,
                  `${unit.clientName} · ${unit.unitName}`,
                )
              }
            />
          ) : null}
          {activeSection === "masters" && currentVendor ? (
            <MasterDataView
              client={currentVendor}
              types={currentTypes}
              rooms={data.accommodationRooms}
              employees={data.employees}
              shifts={currentShifts}
              remarks={currentRemarks}
              canManage={mayManage("masters")}
              onAddType={() => setModal({ kind: "accommodation-type" })}
              onEditType={(accommodationType) =>
                setModal({ kind: "accommodation-type", accommodationType })
              }
              onTypeStatus={(type) =>
                updateRecordStatus(
                  "accommodation_type",
                  type.id,
                  type.status,
                  type.name,
                )
              }
              onDeleteType={(type) =>
                deleteRecord("accommodation_type", type.id, type.name)
              }
              onAddShift={() => setModal({ kind: "shift" })}
              onEditShift={(shift) => setModal({ kind: "shift", shift })}
              onShiftStatus={(shift) =>
                updateRecordStatus("shift", shift.id, shift.status, shift.name)
              }
              onDeleteShift={(shift) =>
                deleteRecord("shift", shift.id, shift.name)
              }
              onAddRemark={() => setModal({ kind: "remark" })}
              onEditRemark={(remark) => setModal({ kind: "remark", remark })}
              onRemarkStatus={(remark) =>
                updateRecordStatus(
                  "remark",
                  remark.id,
                  remark.status,
                  remark.title,
                )
              }
              onDeleteRemark={(remark) =>
                deleteRecord("remark", remark.id, remark.title)
              }
            />
          ) : null}
          {activeSection === "masters" && !currentVendor ? (
            <EmptyPayroll
              unit={null}
              canCreate={mayManage("payroll")}
              canImport={mayManage("masters")}
              canOpenClients={mayView("vendors")}
              onGoToVendors={() => setActiveSection("vendors")}
              onCreate={() => setModal({ kind: "run" })}
              onImport={() => setModal({ kind: "import" })}
            />
          ) : null}
          {activeSection === "operations" ? (
            <OperationsView
              data={data}
              canManage={mayManage("operations")}
              canApprove={
                data.currentUser.role === "super_admin" ||
                data.currentUser.role === "hr_team"
              }
              isActing={isActing}
              onAction={performAction}
            />
          ) : null}
          {activeSection === "reports" ? (
            <ReportsCenter
              data={data}
              run={currentRun}
              items={currentItems}
              vendorId={activeVendorId}
              unitId={activeUnitId}
            />
          ) : null}
          {activeSection === "users" ? (
            <UsersAccessView
              users={data.appUsers}
              vendors={data.vendors}
              units={data.units}
              currentUser={data.currentUser}
              canManage={
                data.currentUser.role === "super_admin" && mayManage("users")
              }
              onAdd={() => setModal({ kind: "app-user" })}
              onEdit={(profile) => setModal({ kind: "app-user", profile })}
              onStatus={(profile) =>
                updateRecordStatus(
                  "app_user",
                  profile.id,
                  profile.status,
                  profile.fullName ?? profile.email,
                )
              }
              onDelete={(profile) =>
                deleteRecord(
                  "app_user",
                  profile.id,
                  profile.fullName ?? profile.email,
                )
              }
            />
          ) : null}
          {activeSection === "settings" && currentVendor ? (
            <SettingsView
              key={currentVendor.id}
              vendor={currentVendor}
              rules={currentRules}
              canManage={mayManage("settings")}
              isActing={isActing}
              onSave={(rules) =>
                performAction("save-rules", "Payroll rules saved", {
                  vendorId: currentVendor.id,
                  rules,
                })
              }
            />
          ) : null}
        </main>
      </div>

      {selectedItem ? (
        <PayrollDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onPayslip={() => {
            setPayslipItem(selectedItem);
            setSelectedItem(null);
          }}
          onEdit={() => {
            setModal({ kind: "salary", item: selectedItem });
            setSelectedItem(null);
          }}
          locked={currentRun?.status === "approved" || !mayManage("payroll")}
        />
      ) : null}
      {payslipItem && currentVendor && currentUnit ? (
        <PayslipModal
          item={payslipItem}
          vendor={currentVendor}
          unit={currentUnit}
          run={currentRun}
          period={currentRun?.payPeriod ?? new Date().toISOString().slice(0, 7)}
          canExport={mayManage("payroll") || mayManage("payments")}
          onClose={() => setPayslipItem(null)}
        />
      ) : null}
      {bulkPayslipsOpen && currentVendor && currentUnit && currentRun ? (
        <BulkPayslipModal
          items={currentItems}
          vendor={currentVendor}
          unit={currentUnit}
          run={currentRun}
          onClose={() => setBulkPayslipsOpen(false)}
        />
      ) : null}
      {profileOpen ? (
        <ProfileModal
          profile={data.currentUser}
          busy={isActing}
          onClose={() => setProfileOpen(false)}
          onSave={async (details) => {
            const ok = await performAction(
              "save-own-profile",
              "Profile details updated",
              details,
            );
            if (ok) setProfileOpen(false);
          }}
          onChangePassword={onChangePassword}
        />
      ) : null}
      {modal ? (
        <PayrollActionModal
          modal={modal}
          vendors={data.vendors}
          units={data.units}
          hostels={data.hostels}
          accommodationTypes={currentTypes}
          rooms={data.accommodationRooms.filter(
            (room) => room.vendorId === activeVendorId,
          )}
          employees={currentEmployees}
          shifts={currentShifts}
          remarks={currentRemarks}
          unit={currentUnit}
          vendorId={activeVendorId}
          currentPeriod={
            currentRun?.payPeriod ??
            activePeriod ??
            new Date().toISOString().slice(0, 7)
          }
          currentRun={currentRun}
          busy={isActing}
          onClose={() => setModal(null)}
          onAction={performAction}
        />
      ) : null}
      {toast ? (
        <div className="toast">
          <Icon name="check" size={17} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Dashboard({
  run,
  items,
  employees,
  data,
  onNavigate,
}: {
  run: PayrollRun;
  items: PayrollItem[];
  employees: Employee[];
  data: AppData;
  onNavigate: (section: Section) => void;
}) {
  const issueItems = items.filter((item) => item.validationStatus !== "ready");
  const paymentBankPercent = run.netPayable
    ? Math.round((run.bankPayable / run.netPayable) * 100)
    : 0;
  const departmentCounts = Array.from(
    new Set(items.map((item) => item.department)),
  ).map((department) => ({
    department,
    count: items.filter((item) => item.department === department).length,
    amount: items
      .filter((item) => item.department === department)
      .reduce((sum, item) => sum + item.netPayable, 0),
  }));
  const maxAmount = Math.max(...departmentCounts.map((row) => row.amount), 1);
  const workflow = [
    {
      label: "Attendance",
      detail: `${items.reduce((sum, item) => sum + item.presentDays, 0)} present days`,
      state: "complete",
    },
    {
      label: "Salary calculated",
      detail: `${items.length} employees`,
      state: "complete",
    },
    {
      label: "Validation",
      detail: run.issueCount ? `${run.issueCount} issues` : "All checks passed",
      state: run.issueCount ? "attention" : "complete",
    },
    {
      label: "Approval",
      detail: run.status === "approved" ? "Approved" : "Pending",
      state: run.status === "approved" ? "complete" : "pending",
    },
    {
      label: "Payment",
      detail: run.status === "approved" ? "Ready to export" : "Locked",
      state: run.status === "approved" ? "ready" : "pending",
    },
  ];

  return (
    <div className="section-stack">
      <section className="kpi-grid">
        <MetricCard
          label="Employees in run"
          value={String(run.employeeCount)}
          note={`${employees.filter((employee) => employee.paymentMode === "bank").length} bank · ${employees.filter((employee) => employee.paymentMode === "cash").length} cash`}
          tone="blue"
          icon="users"
        />
        <MetricCard
          label="Gross earnings"
          value={compactMoney(run.grossEarnings)}
          note="Before all deductions"
          tone="violet"
          icon="calculator"
        />
        <MetricCard
          label="Total deductions"
          value={compactMoney(
            run.statutoryDeductions +
              run.otherDeductions +
              run.accommodationDeductions,
          )}
          note={`${compactMoney(run.statutoryDeductions)} statutory`}
          tone="amber"
          icon="file"
        />
        <MetricCard
          label="Net payable"
          value={compactMoney(run.netPayable)}
          note={`${paymentBankPercent}% through bank`}
          tone="green"
          icon="bank"
        />
        <MetricCard
          label="Exceptions"
          value={String(run.issueCount)}
          note={
            run.issueCount
              ? "Resolve before approval"
              : "Payroll is validation-ready"
          }
          tone={run.issueCount ? "red" : "green"}
          icon="alert"
        />
      </section>

      <section className="panel workflow-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Month-end control</span>
            <h2>Payroll readiness</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate("payroll")}>
            Open payroll run <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="workflow-line">
          {workflow.map((step, index) => (
            <div
              className={`workflow-step workflow-${step.state}`}
              key={step.label}
            >
              <div className="workflow-marker">
                {step.state === "complete" ? (
                  <Icon name="check" size={15} />
                ) : (
                  index + 1
                )}
              </div>
              <div>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </div>
              {index < workflow.length - 1 ? <i /> : null}
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Net payroll mix</span>
              <h2>Department view</h2>
            </div>
            <span className="muted-label">{money(run.netPayable)} total</span>
          </div>
          <div className="bar-list">
            {departmentCounts.map((row) => (
              <div className="bar-row" key={row.department}>
                <div>
                  <strong>{row.department}</strong>
                  <span>
                    {row.count} employee{row.count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="bar-track">
                  <i
                    style={{
                      width: `${Math.max(10, (row.amount / maxAmount) * 100)}%`,
                    }}
                  />
                </div>
                <b>{money(row.amount)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel payment-mix-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Payment mode</span>
              <h2>Bank vs cash</h2>
            </div>
          </div>
          <div className="payment-mix">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#2677f2 0 ${paymentBankPercent}%, #f2a94b ${paymentBankPercent}% 100%)`,
              }}
            >
              <span>
                <strong>{paymentBankPercent}%</strong>
                <small>bank pay</small>
              </span>
            </div>
            <div className="mix-legend">
              <div>
                <i className="legend-bank" />
                <span>
                  <strong>{money(run.bankPayable)}</strong>
                  <small>Bank transfer</small>
                </span>
              </div>
              <div>
                <i className="legend-cash" />
                <span>
                  <strong>{money(run.cashPayable)}</strong>
                  <small>Cash payable</small>
                </span>
              </div>
            </div>
          </div>
          <button
            className="secondary-button full-button"
            onClick={() => onNavigate("payments")}
          >
            Prepare payment outputs
          </button>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Validation queue</span>
            <h2>Exceptions requiring action</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate("payroll")}>
            {issueItems.length ? "Review all" : "View payroll"}{" "}
            <Icon name="arrow" size={16} />
          </button>
        </div>
        {issueItems.length ? (
          <div className="exception-list">
            {issueItems.map((item) => (
              <div className="exception-row" key={item.id}>
                <span className="employee-avatar">
                  {initials(item.employeeName)}
                </span>
                <div>
                  <strong>{item.employeeName}</strong>
                  <small>
                    {item.employeeCode} · {item.department}
                  </small>
                </div>
                <span className="exception-message">
                  <Icon name="alert" size={16} />
                  {item.validationMessage}
                </span>
                <b>{money(item.netPayable)}</b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="check"
            title="No payroll exceptions"
            detail="All employee and calculation checks are ready for approval."
          />
        )}
      </section>

      {data.auditEvents.length ? (
        <section className="panel compact-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Control history</span>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="activity-row">
            {data.auditEvents
              .slice(-3)
              .reverse()
              .map((event) => (
                <div key={event.id}>
                  <span>
                    <Icon name="check" size={15} />
                  </span>
                  <p>
                    <strong>{event.summary}</strong>
                    <small>{event.actorEmail ?? "Payroll system"}</small>
                  </p>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
  icon: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <i>
          <Icon name={icon} size={18} />
        </i>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function PayrollRunView({
  run,
  items,
  isActing,
  canManage,
  canManageEmployees,
  canApprove,
  onAction,
  onSelect,
  onEmployees,
}: {
  run: PayrollRun;
  items: PayrollItem[];
  isActing: boolean;
  canManage: boolean;
  canManageEmployees: boolean;
  canApprove: boolean;
  onAction: (action: string, message: string) => Promise<boolean>;
  onSelect: (item: PayrollItem) => void;
  onEmployees: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = items.filter((item) => {
    const matchesQuery =
      `${item.employeeCode} ${item.employeeName} ${item.department}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "review"
        ? item.validationStatus !== "ready"
        : item.validationStatus === "ready");
    return matchesQuery && matchesFilter;
  });
  function exportPayroll() {
    downloadCsv(`payroll-register-${run.payPeriod}.csv`, [
      [
        "Emp ID",
        "Employee",
        "Department",
        "Present",
        "Absent",
        "Leave",
        "WO/H",
        "Holiday Present",
        "Payable Days",
        "OT Hours",
        "Gross Earnings",
        "Salary Deductions",
        "Accommodation Deductions",
        "Return Amount",
        "Net Payable",
        "Payment Mode",
        "Validation",
      ],
      ...visible.map((item) => [
        item.employeeCode,
        item.employeeName,
        item.department,
        item.presentDays,
        item.absentDays,
        item.leaveDays,
        item.weekOffDays,
        item.holidayPresentDays,
        item.payableDays,
        item.overtimeHours,
        item.grossEarnings,
        item.totalDeductions - item.accommodationDeduction,
        item.accommodationDeduction,
        item.returnAmount,
        item.netPayable,
        item.paymentMode,
        item.validationStatus,
      ]),
    ]);
  }
  return (
    <div className="section-stack">
      <section
        className={`run-command ${run.status === "approved" ? "command-approved" : run.issueCount ? "command-attention" : "command-ready"}`}
      >
        <div className="command-icon">
          {run.status === "approved" ? (
            <Icon name="check" />
          ) : (
            <Icon name={run.issueCount ? "alert" : "calculator"} />
          )}
        </div>
        <div>
          <span className="eyebrow">
            Run {run.id} ·{" "}
            {run.processingMode === "salary_import"
              ? "Imported salary source"
              : "Application attendance source"}
          </span>
          <h2>
            {run.status === "approved"
              ? "Payroll approved"
              : !items.length
                ? "Add employees to start payroll"
                : run.issueCount
                  ? `${run.issueCount} employee records need review`
                  : run.grossEarnings <= 0
                    ? "Add attendance or salary amounts"
                    : "Payroll passed all validation checks"}
          </h2>
          <p>
            {run.status === "approved"
              ? `Approved by ${run.approvedBy ?? "Payroll approver"}. Payment exports are unlocked.`
              : !items.length
                ? "Add or import employees, then record their attendance and salary."
                : run.issueCount
                  ? "Update employee bank or statutory details, then recheck the run."
                  : run.grossEarnings <= 0
                    ? "Record attendance or open an employee salary row to enter earnings."
                    : run.processingMode === "salary_import"
                      ? "Imported salary-slip headers are authoritative; review recoveries and approve."
                      : "Review the attendance-based calculations, then approve the final salary run."}
          </p>
        </div>
        <div className="command-actions">
          {canManage ? (
            <>
              {run.status !== "approved" ? (
                <>
                  <button
                    className="secondary-button"
                    disabled={isActing}
                    onClick={() =>
                      onAction(
                        "recalculate",
                        run.processingMode === "salary_import"
                          ? "Imported salary totals recalculated"
                          : "Attendance and payroll totals recalculated",
                      )
                    }
                  >
                    {isActing ? (
                      <span className="button-spinner" />
                    ) : (
                      <Icon name="refresh" size={17} />
                    )}
                    {run.processingMode === "salary_import"
                      ? "Refresh totals"
                      : "Recalculate attendance"}
                  </button>
                  <button
                    className="danger-button"
                    disabled={isActing}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete the ${monthLabel(run.payPeriod)} payroll run? Salary calculations and accommodation recoveries will be removed, but attendance history will remain.`,
                        )
                      )
                        void onAction(
                          "delete-payroll-run",
                          "Payroll run deleted; attendance history preserved",
                        );
                    }}
                  >
                    Delete run
                  </button>
                </>
              ) : null}
              {!items.length ? (
                canManageEmployees ? (
                  <button className="primary-button" onClick={onEmployees}>
                    + Add employees
                  </button>
                ) : (
                  <span className="access-mode-note">
                    HR must add employees
                  </span>
                )
              ) : run.issueCount ? (
                <>
                  <button
                    className="secondary-button"
                    disabled={isActing}
                    onClick={() =>
                      onAction("resolve-issues", "Employee records checked")
                    }
                  >
                    Recheck
                  </button>
                  {canManageEmployees ? (
                    <button className="primary-button" onClick={onEmployees}>
                      Edit employee records
                    </button>
                  ) : null}
                </>
              ) : run.status !== "approved" ? (
                canApprove ? (
                  <button
                    className="primary-button"
                    disabled={isActing || run.grossEarnings <= 0}
                    onClick={() =>
                      onAction(
                        "approve",
                        "Payroll approved and payment outputs unlocked",
                      )
                    }
                  >
                    <Icon name="check" size={17} />
                    Approve payroll
                  </button>
                ) : (
                  <span className="access-mode-note">
                    <Icon name="alert" size={15} />
                    Awaiting an authorised approver
                  </span>
                )
              ) : (
                <button
                  className="secondary-button"
                  disabled={isActing}
                  onClick={() =>
                    onAction("reopen", "Payroll reopened for corrections")
                  }
                >
                  <Icon name="refresh" size={17} />
                  Reopen payroll
                </button>
              )}
            </>
          ) : (
            <span className="access-mode-note">
              <Icon name="eye" size={15} />
              View-only payroll access
            </span>
          )}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label="Search employee"
              placeholder="Search employee, ID or department"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="filter-tabs">
            <button
              className={filter === "all" ? "filter-active" : ""}
              onClick={() => setFilter("all")}
            >
              All <span>{items.length}</span>
            </button>
            <button
              className={filter === "ready" ? "filter-active" : ""}
              onClick={() => setFilter("ready")}
            >
              Ready{" "}
              <span>
                {
                  items.filter((item) => item.validationStatus === "ready")
                    .length
                }
              </span>
            </button>
            <button
              className={filter === "review" ? "filter-active" : ""}
              onClick={() => setFilter("review")}
            >
              Review{" "}
              <span>
                {
                  items.filter((item) => item.validationStatus !== "ready")
                    .length
                }
              </span>
            </button>
          </div>
          {canManage ? (
            <button className="secondary-button" onClick={exportPayroll}>
              <Icon name="download" size={16} />
              Excel-compatible CSV
            </button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table payroll-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Payable / OT</th>
                <th>Gross earnings</th>
                <th>Salary deductions</th>
                <th>Accommodation</th>
                <th>Net payable</th>
                <th>Validation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <EmployeeCell
                      name={item.employeeName}
                      code={item.employeeCode}
                      detail={item.department}
                    />
                  </td>
                  <td>
                    <strong>{item.payableDays} days</strong>
                    <small>{item.overtimeHours} OT hrs</small>
                  </td>
                  <td>{money(item.grossEarnings)}</td>
                  <td>
                    {money(item.totalDeductions - item.accommodationDeduction)}
                  </td>
                  <td>
                    {money(item.accommodationDeduction)}
                    <small>{item.accommodationType}</small>
                  </td>
                  <td className="net-cell">{money(item.netPayable)}</td>
                  <td>
                    <StatusPill
                      status={
                        item.validationStatus === "ready" ? "Ready" : "Review"
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="row-action"
                      aria-label={`Review ${item.employeeName}`}
                      onClick={() => onSelect(item)}
                    >
                      <Icon name="chevron" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>{visible.length} employees</strong>
                </td>
                <td>
                  {money(
                    visible.reduce((sum, item) => sum + item.grossEarnings, 0),
                  )}
                </td>
                <td>
                  {money(
                    visible.reduce(
                      (sum, item) =>
                        sum +
                        item.totalDeductions -
                        item.accommodationDeduction,
                      0,
                    ),
                  )}
                </td>
                <td>
                  {money(
                    visible.reduce(
                      (sum, item) => sum + item.accommodationDeduction,
                      0,
                    ),
                  )}
                </td>
                <td>
                  {money(
                    visible.reduce((sum, item) => sum + item.netPayable, 0),
                  )}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function AttendanceView({
  period,
  periodStart,
  periodEnd,
  items,
  employees,
  attendance,
  canManage,
  onEdit,
  onImport,
  locked,
}: {
  period: string;
  periodStart: string | null;
  periodEnd: string | null;
  items: PayrollItem[];
  employees: Employee[];
  attendance: AttendanceEntry[];
  canManage: boolean;
  onEdit: (employee: Employee, date: string, entry?: AttendanceEntry) => void;
  onImport: () => void;
  locked: boolean;
}) {
  const range = payrollPeriodRange(period, periodStart, periodEnd);
  const dates = Array.from({ length: range.days }, (_, index) => {
    const date = new Date(`${range.start}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const entryMap = new Map(
    attendance.map((entry) => [
      `${entry.employeeId}:${entry.attendanceDate}`,
      entry,
    ]),
  );
  const followups = items.filter(
    (item) => item.absentDays >= 2 || item.leaveDays >= 2,
  );
  function exportAttendance() {
    downloadCsv(`attendance-${period}.csv`, [
      [
        "Emp ID",
        "Name",
        "Department",
        "Default shift",
        ...dates.map((date) => date.slice(8)),
      ],
      ...employees.map((employee) => [
        employee.employeeCode,
        employee.name,
        employee.department,
        employee.defaultShift,
        ...dates.map(
          (date) => entryMap.get(`${employee.id}:${date}`)?.statusCode ?? "",
        ),
      ]),
    ]);
  }
  return (
    <div className="section-stack">
      <section className="rule-callout">
        <span>
          <Icon name="calendar" />
        </span>
        <div>
          <strong>
            {locked
              ? "This attendance register is read only."
              : "Click any date to enter attendance, shift, and overtime."}
          </strong>
          <p>
            Shifts can change every day and week offs may occur on any weekday.
            Import the original Attendance Input workbook to fill the whole
            month.
          </p>
        </div>
      </section>
      <section className="kpi-grid attendance-kpis">
        <MetricCard
          label="Present days"
          value={String(items.reduce((sum, item) => sum + item.presentDays, 0))}
          note="Includes holiday present"
          tone="green"
          icon="check"
        />
        <MetricCard
          label="Absent days"
          value={String(items.reduce((sum, item) => sum + item.absentDays, 0))}
          note={`${followups.length} follow-up cases`}
          tone="red"
          icon="alert"
        />
        <MetricCard
          label="Leave days"
          value={String(items.reduce((sum, item) => sum + item.leaveDays, 0))}
          note="Continuous streak tracked"
          tone="violet"
          icon="calendar"
        />
        <MetricCard
          label="Holiday work"
          value={String(
            items.reduce((sum, item) => sum + item.holidayPresentDays, 0),
          )}
          note="Feeds holiday wages"
          tone="amber"
          icon="calculator"
        />
        <MetricCard
          label="OT hours"
          value={String(
            items.reduce((sum, item) => sum + item.overtimeHours, 0),
          )}
          note="Feeds overtime wages"
          tone="blue"
          icon="calculator"
        />
      </section>
      <section className="panel table-panel">
        <div className="panel-heading attendance-heading">
          <div>
            <span className="eyebrow">{monthLabel(period)} daily roster</span>
            <h2>Attendance + shift matrix</h2>
          </div>
          <div className="attendance-toolbar">
            {canManage ? (
              <>
                <button className="secondary-button" onClick={exportAttendance}>
                  <Icon name="download" size={15} />
                  Export CSV
                </button>
                <button
                  className="primary-button"
                  onClick={onImport}
                  disabled={locked}
                >
                  Import attendance
                </button>
              </>
            ) : (
              <span className="access-mode-note">
                <Icon name="eye" size={15} />
                View only
              </span>
            )}
          </div>
        </div>
        <div className="status-legend attendance-legend">
          {Object.entries(statusMeta).map(([code, meta]) => (
            <span key={code}>
              <i className={meta.className}>{code}</i>
              {meta.label}
            </span>
          ))}
        </div>
        <div className="table-scroll">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th className="sticky-col">Employee</th>
                {dates.map((date) => (
                  <th key={date}>
                    <strong>
                      {new Date(`${date}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "short" },
                      )}
                    </strong>
                    <small>
                      {new Date(`${date}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        { weekday: "short" },
                      )}
                    </small>
                  </th>
                ))}
                <th>Monthly summary</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const item = items.find(
                  (row) => row.employeeId === employee.id,
                );
                return (
                  <tr key={employee.id}>
                    <td className="sticky-col">
                      <EmployeeCell
                        name={employee.name}
                        code={employee.employeeCode}
                        detail={employee.department}
                      />
                    </td>
                    {dates.map((date) => {
                      const entry = entryMap.get(`${employee.id}:${date}`);
                      return (
                        <td key={date}>
                          <button
                            className="attendance-edit"
                            disabled={locked}
                            title={`${employee.name} · ${date}`}
                            onClick={() => onEdit(employee, date, entry)}
                          >
                            {entry ? (
                              <div className="attendance-mark">
                                <b
                                  className={
                                    statusMeta[entry.statusCode]?.className ??
                                    ""
                                  }
                                >
                                  {entry.statusCode}
                                </b>
                                <span>
                                  {entry.shiftCode.replace(" Shift", "")}
                                </span>
                                {entry.overtimeHours ? (
                                  <em>+{entry.overtimeHours}h</em>
                                ) : null}
                              </div>
                            ) : (
                              <span className="missing-mark">+</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <div className="attendance-summary">
                        <strong>{item?.presentDays ?? 0} P</strong>
                        <span>
                          {item?.absentDays ?? 0} A · {item?.leaveDays ?? 0} L
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!employees.length ? (
          <EmptyState
            icon="users"
            title="No employees yet"
            detail="Add employees or import the Attendance Input workbook to begin."
          />
        ) : null}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HR follow-up</span>
              <h2>Continuous absent / leave</h2>
            </div>
          </div>
          {followups.length ? (
            <div className="compact-list">
              {followups.map((item) => (
                <div key={item.id}>
                  <EmployeeCell
                    name={item.employeeName}
                    code={item.employeeCode}
                    detail={item.department}
                  />
                  <span>
                    <b>{item.absentDays} A</b>
                    <b>{item.leaveDays} L</b>
                  </span>
                  <StatusPill
                    status={item.absentDays >= 3 ? "High" : "Follow-up"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="No follow-ups"
              detail="No continuous absent or leave streaks exceed the threshold."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">High attendance</span>
              <h2>Maximum working days</h2>
            </div>
          </div>
          <div className="rank-list">
            {[...items]
              .sort((a, b) => b.presentDays - a.presentDays)
              .slice(0, 5)
              .map((item, index) => (
                <div key={item.id}>
                  <span>{index + 1}</span>
                  <EmployeeCell
                    name={item.employeeName}
                    code={item.employeeCode}
                    detail={item.department}
                  />
                  <strong>
                    {item.presentDays + item.holidayPresentDays}
                    <small>worked</small>
                  </strong>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmployeesView({
  employees,
  vendors,
  units,
  canManage,
  onAdd,
  onEdit,
  onImport,
  onLeft,
  onReactivate,
  onWorkflow,
}: {
  employees: Employee[];
  vendors: Vendor[];
  units: ClientUnit[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (employee: Employee) => void;
  onImport: () => void;
  onLeft: (employee: Employee) => void;
  onReactivate: (employee: Employee) => void;
  onWorkflow: (employee: Employee) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cardEmployee, setCardEmployee] = useState<Employee | null>(null);
  const activeEmployees = employees.filter(
    (employee) => employee.status === "active",
  );
  const ready = activeEmployees.filter(
    (employee) => employee.complianceStatus === "ready",
  ).length;
  const visible = employees.filter(
    (employee) =>
      `${employee.employeeCode} ${employee.name} ${employee.department}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (statusFilter === "all" || employee.status === statusFilter),
  );
  function exportEmployees() {
    downloadCsv("employee-master.csv", [
      [
        "Emp ID",
        "Name",
        "Department",
        "Date of Joining",
        "UAN",
        "ESI",
        "Bank Account",
        "IFSC",
        "Bank Name",
        "Accommodation Type",
        "Room",
        "Payment Mode",
        "Salary Amount",
        "Salary Basis",
        "Default Shift",
        "Readiness",
        "Status",
      ],
      ...visible.map((employee) => [
        employee.employeeCode,
        employee.name,
        employee.department,
        employee.dateOfJoining,
        employee.uanMasked ?? "",
        employee.esiMasked ?? "",
        employee.bankAccountMasked ?? "",
        employee.ifscMasked ?? "",
        employee.bankName ?? "",
        employee.accommodationType,
        employee.roomNumber ?? "",
        employee.paymentMode,
        employee.salaryAmount,
        employee.salaryBasis,
        employee.defaultShift,
        employee.complianceStatus,
        employee.status,
      ]),
    ]);
  }
  return (
    <div className="section-stack">
      <section className="kpi-grid attendance-kpis">
        <MetricCard
          label="Active employees"
          value={String(activeEmployees.length)}
          note={`${employees.length - activeEmployees.length} left / inactive records`}
          tone="blue"
          icon="users"
        />
        <MetricCard
          label="Payroll ready"
          value={String(ready)}
          note={`${Math.round((ready / Math.max(activeEmployees.length, 1)) * 100)}% complete`}
          tone="green"
          icon="check"
        />
        <MetricCard
          label="Statutory pending"
          value={String(
            activeEmployees.filter(
              (employee) => !employee.uanMasked || !employee.esiMasked,
            ).length,
          )}
          note="UAN or ESI missing"
          tone="red"
          icon="alert"
        />
        <MetricCard
          label="Bank pending"
          value={String(
            activeEmployees.filter(
              (employee) => !employee.bankAccountMasked || !employee.ifscMasked,
            ).length,
          )}
          note="Account number or IFSC missing"
          tone="amber"
          icon="bank"
        />
        <MetricCard
          label="Room allocated"
          value={String(
            activeEmployees.filter((employee) => employee.roomId).length,
          )}
          note="Employees assigned to rooms"
          tone="violet"
          icon="home"
        />
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label="Search employee master"
              placeholder="Search employee master"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="filter-tabs">
            <button
              className={statusFilter === "all" ? "filter-active" : ""}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              className={statusFilter === "active" ? "filter-active" : ""}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </button>
            <button
              className={statusFilter === "inactive" ? "filter-active" : ""}
              onClick={() => setStatusFilter("inactive")}
            >
              Left
            </button>
          </div>
          {canManage ? (
            <>
              <button className="secondary-button" onClick={exportEmployees}>
                Export CSV
              </button>
              <button className="secondary-button" onClick={onImport}>
                Import Excel
              </button>
              <button className="primary-button" onClick={onAdd}>
                + Add employee
              </button>
            </>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type / dates</th>
                <th>Salary</th>
                <th>Compliance</th>
                <th>Workflow</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <EmployeeCell
                      name={employee.name}
                      code={employee.employeeCode}
                      detail={employee.department}
                    />
                  </td>
                  <td>
                    <strong>
                      {employee.employmentType === "direct"
                        ? "Direct Joy employee"
                        : "Client employee"}
                    </strong>
                    <small>
                      Joined {employee.dateOfJoining}
                      {employee.dateOfLeaving
                        ? ` · Left ${employee.dateOfLeaving}`
                        : ""}
                    </small>
                  </td>
                  <td>
                    {money(employee.salaryAmount)}
                    <small>
                      {employee.salaryBasis} · {employee.defaultShift}
                    </small>
                  </td>
                  <td>
                    <FieldState
                      value={
                        employee.uanMasked && employee.esiMasked
                          ? "EPF / ESI ready"
                          : null
                      }
                    />
                    <small>
                      {employee.bankAccountMasked
                        ? "Bank ready"
                        : "Bank pending"}
                    </small>
                  </td>
                  <td>
                    <StatusPill
                      status={readableField(employee.processingStage)}
                    />
                    {canManage && employee.processingStage !== "approved" ? (
                      <button
                        className="record-action"
                        onClick={() => onWorkflow(employee)}
                      >
                        Finalize next stage
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill
                      status={employee.status === "active" ? "Active" : "Left"}
                    />
                  </td>
                  <td>
                    <div className="record-actions">
                      <button
                        className="record-action"
                        onClick={() => setCardEmployee(employee)}
                      >
                        ID card + QR
                      </button>
                      {canManage ? (
                        <>
                          <button
                            className="record-action"
                            onClick={() => onEdit(employee)}
                          >
                            Edit
                          </button>
                          {employee.status === "active" ? (
                            <button
                              className="record-action record-delete"
                              onClick={() => onLeft(employee)}
                            >
                              Put left date
                            </button>
                          ) : (
                            <button
                              className="record-action"
                              onClick={() => onReactivate(employee)}
                            >
                              Reactivate
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {cardEmployee ? (
        <EmployeeIdCard
          employee={cardEmployee}
          vendor={vendors.find((vendor) => vendor.id === cardEmployee.vendorId)}
          unit={units.find((unit) => unit.id === cardEmployee.clientUnitId)}
          onClose={() => setCardEmployee(null)}
        />
      ) : null}
    </div>
  );
}

function EmployeeIdCard({
  employee,
  vendor,
  unit,
  onClose,
}: {
  employee: Employee;
  vendor?: Vendor;
  unit?: ClientUnit;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(
      JSON.stringify({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        department: employee.department,
      }),
      { width: 280, margin: 1 },
    ).then(setQr);
  }, [employee]);
  const corporate = (vendor?.legalName ?? vendor?.name ?? "")
    .toLowerCase()
    .includes("corporate");
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  const companyEmail = corporate
    ? "info@joycorporatesolutions.com"
    : "operations@joyindia.in";
  const companyAddress =
    "8/40, 16 Krishna Complex, Thennampalayam, Arasur, Coimbatore - 641407";
  const homeAddress = [
    employee.addressLine,
    employee.district,
    employee.stateName,
    employee.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="modal-layer">
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="Close ID card"
      />
      <div className="id-card-modal">
        <div className="modal-toolbar">
          <strong>CR80 portrait employee ID card · 54 × 85.6 mm</strong>
          <div>
            <button className="secondary-button" onClick={() => window.print()}>
              Print / Save PDF
            </button>
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="employee-id-card-set">
          <article className="employee-id-card id-card-front">
            <header className="id-card-company">
              {vendor?.logoDataUrl ? (
                <img src={vendor.logoDataUrl} alt={`${vendor.name} logo`} />
              ) : null}
              <div>
                <b>{companyName}</b>
                <span>EMPLOYEE IDENTITY CARD</span>
              </div>
            </header>
            <div className="id-card-main">
              {employee.photoDataUrl ? (
                <img
                  className="employee-id-photo-image"
                  src={employee.photoDataUrl}
                  alt={`${employee.name} photo`}
                />
              ) : (
                <div className="employee-id-photo">
                  {initials(employee.name)}
                </div>
              )}
              <div className="id-card-person">
                <h2>{employee.name}</h2>
                <strong>{employee.department}</strong>
                <dl>
                  <div>
                    <dt>Employee ID</dt>
                    <dd>{employee.employeeCode}</dd>
                  </div>
                  <div>
                    <dt>Client employer</dt>
                    <dd>{unit?.clientName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Blood group</dt>
                    <dd>{employee.bloodGroup ?? "—"}</dd>
                  </div>
                </dl>
              </div>
              {qr ? (
                <img
                  className="id-card-qr"
                  src={qr}
                  alt={`QR code for ${employee.employeeCode}`}
                />
              ) : null}
            </div>
            <footer>{companyEmail} · +91 90807 76580</footer>
          </article>
          <article className="employee-id-card id-card-back">
            <header>EMERGENCY &amp; ADDRESS DETAILS</header>
            <dl>
              <div>
                <dt>Emergency contact</dt>
                <dd>{employee.emergencyContactNumber ?? "—"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{homeAddress || "—"}</dd>
              </div>
              <div>
                <dt>Father name</dt>
                <dd>{employee.fatherName ?? "—"}</dd>
              </div>
              <div>
                <dt>Spouse name</dt>
                <dd>{employee.spouseName ?? "—"}</dd>
              </div>
              <div>
                <dt>Marital status</dt>
                <dd>{employee.maritalStatus ?? "—"}</dd>
              </div>
            </dl>
            <section>
              <strong>{companyName}</strong>
              <span>{companyAddress}</span>
              <span>{companyEmail} · +91 90807 76580 · www.joyindia.in</span>
            </section>
            <small>
              If found, please return this card to the company address above.
            </small>
          </article>
        </div>
      </div>
    </div>
  );
}

function AccommodationView({
  types,
  items,
  employees,
  charges,
  canManage,
  onAdd,
  onEdit,
  locked,
}: {
  types: AccommodationType[];
  items: PayrollItem[];
  employees: Employee[];
  charges: AccommodationCharge[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (employee: Employee, charge: AccommodationCharge) => void;
  locked: boolean;
}) {
  const roomTypes = types.map(({ name: type }) => ({
    type,
    people: employees.filter((employee) => employee.accommodationType === type),
    items: items.filter((item) => item.accommodationType === type),
  }));
  const rooms = Array.from(
    new Set(charges.map((charge) => charge.roomNumber).filter(Boolean)),
  ) as string[];
  function exportAccommodation() {
    downloadCsv("accommodation-deduction-register.csv", [
      [
        "Emp ID",
        "Employee",
        "Accommodation Type",
        "Room",
        "ID Card",
        "Rent",
        "Bus",
        "Medical",
        "Ticket",
        "Shoe",
        "Advance",
        "Food",
        "Aadhaar Update",
        "Bank Account Charge",
        "T-Shirt",
        "Old Pending",
        "Gas Share",
        "Ration Share",
        "Provision Share",
        "Return Amount",
        "Final Net Pay",
      ],
      ...charges.map((charge) => {
        const employee = employees.find((row) => row.id === charge.employeeId);
        const item = items.find((row) => row.employeeId === charge.employeeId);
        return [
          employee?.employeeCode ?? "",
          employee?.name ?? "",
          employee?.accommodationType ?? "",
          charge.roomNumber ?? "",
          charge.idCard,
          charge.rent,
          charge.bus,
          charge.medical,
          charge.ticket,
          charge.shoe,
          charge.advance,
          charge.food,
          charge.aadhaarUpdate,
          charge.bankAccountCharge,
          charge.tshirt,
          charge.oldPending,
          charge.gasShare,
          charge.rationShare,
          charge.provisionShare,
          charge.returnAmount,
          item?.netPayable ?? 0,
        ];
      }),
    ]);
  }
  return (
    <div className="section-stack">
      <section className="accommodation-type-grid">
        {roomTypes.map((group) => (
          <article className="accommodation-card" key={group.type}>
            <span className="accommodation-icon">
              <Icon name={group.type === "Tamil" ? "users" : "home"} />
            </span>
            <div>
              <span>{group.type}</span>
              <strong>{group.people.length} employees</strong>
              <small>
                {money(
                  group.items.reduce(
                    (sum, item) => sum + item.accommodationDeduction,
                    0,
                  ),
                )}{" "}
                deductions
              </small>
            </div>
          </article>
        ))}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Employee recoveries</span>
            <h2>Accommodation deduction register</h2>
          </div>
          <div className="attendance-toolbar">
            {canManage ? (
              <button
                className="secondary-button"
                onClick={exportAccommodation}
              >
                <Icon name="download" size={16} />
                Room-wise CSV
              </button>
            ) : (
              <span className="access-mode-note">
                <Icon name="eye" size={15} />
                View only
              </span>
            )}
            {canManage ? (
              <button
                className="primary-button"
                onClick={onAdd}
                disabled={locked || !employees.length}
              >
                + Add recovery
              </button>
            ) : null}
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type / room</th>
                <th>Rent</th>
                <th>Bus</th>
                <th>Food</th>
                <th>Advance</th>
                <th>Gas share</th>
                <th>Ration share</th>
                <th>Provision share</th>
                <th>Other / old</th>
                <th>Total recovery</th>
                <th>Final pay</th>
                {canManage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => {
                const employee = employees.find(
                  (row) => row.id === charge.employeeId,
                );
                const item = items.find(
                  (row) => row.employeeId === charge.employeeId,
                );
                const other =
                  charge.idCard +
                  charge.medical +
                  charge.ticket +
                  charge.shoe +
                  charge.aadhaarUpdate +
                  charge.bankAccountCharge +
                  charge.tshirt +
                  charge.oldPending;
                const total =
                  charge.rent +
                  charge.bus +
                  charge.food +
                  charge.advance +
                  charge.gasShare +
                  charge.rationShare +
                  charge.provisionShare +
                  other -
                  charge.returnAmount;
                return (
                  <tr key={charge.id}>
                    <td>
                      <EmployeeCell
                        name={employee?.name ?? "Employee"}
                        code={employee?.employeeCode ?? "—"}
                        detail={employee?.department ?? ""}
                      />
                    </td>
                    <td>
                      <strong>{employee?.accommodationType}</strong>
                      <small>{charge.roomNumber}</small>
                    </td>
                    <td>{money(charge.rent)}</td>
                    <td>{money(charge.bus)}</td>
                    <td>{money(charge.food)}</td>
                    <td>{money(charge.advance)}</td>
                    <td>{money(charge.gasShare)}</td>
                    <td>{money(charge.rationShare)}</td>
                    <td>{money(charge.provisionShare)}</td>
                    <td>{money(other)}</td>
                    <td>{money(total)}</td>
                    <td className="net-cell">{money(item?.netPayable ?? 0)}</td>
                    {canManage ? (
                      <td>
                        {employee ? (
                          <button
                            className="text-button"
                            disabled={locked}
                            onClick={() => onEdit(employee, charge)}
                          >
                            Edit
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!charges.length ? (
          <EmptyState
            icon="home"
            title="No room recoveries yet"
            detail="Add rent, gas, ration, provision, advance, or other employee recoveries."
          />
        ) : null}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Room control</span>
            <h2>Room-wise summary</h2>
          </div>
        </div>
        <div className="room-grid">
          {rooms.map((room) => {
            const roomCharges = charges.filter(
              (charge) => charge.roomNumber === room,
            );
            const roomEmployees = roomCharges
              .map((charge) =>
                employees.find((employee) => employee.id === charge.employeeId),
              )
              .filter(Boolean) as Employee[];
            const recovery = roomCharges.reduce(
              (sum, charge) =>
                sum +
                charge.rent +
                charge.bus +
                charge.food +
                charge.advance +
                charge.gasShare +
                charge.rationShare +
                charge.provisionShare +
                charge.oldPending,
              0,
            );
            return (
              <article key={room}>
                <div>
                  <span className="room-key">{room}</span>
                  <StatusPill status="Active" />
                </div>
                <strong>{roomEmployees.length} residents</strong>
                <p>
                  {roomEmployees.map((employee) => employee.name).join(" · ")}
                </p>
                <footer>
                  <span>Monthly recovery</span>
                  <b>{money(recovery)}</b>
                </footer>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PaymentsView({
  run,
  items,
  employees,
  vendor,
  unit,
  canExport,
  onPayslip,
  onBulkPayslips,
}: {
  run: PayrollRun;
  items: PayrollItem[];
  employees: Employee[];
  vendor: Vendor;
  unit: ClientUnit;
  canExport: boolean;
  onPayslip: (item: PayrollItem) => void;
  onBulkPayslips: () => void;
}) {
  const bankItems = items.filter((item) => item.paymentMode === "bank");
  const cashItems = items.filter((item) => item.paymentMode === "cash");
  function exportRows(mode: "bank" | "cash") {
    const rows = mode === "bank" ? bankItems : cashItems;
    const header =
      mode === "bank"
        ? [
            "SNO_REF_NO",
            "CUSTOMER_NAME",
            "ACCOUNT_NO",
            "AMOUNT",
            "DESCRIPTION",
            "IFSC_CODE",
            "BANK_NAME",
          ]
        : ["SL_NO", "EMP_ID", "EMPLOYEE_NAME", "AMOUNT", "PAYMENT_MODE"];
    const values = rows.map((item, index) =>
      mode === "bank"
        ? [
            index + 1,
            item.employeeName,
            item.bankAccountMasked ?? "",
            item.netPayable,
            `${monthLabel(run.payPeriod)} Salary`,
            item.ifscMasked ?? "",
            employees.find((employee) => employee.id === item.employeeId)
              ?.bankName ?? "",
          ]
        : [
            index + 1,
            item.employeeCode,
            item.employeeName,
            item.netPayable,
            "Cash",
          ],
    );
    downloadCsv(`${mode}-payment-${run.payPeriod}.csv`, [header, ...values]);
  }
  function exportIndianBank() {
    const rows = bankItems.map((item, index) => {
      const employee = employees.find((row) => row.id === item.employeeId);
      return [
        index + 1,
        item.employeeName,
        unit.location,
        item.bankAccountMasked ?? "",
        item.netPayable,
        `Salary ${monthLabel(run.payPeriod)}`,
        item.ifscMasked ?? "",
        employee?.bankName ?? "",
        "",
      ];
    });
    downloadXlsx(`indian-bank-bulk-${run.payPeriod}.xlsx`, [
      [
        "SNO_REF_NO",
        "CUSTOMER_NAME",
        "CITY",
        "ACCOUNT_NO",
        "AMOUNT",
        "DESCRIPTION",
        "IFSC_CODE",
        "BANK_NAME",
        "BENEFICIARY_EMAIL_ID",
      ],
      ...rows,
    ]);
  }
  function exportCubAnyBank() {
    const rows = bankItems
      .filter(
        (item) =>
          !String(item.ifscMasked ?? "")
            .toUpperCase()
            .startsWith("CIUB"),
      )
      .map(
        (item) =>
          `NEFT~${item.ifscMasked ?? ""}~${item.netPayable.toFixed(2)}~10~${item.bankAccountMasked ?? ""}~${vendor.legalName.toUpperCase()}~0~SALARY ${run.payPeriod}`,
      );
    downloadText(`cub-any-bank-${run.payPeriod}.txt`, rows.join("\r\n"));
  }
  function exportCubToCub() {
    const rows = bankItems
      .filter((item) =>
        String(item.ifscMasked ?? "")
          .toUpperCase()
          .startsWith("CIUB"),
      )
      .map(
        (item) =>
          `${item.bankAccountMasked ?? ""}~${item.netPayable.toFixed(2)}~${vendor.name.toUpperCase()} ${run.payPeriod} SALARY`,
      );
    downloadText(`cub-to-cub-${run.payPeriod}.txt`, rows.join("\r\n"));
  }
  return (
    <div className="section-stack">
      <section className="panel panel-heading">
        <div>
          <span className="eyebrow">Payslip download centre</span>
          <h2>Bulk payslips — two slips per A4 page</h2>
          <p>
            Logo source: Group Companies &amp; Clients → Edit group company →
            Company logo for payslips.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={onBulkPayslips}
          disabled={!items.length}
        >
          <Icon name="download" size={16} />
          Download bulk payslips PDF
        </button>
      </section>
      <section className="payment-summary-grid">
        <article>
          <span>
            <Icon name="bank" />
          </span>
          <div>
            <small>Bank transfer</small>
            <strong>{money(run.bankPayable)}</strong>
            <p>{bankItems.length} employees · final payable after recoveries</p>
          </div>
          <button
            onClick={() => exportRows("bank")}
            disabled={run.status !== "approved" || !canExport}
          >
            <Icon name="download" size={16} />
            {canExport ? "CUB / bank CSV" : "View only"}
          </button>
        </article>
        <article>
          <span className="cash-icon">₹</span>
          <div>
            <small>Cash payable</small>
            <strong>{money(run.cashPayable)}</strong>
            <p>{cashItems.length} employees · acknowledgement required</p>
          </div>
          <button
            onClick={() => exportRows("cash")}
            disabled={run.status !== "approved" || !canExport}
          >
            <Icon name="download" size={16} />
            {canExport ? "Cash list CSV" : "View only"}
          </button>
        </article>
        <article>
          <span>
            <Icon name="file" />
          </span>
          <div>
            <small>Half-A4 payslips</small>
            <strong>{items.length}</strong>
            <p>Two employee slips per A4 page</p>
          </div>
          <div className="record-actions">
            <button
              onClick={() => items[0] && onPayslip(items[0])}
              disabled={!items.length}
            >
              Preview
            </button>
            <button onClick={onBulkPayslips} disabled={!items.length}>
              Bulk PDF
            </button>
          </div>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Bank bulk-upload formats</span>
            <h2>Downloads matching supplied bank templates</h2>
          </div>
          <span className="muted-label">{bankItems.length} bank employees</span>
        </div>
        <div className="record-actions">
          <button
            className="secondary-button"
            onClick={exportIndianBank}
            disabled={!bankItems.length || !canExport}
          >
            Indian Bank Excel
          </button>
          <button
            className="secondary-button"
            onClick={exportCubAnyBank}
            disabled={!bankItems.length || !canExport}
          >
            CUB Any Bank TXT
          </button>
          <button
            className="secondary-button"
            onClick={exportCubToCub}
            disabled={!bankItems.length || !canExport}
          >
            CUB-to-CUB TXT
          </button>
        </div>
      </section>
      <section className="panel payroll-bank-flow">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Easy payroll and bank-payment guide</span>
            <h2>How wages become the bank upload file</h2>
          </div>
        </div>
        <ol>
          <li><strong>1. Attendance or client file</strong><span>Use approved attendance, or import the client salary register.</span></li>
          <li><strong>2. Earnings</strong><span>Basic, DA, HRA, OT and other selected earnings are calculated or imported.</span></li>
          <li><strong>3. Statutory deductions</strong><span>EPF, ESI, PT and LWF rules are applied according to employee settings.</span></li>
          <li><strong>4. Recoveries</strong><span>Room rent, Gas, Ration, Provision, advance and other finalized deductions are subtracted.</span></li>
          <li><strong>5. Final payable</strong><span>Gross earnings − statutory deductions − recoveries + returns.</span></li>
          <li><strong>6. Bank validation</strong><span>Confirm employee account number, IFSC, bank name and payable amount.</span></li>
          <li><strong>7. Download</strong><span>Select Indian Bank Excel, CUB Any Bank TXT or CUB-to-CUB TXT and upload it in the bank portal.</span></li>
        </ol>
        {run.status !== "approved" ? <p className="form-note"><strong>Draft warning:</strong> exports are available for authorized checking, but use the file for payment only after payroll approval.</p> : null}
      </section>
      {run.status !== "approved" ? (
        <section className="locked-banner">
          <span>
            <Icon name="alert" />
          </span>
          <div>
            <strong>Payment outputs are locked until payroll approval.</strong>
            <p>
              Resolve all validation issues, recalculate and approve the payroll
              run first.
            </p>
          </div>
        </section>
      ) : (
        <section className="success-banner">
          <span>
            <Icon name="check" />
          </span>
          <div>
            <strong>Payroll is approved for disbursement.</strong>
            <p>Bank, cash and payslip outputs are now available.</p>
          </div>
        </section>
      )}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Bank validation</span>
            <h2>Payment-ready employee list</h2>
          </div>
          <span className="muted-label">Masked in demo</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee</th>
                <th>Account</th>
                <th>IFSC</th>
                <th>Mode</th>
                <th>Net payable</th>
                <th>Readiness</th>
                <th>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <EmployeeCell
                      name={item.employeeName}
                      code={item.employeeCode}
                      detail={item.department}
                    />
                  </td>
                  <td>
                    {item.bankAccountMasked ?? (
                      <span className="pending-text">Pending</span>
                    )}
                  </td>
                  <td>
                    {item.ifscMasked ?? (
                      <span className="pending-text">Pending</span>
                    )}
                  </td>
                  <td>
                    <span className="mode-pill">
                      {item.paymentMode === "bank" ? "Bank" : "Cash"}
                    </span>
                  </td>
                  <td className="net-cell">{money(item.netPayable)}</td>
                  <td>
                    <StatusPill
                      status={
                        item.validationStatus === "ready" ? "Ready" : "Review"
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="payslip-button"
                      onClick={() => onPayslip(item)}
                    >
                      <Icon name="eye" size={16} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function VendorsView({
  vendors,
  units,
  activeVendorId,
  canManage,
  onSelect,
  onAddVendor,
  onEditVendor,
  onAddUnit,
  onEditUnit,
  onVendorStatus,
  onDeleteVendor,
  onUnitStatus,
  onDeleteUnit,
}: {
  vendors: Vendor[];
  units: ClientUnit[];
  activeVendorId: string;
  canManage: boolean;
  onSelect: (vendorId: string, unitId: string) => void;
  onAddVendor: () => void;
  onEditVendor: (vendor: Vendor) => void;
  onAddUnit: () => void;
  onEditUnit: (unit: ClientUnit) => void;
  onVendorStatus: (vendor: Vendor) => void;
  onDeleteVendor: (vendor: Vendor) => void;
  onUnitStatus: (unit: ClientUnit) => void;
  onDeleteUnit: (unit: ClientUnit) => void;
}) {
  return (
    <div className="section-stack">
      <section className="vendor-actions">
        <div>
          <strong>
            {vendors.filter((vendor) => vendor.status === "active").length}{" "}
            active group companies
          </strong>
          <span>
            Joy group companies are maintained separately from their client
            factories and employer units.
          </span>
        </div>
        {canManage ? (
          <button className="primary-button" onClick={onAddVendor}>
            + Add group company
          </button>
        ) : (
          <span className="access-mode-note">
            <Icon name="eye" size={15} />
            View only
          </span>
        )}
      </section>
      <section className="vendor-grid">
        {vendors.map((vendor) => {
          const vendorUnits = units.filter(
            (unit) => unit.vendorId === vendor.id,
          );
          return (
            <article
              className={
                vendor.id === activeVendorId
                  ? "vendor-card vendor-selected"
                  : "vendor-card"
              }
              key={vendor.id}
            >
              <header>
                {vendor.logoDataUrl ? (
                  <img
                    className="vendor-logo vendor-logo-image"
                    src={vendor.logoDataUrl}
                    alt={`${vendor.name} logo`}
                  />
                ) : (
                  <button
                    className="vendor-logo vendor-logo-upload"
                    onClick={() => onEditVendor(vendor)}
                    title="Upload company logo"
                  >
                    + Logo
                  </button>
                )}
                <StatusPill
                  status={vendor.status === "active" ? "Active" : "Inactive"}
                />
              </header>
              <h2>{vendor.legalName}</h2>
              <p>
                {vendorUnits.length} client units ·{" "}
                {vendorUnits.reduce((sum, unit) => sum + unit.employeeCount, 0)}{" "}
                active employees
              </p>
              {vendor.remarks ? (
                <p className="record-remarks">{vendor.remarks}</p>
              ) : null}
              <dl>
                <div>
                  <dt>EPF code</dt>
                  <dd>{vendor.epfCode ?? "Not added"}</dd>
                </div>
                <div>
                  <dt>ESI code</dt>
                  <dd>{vendor.esiCode ?? "Not added"}</dd>
                </div>
                <div>
                  <dt>GSTIN</dt>
                  <dd>{vendor.gstin ?? "Not added"}</dd>
                </div>
              </dl>
              <div className="client-card-footer">
                <button
                  className="secondary-button"
                  disabled={vendor.status !== "active"}
                  onClick={() =>
                    onSelect(
                      vendor.id,
                      vendorUnits.find((unit) => unit.status === "active")
                        ?.id ?? "",
                    )
                  }
                >
                  Open group company <Icon name="arrow" size={16} />
                </button>
                {canManage ? (
                  <RecordActions
                    status={vendor.status}
                    onEdit={() => onEditVendor(vendor)}
                    onToggle={() => onVendorStatus(vendor)}
                    onDelete={() => onDeleteVendor(vendor)}
                  />
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Operational structure</span>
            <h2>Clients and employer units</h2>
          </div>
          {canManage ? (
            <button
              className="primary-button"
              onClick={onAddUnit}
              disabled={!vendors.some((vendor) => vendor.status === "active")}
            >
              + Add client unit
            </button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group company</th>
                <th>Client name</th>
                <th>Employer unit</th>
                <th>Location / remarks</th>
                <th>Active employees</th>
                <th>Status</th>
                <th>Open</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const canOpen =
                  unit.status === "active" &&
                  vendors.find((vendor) => vendor.id === unit.vendorId)
                    ?.status === "active";
                return (
                  <tr key={unit.id}>
                    <td>
                      {
                        vendors.find((vendor) => vendor.id === unit.vendorId)
                          ?.code
                      }
                    </td>
                    <td>
                      <strong>{unit.clientName}</strong>
                    </td>
                    <td>{unit.unitName}</td>
                    <td>
                      <strong>{unit.location}</strong>
                      {unit.remarks ? <small>{unit.remarks}</small> : null}
                    </td>
                    <td>{unit.employeeCount}</td>
                    <td>
                      <StatusPill
                        status={
                          unit.status === "active" ? "Active" : "Inactive"
                        }
                      />
                    </td>
                    <td>
                      {canOpen ? (
                        <button
                          className="record-action"
                          onClick={() => onSelect(unit.vendorId, unit.id)}
                        >
                          Open
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canManage ? (
                      <td>
                        <RecordActions
                          status={unit.status}
                          onEdit={() => onEditUnit(unit)}
                          onToggle={() => onUnitStatus(unit)}
                          onDelete={() => onDeleteUnit(unit)}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!units.length ? (
          <EmptyState
            icon="building"
            title="No client units yet"
            detail="Add a group company first, then create its client and employer units."
          />
        ) : null}
      </section>
    </div>
  );
}

function UsersAccessView({
  users,
  vendors,
  units,
  currentUser,
  canManage,
  onAdd,
  onEdit,
  onStatus,
  onDelete,
}: {
  users: AppUserProfile[];
  vendors: Vendor[];
  units: ClientUnit[];
  currentUser: AppUserProfile;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (profile: AppUserProfile) => void;
  onStatus: (profile: AppUserProfile) => void;
  onDelete: (profile: AppUserProfile) => void;
}) {
  const roleCounts = (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({
    role,
    count: users.filter(
      (profile) => profile.role === role && profile.status === "active",
    ).length,
  }));
  const formatLogin = (value: string | null) =>
    value
      ? new Date(value).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not signed in yet";
  return (
    <div className="section-stack">
      <section className="access-intro">
        <div>
          <span className="eyebrow">
            Identity-based and organisation-scoped control
          </span>
          <h2>Assign Payroll Team clients and HR Team employer units</h2>
          <p>
            Payroll users can access only assigned clients. HR users can access
            only assigned employer units. Module permissions and final payroll
            approval remain separate controls.
          </p>
        </div>
        {canManage ? (
          <button className="primary-button" onClick={onAdd}>
            + Add user
          </button>
        ) : (
          <span className="access-mode-note">
            <Icon name="eye" size={15} />
            View only
          </span>
        )}
      </section>
      <section className="role-summary-grid">
        {roleCounts.map(({ role, count }) => (
          <article key={role} className={`role-summary role-${role}`}>
            <span>{initials(ROLE_LABELS[role])}</span>
            <div>
              <small>{ROLE_LABELS[role]}</small>
              <strong>{count}</strong>
              <p>active {count === 1 ? "user" : "users"}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="access-security-note">
        <Icon name="alert" size={19} />
        <div>
          <strong>Temporary-password access protects every new user.</strong>
          <p>
            The Super Admin creates the login and temporary password here. At
            the first successful sign-in, the user must immediately set a
            private password before accessing the application.
          </p>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Company users</span>
            <h2>User profiles & permission coverage</h2>
          </div>
          <span className="muted-label">
            {users.filter((profile) => profile.status === "active").length}{" "}
            active ·{" "}
            {users.filter((profile) => profile.status !== "active").length}{" "}
            inactive
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table access-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Assigned client / employer units</th>
                <th>Module access</th>
                <th>Final approval</th>
                <th>Last sign-in</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((profile) => {
                const managed = ACCESS_MODULES.filter(
                  (module) => profile.permissions[module.id] === "manage",
                ).length;
                const viewed = ACCESS_MODULES.filter(
                  (module) => profile.permissions[module.id] === "view",
                ).length;
                const isCurrent = profile.email === currentUser.email;
                const scopeLabels =
                  profile.role === "super_admin"
                    ? ["All clients and employer units"]
                    : profile.role === "payroll_team"
                      ? profile.clientScope.map(
                          (id) =>
                            vendors.find((vendor) => vendor.id === id)?.name ??
                            id,
                        )
                      : profile.unitScope.map((id) => {
                          const unit = units.find(
                            (candidate) => candidate.id === id,
                          );
                          return unit
                            ? `${unit.clientName} · ${unit.unitName}`
                            : id;
                        });
                return (
                  <tr key={profile.id}>
                    <td>
                      <EmployeeCell
                        name={profile.fullName ?? profile.email.split("@")[0]}
                        code={profile.email}
                        detail={isCurrent ? "You" : ""}
                      />
                    </td>
                    <td>
                      <span className={`role-pill role-pill-${profile.role}`}>
                        {ROLE_LABELS[profile.role]}
                      </span>
                    </td>
                    <td>
                      <div className="scope-label-list">
                        {scopeLabels.length ? (
                          scopeLabels.map((label) => (
                            <span key={label}>{label}</span>
                          ))
                        ) : (
                          <span className="field-pending">
                            No scope assigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="permission-counts">
                        <b>{managed} full</b>
                        <span>{viewed} view</span>
                        <small>
                          {ACCESS_MODULES.length - managed - viewed} hidden
                        </small>
                      </div>
                    </td>
                    <td>
                      {profile.canApprovePayroll ? (
                        <span className="field-ready">
                          <Icon name="check" size={14} />
                          Authorised
                        </span>
                      ) : (
                        <span className="field-pending">Not authorised</span>
                      )}
                    </td>
                    <td>
                      <span className="last-login">
                        {formatLogin(profile.lastLoginAt)}
                      </span>
                    </td>
                    <td>
                      <StatusPill
                        status={
                          profile.status === "active" ? "Active" : "Inactive"
                        }
                      />
                    </td>
                    {canManage ? (
                      <td>
                        <div className="record-actions">
                          <button
                            className="record-action"
                            onClick={() => onEdit(profile)}
                          >
                            Edit
                          </button>
                          {!isCurrent ? (
                            <button
                              className="record-action"
                              onClick={() => onStatus(profile)}
                            >
                              {profile.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          ) : null}
                          {!isCurrent ? (
                            <button
                              className="record-action record-delete"
                              onClick={() => onDelete(profile)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!users.length ? (
          <EmptyState
            icon="users"
            title="No user profiles"
            detail="Add the first Super Admin, Payroll Team, or HR Team profile."
          />
        ) : null}
      </section>
    </div>
  );
}

function MasterDataView({
  client,
  types,
  rooms,
  employees,
  shifts,
  remarks,
  canManage,
  onAddType,
  onEditType,
  onTypeStatus,
  onDeleteType,
  onAddShift,
  onEditShift,
  onShiftStatus,
  onDeleteShift,
  onAddRemark,
  onEditRemark,
  onRemarkStatus,
  onDeleteRemark,
}: {
  client: Vendor;
  types: AccommodationType[];
  rooms: AccommodationRoom[];
  employees: Employee[];
  shifts: ShiftDefinition[];
  remarks: PayrollRemark[];
  canManage: boolean;
  onAddType: () => void;
  onEditType: (type: AccommodationType) => void;
  onTypeStatus: (type: AccommodationType) => void;
  onDeleteType: (type: AccommodationType) => void;
  onAddShift: () => void;
  onEditShift: (shift: ShiftDefinition) => void;
  onShiftStatus: (shift: ShiftDefinition) => void;
  onDeleteShift: (shift: ShiftDefinition) => void;
  onAddRemark: () => void;
  onEditRemark: (remark: PayrollRemark) => void;
  onRemarkStatus: (remark: PayrollRemark) => void;
  onDeleteRemark: (remark: PayrollRemark) => void;
}) {
  return (
    <div className="section-stack">
      <section className="rule-callout">
        <span>
          <Icon name="settings" />
        </span>
        <div>
          <strong>
            {canManage ? "Manage" : "Review"} accommodation, shifts, and remarks
            for {client.name}.
          </strong>
          <p>
            Only active accommodation types, shifts, and remarks are available
            in operational forms. Existing payroll history is preserved.
          </p>
        </div>
        {!canManage ? (
          <span className="access-mode-note">
            <Icon name="eye" size={15} />
            View only
          </span>
        ) : null}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Accommodation master</span>
            <h2>Accommodation types & room categories</h2>
          </div>
          {canManage ? (
            <button className="primary-button" onClick={onAddType}>
              + Add accommodation type
            </button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Accommodation type</th>
                <th>Rooms</th>
                <th>Active employees</th>
                <th>Remarks</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td>
                    <strong>{type.name}</strong>
                  </td>
                  <td>
                    {
                      rooms.filter(
                        (room) => room.accommodationTypeId === type.id,
                      ).length
                    }
                  </td>
                  <td>
                    {
                      employees.filter(
                        (employee) =>
                          employee.vendorId === client.id &&
                          employee.accommodationType === type.name &&
                          employee.status === "active",
                      ).length
                    }
                  </td>
                  <td>{type.remarks ?? "—"}</td>
                  <td>
                    <StatusPill
                      status={type.status === "active" ? "Active" : "Inactive"}
                    />
                  </td>
                  {canManage ? (
                    <td>
                      <RecordActions
                        status={type.status}
                        onEdit={() => onEditType(type)}
                        onToggle={() => onTypeStatus(type)}
                        onDelete={() => onDeleteType(type)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!types.length ? (
          <EmptyState
            icon="home"
            title="No accommodation types"
            detail="Add Tamil, Outside Room, Joy Room, or another custom accommodation type."
          />
        ) : null}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Shift master</span>
            <h2>Shift details & working hours</h2>
          </div>
          {canManage ? (
            <button className="primary-button" onClick={onAddShift}>
              + Add shift
            </button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shift name</th>
                <th>Start time</th>
                <th>End time</th>
                <th>Remarks</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td>
                    <strong>{shift.name}</strong>
                  </td>
                  <td>{formatShiftTime(shift.startTime)}</td>
                  <td>
                    {formatShiftTime(shift.endTime)}
                    {shift.endTime <= shift.startTime ? (
                      <small>Next day</small>
                    ) : null}
                  </td>
                  <td>{shift.remarks ?? "—"}</td>
                  <td>
                    <StatusPill
                      status={shift.status === "active" ? "Active" : "Inactive"}
                    />
                  </td>
                  {canManage ? (
                    <td>
                      <RecordActions
                        status={shift.status}
                        onEdit={() => onEditShift(shift)}
                        onToggle={() => onShiftStatus(shift)}
                        onDelete={() => onDeleteShift(shift)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shifts.length ? (
          <EmptyState
            icon="calendar"
            title="No shifts added"
            detail="Create the first working shift for this client."
          />
        ) : null}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Remarks master</span>
            <h2>Reusable notes & other remarks</h2>
          </div>
          {canManage ? (
            <button className="primary-button" onClick={onAddRemark}>
              + Add remark
            </button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Remark title</th>
                <th>Category</th>
                <th>Details</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {remarks.map((remark) => (
                <tr key={remark.id}>
                  <td>
                    <strong>{remark.title}</strong>
                  </td>
                  <td>
                    <span className="mode-pill">
                      {readableField(remark.category)}
                    </span>
                  </td>
                  <td>{remark.notes ?? "—"}</td>
                  <td>
                    <StatusPill
                      status={
                        remark.status === "active" ? "Active" : "Inactive"
                      }
                    />
                  </td>
                  {canManage ? (
                    <td>
                      <RecordActions
                        status={remark.status}
                        onEdit={() => onEditRemark(remark)}
                        onToggle={() => onRemarkStatus(remark)}
                        onDelete={() => onDeleteRemark(remark)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!remarks.length ? (
          <EmptyState
            icon="file"
            title="No remarks added"
            detail="Create attendance, employee, salary, employer, shift, or general remarks."
          />
        ) : null}
      </section>
    </div>
  );
}

function formatShiftTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function SettingsView({
  vendor,
  rules,
  canManage,
  isActing,
  onSave,
}: {
  vendor: Vendor;
  rules: PayrollRule | null;
  canManage: boolean;
  isActing: boolean;
  onSave: (rules: Record<string, unknown>) => Promise<boolean>;
}) {
  const earnings = [
    "Basic",
    "DA",
    "HRA",
    "Conveyance allowance",
    "Food allowance",
    "Night allowance",
    "OT wages",
    "Attendance bonus",
    "Arrears",
    "Holiday wages",
    "Production incentive",
    "Medical allowance",
  ];
  const deductions = [
    "PF",
    "ESI",
    "Professional Tax",
    "LWF",
    "Canteen",
    "Snacks",
    "Tent / accommodation",
    "Advance",
    "Others",
    "TDS",
    "Medical insurance",
  ];
  const [form, setForm] = useState({
    ...defaultPayrollRules,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    ...rules,
  });
  function update(field: string, value: string | number | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  return (
    <div className="section-stack">
      <section className="rule-callout">
        <span>
          <Icon name="settings" />
        </span>
        <div>
          <strong>
            Salary and statutory rules are saved separately for {vendor.name}.
          </strong>
          <p>
            Enter only approved PF, ESI, tax, overtime and attendance settings.
            A zero statutory rate means that component is not automatically
            calculated.
          </p>
        </div>
      </section>
      <form
        className="panel rules-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canManage) void onSave(form);
        }}
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Entity-specific controls</span>
            <h2>Calculation rules</h2>
          </div>
          {canManage ? (
            <button
              className="primary-button"
              type="submit"
              disabled={isActing}
            >
              {isActing ? "Saving…" : "Save payroll rules"}
            </button>
          ) : (
            <span className="access-mode-note">
              <Icon name="eye" size={15} />
              View only
            </span>
          )}
        </div>
        <fieldset
          className="form-grid rules-grid rules-fieldset"
          disabled={!canManage}
        >
          <label>
            <span>Standard working days</span>
            <input
              type="number"
              min="1"
              max="31"
              value={form.standardWorkingDays}
              onChange={(event) =>
                update("standardWorkingDays", Number(event.target.value))
              }
              required
            />
          </label>
          <label>
            <span>PF employee rate (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.pfRate}
              onChange={(event) => update("pfRate", Number(event.target.value))}
            />
          </label>
          <label>
            <span>ESI employee rate (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.esiRate}
              onChange={(event) =>
                update("esiRate", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Professional tax (₹)</span>
            <input
              type="number"
              min="0"
              value={form.professionalTax}
              onChange={(event) =>
                update("professionalTax", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Labour welfare fund (₹)</span>
            <input
              type="number"
              min="0"
              value={form.lwf}
              onChange={(event) => update("lwf", Number(event.target.value))}
            />
          </label>
          <label>
            <span>Overtime hourly rate (₹)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.overtimeHourlyRate}
              onChange={(event) =>
                update("overtimeHourlyRate", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Effective from</span>
            <input
              type="date"
              value={form.effectiveFrom}
              onChange={(event) => update("effectiveFrom", event.target.value)}
              required
            />
          </label>
          <div className="rule-toggles">
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.paidLeave)}
                onChange={(event) =>
                  update("paidLeave", event.target.checked ? 1 : 0)
                }
              />
              Approved leave is payable
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.paidWeekOff)}
                onChange={(event) =>
                  update("paidWeekOff", event.target.checked ? 1 : 0)
                }
              />
              Week offs / holidays are payable
            </label>
          </div>
        </fieldset>
      </form>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Excel salary register</span>
              <h2>Earning components</h2>
            </div>
            <span className="muted-label">Edit inside each salary record</span>
          </div>
          <div className="tag-cloud">
            {earnings.map((item) => (
              <span key={item}>
                {item}
                <i>Enabled</i>
              </span>
            ))}
          </div>
          <div className="formula-box">
            <span>Gross earnings</span>
            <code>
              Basic → Medical Allowance (OT hours excluded; OT wages included)
            </code>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Excel salary register</span>
              <h2>Deduction components</h2>
            </div>
            <span className="muted-label">Edit inside each salary record</span>
          </div>
          <div className="tag-cloud">
            {deductions.map((item) => (
              <span key={item}>
                {item}
                <i>Enabled</i>
              </span>
            ))}
          </div>
          <div className="formula-box">
            <span>Net payable</span>
            <code>
              Gross − statutory − other − accommodation + return amount
            </code>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Attendance controls</span>
            <h2>Status code mapping</h2>
          </div>
          <span className="muted-label">
            Matches the original attendance workbook
          </span>
        </div>
        <div className="status-code-grid">
          {Object.entries(statusMeta).map(([code, meta]) => (
            <article key={code}>
              <b className={meta.className}>{code}</b>
              <div>
                <strong>{meta.label}</strong>
                <span>
                  {code === "P"
                    ? "Counts as present and payable"
                    : code === "A"
                      ? "Counts as absent and follow-up"
                      : code === "L"
                        ? "Approved leave; paid according to saved rules"
                        : code === "WO"
                          ? "Any rostered weekday off"
                          : code === "H"
                            ? "Company holiday"
                            : "Worked on WO/holiday; counts as present"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Approval governance</span>
            <h2>Recommended maker-checker workflow</h2>
          </div>
        </div>
        <div className="approval-grid">
          <article>
            <span>1</span>
            <div>
              <strong>HR Operations</strong>
              <p>Attendance, shift, week off, OT and employee master.</p>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <strong>Payroll Maker</strong>
              <p>
                Earnings, deductions, accommodation and exception resolution.
              </p>
            </div>
          </article>
          <article>
            <span>3</span>
            <div>
              <strong>Accounts Checker</strong>
              <p>Totals, statutory mapping, bank readiness and variance.</p>
            </div>
          </article>
          <article>
            <span>4</span>
            <div>
              <strong>Authorised Approver</strong>
              <p>Final lock, payment export and audit trail.</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function PayrollDetail({
  item,
  onClose,
  onPayslip,
  onEdit,
  locked,
}: {
  item: PayrollItem;
  onClose: () => void;
  onPayslip: () => void;
  onEdit: () => void;
  locked: boolean;
}) {
  const earnings = [
    ["Basic", item.basic],
    ["DA", item.da],
    ["HRA", item.hra],
    ["Conveyance", item.conveyance],
    ["Food allowance", item.foodAllowance],
    ["Night allowance", item.nightAllowance],
    ["OT wages", item.overtimeWages],
    ["Attendance bonus", item.attendanceBonus],
    ["Arrears", item.arrears],
    ["Holiday wages", item.holidayWages],
    ["Production incentive", item.productionIncentive],
    ["Medical allowance", item.medicalAllowance],
  ] as Array<[string, number]>;
  const deductions = [
    ["PF", item.pfDeduction],
    ["ESI", item.esiDeduction],
    ["Professional Tax", item.professionalTax],
    ["LWF", item.lwf],
    ["Canteen", item.canteen],
    ["Snacks", item.snacks],
    ["Tent", item.tent],
    ["Advance", item.advance],
    ["Others", item.otherDeduction],
    ["TDS", item.tds],
    ["Medical insurance", item.medicalInsurance],
    ["Accommodation", item.accommodationDeduction],
  ] as Array<[string, number]>;
  return (
    <div className="drawer-layer">
      <button
        className="drawer-scrim"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="detail-drawer">
        <header>
          <div>
            <span className="eyebrow">Employee calculation</span>
            <h2>{item.employeeName}</h2>
            <p>
              {item.employeeCode} · {item.department}
            </p>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="drawer-status">
          <StatusPill
            status={item.validationStatus === "ready" ? "Ready" : "Review"}
          />
          {item.validationMessage ? (
            <span>
              <Icon name="alert" size={15} />
              {item.validationMessage}
            </span>
          ) : (
            <span>
              <Icon name="check" size={15} />
              All validation checks passed
            </span>
          )}
        </div>
        <section>
          <h3>Attendance inputs</h3>
          <div className="detail-metrics">
            <div>
              <span>Present</span>
              <strong>{item.presentDays}</strong>
            </div>
            <div>
              <span>Absent</span>
              <strong>{item.absentDays}</strong>
            </div>
            <div>
              <span>Leave</span>
              <strong>{item.leaveDays}</strong>
            </div>
            <div>
              <span>WO / H</span>
              <strong>{item.weekOffDays}</strong>
            </div>
            <div>
              <span>HP</span>
              <strong>{item.holidayPresentDays}</strong>
            </div>
            <div>
              <span>OT hours</span>
              <strong>{item.overtimeHours}</strong>
            </div>
          </div>
        </section>
        <section>
          <h3>Earnings</h3>
          <div className="calculation-list">
            {earnings.map(([label, value]) =>
              value ? (
                <div key={label}>
                  <span>{label}</span>
                  <b>{money(value)}</b>
                </div>
              ) : null,
            )}
            <div className="calculation-total">
              <span>Gross earnings</span>
              <b>{money(item.grossEarnings)}</b>
            </div>
          </div>
        </section>
        <section>
          <h3>Deductions</h3>
          <div className="calculation-list">
            {deductions.map(([label, value]) =>
              value ? (
                <div key={label}>
                  <span>{label}</span>
                  <b>{money(value)}</b>
                </div>
              ) : null,
            )}
            {item.returnAmount ? (
              <div className="return-line">
                <span>Return amount</span>
                <b>+ {money(item.returnAmount)}</b>
              </div>
            ) : null}
            <div className="calculation-total">
              <span>Total deductions</span>
              <b>{money(item.totalDeductions)}</b>
            </div>
          </div>
        </section>
        <div className="net-summary">
          <span>Final net payable</span>
          <strong>{money(item.netPayable)}</strong>
          <small>
            {item.paymentMode === "bank" ? "Bank transfer" : "Cash payment"} ·{" "}
            {item.accommodationType}
          </small>
        </div>
        <footer>
          {!locked ? (
            <button className="secondary-button" onClick={onEdit}>
              Edit salary
            </button>
          ) : (
            <button className="secondary-button" onClick={onClose}>
              Close
            </button>
          )}
          <button className="primary-button" onClick={onPayslip}>
            <Icon name="file" size={16} />
            View payslip
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PayslipSheet({
  item,
  vendor,
  unit,
  run,
  period,
}: {
  item: PayrollItem;
  vendor: Vendor;
  unit: ClientUnit;
  run: PayrollRun | null;
  period: string;
}) {
  const earnings = configuredFields(
    unit.payslipEarningsJson,
    earningFields,
  ).map(
    (field) =>
      [readableField(field), Number(item[field as keyof PayrollItem] ?? 0)] as [
        string,
        number,
      ],
  );
  const deductions = configuredFields(
    unit.payslipDeductionsJson,
    deductionFields,
  ).map(
    (field) =>
      [readableField(field), Number(item[field as keyof PayrollItem] ?? 0)] as [
        string,
        number,
      ],
  );
  const range = run
    ? payrollPeriodRange(run.payPeriod, run.periodStart, run.periodEnd)
    : null;
  const employerTitle = unit.payslipTitle ?? unit.clientName;
  return (
    <article className="payslip-sheet payslip-half-a4">
      <header>
        {vendor.logoDataUrl ? (
          <img
            className="payslip-company-logo"
            src={vendor.logoDataUrl}
            alt={`${vendor.name} logo`}
          />
        ) : (
          <div className="payslip-logo">JOY</div>
        )}
        <div>
          <h2>EMPLOYEE SALARY SLIP</h2>
          <strong>{monthLabel(period).toUpperCase()}</strong>
        </div>
      </header>
      <section className="payslip-company">
        <h3>{employerTitle}</h3>
        <p>
          {unit.payslipSubtitle ??
            `${unit.unitName} · Payroll partner: ${vendor.legalName}`}
        </p>
        <p>{unit.payslipAddress ?? unit.location}</p>
        <span>
          {unit.payslipContact ??
            "joyindia.in · info@joycorporatesolutions.com"}
        </span>
      </section>
      <div className="payslip-meta">
        <div>
          <span>Employee ID</span>
          <strong>{item.employeeCode}</strong>
        </div>
        <div>
          <span>Employee name</span>
          <strong>{item.employeeName}</strong>
        </div>
        <div>
          <span>Department</span>
          <strong>{item.department}</strong>
        </div>
        <div>
          <span>Employer / unit</span>
          <strong>
            {unit.clientName} · {unit.unitName}
          </strong>
        </div>
        <div>
          <span>Payroll period</span>
          <strong>
            {range
              ? `${range.start} to ${range.inclusiveEnd}`
              : monthLabel(period)}
          </strong>
        </div>
        <div>
          <span>Working days</span>
          <strong>{run?.workingDays ?? 26}</strong>
        </div>
        <div>
          <span>Payable days</span>
          <strong>{item.payableDays}</strong>
        </div>
        <div>
          <span>OT hours</span>
          <strong>{item.overtimeHours}</strong>
        </div>
      </div>
      <div className="payslip-columns">
        <section>
          <h4>
            <span>Earnings</span>
            <b>Amount</b>
          </h4>
          {earnings.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value ? money(value) : "—"}</b>
            </div>
          ))}
          <footer>
            <span>Gross earnings</span>
            <b>{money(item.grossEarnings)}</b>
          </footer>
        </section>
        <section>
          <h4>
            <span>Deductions</span>
            <b>Amount</b>
          </h4>
          {deductions.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value ? money(value) : "—"}</b>
            </div>
          ))}
          <footer>
            <span>Total deductions</span>
            <b>{money(item.totalDeductions)}</b>
          </footer>
        </section>
      </div>
      <div className="payslip-net">
        <div>
          <span>Net payable</span>
          <strong>{money(item.netPayable)}</strong>
        </div>
        <p>
          <span>Amount in words</span>
          {numberToWordsIndian(Math.round(item.netPayable))} Rupees Only
        </p>
      </div>
      <footer className="payslip-footnote">
        ***{" "}
        {unit.payslipFooter ??
          "This is a computer-generated payslip and does not require a physical signature."}{" "}
        ***
      </footer>
    </article>
  );
}

function PayslipModal({
  item,
  vendor,
  unit,
  run,
  period,
  canExport,
  onClose,
}: {
  item: PayrollItem;
  vendor: Vendor;
  unit: ClientUnit;
  run: PayrollRun | null;
  period: string;
  canExport: boolean;
  onClose: () => void;
}) {
  return (
    <div className="modal-layer">
      <button
        className="modal-scrim"
        aria-label="Close payslip"
        onClick={onClose}
      />
      <div className="payslip-modal">
        <div className="modal-toolbar">
          <div>
            <strong>Half-A4 salary slip</strong>
            <span>{unit.clientName} · two slips can fit on one A4 sheet</span>
          </div>
          <div>
            {canExport ? (
              <button
                className="secondary-button"
                onClick={() => window.print()}
              >
                <Icon name="download" size={16} />
                Print / Save PDF
              </button>
            ) : null}
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <PayslipSheet
          item={item}
          vendor={vendor}
          unit={unit}
          run={run}
          period={period}
        />
      </div>
    </div>
  );
}

function BulkPayslipModal({
  items,
  vendor,
  unit,
  run,
  onClose,
}: {
  items: PayrollItem[];
  vendor: Vendor;
  unit: ClientUnit;
  run: PayrollRun;
  onClose: () => void;
}) {
  return (
    <div className="modal-layer">
      <button className="modal-scrim" onClick={onClose} />
      <div className="payslip-modal bulk-payslip-modal">
        <div className="modal-toolbar">
          <div>
            <strong>Bulk employee salary slips</strong>
            <span>
              {items.length} employees · two half-A4 slips per A4 page
            </span>
          </div>
          <div>
            <button className="primary-button" onClick={() => window.print()}>
              Print / Save bulk PDF
            </button>
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="bulk-payslip-pages">
          {items.map((item) => (
            <PayslipSheet
              key={item.id}
              item={item}
              vendor={vendor}
              unit={unit}
              run={run}
              period={run.payPeriod}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileModal({
  profile,
  busy,
  onClose,
  onSave,
  onChangePassword,
}: {
  profile: AppUserProfile;
  busy: boolean;
  onClose: () => void;
  onSave: (details: Record<string, unknown>) => Promise<void>;
  onChangePassword?: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(Object.fromEntries(new FormData(event.currentTarget)));
  }
  async function changePassword() {
    setPasswordMessage("");
    if (password.length < 12) {
      setPasswordMessage("Password must contain at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMessage("The passwords do not match.");
      return;
    }
    if (!onChangePassword) {
      setPasswordMessage(
        "Password change is available on the Supabase production login.",
      );
      return;
    }
    try {
      await onChangePassword(password);
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Password could not be changed.",
      );
    }
  }
  return (
    <div className="modal-layer action-modal-layer">
      <button
        className="modal-scrim"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div className="action-modal">
        <header className="action-modal-header">
          <div>
            <span className="eyebrow">My account</span>
            <h2>Profile & password</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="action-modal-body">
          <form
            className="form-grid"
            onSubmit={(event) => void saveProfile(event)}
          >
            <label>
              <span>Employee code</span>
              <input value={profile.employeeCode ?? ""} disabled />
            </label>
            <label>
              <span>Sign-in email</span>
              <input value={profile.email} disabled />
            </label>
            <label>
              <span>Full name *</span>
              <input
                name="fullName"
                defaultValue={profile.fullName ?? ""}
                required
              />
            </label>
            <label>
              <span>Department</span>
              <input
                name="department"
                defaultValue={profile.department ?? ""}
              />
            </label>
            <label>
              <span>Mobile number</span>
              <input
                name="mobileNumber"
                defaultValue={profile.mobileNumber ?? ""}
              />
            </label>
            <button className="primary-button form-span" disabled={busy}>
              Save profile
            </button>
          </form>
          <section className="profile-password-panel">
            <h3>Change password</h3>
            <label>
              <span>New password</span>
              <input
                type="password"
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                minLength={12}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {passwordMessage ? <p>{passwordMessage}</p> : null}
            <button
              className="secondary-button"
              onClick={() => void changePassword()}
            >
              Change password
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyPayroll({
  unit,
  canCreate,
  canImport,
  canOpenClients,
  onGoToVendors,
  onCreate,
  onImport,
}: {
  unit: ClientUnit | null;
  canCreate: boolean;
  canImport: boolean;
  canOpenClients: boolean;
  onGoToVendors: () => void;
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <section className="panel empty-payroll">
      <span>
        <Icon name="calculator" size={28} />
      </span>
      <h2>
        {unit
          ? "No payroll run for this unit"
          : "No employer unit is available"}
      </h2>
      <p>
        {unit
          ? `${unit.clientName} · ${unit.unitName} is ready. A permitted team member can create a monthly salary run or import an Excel workbook.`
          : "A permitted team member can add the client and its employer or factory unit."}
      </p>
      <div>
        {unit && canCreate ? (
          <button className="primary-button" onClick={onCreate}>
            Create payroll run
          </button>
        ) : null}
        {unit && canImport ? (
          <button className="secondary-button" onClick={onImport}>
            Import Excel
          </button>
        ) : null}
        {canOpenClients ? (
          <button className="secondary-button" onClick={onGoToVendors}>
            Open clients & employers
          </button>
        ) : null}
        {!canCreate && !canImport && !canOpenClients ? (
          <span className="access-mode-note">
            <Icon name="eye" size={15} />
            View-only access
          </span>
        ) : null}
      </div>
    </section>
  );
}

function readableField(value: string) {
  const overrides: Record<string, string> = {
    da: "DA",
    hra: "HRA",
    pfDeduction: "PF",
    esiDeduction: "ESI",
    lwf: "LWF",
    tds: "TDS",
    idCard: "ID card",
    aadhaarUpdate: "Aadhaar update",
    tshirt: "T-shirt",
    ifscMasked: "IFSC",
    uanMasked: "UAN",
    esiMasked: "ESI number",
  };
  return (
    overrides[value] ??
    value
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

function followingMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function unitAttendanceCycle(period: string, unit: ClientUnit | null) {
  if (!unit) return calendarPeriod(period);
  const [year, month] = period.split("-").map(Number);
  const date = (targetYear: number, targetMonth: number, day: number) => {
    const maximum = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, maximum)).padStart(2, "0")}`;
  };
  if (unit.attendanceCycleStartDay <= unit.attendanceCycleEndDay)
    return {
      start: date(year, month, unit.attendanceCycleStartDay),
      end: date(year, month, unit.attendanceCycleEndDay),
    };
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return {
    start: date(
      previous.getUTCFullYear(),
      previous.getUTCMonth() + 1,
      unit.attendanceCycleStartDay,
    ),
    end: date(year, month, unit.attendanceCycleEndDay),
  };
}

function configuredFields(
  json: string | null | undefined,
  defaults: readonly string[],
) {
  try {
    const fields = JSON.parse(json ?? "[]");
    return Array.isArray(fields) && fields.length
      ? fields.map(String)
      : [...defaults];
  } catch {
    return [...defaults];
  }
}

function PayrollActionModal({
  modal,
  vendors,
  units,
  hostels,
  accommodationTypes,
  rooms,
  employees,
  shifts,
  remarks,
  unit,
  vendorId,
  currentPeriod,
  currentRun,
  busy,
  onClose,
  onAction,
}: {
  modal: ActiveModal;
  vendors: Vendor[];
  units: ClientUnit[];
  hostels: Hostel[];
  accommodationTypes: AccommodationType[];
  rooms: AccommodationRoom[];
  employees: Employee[];
  shifts: ShiftDefinition[];
  remarks: PayrollRemark[];
  unit: ClientUnit | null;
  vendorId: string;
  currentPeriod: string;
  currentRun: PayrollRun | null;
  busy: boolean;
  onClose: () => void;
  onAction: (
    action: string,
    message: string,
    details?: Record<string, unknown>,
  ) => Promise<boolean>;
}) {
  const [importPeriod, setImportPeriod] = useState(currentPeriod);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<WorkbookImport | null>(null);
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const accessProfile = modal.kind === "app-user" ? modal.profile : undefined;
  const initialRole = accessProfile?.role ?? "hr_team";
  const [userRole, setUserRole] = useState<UserRole>(initialRole);
  const [permissionDraft, setPermissionDraft] = useState<PermissionMap>(() => ({
    ...(accessProfile?.permissions ?? DEFAULT_PERMISSIONS[initialRole]),
  }));
  const [approvalDraft, setApprovalDraft] = useState(
    accessProfile?.canApprovePayroll ?? DEFAULT_APPROVAL_ACCESS[initialRole],
  );
  const [clientScopeDraft, setClientScopeDraft] = useState<string[]>(
    accessProfile?.clientScope ?? [],
  );
  const [unitScopeDraft, setUnitScopeDraft] = useState<string[]>(
    accessProfile?.unitScope ?? [],
  );
  const [hostelScopeDraft, setHostelScopeDraft] = useState<string[]>(
    accessProfile?.hostelScope ?? [],
  );
  const employee = modal.kind === "employee" ? modal.employee : undefined;
  const leftEmployee =
    modal.kind === "employee-left" ? modal.employee : undefined;
  const client = modal.kind === "vendor" ? modal.vendor : undefined;
  const employerUnit = modal.kind === "unit" ? modal.unit : undefined;
  const selectedShift = modal.kind === "shift" ? modal.shift : undefined;
  const selectedRemark = modal.kind === "remark" ? modal.remark : undefined;
  const selectedType =
    modal.kind === "accommodation-type" ? modal.accommodationType : undefined;
  const [employeeType, setEmployeeType] = useState(
    employee?.accommodationType ??
      accommodationTypes.find(
        (type) => type.name === "Tamil" && type.status === "active",
      )?.name ??
      accommodationTypes.find((type) => type.status === "active")?.name ??
      "Tamil",
  );
  const [employeeRoomId, setEmployeeRoomId] = useState(employee?.roomId ?? "");
  const [employeeRoomNumber, setEmployeeRoomNumber] = useState(
    employee?.roomNumber ?? "",
  );
  const initialEmployeeShifts = configuredFields(
    employee?.applicableShiftsJson,
    employee?.defaultShift ? [employee.defaultShift] : ["General"],
  );
  const [employeeShiftPattern, setEmployeeShiftPattern] = useState(
    employee?.shiftPattern === "rotational" ? "rotational" : "regular",
  );
  const [employeeShifts, setEmployeeShifts] = useState<string[]>(
    initialEmployeeShifts,
  );
  const initialRunMonth = currentRun
    ? followingMonth(currentPeriod)
    : currentPeriod;
  const initialRunDates = unitAttendanceCycle(initialRunMonth, unit);
  const [runMonth, setRunMonth] = useState(initialRunMonth);
  const [runStart, setRunStart] = useState(initialRunDates.start);
  const [runEnd, setRunEnd] = useState(initialRunDates.end);
  const [runWorkingDays, setRunWorkingDays] = useState(
    currentRun?.workingDays ?? unit?.attendanceWorkingDays ?? 26,
  );
  const [runProcessingMode, setRunProcessingMode] = useState<
    "attendance" | "salary_import"
  >("attendance");
  const [unitEarnings, setUnitEarnings] = useState<string[]>(
    configuredFields(employerUnit?.payslipEarningsJson, earningFields),
  );
  const [unitDeductions, setUnitDeductions] = useState<string[]>(
    configuredFields(employerUnit?.payslipDeductionsJson, deductionFields),
  );
  const [companyLogo, setCompanyLogo] = useState(client?.logoDataUrl ?? "");
  const [employeePhoto, setEmployeePhoto] = useState(
    employee?.photoDataUrl ?? "",
  );
  const activeAccommodationTypes = accommodationTypes.filter(
    (type) =>
      type.status === "active" || type.name === employee?.accommodationType,
  );
  const matchingRooms = rooms.filter(
    (room) =>
      room.status === "active" &&
      accommodationTypes.find((type) => type.id === room.accommodationTypeId)
        ?.name === employeeType,
  );
  const shiftOptions = Array.from(
    new Set(
      [
        ...shifts
          .filter((shift) => shift.status === "active")
          .map((shift) => shift.name),
        employee?.defaultShift,
        modal.kind === "attendance" ? modal.entry?.shiftCode : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const title =
    modal.kind === "vendor"
      ? client
        ? "Edit group company"
        : "Add group company"
      : modal.kind === "unit"
        ? employerUnit
          ? "Edit client unit"
          : "Add client unit"
        : modal.kind === "employee"
          ? employee
            ? "Edit employee"
            : "Add employee"
          : modal.kind === "employee-left"
            ? "Put employee left date"
            : modal.kind === "accommodation-type"
              ? selectedType
                ? "Edit accommodation type"
                : "Add accommodation type"
              : modal.kind === "shift"
                ? selectedShift
                  ? "Edit shift details"
                  : "Add shift"
                : modal.kind === "remark"
                  ? selectedRemark
                    ? "Edit remark"
                    : "Add remark"
                  : modal.kind === "app-user"
                    ? accessProfile
                      ? "Edit user access"
                      : "Add user access"
                    : modal.kind === "run"
                      ? "Create payroll month"
                      : modal.kind === "attendance"
                        ? "Update attendance"
                        : modal.kind === "salary"
                          ? "Edit salary calculation"
                          : modal.kind === "accommodation"
                            ? "Edit accommodation recovery"
                            : "Bulk import payroll data";
  const submitLabel =
    modal.kind === "import"
      ? "Import into payroll"
      : modal.kind === "run"
        ? "Create payroll run"
        : modal.kind === "vendor"
          ? client
            ? "Save group company"
            : "Add group company"
          : modal.kind === "unit"
            ? employerUnit
              ? "Save client unit"
              : "Add client unit"
            : modal.kind === "accommodation-type"
              ? selectedType
                ? "Save accommodation type"
                : "Add accommodation type"
              : modal.kind === "shift"
                ? selectedShift
                  ? "Save shift"
                  : "Add shift"
                : modal.kind === "remark"
                  ? selectedRemark
                    ? "Save remark"
                    : "Add remark"
                  : modal.kind === "app-user"
                    ? accessProfile
                      ? "Save user access"
                      : "Add user"
                    : "Save changes";

  async function inspectFile(file: File, period: string) {
    setSelectedFile(file);
    setParsed(null);
    setParseError("");
    setParsing(true);
    try {
      const result = await parsePayrollWorkbook(file, period);
      if (!result.employees.length)
        throw new Error("The workbook does not contain employee rows.");
      setParsed(result);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "Unable to read the selected workbook",
      );
    } finally {
      setParsing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (modal.kind === "vendor")
      await onAction(
        "save-client",
        client ? "Group company details updated" : "Group company created",
        { ...fields, logoDataUrl: companyLogo, id: client?.id },
      );
    else if (modal.kind === "unit")
      await onAction(
        "save-unit",
        employerUnit ? "Employer unit updated" : "Employer unit created",
        {
          ...fields,
          payslipEarnings: unitEarnings,
          payslipDeductions: unitDeductions,
          id: employerUnit?.id,
        },
      );
    else if (modal.kind === "employee") {
      const employmentType =
        employee?.employmentType ??
        (window.confirm(
          "Is this a direct employee of Joy Manpower Service / Joy Corporate Solutions? Select OK for Direct, or Cancel for Client-assigned.",
        )
          ? "direct"
          : "client");
      if (employeeShiftPattern === "rotational" && employeeShifts.length < 2) {
        window.alert(
          "Select at least 2 applicable shifts for a rotational employee.",
        );
        return;
      }
      const applicable =
        employeeShiftPattern === "regular"
          ? [employeeShifts[0] ?? shiftOptions[0] ?? "General"]
          : employeeShifts;
      await onAction(
        "save-employee",
        employee ? "Employee details updated" : "Employee added to payroll",
        {
          employee: {
            ...fields,
            photoDataUrl: employeePhoto,
            shiftPattern: employeeShiftPattern,
            defaultShift: applicable[0],
            applicableShiftsJson: JSON.stringify(applicable),
            paymentMode: "bank",
            employmentType,
            id: employee?.id,
          },
        },
      );
    } else if (modal.kind === "employee-left")
      await onAction(
        "mark-employee-left",
        `${modal.employee.name} marked as left; history preserved`,
        { employeeId: modal.employee.id, leftDate: fields.leftDate },
      );
    else if (modal.kind === "accommodation-type")
      await onAction(
        "save-accommodation-type",
        selectedType
          ? "Accommodation type updated"
          : "Accommodation type added",
        { ...fields, id: selectedType?.id },
      );
    else if (modal.kind === "shift")
      await onAction(
        "save-shift",
        selectedShift ? "Shift details updated" : "Shift added",
        { ...fields, id: selectedShift?.id },
      );
    else if (modal.kind === "remark")
      await onAction(
        "save-remark",
        selectedRemark ? "Remark updated" : "Remark added",
        { ...fields, id: selectedRemark?.id },
      );
    else if (modal.kind === "app-user")
      await onAction(
        "save-app-user",
        accessProfile
          ? "Direct employee user updated"
          : "Direct employee login created",
        {
          id: accessProfile?.id,
          email: fields.email,
          temporaryPassword: fields.temporaryPassword,
          fullName: fields.fullName,
          employeeCode: fields.employeeCode,
          department: fields.department,
          dateOfJoining: fields.dateOfJoining,
          mobileNumber: fields.mobileNumber,
          role: userRole,
          permissions: permissionDraft,
          canApprovePayroll: approvalDraft,
          clientScope: clientScopeDraft,
          unitScope: unitScopeDraft,
          hostelScope: hostelScopeDraft,
        },
      );
    else if (modal.kind === "run")
      await onAction("create-run", "Custom monthly payroll run created", {
        payPeriod: fields.payPeriod,
        periodStart: fields.periodStart,
        periodEnd: fields.periodEnd,
        workingDays: fields.workingDays,
        processingMode: runProcessingMode,
      });
    else if (modal.kind === "attendance")
      await onAction(
        "save-attendance",
        "Attendance, shift and payroll updated",
        {
          employeeId: modal.employee.id,
          attendanceDate: modal.date,
          ...fields,
        },
      );
    else if (modal.kind === "salary")
      await onAction(
        "save-payroll-item",
        "Employee earnings and deductions saved",
        { itemId: modal.item.id, fields },
      );
    else if (modal.kind === "accommodation")
      await onAction("save-accommodation", "Accommodation deductions saved", {
        employeeId: String(fields.employeeId),
        fields,
      });
    else if (modal.kind === "import" && parsed)
      await onAction(
        "import-workbook",
        `Imported ${parsed.employees.length} employees and ${parsed.attendance.length} attendance entries`,
        { ...parsed, payPeriod: importPeriod },
      );
  }

  const recoveryFields = [
    "rent",
    "bus",
    "food",
    "advance",
    "gasShare",
    "rationShare",
    "provisionShare",
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
  const toggleScope = (
    setter: (value: string[]) => void,
    current: string[],
    id: string,
    checked: boolean,
  ) =>
    setter(
      checked
        ? [...new Set([...current, id])]
        : current.filter((entry) => entry !== id),
    );

  return (
    <div className="modal-layer action-modal-layer">
      <button
        className="modal-scrim"
        aria-label="Close form"
        onClick={onClose}
      />
      <form
        className={`action-modal ${modal.kind === "salary" || modal.kind === "app-user" ? "action-modal-wide" : ""}`}
        onSubmit={submit}
      >
        <header className="action-modal-header">
          <div>
            <span className="eyebrow">
              {modal.kind === "app-user"
                ? "Identity & module permissions"
                : unit
                  ? `${unit.clientName} · ${unit.unitName}`
                  : "Payroll configuration"}
            </span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="action-modal-body">
          <datalist id="payroll-remark-options">
            {remarks
              .filter((remark) => remark.status === "active")
              .map((remark) => (
                <option
                  key={remark.id}
                  value={
                    remark.notes
                      ? `${remark.title}: ${remark.notes}`
                      : remark.title
                  }
                />
              ))}
          </datalist>
          {modal.kind === "vendor" ? (
            <div className="form-grid">
              <label>
                <span>Group company short code *</span>
                <input
                  name="code"
                  defaultValue={client?.code}
                  placeholder="JMS"
                  maxLength={15}
                  required
                />
              </label>
              <label>
                <span>Group company display name *</span>
                <input
                  name="name"
                  defaultValue={client?.name}
                  placeholder="Joy group company name"
                  required
                />
              </label>
              <label className="form-span">
                <span>Registered legal name</span>
                <input
                  name="legalName"
                  defaultValue={client?.legalName}
                  placeholder="Registered legal company name"
                />
              </label>
              <label className="form-span">
                <span>Company logo for payslips</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 350000) {
                      window.alert("Choose a logo smaller than 350 KB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setCompanyLogo(String(reader.result ?? ""));
                    reader.readAsDataURL(file);
                  }}
                />
                {companyLogo ? (
                  <small>Logo selected · it will appear on salary slips</small>
                ) : null}
              </label>
              <label>
                <span>EPF establishment code</span>
                <input
                  name="epfCode"
                  defaultValue={client?.epfCode ?? ""}
                  placeholder="Optional"
                />
              </label>
              <label>
                <span>ESI establishment code</span>
                <input
                  name="esiCode"
                  defaultValue={client?.esiCode ?? ""}
                  placeholder="Optional"
                />
              </label>
              <label>
                <span>GSTIN</span>
                <input
                  name="gstin"
                  defaultValue={client?.gstin ?? ""}
                  placeholder="Optional"
                />
              </label>
              <label>
                <span>Other remarks</span>
                <input
                  name="remarks"
                  list="payroll-remark-options"
                  defaultValue={client?.remarks ?? ""}
                  placeholder="Optional group company notes"
                />
              </label>
            </div>
          ) : null}

          {modal.kind === "unit" ? (
            <div className="form-grid">
              <label className="form-span">
                <span>Client *</span>
                <select
                  name="vendorId"
                  defaultValue={employerUnit?.vendorId ?? vendorId}
                  required
                >
                  {vendors
                    .filter(
                      (vendor) =>
                        vendor.status === "active" ||
                        vendor.id === employerUnit?.vendorId,
                    )
                    .map((vendor) => (
                      <option value={vendor.id} key={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Employer company *</span>
                <input
                  name="clientName"
                  defaultValue={employerUnit?.clientName}
                  placeholder="Watertec India"
                  required
                />
              </label>
              <label>
                <span>Factory / unit name *</span>
                <input
                  name="unitName"
                  defaultValue={employerUnit?.unitName}
                  placeholder="Unit I"
                  required
                />
              </label>
              <label>
                <span>Location *</span>
                <input
                  name="location"
                  defaultValue={employerUnit?.location}
                  placeholder="Coimbatore"
                  required
                />
              </label>
              <label>
                <span>Other remarks</span>
                <input
                  name="remarks"
                  list="payroll-remark-options"
                  defaultValue={employerUnit?.remarks ?? ""}
                  placeholder="Optional employer notes"
                />
              </label>
              <div className="form-note form-span">
                <strong>Unit-wise attendance cycle</strong>
                <span>
                  Example: start 26 and end 25 means previous month 26th through
                  current month 25th.
                </span>
              </div>
              <label>
                <span>Cycle start day *</span>
                <input
                  name="attendanceCycleStartDay"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={employerUnit?.attendanceCycleStartDay ?? 1}
                  required
                />
              </label>
              <label>
                <span>Cycle end day *</span>
                <input
                  name="attendanceCycleEndDay"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={employerUnit?.attendanceCycleEndDay ?? 31}
                  required
                />
              </label>
              <label className="form-span">
                <span>Default working days *</span>
                <input
                  name="attendanceWorkingDays"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={employerUnit?.attendanceWorkingDays ?? 26}
                  required
                />
              </label>
              <label>
                <span>OT payment multiplier *</span>
                <input
                  name="overtimeMultiplier"
                  type="number"
                  min="1"
                  max="2"
                  step="0.01"
                  defaultValue={employerUnit?.overtimeMultiplier ?? 1}
                  required
                />
                <small>
                  Manual value allowed: 1, 1.25, 1.5, 2, or any value between 1
                  and 2.
                </small>
              </label>
              <label className="form-span">
                <span>Deduction voucher header</span>
                <input
                  name="voucherHeader"
                  defaultValue={employerUnit?.voucherHeader ?? ""}
                  placeholder="Client company name / customized voucher heading"
                />
              </label>
              <div className="form-note form-span">
                <strong>Employer-customized salary slip</strong>
                <span>
                  These settings can be changed during unit creation or later
                  through Edit employer unit.
                </span>
              </div>
              <label className="form-span">
                <span>Payslip employer heading</span>
                <input
                  name="payslipTitle"
                  defaultValue={employerUnit?.payslipTitle ?? ""}
                  placeholder="Employer legal / display name"
                />
              </label>
              <label className="form-span">
                <span>Payslip subtitle</span>
                <input
                  name="payslipSubtitle"
                  defaultValue={employerUnit?.payslipSubtitle ?? ""}
                  placeholder="Factory, division, payroll partner, or registration detail"
                />
              </label>
              <label className="form-span">
                <span>Payslip address</span>
                <textarea
                  name="payslipAddress"
                  defaultValue={employerUnit?.payslipAddress ?? ""}
                  rows={2}
                  placeholder="Employer address shown on the salary slip"
                />
              </label>
              <label className="form-span">
                <span>Payslip contact line</span>
                <input
                  name="payslipContact"
                  defaultValue={employerUnit?.payslipContact ?? ""}
                  placeholder="Website · email · phone"
                />
              </label>
              <label className="form-span">
                <span>Payslip footer</span>
                <input
                  name="payslipFooter"
                  defaultValue={employerUnit?.payslipFooter ?? ""}
                  placeholder="Customized salary slip declaration"
                />
              </label>
              <section className="form-span payslip-field-selector">
                <strong>Payslip earnings to show *</strong>
                <div className="scope-checkbox-grid">
                  {earningFields.map((field) => (
                    <label key={field}>
                      <input
                        type="checkbox"
                        checked={unitEarnings.includes(field)}
                        onChange={(event) =>
                          setUnitEarnings(
                            event.target.checked
                              ? [...unitEarnings, field]
                              : unitEarnings.filter((value) => value !== field),
                          )
                        }
                      />
                      <span>{readableField(field)}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="form-span payslip-field-selector">
                <strong>Payslip deductions to show *</strong>
                <div className="scope-checkbox-grid">
                  {deductionFields.map((field) => (
                    <label key={field}>
                      <input
                        type="checkbox"
                        checked={unitDeductions.includes(field)}
                        onChange={(event) =>
                          setUnitDeductions(
                            event.target.checked
                              ? [...unitDeductions, field]
                              : unitDeductions.filter(
                                  (value) => value !== field,
                                ),
                          )
                        }
                      />
                      <span>{readableField(field)}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {modal.kind === "employee-left" ? (
            <div className="form-grid">
              <div className="form-note form-span">
                <strong>
                  {leftEmployee?.name} · {leftEmployee?.employeeCode}
                </strong>
                <span>
                  The employee master, attendance, payroll, accommodation, and
                  payment history will remain preserved.
                </span>
              </div>
              <label className="form-span">
                <span>Employee left date *</span>
                <input
                  name="leftDate"
                  type="date"
                  min={leftEmployee?.dateOfJoining}
                  defaultValue={
                    leftEmployee?.dateOfLeaving ??
                    new Date().toISOString().slice(0, 10)
                  }
                  required
                />
              </label>
            </div>
          ) : null}

          {modal.kind === "employee" ? (
            <div className="form-grid employee-identity-fields">
              <div className="form-note form-span">
                <strong>ID card identity and emergency details</strong>
                <span>
                  These details appear on the CR80 front/back employee ID card.
                </span>
              </div>
              <label>
                <span>Employee mobile number</span>
                <input
                  name="mobileNumber"
                  defaultValue={employee?.mobileNumber ?? ""}
                  inputMode="tel"
                />
              </label>
              <label>
                <span>Emergency contact number</span>
                <input
                  name="emergencyContactNumber"
                  defaultValue={employee?.emergencyContactNumber ?? ""}
                  inputMode="tel"
                />
              </label>
              <label className="form-span">
                <span>Residential address</span>
                <textarea
                  name="addressLine"
                  defaultValue={employee?.addressLine ?? ""}
                  rows={2}
                />
              </label>
              <label>
                <span>District</span>
                <input
                  name="district"
                  defaultValue={employee?.district ?? ""}
                />
              </label>
              <label>
                <span>State</span>
                <input
                  name="stateName"
                  defaultValue={employee?.stateName ?? "Tamil Nadu"}
                />
              </label>
              <label>
                <span>Pincode</span>
                <input
                  name="pincode"
                  defaultValue={employee?.pincode ?? ""}
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <label>
                <span>Blood group</span>
                <select
                  name="bloodGroup"
                  defaultValue={employee?.bloodGroup ?? ""}
                >
                  <option value="">Select</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (group) => (
                      <option key={group}>{group}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>Highest qualification</span>
                <input
                  name="highestQualification"
                  defaultValue={employee?.highestQualification ?? ""}
                  placeholder="Example: B.E., Diploma, ITI, 12th"
                />
              </label>
              <label>
                <span>Father name</span>
                <input
                  name="fatherName"
                  defaultValue={employee?.fatherName ?? ""}
                />
              </label>
              <label>
                <span>Marital status</span>
                <select
                  name="maritalStatus"
                  defaultValue={employee?.maritalStatus ?? "Unmarried"}
                >
                  <option>Unmarried</option>
                  <option>Married</option>
                  <option>Widowed</option>
                  <option>Separated</option>
                </select>
              </label>
              <label>
                <span>Spouse name</span>
                <input
                  name="spouseName"
                  defaultValue={employee?.spouseName ?? ""}
                />
              </label>
            </div>
          ) : null}

          {modal.kind === "employee" ? (
            <section className="employee-shift-selector">
              <div className="form-note">
                <strong>Shift pattern *</strong>
                <span>
                  Select one regular timing, or every rotational shift
                  applicable to this employee.
                </span>
              </div>
              <div className="shift-pattern-options">
                <label>
                  <input
                    type="radio"
                    checked={employeeShiftPattern === "regular"}
                    onChange={() => {
                      setEmployeeShiftPattern("regular");
                      setEmployeeShifts([
                        employeeShifts[0] ?? shiftOptions[0] ?? "General",
                      ]);
                    }}
                  />
                  <span>Regular shift</span>
                </label>
                <label>
                  <input
                    type="radio"
                    checked={employeeShiftPattern === "rotational"}
                    onChange={() => setEmployeeShiftPattern("rotational")}
                  />
                  <span>Rotational shift</span>
                </label>
              </div>
              {employeeShiftPattern === "regular" ? (
                <label>
                  <span>Regular shift timing *</span>
                  <select
                    value={employeeShifts[0] ?? ""}
                    onChange={(event) =>
                      setEmployeeShifts([event.target.value])
                    }
                    required
                  >
                    {shiftOptions.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <fieldset>
                  <legend>Applicable shifts * (minimum 2)</legend>
                  <div className="scope-checkbox-grid">
                    {shiftOptions.map((shift) => (
                      <label key={shift}>
                        <input
                          type="checkbox"
                          checked={employeeShifts.includes(shift)}
                          onChange={(event) =>
                            setEmployeeShifts(
                              event.target.checked
                                ? [...new Set([...employeeShifts, shift])]
                                : employeeShifts.filter(
                                    (value) => value !== shift,
                                  ),
                            )
                          }
                        />
                        <span>{shift}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </section>
          ) : null}

          {modal.kind === "employee" ? (
            <div className="form-grid">
              <label>
                <span>Employee code *</span>
                <input
                  name="employeeCode"
                  defaultValue={employee?.employeeCode}
                  placeholder="J1007"
                  required
                />
              </label>
              <label>
                <span>Employee name *</span>
                <input
                  name="name"
                  defaultValue={employee?.name}
                  placeholder="Full name"
                  required
                />
              </label>
              <label>
                <span>Department *</span>
                <input
                  name="department"
                  defaultValue={employee?.department ?? "Production"}
                  required
                />
              </label>
              <label>
                <span>Date of joining *</span>
                <input
                  name="dateOfJoining"
                  type="date"
                  defaultValue={
                    employee?.dateOfJoining ?? `${currentPeriod}-01`
                  }
                  required
                />
              </label>
              <label>
                <span>Basic salary / daily rate (₹)</span>
                <input
                  name="salaryAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={employee?.salaryAmount ?? 0}
                  required
                />
              </label>
              <label>
                <span>Salary basis</span>
                <select
                  name="salaryBasis"
                  defaultValue={employee?.salaryBasis ?? "monthly"}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>
              <label>
                <span>Default shift</span>
                <select
                  name="defaultShift"
                  defaultValue={
                    employee?.defaultShift ??
                    shiftOptions.find((shift) => shift === "General") ??
                    shiftOptions[0]
                  }
                >
                  {shiftOptions.map((shift) => (
                    <option key={shift}>{shift}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Payment mode</span>
                <select
                  name="paymentMode"
                  defaultValue={employee?.paymentMode ?? "cash"}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank transfer</option>
                </select>
              </label>
              <label>
                <span>UAN</span>
                <input
                  name="uanMasked"
                  defaultValue={employee?.uanMasked ?? ""}
                  placeholder="Optional unless PF applies"
                />
              </label>
              <label>
                <span>ESI number</span>
                <input
                  name="esiMasked"
                  defaultValue={employee?.esiMasked ?? ""}
                  placeholder="Optional unless ESI applies"
                />
              </label>
              <label>
                <span>Bank account number</span>
                <input
                  name="bankAccountMasked"
                  defaultValue={employee?.bankAccountMasked ?? ""}
                />
              </label>
              <label>
                <span>IFSC code</span>
                <input
                  name="ifscMasked"
                  defaultValue={employee?.ifscMasked ?? ""}
                />
              </label>
              <label>
                <span>Bank name</span>
                <input
                  name="bankName"
                  defaultValue={employee?.bankName ?? ""}
                />
              </label>
              <label>
                <span>EPF applicable</span>
                <select
                  name="pfApplicable"
                  defaultValue={employee?.pfApplicable === 0 ? "no" : "yes"}
                >
                  <option value="yes">Required</option>
                  <option value="no">Not required</option>
                </select>
              </label>
              <label>
                <span>Customized EPF wage (₹)</span>
                <input
                  name="pfWageAmount"
                  type="number"
                  min="0"
                  max="15000"
                  step="0.01"
                  defaultValue={employee?.pfWageAmount ?? 0}
                />
                <small>Maximum statutory ceiling ₹15,000</small>
              </label>
              <label>
                <span>ESI applicable</span>
                <select
                  name="esiApplicable"
                  defaultValue={employee?.esiApplicable === 0 ? "no" : "yes"}
                >
                  <option value="yes">Required</option>
                  <option value="no">Not required</option>
                </select>
              </label>
              <label>
                <span>Customized ESI wage (₹)</span>
                <input
                  name="esiWageAmount"
                  type="number"
                  min="0"
                  max="21000"
                  step="0.01"
                  defaultValue={employee?.esiWageAmount ?? 0}
                />
                <small>Maximum coverage ceiling ₹21,000</small>
              </label>
              <label>
                <span>Professional Tax</span>
                <select
                  name="ptApplicable"
                  defaultValue={employee?.ptApplicable === 0 ? "no" : "yes"}
                >
                  <option value="yes">Applicable</option>
                  <option value="no">Not required</option>
                </select>
              </label>
              <label>
                <span>Tamil Nadu LWF</span>
                <select
                  name="lwfApplicable"
                  defaultValue={employee?.lwfApplicable === 0 ? "no" : "yes"}
                >
                  <option value="yes">Applicable</option>
                  <option value="no">Not required</option>
                </select>
              </label>
              <label>
                <span>Accommodation type *</span>
                <select
                  name="accommodationType"
                  value={employeeType}
                  onChange={(event) => {
                    setEmployeeType(event.target.value);
                    setEmployeeRoomId("");
                    setEmployeeRoomNumber("");
                  }}
                  required
                >
                  {activeAccommodationTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Existing room</span>
                <select
                  name="roomId"
                  value={employeeRoomId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setEmployeeRoomId(id);
                    setEmployeeRoomNumber(
                      matchingRooms.find((room) => room.id === id)
                        ?.roomNumber ?? "",
                    );
                  }}
                >
                  <option value="">No existing room selected</option>
                  {matchingRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber}
                      {room.capacity ? ` · capacity ${room.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Room number</span>
                <input
                  name="roomNumber"
                  value={employeeRoomNumber}
                  onChange={(event) => {
                    setEmployeeRoomNumber(event.target.value);
                    setEmployeeRoomId("");
                  }}
                  placeholder="Choose above or type a new room number"
                />
              </label>
              <label className="form-span">
                <span>Employee photo for ID card</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 500000) {
                      window.alert(
                        "Choose an employee photo smaller than 500 KB.",
                      );
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setEmployeePhoto(String(reader.result ?? ""));
                    reader.readAsDataURL(file);
                  }}
                />
                {employeePhoto ? (
                  <small>Employee photo selected</small>
                ) : (
                  <small>Recommended: clear passport-style photo</small>
                )}
              </label>
              <label>
                <span>Other remarks</span>
                <input
                  name="remarks"
                  list="payroll-remark-options"
                  defaultValue={employee?.remarks ?? ""}
                  placeholder="Optional employee notes"
                />
              </label>
              <div className="form-note form-span">
                <strong>QR employee ID card</strong>
                <span>
                  The ID card and employee QR code are generated automatically
                  immediately after saving. Open Employees → Actions → ID card +
                  QR to print it.
                </span>
              </div>
            </div>
          ) : null}

          {modal.kind === "accommodation-type" ? (
            <div className="form-grid">
              <label className="form-span">
                <span>Accommodation type name *</span>
                <input
                  name="name"
                  defaultValue={selectedType?.name ?? ""}
                  placeholder="Tamil, Outside Room, Joy Room…"
                  required
                />
              </label>
              <label className="form-span">
                <span>Remarks</span>
                <textarea
                  name="remarks"
                  defaultValue={selectedType?.remarks ?? ""}
                  rows={3}
                  placeholder="Optional allocation or recovery guidance"
                />
              </label>
              <div className="form-note form-span">
                Active accommodation types appear in employee and room forms. A
                type with active employee assignments cannot be deactivated or
                removed.
              </div>
            </div>
          ) : null}

          {modal.kind === "shift" ? (
            <div className="form-grid">
              <label className="form-span">
                <span>Client location *</span>
                <select
                  name="clientUnitId"
                  defaultValue={selectedShift?.clientUnitId ?? unit?.id ?? ""}
                  required
                >
                  {units
                    .filter(
                      (entry) =>
                        entry.vendorId === vendorId &&
                        entry.status === "active",
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.clientName} · {entry.unitName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Shift name *</span>
                <input
                  name="name"
                  defaultValue={selectedShift?.name}
                  required
                />
              </label>
              <label>
                <span>Start time *</span>
                <input
                  name="startTime"
                  type="time"
                  defaultValue={selectedShift?.startTime ?? "09:00"}
                  required
                />
              </label>
              <label>
                <span>End time *</span>
                <input
                  name="endTime"
                  type="time"
                  defaultValue={selectedShift?.endTime ?? "18:00"}
                  required
                />
              </label>
              <label>
                <span>Break minutes</span>
                <input
                  name="breakMinutes"
                  type="number"
                  min="0"
                  defaultValue={selectedShift?.breakMinutes ?? 60}
                />
              </label>
              <label>
                <span>Required work minutes</span>
                <input
                  name="requiredWorkMinutes"
                  type="number"
                  min="1"
                  defaultValue={selectedShift?.requiredWorkMinutes ?? 480}
                />
              </label>
              <label>
                <span>Late grace minutes</span>
                <input
                  name="lateGraceMinutes"
                  type="number"
                  min="0"
                  defaultValue={selectedShift?.lateGraceMinutes ?? 0}
                />
              </label>
              <label>
                <span>Late deduction minutes</span>
                <input
                  name="lateDeductionMinutes"
                  type="number"
                  min="0"
                  defaultValue={selectedShift?.lateDeductionMinutes ?? 0}
                />
              </label>
              <label>
                <span>Early-out grace minutes</span>
                <input
                  name="earlyGraceMinutes"
                  type="number"
                  min="0"
                  defaultValue={selectedShift?.earlyGraceMinutes ?? 0}
                />
              </label>
              <label>
                <span>Early-out deduction minutes</span>
                <input
                  name="earlyDeductionMinutes"
                  type="number"
                  min="0"
                  defaultValue={selectedShift?.earlyDeductionMinutes ?? 0}
                />
              </label>
              <label>
                <span>OT logic</span>
                <select
                  name="otMode"
                  defaultValue={selectedShift?.otMode ?? "approval"}
                >
                  <option value="approval">
                    Based on requirement / approval
                  </option>
                  <option value="fixed">Fixed OT hours</option>
                </select>
              </label>
              <label>
                <span>Fixed OT hours</span>
                <input
                  name="fixedOtHours"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  defaultValue={selectedShift?.fixedOtHours ?? 0}
                />
              </label>
              <label className="form-span">
                <span>Shift remarks</span>
                <input
                  name="remarks"
                  defaultValue={selectedShift?.remarks ?? ""}
                />
              </label>
              <div className="form-note form-span">
                Late and early deductions apply only after their grace limits.
                Overnight shifts are supported.
              </div>
            </div>
          ) : null}

          {modal.kind === "remark" ? (
            <div className="form-grid">
              <label>
                <span>Remark title *</span>
                <input
                  name="title"
                  defaultValue={selectedRemark?.title}
                  placeholder="Late arrival, safety issue, follow-up…"
                  required
                />
              </label>
              <label>
                <span>Category *</span>
                <select
                  name="category"
                  defaultValue={selectedRemark?.category ?? "general"}
                >
                  {[
                    "general",
                    "attendance",
                    "employee",
                    "salary",
                    "employer",
                    "shift",
                  ].map((category) => (
                    <option value={category} key={category}>
                      {readableField(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-span">
                <span>Remark details</span>
                <textarea
                  name="notes"
                  defaultValue={selectedRemark?.notes ?? ""}
                  placeholder="Describe when your team should use this remark"
                  rows={4}
                />
              </label>
            </div>
          ) : null}

          {modal.kind === "app-user" ? (
            <div className="user-access-form">
              {!accessProfile ? (
                <label>
                  <span>Temporary password * (minimum 12 characters)</span>
                  <input
                    name="temporaryPassword"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
              ) : null}
              {userRole === "hostel_incharge" ? (
                <section className="scope-assignment-panel">
                  <header>
                    <div>
                      <span className="eyebrow">Hostel responsibility</span>
                      <h3>Assign responsible hostels</h3>
                    </div>
                    <small>
                      Attendance and hostel entries are limited to these
                      residents
                    </small>
                  </header>
                  <div className="scope-checkbox-grid">
                    {hostels
                      .filter(
                        (hostel) =>
                          hostel.status === "active" ||
                          hostelScopeDraft.includes(hostel.id),
                      )
                      .map((hostel) => (
                        <label key={hostel.id}>
                          <input
                            type="checkbox"
                            checked={hostelScopeDraft.includes(hostel.id)}
                            onChange={(event) =>
                              toggleScope(
                                setHostelScopeDraft,
                                hostelScopeDraft,
                                hostel.id,
                                event.target.checked,
                              )
                            }
                          />
                          <span>
                            <strong>{hostel.name}</strong>
                            <small>
                              {
                                vendors.find(
                                  (vendor) => vendor.id === hostel.vendorId,
                                )?.name
                              }
                            </small>
                          </span>
                        </label>
                      ))}
                  </div>
                </section>
              ) : null}
              <div className="form-grid">
                <div className="form-note form-span">
                  <strong>Joy direct employee user</strong>
                  <span>
                    Create the login and direct employee identity together.
                    Client-factory manpower remains in Employee Master.
                  </span>
                </div>
                <label>
                  <span>Employee code *</span>
                  <input
                    name="employeeCode"
                    defaultValue={accessProfile?.employeeCode ?? ""}
                    required
                  />
                </label>
                <label>
                  <span>Employee name *</span>
                  <input
                    name="fullName"
                    defaultValue={accessProfile?.fullName ?? ""}
                    required
                  />
                </label>
                <label>
                  <span>Department *</span>
                  <input
                    name="department"
                    defaultValue={accessProfile?.department ?? ""}
                    required
                  />
                </label>
                <label>
                  <span>Date of joining *</span>
                  <input
                    name="dateOfJoining"
                    type="date"
                    defaultValue={accessProfile?.dateOfJoining ?? ""}
                    required
                  />
                </label>
                <label>
                  <span>Mobile number</span>
                  <input
                    name="mobileNumber"
                    defaultValue={accessProfile?.mobileNumber ?? ""}
                  />
                </label>
                <label>
                  <span>Sign-in email *</span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={accessProfile?.email ?? ""}
                    required
                  />
                </label>
                <label className="form-span">
                  <span>Role *</span>
                  <select
                    value={userRole}
                    onChange={(event) => {
                      const role = event.target.value as UserRole;
                      setUserRole(role);
                      setPermissionDraft({ ...DEFAULT_PERMISSIONS[role] });
                      setApprovalDraft(DEFAULT_APPROVAL_ACCESS[role]);
                    }}
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <section className="scope-assignment-panel">
                <header>
                  <div>
                    <span className="eyebrow">Organisation access</span>
                    <h3>
                      {userRole === "super_admin"
                        ? "Unrestricted access"
                        : userRole === "payroll_team"
                          ? "Assign clients"
                          : "Assign employer units"}
                    </h3>
                  </div>
                  <small>
                    {userRole === "super_admin"
                      ? "All current and future clients and units"
                      : "At least one assignment is required"}
                  </small>
                </header>
                {userRole === "super_admin" ? (
                  <div className="form-note">
                    Super Admin can access every client and employer unit.
                  </div>
                ) : userRole === "payroll_team" ? (
                  <div className="scope-checkbox-grid">
                    {vendors
                      .filter(
                        (vendor) =>
                          vendor.status === "active" ||
                          clientScopeDraft.includes(vendor.id),
                      )
                      .map((vendor) => (
                        <label key={vendor.id}>
                          <input
                            type="checkbox"
                            checked={clientScopeDraft.includes(vendor.id)}
                            onChange={(event) =>
                              toggleScope(
                                setClientScopeDraft,
                                clientScopeDraft,
                                vendor.id,
                                event.target.checked,
                              )
                            }
                          />
                          <span>
                            <strong>{vendor.name}</strong>
                            <small>{vendor.code}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                ) : (
                  <div className="scope-checkbox-grid">
                    {vendors.map((vendor) => (
                      <div className="scope-client-group" key={vendor.id}>
                        <strong>{vendor.name}</strong>
                        {units
                          .filter(
                            (entry) =>
                              entry.vendorId === vendor.id &&
                              (entry.status === "active" ||
                                unitScopeDraft.includes(entry.id)),
                          )
                          .map((entry) => (
                            <label key={entry.id}>
                              <input
                                type="checkbox"
                                checked={unitScopeDraft.includes(entry.id)}
                                onChange={(event) =>
                                  toggleScope(
                                    setUnitScopeDraft,
                                    unitScopeDraft,
                                    entry.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>
                                <strong>{entry.clientName}</strong>
                                <small>
                                  {entry.unitName} · {entry.location}
                                </small>
                              </span>
                            </label>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="permission-legend">
                <span>
                  <b>No access</b> Hidden and blocked
                </span>
                <span>
                  <b>View only</b> Can review, cannot save
                </span>
                <span>
                  <b>Full access</b> Can create, edit, import, or export
                </span>
              </div>
              <section className="permission-matrix">
                <header>
                  <div>
                    <span className="eyebrow">Custom permissions</span>
                    <h3>Module access</h3>
                  </div>
                  <small>
                    {userRole === "super_admin"
                      ? "Super Admin always has full access"
                      : "Change any role default"}
                  </small>
                </header>
                {ACCESS_MODULES.map((module) => (
                  <label key={module.id}>
                    <div>
                      <strong>{module.label}</strong>
                      <small>{module.description}</small>
                    </div>
                    <select
                      aria-label={`${module.label} permission`}
                      value={permissionDraft[module.id]}
                      disabled={userRole === "super_admin"}
                      onChange={(event) =>
                        setPermissionDraft((current) => ({
                          ...current,
                          [module.id]: event.target
                            .value as PermissionMap[typeof module.id],
                        }))
                      }
                    >
                      <option value="none">No access</option>
                      <option value="view">View only</option>
                      <option value="manage">Full access</option>
                    </select>
                  </label>
                ))}
              </section>
              <label
                className={`approval-authority ${userRole === "super_admin" ? "approval-authority-fixed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={approvalDraft}
                  disabled={userRole === "super_admin"}
                  onChange={(event) => setApprovalDraft(event.target.checked)}
                />
                <span>
                  <strong>Allow final payroll approval</strong>
                  <small>
                    This person can lock an approved salary run and unlock
                    payment exports. Payroll Full access is also required.
                  </small>
                </span>
              </label>
            </div>
          ) : null}

          {modal.kind === "run" ? (
            <div className="form-grid">
              <label className="form-span">
                <span>Payroll processing type *</span>
                <select
                  value={runProcessingMode}
                  onChange={(event) =>
                    setRunProcessingMode(
                      event.target.value as "attendance" | "salary_import",
                    )
                  }
                >
                  <option value="attendance">
                    Attendance available in application
                  </option>
                  <option value="salary_import">
                    Import salary-slip / salary-register headers
                  </option>
                </select>
              </label>
              <label className="form-span">
                <span>Payroll month / label *</span>
                <input
                  name="payPeriod"
                  type="month"
                  value={runMonth}
                  onChange={(event) => {
                    const value = event.target.value;
                    const dates = unitAttendanceCycle(value, unit);
                    setRunMonth(value);
                    setRunStart(dates.start);
                    setRunEnd(dates.end);
                    setRunWorkingDays(unit?.attendanceWorkingDays ?? 26);
                  }}
                  required
                />
              </label>
              <label>
                <span>Calculation period starts *</span>
                <input
                  name="periodStart"
                  type="date"
                  value={runStart}
                  onChange={(event) => setRunStart(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Calculation period ends *</span>
                <input
                  name="periodEnd"
                  type="date"
                  value={runEnd}
                  onChange={(event) => setRunEnd(event.target.value)}
                  required
                />
              </label>
              <label className="form-span">
                <span>Monthly working days *</span>
                <input
                  name="workingDays"
                  type="number"
                  min="1"
                  max="62"
                  value={runWorkingDays}
                  onChange={(event) =>
                    setRunWorkingDays(Number(event.target.value))
                  }
                  required
                />
              </label>
              <div className="form-note form-span">
                Attendance mode calculates salary from saved attendance.
                Salary-import mode keeps imported earning and deduction headers
                as the payroll source.
              </div>
            </div>
          ) : null}

          {modal.kind === "attendance" ? (
            <div className="form-grid">
              <div className="form-note form-span">
                <strong>{modal.employee.name}</strong>
                <span>
                  {modal.employee.employeeCode} ·{" "}
                  {new Date(`${modal.date}T00:00:00`).toLocaleDateString(
                    "en-IN",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </span>
              </div>
              <label>
                <span>Attendance status *</span>
                <select
                  name="statusCode"
                  defaultValue={modal.entry?.statusCode ?? "P"}
                >
                  {Object.entries(statusMeta).map(([code, meta]) => (
                    <option value={code} key={code}>
                      {code} — {meta.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Client-mapped shift *</span>
                <select
                  name="shiftCode"
                  defaultValue={
                    modal.entry?.shiftCode ?? modal.employee.defaultShift
                  }
                >
                  {shiftOptions.map((shift) => (
                    <option key={shift}>{shift}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Punch in</span>
                <input
                  name="punchIn"
                  type="time"
                  defaultValue={modal.entry?.punchIn ?? ""}
                />
              </label>
              <label>
                <span>Punch out</span>
                <input
                  name="punchOut"
                  type="time"
                  defaultValue={modal.entry?.punchOut ?? ""}
                />
              </label>
              <label>
                <span>Approved OT hours</span>
                <input
                  name="overtimeHours"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  defaultValue={modal.entry?.overtimeHours ?? 0}
                />
              </label>
              <label>
                <span>Attendance remarks</span>
                <input
                  name="remarks"
                  list="payroll-remark-options"
                  defaultValue={modal.entry?.remarks ?? ""}
                />
              </label>
              <div className="form-note form-span">
                The selected shift applies break time, required work time,
                late/early grace, deduction hours and fixed/approved OT rules
                automatically.
              </div>
            </div>
          ) : null}

          {modal.kind === "salary" ? (
            <div className="salary-form-columns">
              <section>
                <h3>Earnings</h3>
                <div className="form-grid">
                  {earningFields.map((field) => (
                    <label key={field}>
                      <span>{readableField(field)}</span>
                      <input
                        name={field}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={modal.item[field]}
                      />
                    </label>
                  ))}
                </div>
              </section>
              <section>
                <h3>Deductions</h3>
                <div className="form-grid">
                  {deductionFields.map((field) => (
                    <label key={field}>
                      <span>{readableField(field)}</span>
                      <input
                        name={field}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={modal.item[field]}
                      />
                    </label>
                  ))}
                </div>
                <div className="form-note">
                  Room deductions are managed separately under Accommodation.
                </div>
              </section>
            </div>
          ) : null}

          {modal.kind === "accommodation" ? (
            <div className="form-grid">
              <label className="form-span">
                <span>Employee *</span>
                <select
                  name="employeeId"
                  defaultValue={modal.employee?.id ?? employees[0]?.id}
                  required
                >
                  {employees.map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.employeeCode} · {row.name} · {row.accommodationType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-span">
                <span>Room number</span>
                <input
                  name="roomNumber"
                  defaultValue={
                    modal.charge?.roomNumber ?? modal.employee?.roomNumber ?? ""
                  }
                />
              </label>
              {recoveryFields.map((field) => (
                <label key={field}>
                  <span>{readableField(field)} (₹)</span>
                  <input
                    name={field}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={modal.charge?.[field] ?? 0}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {modal.kind === "import" ? (
            <div className="import-form">
              <label>
                <span>Import into payroll month *</span>
                <input
                  type="month"
                  value={importPeriod}
                  onChange={(event) => {
                    const period = event.target.value;
                    setImportPeriod(period);
                    if (selectedFile && period)
                      void inspectFile(selectedFile, period);
                  }}
                  required
                />
              </label>
              <label className="file-drop">
                <input
                  type="file"
                  accept=".xlsx,.csv,.txt"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void inspectFile(file, importPeriod);
                  }}
                />
                <Icon name="file" size={25} />
                <strong>
                  {selectedFile?.name ??
                    "Choose Attendance, Salary Register, CSV, or TXT"}
                </strong>
                <span>
                  Supports Excel .xlsx, CSV and tab/pipe/comma-delimited TXT
                  files with attendance or salary-slip headers.
                </span>
              </label>
              {parsing ? (
                <div className="form-note">
                  Reading file and mapping employee records…
                </div>
              ) : null}
              {parseError ? (
                <div className="form-error">{parseError}</div>
              ) : null}
              {parsed ? (
                <div className="import-preview">
                  <span className="eyebrow">
                    File recognized ·{" "}
                    {parsed.sourceType === "salary"
                      ? "Salary import mode"
                      : "Attendance / employee mode"}
                  </span>
                  <strong>{parsed.sheetName}</strong>
                  <div>
                    <span>{parsed.employees.length} employees</span>
                    <span>{parsed.attendance.length} attendance marks</span>
                    <span>{parsed.salaryItems.length} salary records</span>
                  </div>
                  <p>
                    Records will be saved to {unit?.clientName} ·{" "}
                    {unit?.unitName} for {monthLabel(importPeriod)}. A payroll
                    run will be created if one does not already exist.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="action-modal-footer">
          {modal.kind === "attendance" && modal.entry ? (
            <button
              className="danger-button"
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete attendance for ${modal.employee.name} on ${modal.date}?`,
                  )
                )
                  void onAction(
                    "delete-attendance",
                    "Attendance and shift entry deleted",
                    {
                      employeeId: modal.employee.id,
                      attendanceDate: modal.date,
                    },
                  );
              }}
            >
              Delete entry
            </button>
          ) : null}
          {modal.kind === "accommodation" && modal.employee && modal.charge ? (
            <button
              className="danger-button"
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete accommodation recoveries for ${modal.employee?.name}?`,
                  )
                )
                  void onAction(
                    "delete-accommodation",
                    "Accommodation recoveries deleted",
                    { employeeId: modal.employee?.id },
                  );
              }}
            >
              Delete recovery
            </button>
          ) : null}
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={busy || parsing || (modal.kind === "import" && !parsed)}
          >
            {busy ? (
              <>
                <span className="button-spinner" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function EmployeeCell({
  name,
  code,
  detail,
}: {
  name: string;
  code: string;
  detail: string;
}) {
  return (
    <div className="employee-cell">
      <span>{initials(name)}</span>
      <div>
        <strong>{name}</strong>
        <small>
          {code}
          {detail ? ` · ${detail}` : ""}
        </small>
      </div>
    </div>
  );
}

function FieldState({ value }: { value: string | null }) {
  return value ? (
    <span className="field-ready">
      <Icon name="check" size={14} />
      {value}
    </span>
  ) : (
    <span className="field-pending">
      <Icon name="alert" size={14} />
      Pending
    </span>
  );
}

function RecordActions({
  status,
  onEdit,
  onToggle,
  onDelete,
  onOpen,
}: {
  status: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  return (
    <div className="record-actions">
      {onOpen ? (
        <button className="record-action" onClick={onOpen}>
          Open
        </button>
      ) : null}
      <button className="record-action" onClick={onEdit}>
        Edit
      </button>
      <button className="record-action" onClick={onToggle}>
        {status === "active" ? "Deactivate" : "Activate"}
      </button>
      <button className="record-action record-delete" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <span className={`status-pill pill-${key}`}>
      <i />
      {status}
    </span>
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadXlsx(filename: string, rows: Array<Array<string | number>>) {
  const xml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const column = (index: number) => {
    let label = "";
    for (let value = index + 1; value; value = Math.floor((value - 1) / 26))
      label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
    return label;
  };
  const sheetRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, cellIndex) => {
            const ref = `${column(cellIndex)}${rowIndex + 1}`;
            return typeof cell === "number"
              ? `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ""}><v>${cell}</v></c>`
              : `<c r="${ref}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ""}><is><t>${xml(String(cell))}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Indian Bank Bulk Upload" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "xl/styles.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/><col min="6" max="9" width="24" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  const workbookBytes = new Uint8Array(zipSync(files));
  const url = URL.createObjectURL(
    new Blob([workbookBytes.buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function numberToWordsIndian(value: number): string {
  if (value === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const underHundred = (number: number) =>
    number < 20
      ? ones[number]
      : `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ""}`;
  const underThousand = (number: number) =>
    number < 100
      ? underHundred(number)
      : `${ones[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${underHundred(number % 100)}` : ""}`;
  const groups: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  let remaining = value;
  const words: string[] = [];
  for (const [size, label] of groups) {
    const count = Math.floor(remaining / size);
    if (count) {
      words.push(`${underThousand(count)} ${label}`);
      remaining %= size;
    }
  }
  if (remaining) words.push(underThousand(remaining));
  return words.join(" ");
}
