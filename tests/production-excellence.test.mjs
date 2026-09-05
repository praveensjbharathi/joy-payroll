import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("employee ID card is portrait, client-branded and mobile-free on front", async () => {
  const id = await source("app/employee-id-card.tsx");
  // Verify the actual HQ portrait render rather than relying on a documentation comment.
  assert.match(id, /const width=1276,height=2022/);
  assert.match(id, /id-card-front/);
  assert.match(id, /Client employer/);
  const front = id.slice(id.indexOf("id-card-front"), id.indexOf("id-card-back"));
  assert.doesNotMatch(front, /mobileNumber|Mobile number|Mobile/);
});

test("employee master includes highest qualification", async () => {
  const payroll = await source("app/payroll-app.tsx");
  assert.match(payroll, /highestQualification/);
  assert.match(payroll, /Highest qualification/);
});

test("payroll is bank-transfer only and all three bank formats remain available", async () => {
  const payroll = await source("app/payroll-app.tsx");
  const api = await source("app/api/app-data/route.ts");
  assert.doesNotMatch(payroll, /<option value="cash">Cash<\/option>/);
  assert.match(payroll, /item\.paymentMode !== "cash" && item\.netPayable > 0/);
  assert.match(payroll, /bankValidationIssues/);
  assert.match(api, /const paymentMode = "bank";/);
  assert.doesNotMatch(api, /paymentMode: "cash"/);
  assert.match(payroll, /Indian Bank Excel/);
  assert.match(payroll, /CUB Any Bank TXT/);
  assert.match(payroll, /CUB-to-CUB TXT/);
  assert.match(payroll, /selectedBankItems/);
  assert.doesNotMatch(payroll, />Lock selected batch</);
  assert.match(payroll, /JOY_ONE_CLICK_BANK_EXPORT_V1/);
  assert.match(payroll, /download-payment-batch/);
  assert.match(api, /requestedItemIds/);
  assert.match(api, /payment_export_batch_run_item_unique/);
  assert.match(api, /duplicate processing was blocked/);
  assert.match(payroll, /const bankDownloadBlockReason/);
  assert.match(payroll, /Download check:/);
  assert.match(payroll, /zero-pay employee\(s\) omitted from bank files/);
  assert.doesNotMatch(payroll, /lock the batch before downloading a bank file/);
  assert.match(payroll, /JOY_FUND_LIMITED_BANK_BATCH_V4/);
  assert.match(payroll, /const availableBankItems = bankItems\.filter/);
  assert.match(payroll, /const prepared = resolveBankExport\("indian_bank_xlsx"\)/);
  assert.match(payroll, /No employee is selected automatically/);
  assert.match(payroll, /available bank balance/);
  assert.match(payroll, /Download selected batch/);
  assert.match(payroll, /isDownloaded \|\| isLocked \|\| !formatEligible/);
  assert.match(payroll, /Only downloaded employees are locked/);
  assert.doesNotMatch(payroll, /-RECONCILED-COPY/);
  const formatsStart = payroll.indexOf('<span className="eyebrow">Bank bulk-upload formats</span>');
  const formatsEnd = payroll.indexOf('<section className="panel payroll-bank-flow">', formatsStart);
  const formats = payroll.slice(formatsStart, formatsEnd);
  assert.ok(formatsStart >= 0 && formatsEnd > formatsStart);
  assert.doesNotMatch(formats, /disabled=\{run\.status|!selectedBankItems/);
  assert.match(formats, /disabled=\{paymentSelectionBusy\}/);
});

test("recovery category choices resolve to real hostel and room master IDs", async () => {
  const recovery = await source("app/reports-recovery.tsx");
  assert.match(recovery, /JOY_RECOVERY_SCOPE_MAPPING_V2/);
  assert.match(recovery, /joySharedRecoveryTypeIds\.has\(type\.id\)/);
  assert.match(recovery, /recoveryScopeTypeIds\.has\(hostel\.accommodationTypeId\)/);
  assert.match(recovery, /recoveryScopeTypeIds\.has\(room\.accommodationTypeId\)/);
  assert.match(recovery, /scope\.includes\(run\.clientUnitId\)/);
  assert.doesNotMatch(recovery, /accommodationTypeId === roomRecoveryScope/);
});

test("payroll page explains wage-to-bank flow", async () => {
  const payroll = await source("app/payroll-app.tsx");
  for (const text of [
    "Earnings",
    "Statutory deductions",
    "Recoveries",
    "Final payable",
    "Bank validation",
    "Download",
  ]) assert.match(payroll, new RegExp(text));
});

test("hostel master supports edit delete mapping and unallocated employee allocation", async () => {
  const hostel = await source("app/hostel-master.tsx");
  assert.match(hostel, /updateHostel/);
  assert.match(hostel, /delete-hostel/);
  assert.match(hostel, /Mapped client employer units/);
  assert.match(hostel, /unallocatedEmployees/);
  assert.match(hostel, /Allocate employee/);
  assert.match(hostel, /allocate-room/);
});

test("employee creation fetches unit-mapped hostel rooms and ships a matching Excel format", async () => {
  const payroll = await source("app/payroll-app.tsx");
  const importer = await source("lib/excel-import.ts");
  const api = await source("app/api/app-data/route.ts");
  assert.match(payroll, /const matchingHostels = hostels\.filter/);
  assert.match(payroll, /scope\.includes\(unit\.id\)/);
  assert.match(payroll, /room\.hostelId === employeeHostelId/);
  assert.match(payroll, /Select mapped hostel \/ area/);
  assert.match(payroll, /Individual monthly rent/);
  assert.match(payroll, /Employee Excel format/);
  assert.match(payroll, /EMPLOYEE_IMPORT_HEADERS/);
  assert.match(importer, /export const EMPLOYEE_IMPORT_HEADERS/);
  assert.match(importer, /sourceType: "employee"/);
  assert.match(importer, /employeeMasterSheet/);
  assert.match(api, /hostel \/ area .* is not mapped to this employer unit/);
  assert.match(api, /room .* was not found in/);
});

test("all large preview dialogs scroll without clipping controls", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /JOY_PREVIEW_SCROLL_V1/);
  assert.match(css, /\.payslip-modal,/);
  assert.match(css, /\.room-report-modal,/);
  assert.match(css, /\.id-card-modal,/);
  assert.match(css, /\.action-modal/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /max-height: 94dvh/);
});

