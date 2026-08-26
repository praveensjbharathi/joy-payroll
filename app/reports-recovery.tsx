"use client";

import { useMemo, useState } from "react";
import type { AccommodationCharge, AppData, Employee, PayrollItem, PayrollRun } from "./payroll-app";

type ReportRow = Array<string | number>;

function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function save(filename: string, body: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function exportCsv(name: string, rows: ReportRow[]) { save(`${name}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8"); }
function exportExcel(name: string, rows: ReportRow[]) {
  const table = `<table>${rows.map((row, index) => `<tr>${row.map((value) => `<${index ? "td" : "th"}>${String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</table>`;
  save(`${name}.xls`, `\ufeff<html><head><meta charset="utf-8"></head><body>${table}</body></html>`, "application/vnd.ms-excel");
}

export function RecoveryCenter({ run, employees, items, charges, data, canManage, onEdit }: { run: PayrollRun | null; employees: Employee[]; items: PayrollItem[]; charges: AccommodationCharge[]; data: AppData; canManage: boolean; onEdit: (employee?: Employee, charge?: AccommodationCharge) => void }) {
  const runCharges = run ? charges.filter((charge) => charge.runId === run.id) : [];
  const employeeRows = employees.map((employee) => {
    const charge = runCharges.find((entry) => entry.employeeId === employee.id);
    const item = items.find((entry) => entry.employeeId === employee.id);
    const individual = charge ? charge.rent + charge.bus + charge.food + charge.advance + charge.idCard + charge.medical + charge.ticket + charge.shoe + charge.aadhaarUpdate + charge.bankAccountCharge + charge.tshirt + charge.oldPending : 0;
    const shared = charge ? charge.gasShare + charge.rationShare + charge.provisionShare : 0;
    return { employee, charge, individual, shared, total: individual + shared, item };
  });
  const roomRows = data.roomExpenses.filter((expense) => !run || expense.payPeriod === run.payPeriod).map((expense) => ({ expense, room: data.accommodationRooms.find((room) => room.id === expense.roomId) }));
  return <div className="section-stack"><section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Individual employee recoveries</span><h2>Employee-wise deduction types</h2></div>{canManage && run ? <button className="primary-button" onClick={() => onEdit()}>+ Add recovery</button> : null}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>Employee</th><th>Room</th><th>Individual recovery</th><th>Gas / Ration / Provision</th><th>Total recovery</th><th>Action</th></tr></thead><tbody>{employeeRows.map(({ employee, charge, individual, shared, total }) => <tr key={employee.id}><td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td><td>{employee.roomNumber ?? "—"}<small>{employee.accommodationType}</small></td><td>₹{individual.toFixed(2)}</td><td>₹{shared.toFixed(2)}</td><td><strong>₹{total.toFixed(2)}</strong></td><td>{canManage && run ? <button className="record-action" onClick={() => onEdit(employee, charge)}>{charge ? "Edit" : "Add"}</button> : "View only"}</td></tr>)}</tbody></table></div></section><section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Shared room recoveries</span><h2>Gas, Ration & Provision split</h2></div><span className="muted-label">Finalized total ÷ room occupant count</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Room</th><th>Month</th><th>Occupants</th><th>Gas</th><th>Ration</th><th>Provision</th><th>Per head</th><th>Status</th></tr></thead><tbody>{roomRows.map(({ expense, room }) => <tr key={expense.id}><td><strong>{room?.roomNumber ?? expense.roomId}</strong></td><td>{expense.payPeriod}</td><td>{expense.occupantCount}</td><td>₹{expense.gasAmount.toFixed(2)}</td><td>₹{expense.rationAmount.toFixed(2)}</td><td>₹{expense.provisionAmount.toFixed(2)}</td><td><strong>₹{((expense.gasAmount + expense.rationAmount + expense.provisionAmount) / Math.max(1, expense.occupantCount)).toFixed(2)}</strong></td><td>{expense.status}</td></tr>)}</tbody></table></div></section></div>;
}

export function ReportsCenter({ data, run, items, vendorId, unitId }: { data: AppData; run: PayrollRun | null; items: PayrollItem[]; vendorId: string; unitId: string }) {
  const [report, setReport] = useState("payroll");
  const reports = useMemo<Record<string, { label: string; rows: ReportRow[] }>>(() => {
    const employees = data.employees.filter((employee) => (!vendorId || employee.vendorId === vendorId) && (!unitId || employee.clientUnitId === unitId));
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const attendance = data.attendance.filter((entry) => employeeIds.has(entry.employeeId));
    const roomExpenses = data.roomExpenses.filter((expense) => !run || expense.payPeriod === run.payPeriod);
    return {
      payroll: { label: "Payroll register", rows: [["Employee ID", "Employee", "Department", "Payable days", "OT hours", "Gross", "Total deductions", "Net payable", "Status"], ...items.map((item) => [item.employeeCode, item.employeeName, item.department, item.payableDays, item.overtimeHours, item.grossEarnings, item.totalDeductions, item.netPayable, item.validationStatus])] },
      employees: { label: "Employee master", rows: [["Employee ID", "Employee", "Department", "Joining", "Left", "Accommodation", "Room", "Bank", "EPF", "ESI", "Status"], ...employees.map((employee) => [employee.employeeCode, employee.name, employee.department, employee.dateOfJoining, employee.dateOfLeaving ?? "", employee.accommodationType, employee.roomNumber ?? "", employee.bankAccountMasked ? "Ready" : "Pending", employee.uanMasked ? "Ready" : "Pending", employee.esiMasked ? "Ready" : "Pending", employee.status])] },
      attendance: { label: "Attendance register", rows: [["Employee ID", "Date", "Status", "Shift", "Punch in", "Punch out", "OT hours"], ...attendance.map((entry) => [employees.find((employee) => employee.id === entry.employeeId)?.employeeCode ?? entry.employeeId, entry.attendanceDate, entry.statusCode, entry.shiftCode, entry.punchIn ?? "", entry.punchOut ?? "", entry.overtimeHours])] },
      compliance: { label: "Compliance pending", rows: [["Employee ID", "Employee", "Bank", "EPF/UAN", "ESI"], ...employees.map((employee) => [employee.employeeCode, employee.name, employee.bankAccountMasked && employee.ifscMasked ? "Ready" : "Pending", employee.uanMasked ? "Ready" : "Pending", employee.esiMasked ? "Ready" : "Pending"])] },
      recoveries: { label: "Room recovery register", rows: [["Month", "Room", "Occupants", "Gas", "Ration", "Provision", "Per head", "Status"], ...roomExpenses.map((expense) => [expense.payPeriod, data.accommodationRooms.find((room) => room.id === expense.roomId)?.roomNumber ?? expense.roomId, expense.occupantCount, expense.gasAmount, expense.rationAmount, expense.provisionAmount, (expense.gasAmount + expense.rationAmount + expense.provisionAmount) / Math.max(1, expense.occupantCount), expense.status])] },
      hostel: { label: "Hostel activity & expense report", rows: [["Hostel", "Date", "Activity", "Reading / Quantity", "Amount", "Status"], ...data.hostelUtilityReadings.map((entry) => [data.hostels.find((hostel) => hostel.id === entry.hostelId)?.name ?? entry.hostelId, entry.readingDate, entry.activityName ?? entry.utilityType, entry.readingValue || entry.tankerQuantity, entry.amount, entry.status])] },
      vehicles: { label: "Vehicle movement & expense report", rows: [["Vehicle", "Date", "Type", "From", "To", "Start KM", "End KM", "Litres", "Amount", "Next due"], ...data.vehicleRecords.map((entry) => [data.vehicles.find((vehicle) => vehicle.id === entry.vehicleId)?.registrationNumber ?? entry.vehicleId, entry.recordDate, entry.recordType, entry.tripFrom ?? "", entry.tripTo ?? "", entry.startKm ?? "", entry.endKm ?? "", entry.litres, entry.amount, entry.nextDueDate ?? ""])] },
    };
  }, [data, items, run, unitId, vendorId]);
  const selected = reports[report]; const name = `${report}-report-${run?.payPeriod ?? new Date().toISOString().slice(0, 10)}`;
  return <div className="section-stack"><section className="panel report-command"><div><span className="eyebrow">Download centre</span><h2>Reports workspace</h2><p>Choose a report and download the current client, unit and payroll-month view.</p></div><label><span>Report type</span><select value={report} onChange={(event) => setReport(event.target.value)}>{Object.entries(reports).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><div className="record-actions"><button className="secondary-button" onClick={() => exportExcel(name, selected.rows)}>Excel</button><button className="secondary-button" onClick={() => exportCsv(name, selected.rows)}>CSV</button><button className="primary-button" onClick={() => window.print()}>Print / PDF</button></div></section><section className="panel table-panel report-print-area"><div className="panel-heading"><div><span className="eyebrow">Report preview</span><h2>{selected.label}</h2></div><span className="muted-label">{Math.max(0, selected.rows.length - 1)} records</span></div><div className="table-scroll"><table className="data-table"><thead><tr>{selected.rows[0]?.map((cell, index) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{selected.rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div></section></div>;
}
