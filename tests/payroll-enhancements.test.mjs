import assert from "node:assert/strict";
import test from "node:test";
import { payrollPeriodRange, splitMoneyEqually, splitRoomExpenses } from "../lib/payroll-operations.ts";

test("room costs split exactly to paise across roommates", () => {
  assert.deepEqual(splitMoneyEqually(100, 3), [33.34, 33.33, 33.33]);
  const rows = splitRoomExpenses({ gasAmount: 100, rationAmount: 250, provisionAmount: 75.5 }, ["EMP-3", "EMP-1", "EMP-2"]);
  assert.deepEqual(rows.map((row) => row.employeeId), ["EMP-1", "EMP-2", "EMP-3"]);
  assert.equal(rows.reduce((sum, row) => sum + row.gasShare, 0), 100);
  assert.equal(rows.reduce((sum, row) => sum + row.rationShare, 0), 250);
  assert.equal(rows.reduce((sum, row) => sum + row.provisionShare, 0), 75.5);
});

test("custom payroll periods expose an inclusive start and end", () => {
  assert.deepEqual(payrollPeriodRange("2026-09", "2026-08-26", "2026-09-25"), {
    start: "2026-08-26",
    end: "2026-09-26",
    inclusiveEnd: "2026-09-25",
    days: 31,
  });
});
