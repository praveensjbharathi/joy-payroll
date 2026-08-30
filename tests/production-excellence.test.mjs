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
  assert.match(payroll, /const bankItems = items;/);
  assert.match(payroll, /bankValidationIssues/);
  assert.match(api, /const paymentMode = "bank";/);
  assert.doesNotMatch(api, /paymentMode: "cash"/);
  assert.match(payroll, /Indian Bank Excel/);
  assert.match(payroll, /CUB Any Bank TXT/);
  assert.match(payroll, /CUB-to-CUB TXT/);
  assert.match(payroll, /selectedBankItems/);
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
