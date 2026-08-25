import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { parsePayrollWorkbook } from "../lib/excel-import.ts";
import { installXmlDomParser } from "./xml-dom-shim.mjs";

installXmlDomParser();

function workbook(name, sheetXml) {
  const xml = {
    "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`,
  };
  return new File([zipSync(Object.fromEntries(Object.entries(xml).map(([path, value]) => [path, strToU8(value)])))], `${name}.xlsx`);
}

function cell(address, value) {
  return typeof value === "number" ? `<c r="${address}"><v>${value}</v></c>` : `<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

test("imports Attendance Input rows, flexible week offs, and employee shifts", async () => {
  const file = workbook("Attendance Input", `<row r="5">${cell("B5", "EMP NO")}${cell("C5", "Name")}${cell("E5", "Department")}${cell("F5", "Shift")}${cell("G5", "1-Jul")}${cell("H5", "2-Jul")}${cell("I5", "3-Jul")}</row><row r="6">${cell("B6", "J83")}${cell("C6", "Employee One")}${cell("E6", "Production")}${cell("F6", "2nd Shift")}${cell("G6", "P")}${cell("H6", "WO")}${cell("I6", "HP")}</row>`);
  const result = await parsePayrollWorkbook(file, "2025-07");
  assert.equal(result.sourceType, "attendance");
  assert.equal(result.employees.length, 1);
  assert.equal(result.employees[0].defaultShift, "2nd Shift");
  assert.deepEqual(result.attendance.map((entry) => entry.statusCode), ["P", "WO", "HP"]);
  assert.equal(result.attendance[1].attendanceDate, "2025-07-02");
});

test("imports Salary Register components without expanding stray XFD cells", async () => {
  const file = workbook("Salary Register", `<row r="2">${cell("B2", "Emp ID")}${cell("C2", "Name")}</row><row r="3">${cell("B3", 13021)}${cell("C3", "Employee Two")}${cell("D3", "Quality")}${cell("I3", 123456789)}${cell("K3", "CUB0000123")}${cell("Y3", 18000)}${cell("AA3", 3500)}${cell("AM3", 1800)}${cell("AZ3", "Joy Room")}${cell("BB3", "AR1")}${cell("XFD3", "Ignored")}</row>`);
  const result = await parsePayrollWorkbook(file, "2025-07");
  assert.equal(result.sourceType, "salary");
  assert.equal(result.employees[0].employeeCode, "13021");
  assert.equal(result.employees[0].salaryAmount, 18000);
  assert.equal(result.employees[0].paymentMode, "bank");
  assert.equal(result.employees[0].roomNumber, "AR1");
  assert.equal(result.salaryItems[0].basic, 18000);
  assert.equal(result.salaryItems[0].hra, 3500);
  assert.equal(result.salaryItems[0].pfDeduction, 1800);
});