test("normal form actions stay on payroll-api and only payslip email uses salary-slip-mailer", async () => {
  const payroll = await source("app/payroll-app.tsx");
  const performStart = payroll.indexOf("  async function performAction(");
  const performEnd = payroll.indexOf("  async function updateRecordStatus(", performStart);
  assert.ok(performStart >= 0 && performEnd > performStart, "performAction block must exist");
  const performAction = payroll.slice(performStart, performEnd);
  assert.match(performAction, /fetch\(apiEndpoint/);
  assert.doesNotMatch(performAction, /salary-slip-mailer/);

  const payslipStart = payroll.indexOf("function PayslipModal(");
  assert.ok(payslipStart >= 0, "PayslipModal must exist");
  const payslip = payroll.slice(payslipStart);
  assert.match(payslip, /salary-slip-mailer/);
  assert.match(payslip, /itemId: item\.id/);
});

test("bulk salary-slip mailer sorts with employee master data, not a missing payroll item column", async () => {
  const mailer = await source("supabase/functions/salary-slip-mailer/index.ts");
  assert.doesNotMatch(mailer, /\.from\("payroll_items"\)[\s\S]{0,200}\.order\("employee_name"\)/);
  assert.match(mailer, /const orderedSelected=\[\.\.\.selected\]\.sort/);
  assert.match(mailer, /leftEmployee\?\.name/);
  assert.match(mailer, /rightEmployee\?\.employee_code/);
  assert.match(mailer, /for\(const item of orderedSelected\)/);
});

test("individual dated recoveries persist as transactions and synchronize final payroll", async () => {
  const api = await source("app/api/app-data/route.ts");
  const start = api.indexOf('    } else if (action === "save-recovery-entry") {');
  const end = api.indexOf('    } else if (action === "delete-recovery-entry") {', start);
  assert.ok(start >= 0 && end > start, "individual recovery action must exist");
  const block = api.slice(start, end);
  assert.match(block, /const id = `REC-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(block, /\.insert\(recoveryEntries\)/);
  assert.match(block, /await syncDatedRecoveries\(db, runId, employeeId\)/);
  assert.match(api, /async function syncDatedRecoveries/);
  assert.match(api, /await recalculateRun\(db, runId, false\)/);
});

test("approved payroll can safely reopen cleared batches for recovery correction", async () => {
  const api = await source("app/api/app-data/route.ts");
  const recovery = await source("app/reports-recovery.tsx");
  assert.match(recovery, /recovery-lock-guidance/);
  assert.match(recovery, /Reopen the cleared batch and payroll here/);
  assert.match(recovery, /reopen-payroll-for-recovery/);
  assert.match(recovery, /Reopen payment batch & payroll/);
  assert.match(recovery, /run\.status === "approved"/);
  assert.match(api, /action === "reopen-payroll-for-recovery"/);
  assert.match(api, /payroll_reopened_for_recovery/);
  assert.match(api, /eq\(payrollBatches\.status, "cleared"\)/);
  assert.match(api, /status: "prepared"/);
});

test("missed employees can join a payment-protected payroll without reopening paid rows", async () => {
  const api = await source("app/api/app-data/route.ts");
  const payroll = await source("app/payroll-app.tsx");
  const start = api.indexOf('    } else if (action === "reopen" || action === "reset-demo") {');
  const end = api.indexOf('    } else if (action === "delete-payroll-run") {', start);
  assert.ok(start >= 0 && end > start, "general payroll reopen action must exist");
  const reopen = api.slice(start, end);
  assert.match(reopen, /const missingEmployees = activeEmployees\.filter/);
  assert.match(reopen, /const downloadedPaymentBatches = paymentBatches\.filter/);
  assert.match(reopen, /await addEmployeesToRun/);
  assert.match(reopen, /downloaded bank batch\(es\) and paid employee records remain locked/);
  assert.match(api, /requirePayrollItemPaymentUnlocked/);
  assert.match(api, /downloadedItemIds\.has\(item\.id\)/);
  assert.match(payroll, /Add \$\{missingEmployeeCount\} missed employee/);
  assert.match(payroll, /downloadedPayrollItemIds\.has\(selectedItem\.id\)/);
  assert.match(payroll, /paymentExportBatches\.find\(\(batch\) => batch\.status === "locked"\) \?\? null/);
});

test("room recovery is an append-only dated ledger and finalization aggregates the month", async () => {
  const api = await source("app/api/app-data/route.ts");
  const schema = await source("db/schema.ts");
  const recovery = await source("app/reports-recovery.tsx");
  const start = api.indexOf('    } else if (action === "save-room-expense") {');
  const end = api.indexOf('    } else if (action === "finalize-room-expense") {', start);
  assert.ok(start >= 0 && end > start, "room recovery save action must exist");
  const saveBlock = api.slice(start, end);
  assert.match(saveBlock, /const expenseId = `ROOMEXP-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(saveBlock, /\.insert\(accommodationRoomExpenses\)/);
  assert.doesNotMatch(saveBlock, /const \[existing\]/);
  assert.match(api, /const ledger = await db/);
  assert.match(api, /ledger\.reduce\(\(sum, entry\) => sum \+ numberValue\(entry\.gasAmount\)/);
  assert.match(api, /ledger\.reduce\(\(sum, entry\) => sum \+ numberValue\(entry\.rationAmount\)/);
  assert.match(api, /ledger\.reduce\(\(sum, entry\) => sum \+ numberValue\(entry\.provisionAmount\)/);
  assert.match(schema, /index\("accommodation_room_period_idx"\)/);
  assert.doesNotMatch(schema, /uniqueIndex\("accommodation_room_period_unique"\)/);
  assert.match(recovery, /Room recovery date-wise ledger/);
  assert.match(recovery, /setRoomRecoveryGas\(0\)/);
  assert.match(recovery, /Save dated room recovery entry/);
});

test("employee finalization allocates draft room recovery to applicable occupants", async () => {
  const api = await source("app/api/app-data/route.ts");
  const start = api.indexOf('    } else if (action === "finalize-employee-recovery") {');
  const end = api.indexOf('    } else if (action === "reopen-employee-recovery") {', start);
  assert.ok(start >= 0 && end > start, "employee recovery finalization must exist");
  const block = api.slice(start, end);
  assert.match(block, /eq\(accommodationRoomExpenses\.roomId, employee\.roomId\)/);
  assert.match(block, /eq\(accommodationRoomExpenses\.payPeriod, run\.payPeriod\)/);
  assert.match(block, /eq\(accommodationRoomExpenses\.status, "draft"\)/);
  assert.match(block, /await finalizeRoomExpense/);
  assert.match(block, /room_expense_auto_finalized/);
  assert.ok(
    block.indexOf("await finalizeRoomExpense") < block.indexOf("const entries = await db"),
    "room shares must be allocated before the employee voucher is finalized",
  );
});

test("draft room recovery is previewed for every applicable employee", async () => {
  const recovery = await source("app/reports-recovery.tsx");
  assert.match(recovery, /const draftRoomLedger/);
  assert.match(recovery, /const pendingGasShare/);
  assert.match(recovery, /const pendingRationShare/);
  assert.match(recovery, /const pendingProvisionShare/);
  assert.match(recovery, /const pendingShared/);
  assert.match(recovery, /Draft room share/);
  assert.match(
    recovery,
    /Math\.max\(0, \(item\?\.netPayable \?\? 0\) - pendingShared\)/,
  );
});

test("bulk recovery vouchers are driven directly by finalizations", async () => {
  const recovery = await source("app/reports-recovery.tsx");
  assert.match(recovery, /const finalizedVoucherRows = finalizations\.flatMap/);
  assert.match(recovery, /rows=\{finalizedVoucherRows\}/);
  assert.match(recovery, /Bulk deduction vouchers/);
  assert.match(recovery, /voucherBrand/);
  assert.match(recovery, /clientEmployer/);
});

test("voucher print typography is readable", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /bulk-recovery-vouchers \.advance-voucher/);
  assert.match(css, /font-size: 12pt/);
  assert.match(css, /font-size: 11pt/);
  assert.match(css, /Joy Payroll production readability baseline/);
});

test("recovery printing isolates the requested pages and bulk salary slips can email all employees", async () => {
  const recovery = await source("app/reports-recovery.tsx");
  const enhancements = await source("app/payroll-enhancements.tsx");
  const payroll = await source("app/payroll-app.tsx");
  const printDocument = await source("lib/print-document.ts");
  assert.match(recovery, /printIsolatedElement\(source, target\)/);
  const roomPrintStart = recovery.indexOf("  function printRoomRecovery(");
  const roomPrintEnd = recovery.indexOf("  const recoveryAccommodationTypes", roomPrintStart);
  assert.ok(roomPrintStart >= 0 && roomPrintEnd > roomPrintStart, "room recovery print block must exist");
  const roomPrint = recovery.slice(roomPrintStart, roomPrintEnd);
  assert.match(roomPrint, /printIsolatedElement\(layer, "room"\)/);
  assert.match(roomPrint, /optionalRecoveryPrintHeaders/);
  assert.match(roomPrint, /label === "Room"/);
  assert.match(roomPrint, /label === "Voucher"/);
  assert.match(roomPrint, /matchedRows\.every/);
  assert.doesNotMatch(roomPrint, /document\.body\.appendChild\(layer\)|window\.print\(\)/);
  assert.match(enhancements, /printIsolatedElement\(source, "room"\)/);
  assert.match(payroll, /printIsolatedElement\(source, "payslips"\)/);
  assert.match(printDocument, /frame\.contentDocument/);
  assert.match(printDocument, /@page \{ size: A4/);
  assert.match(printDocument, /page: auto !important/);
  assert.match(printDocument, /\.room-report-page:not\(:last-child\)/);
  assert.match(printDocument, /\.room-recovery-print-sheet:not\(:last-child\)/);
  assert.match(printDocument, /\.room-recovery-print-sheet tr/);
  assert.match(printDocument, /font-size: 9pt !important/);
  assert.match(printDocument, /min-width: 36mm !important/);
  assert.match(printDocument, /\.advance-voucher:not\(:last-child\)/);
  assert.match(printDocument, /\.payslip-sheet:not\(:last-child\)/);
  assert.match(printDocument, /min-height: 0 !important/);
  assert.match(payroll, /Send salary slips to all/);
  assert.match(payroll, /sendAll: true/);
  assert.match(payroll, /run\.status !== "approved"/);
});

test("role model matches production operating structure and unit scope", async () => {
  const access = await source("lib/access-control.ts");
  const api = await source("app/api/app-data/route.ts");
  for (const role of ["Super Admin", "Payroll HR", "HR Manager", "Field HR", "Hostel In-charge"]) {
    assert.match(access, new RegExp(role));
  }
  assert.match(access, /payroll_team/);
  assert.match(access, /hr_team/);
  assert.match(access, /field_hr/);
  assert.match(access, /hostel_incharge/);
  assert.match(api, /access\.profile\.role === "field_hr"/);
  assert.match(api, /\["hr_team", "field_hr"\]\.includes\(access\.profile\.role\)/);
});
