"use client";

/* Edit forms intentionally synchronize their drafts when the selected payroll run or room changes. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { calendarPeriod } from "../lib/payroll-operations";
import type {
  AccommodationCharge,
  AccommodationRoom,
  AccommodationType,
  AppData,
  Employee,
  PayrollBatch,
  PayrollItem,
  PayrollRun,
  RoomExpense,
} from "./payroll-app";

type Action = (action: string, message: string, details?: Record<string, unknown>) => Promise<boolean>;
const DASHBOARD_RENDER_EPOCH = Date.now();

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function downloadRows(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function NumberCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return <article className={`enhancement-number-card enhancement-tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export function WorkforceDashboard({ data }: { data: AppData }) {
  const [clientId, setClientId] = useState("all");
  const [unitId, setUnitId] = useState("all");
  const eligibleUnits = data.units.filter((unit) => clientId === "all" || unit.vendorId === clientId);
  const selectedEmployees = data.employees.filter((employee) => (clientId === "all" || employee.vendorId === clientId) && (unitId === "all" || employee.clientUnitId === unitId));
  const live = selectedEmployees.filter((employee) => employee.status === "active");
  const left = selectedEmployees.filter((employee) => employee.status !== "active");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const joined = selectedEmployees.filter((employee) => employee.dateOfJoining.startsWith(`${currentMonth}-`));
  const bankPending = live.filter((employee) => !employee.bankAccountMasked || !employee.ifscMasked);
  const epfPending = live.filter((employee) => !employee.uanMasked);
  const esiPending = live.filter((employee) => !employee.esiMasked);
  const pendingEmployees = live.filter((employee) => !employee.bankAccountMasked || !employee.ifscMasked || !employee.uanMasked || !employee.esiMasked);
  const breakdown = eligibleUnits.filter((unit) => unitId === "all" || unit.id === unitId).map((unit) => {
    const assigned = selectedEmployees.filter((employee) => employee.clientUnitId === unit.id);
    const active = assigned.filter((employee) => employee.status === "active");
    return {
      unit,
      total: assigned.length,
      active: active.length,
      left: assigned.length - active.length,
      joined: assigned.filter((employee) => employee.dateOfJoining.startsWith(`${currentMonth}-`)).length,
      bank: active.filter((employee) => !employee.bankAccountMasked || !employee.ifscMasked).length,
      epf: active.filter((employee) => !employee.uanMasked).length,
      esi: active.filter((employee) => !employee.esiMasked).length,
    };
  });

  return <div className="section-stack workforce-dashboard">
    <section className="panel workforce-filter-panel"><div><span className="eyebrow">Scope selector</span><h2>Overall, client-wise & employer-unit-wise</h2></div><div className="workforce-filters"><label><span>Client</span><select value={clientId} onChange={(event) => { setClientId(event.target.value); setUnitId("all"); }}><option value="all">All accessible clients</option>{data.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label><span>Employer / unit</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="all">All employer units</option>{eligibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.clientName} · {unit.unitName}</option>)}</select></label></div></section>

    <section className="workforce-number-grid"><NumberCard label="Overall manpower" value={selectedEmployees.length} note="All employee records" tone="blue" /><NumberCard label="Live manpower" value={live.length} note="Currently active employees" tone="green" /><NumberCard label="Left manpower" value={left.length} note="Inactive / exited employees" tone="slate" /><NumberCard label="Joined this month" value={joined.length} note={`Joining dates in ${currentMonth}`} tone="violet" /></section>

    <section className="workforce-number-grid compliance-number-grid"><NumberCard label="Bank account pending" value={bankPending.length} note={`Account or IFSC missing · ${live.length} active`} tone="amber" /><NumberCard label="EPF / UAN pending" value={epfPending.length} note={`UAN missing · ${live.length} active`} tone="red" /><NumberCard label="ESI number pending" value={esiPending.length} note={`ESI number missing · ${live.length} active`} tone="red" /><NumberCard label="Fully compliant" value={live.length - pendingEmployees.length} note="Bank, IFSC, UAN & ESI available" tone="green" /></section>

    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Employer-unit manpower summary</span><h2>Workforce & pending compliance by unit</h2></div><span className="muted-label">Current month: {currentMonth}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Client / employer unit</th><th>Overall</th><th>Live</th><th>Left</th><th>Joined</th><th>Bank pending</th><th>EPF pending</th><th>ESI pending</th></tr></thead><tbody>{breakdown.map((entry) => <tr key={entry.unit.id}><td><strong>{entry.unit.clientName}</strong><small>{data.vendors.find((vendor) => vendor.id === entry.unit.vendorId)?.code} · {entry.unit.unitName}</small></td><td>{entry.total}</td><td className="workforce-positive">{entry.active}</td><td>{entry.left}</td><td>{entry.joined}</td><td className={entry.bank ? "workforce-pending" : ""}>{entry.bank}</td><td className={entry.epf ? "workforce-pending" : ""}>{entry.epf}</td><td className={entry.esi ? "workforce-pending" : ""}>{entry.esi}</td></tr>)}</tbody></table></div>{!breakdown.length ? <div className="enhancement-empty">Add employer units and employees to populate your manpower dashboard.</div> : null}</section>

    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Compliance follow-up</span><h2>Pending bank, EPF & ESI records</h2></div><span className="muted-label">{pendingEmployees.length} employee{pendingEmployees.length === 1 ? "" : "s"} need follow-up</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Employee</th><th>Employer / unit</th><th>Joined</th><th>Pending age</th><th>Bank / IFSC</th><th>EPF / UAN</th><th>ESI</th></tr></thead><tbody>{pendingEmployees.slice(0, 50).map((employee) => {
      const unit = data.units.find((entry) => entry.id === employee.clientUnitId);
      const days = Math.max(0, Math.floor((DASHBOARD_RENDER_EPOCH - new Date(`${employee.dateOfJoining}T00:00:00`).getTime()) / 86400000));
      const aging = days > 30 ? "30+ days" : days > 15 ? "16–30 days" : days > 10 ? "11–15 days" : days > 5 ? "6–10 days" : "0–5 days";
      return <tr key={employee.id}><td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td><td>{unit?.clientName ?? "—"}<small>{unit?.unitName}</small></td><td>{employee.dateOfJoining}</td><td><span className={`aging-badge ${days > 15 ? "aging-overdue" : ""}`}>{aging}</span></td><td className={!employee.bankAccountMasked || !employee.ifscMasked ? "workforce-pending" : "workforce-positive"}>{!employee.bankAccountMasked || !employee.ifscMasked ? "Pending" : "Ready"}</td><td className={!employee.uanMasked ? "workforce-pending" : "workforce-positive"}>{employee.uanMasked ? "Ready" : "Pending"}</td><td className={!employee.esiMasked ? "workforce-pending" : "workforce-positive"}>{employee.esiMasked ? "Ready" : "Pending"}</td></tr>;
    })}</tbody></table></div>{!pendingEmployees.length ? <div className="enhancement-empty">No pending bank, EPF, or ESI records in this view.</div> : null}</section>
  </div>;
}

export function PayrollPeriodEditor({ run, canManage, isActing, onAction }: { run: PayrollRun; canManage: boolean; isActing: boolean; onAction: Action }) {
  const defaults = calendarPeriod(run.payPeriod);
  const [periodStart, setPeriodStart] = useState(run.periodStart ?? defaults.start);
  const [periodEnd, setPeriodEnd] = useState(run.periodEnd ?? defaults.end);
  const [workingDays, setWorkingDays] = useState(run.workingDays || 26);
  useEffect(() => {
    const month = calendarPeriod(run.payPeriod);
    setPeriodStart(run.periodStart ?? month.start);
    setPeriodEnd(run.periodEnd ?? month.end);
    setWorkingDays(run.workingDays || 26);
  }, [run.id, run.payPeriod, run.periodStart, run.periodEnd, run.workingDays]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAction("update-run-period", "Custom payroll dates and working days updated", { periodStart, periodEnd, workingDays });
  }

  return <form className="panel payroll-period-panel" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">Custom monthly calculation period</span><h2>Payroll dates & working-day divisor</h2></div><span className="muted-label">Salary = monthly amount ÷ working days × payable days</span></div><fieldset className="period-editor-fields" disabled={!canManage || run.status === "approved" || isActing}><label><span>Period starts</span><input aria-label="Payroll period start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required /></label><label><span>Period ends</span><input aria-label="Payroll period end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></label><label><span>Working days</span><input aria-label="Payroll working days" type="number" min="1" max="62" value={workingDays} onChange={(event) => setWorkingDays(Number(event.target.value))} required /></label>{canManage && run.status !== "approved" ? <button className="primary-button" type="submit" disabled={isActing}>{isActing ? "Saving…" : "Save calculation period"}</button> : <span className="access-mode-note">{run.status === "approved" ? "Approved period locked" : "View only"}</span>}</fieldset></form>;
}

export function PayrollBatchPanel({ run, items, batches, canPrepare, canClear, isActing, onAction }: { run: PayrollRun; items: PayrollItem[]; batches: PayrollBatch[]; canPrepare: boolean; canClear: boolean; isActing: boolean; onAction: Action }) {
  const groups = [...new Set(items.map((item) => item.accommodationType))].sort().map((type) => {
    const employees = items.filter((item) => item.accommodationType === type);
    return { type, employees, batch: batches.find((candidate) => candidate.accommodationType === type) };
  });

  function exportBatch(type: string, employees: PayrollItem[]) {
    downloadRows(`payroll-batch-${run.payPeriod}-${type.toLowerCase().replaceAll(/\s+/g, "-")}.csv`, [
      ["Employee code", "Employee name", "Accommodation type", "Room", "Payment mode", "Gross earnings", "Total deductions", "Net payable"],
      ...employees.map((item) => [item.employeeCode, item.employeeName, type, item.roomNumber ?? "", item.paymentMode, item.grossEarnings, item.totalDeductions, item.netPayable]),
    ]);
  }

  async function clear(batch: PayrollBatch) {
    const reference = window.prompt(`Payment / transfer reference for ${batch.accommodationType} (optional):`, "");
    if (reference === null) return;
    await onAction("clear-payroll-batch", `${batch.accommodationType} payment batch cleared`, { batchId: batch.id, paymentReference: reference });
  }

  return <section className="panel table-panel payroll-batch-panel"><div className="panel-heading"><div><span className="eyebrow">Accommodation-wise salary processing</span><h2>Payroll batches & payment clearance</h2></div>{canPrepare ? <button className="primary-button" disabled={isActing || !groups.length} onClick={() => void onAction("prepare-payroll-batches", "Accommodation-wise payroll batches prepared")}>Prepare all batches</button> : null}</div><div className="batch-summary-strip"><span>{groups.length} accommodation type{groups.length === 1 ? "" : "s"}</span><span>{batches.filter((batch) => batch.status === "prepared").length} prepared</span><span>{batches.filter((batch) => batch.status === "cleared").length} payment-cleared</span><span>{run.status === "approved" ? "Payroll approved" : "Approve payroll to clear payments"}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Accommodation batch</th><th>Employees</th><th>Gross earnings</th><th>Net payable</th><th>Preparation</th><th>Payment clearance</th><th>Actions</th></tr></thead><tbody>{groups.map(({ type, employees, batch }) => <tr key={type}><td><strong>{type}</strong><small>{run.payPeriod}</small></td><td>{employees.length}</td><td>{money(employees.reduce((sum, item) => sum + item.grossEarnings, 0))}</td><td className="net-cell">{money(employees.reduce((sum, item) => sum + item.netPayable, 0))}</td><td><span className={`enhancement-status ${batch ? "status-positive" : "status-muted"}`}>{batch ? "Prepared" : "Not prepared"}</span></td><td><span className={`enhancement-status ${batch?.status === "cleared" ? "status-positive" : "status-pending"}`}>{batch?.status === "cleared" ? "Cleared" : "Pending"}</span>{batch?.paymentReference ? <small>{batch.paymentReference}</small> : null}</td><td><div className="record-actions">{!batch && canPrepare ? <button className="record-action" disabled={isActing} onClick={() => void onAction("prepare-payroll-batch", `${type} payroll batch prepared`, { accommodationType: type })}>Prepare</button> : null}{batch && (canPrepare || canClear) ? <button className="record-action" onClick={() => exportBatch(type, employees)}>CSV</button> : null}{batch?.status === "prepared" && canClear ? <button className="record-action" disabled={isActing || run.status !== "approved"} onClick={() => void clear(batch)}>Clear payment</button> : null}{batch?.status === "cleared" && canClear ? <button className="record-action" disabled={isActing} onClick={() => { if (window.confirm(`Reopen payment clearance for ${type}?`)) void onAction("reopen-payroll-batch", `${type} payment clearance reopened`, { batchId: batch.id }); }}>Reopen</button> : null}</div></td></tr>)}</tbody></table></div>{!groups.length ? <div className="enhancement-empty">Add payroll employees to prepare accommodation-wise salary batches.</div> : null}</section>;
}

type RoomDraft = { accommodationTypeId: string; roomNumber: string; capacity: number; address: string; remarks: string };

export function AccommodationControlCenter({ vendorId, types, rooms, employees, expenses, charges, runs, payPeriod, canManage, isActing, onAction, onRoomStatus, onDeleteRoom }: {
  vendorId: string;
  types: AccommodationType[];
  rooms: AccommodationRoom[];
  employees: Employee[];
  expenses: RoomExpense[];
  charges: AccommodationCharge[];
  runs: PayrollRun[];
  payPeriod: string;
  canManage: boolean;
  isActing: boolean;
  onAction: Action;
  onRoomStatus: (room: AccommodationRoom) => void;
  onDeleteRoom: (room: AccommodationRoom) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [roomId, setRoomId] = useState("");
  const [editingRoom, setEditingRoom] = useState<AccommodationRoom | "new" | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>({ accommodationTypeId: "", roomNumber: "", capacity: 0, address: "", remarks: "" });
  const [allocationId, setAllocationId] = useState("");
  const [gasAmount, setGasAmount] = useState(0);
  const [rationAmount, setRationAmount] = useState(0);
  const [provisionAmount, setProvisionAmount] = useState(0);
  const [expenseNotes, setExpenseNotes] = useState("");
  const [reportRooms, setReportRooms] = useState<AccommodationRoom[] | null>(null);

  const vendorTypes = types.filter((type) => type.vendorId === vendorId);
  const vendorRooms = rooms.filter((room) => room.vendorId === vendorId && (typeFilter === "all" || room.accommodationTypeId === typeFilter));
  const selectedRoom = vendorRooms.find((room) => room.id === roomId) ?? vendorRooms[0] ?? null;
  const roomEmployees = selectedRoom ? employees.filter((employee) => employee.roomId === selectedRoom.id && employee.status === "active") : [];
  const selectedExpense = selectedRoom ? expenses.find((expense) => expense.roomId === selectedRoom.id && expense.payPeriod === payPeriod) ?? null : null;
  const typeFor = (room: AccommodationRoom) => types.find((type) => type.id === room.accommodationTypeId);
  const activeTypes = vendorTypes.filter((type) => type.status === "active");
  const allocatable = employees.filter((employee) => employee.vendorId === vendorId && employee.status === "active" && employee.roomId !== selectedRoom?.id);

  useEffect(() => {
    setGasAmount(selectedExpense?.gasAmount ?? 0);
    setRationAmount(selectedExpense?.rationAmount ?? 0);
    setProvisionAmount(selectedExpense?.provisionAmount ?? 0);
    setExpenseNotes(selectedExpense?.notes ?? "");
  }, [selectedExpense?.id, selectedExpense?.gasAmount, selectedExpense?.rationAmount, selectedExpense?.provisionAmount, selectedExpense?.notes, selectedRoom?.id]);

  const finalizedReports = useMemo(() => rooms.filter((room) => room.vendorId === vendorId && expenses.some((expense) => expense.roomId === room.id && expense.payPeriod === payPeriod && expense.status === "finalized")), [rooms, expenses, vendorId, payPeriod]);

  function openEditor(room?: AccommodationRoom) {
    setEditingRoom(room ?? "new");
    setRoomDraft({ accommodationTypeId: room?.accommodationTypeId ?? activeTypes[0]?.id ?? "", roomNumber: room?.roomNumber ?? "", capacity: room?.capacity ?? 0, address: room?.address ?? "", remarks: room?.remarks ?? "" });
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onAction("save-room", editingRoom === "new" ? "Accommodation room created" : "Accommodation room updated", { ...roomDraft, vendorId, id: editingRoom === "new" ? undefined : editingRoom?.id });
    if (ok) setEditingRoom(null);
  }

  async function allocate() {
    if (!selectedRoom || !allocationId) return;
    const ok = await onAction("allocate-room", "Employee allocated to accommodation room", { roomId: selectedRoom.id, employeeId: allocationId });
    if (ok) setAllocationId("");
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) return;
    await onAction("save-room-expense", "Room gas, ration, and provision expenses saved", { roomId: selectedRoom.id, payPeriod, gasAmount, rationAmount, provisionAmount, notes: expenseNotes });
  }

  return <div className="section-stack room-control-center">
    <section className="accommodation-type-grid accommodation-type-filter-grid">{vendorTypes.map((type) => {
      const occupants = employees.filter((employee) => employee.vendorId === vendorId && employee.status === "active" && employee.accommodationType === type.name);
      return <button type="button" className={`accommodation-card accommodation-filter-card ${typeFilter === type.id ? "accommodation-filter-selected" : ""}`} key={type.id} onClick={() => { setTypeFilter(type.id); setRoomId(""); }}><span className="accommodation-icon">{type.name === "Tamil" ? "T" : "R"}</span><div><span>{type.name}</span><strong>{occupants.length} employees</strong><small>{rooms.filter((room) => room.accommodationTypeId === type.id).length} rooms · {type.status}</small></div></button>;
    })}</section>

    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Accommodation room master</span><h2>Choose an accommodation type and room</h2></div><div className="attendance-toolbar"><button className="secondary-button" onClick={() => { setTypeFilter("all"); setRoomId(""); }}>All types</button>{canManage ? <button className="primary-button" disabled={!activeTypes.length} onClick={() => openEditor()}>+ Add room</button> : null}</div></div>
      {editingRoom ? <form className="room-editor-form" onSubmit={saveRoom}><label><span>Accommodation type *</span><select value={roomDraft.accommodationTypeId} onChange={(event) => setRoomDraft((draft) => ({ ...draft, accommodationTypeId: event.target.value }))} required>{activeTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label><label><span>Room number *</span><input value={roomDraft.roomNumber} onChange={(event) => setRoomDraft((draft) => ({ ...draft, roomNumber: event.target.value }))} placeholder="JR-101" required /></label><label><span>Capacity (0 = unlimited)</span><input type="number" min="0" max="1000" value={roomDraft.capacity} onChange={(event) => setRoomDraft((draft) => ({ ...draft, capacity: Number(event.target.value) }))} /></label><label><span>Address / location</span><input value={roomDraft.address} onChange={(event) => setRoomDraft((draft) => ({ ...draft, address: event.target.value }))} /></label><label><span>Remarks</span><input value={roomDraft.remarks} onChange={(event) => setRoomDraft((draft) => ({ ...draft, remarks: event.target.value }))} /></label><div className="room-editor-actions"><button className="secondary-button" type="button" onClick={() => setEditingRoom(null)}>Cancel</button><button className="primary-button" type="submit" disabled={isActing}>{editingRoom === "new" ? "Create room" : "Save room"}</button></div></form> : null}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Accommodation type</th><th>Room</th><th>Occupants</th><th>Location</th><th>Month status</th><th>Room status</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>{vendorRooms.map((room) => {
        const occupants = employees.filter((employee) => employee.roomId === room.id && employee.status === "active");
        const expense = expenses.find((entry) => entry.roomId === room.id && entry.payPeriod === payPeriod);
        return <tr className={selectedRoom?.id === room.id ? "room-row-selected" : ""} key={room.id}><td>{typeFor(room)?.name ?? "—"}</td><td><button className="text-button" onClick={() => setRoomId(room.id)}>{room.roomNumber}</button></td><td>{occupants.length}{room.capacity ? ` / ${room.capacity}` : ""}</td><td>{room.address ?? "—"}</td><td><span className={`enhancement-status ${expense?.status === "finalized" ? "status-positive" : "status-pending"}`}>{expense?.status === "finalized" ? "Finalized" : expense ? "Draft" : "No expenses"}</span></td><td>{room.status === "active" ? "Active" : "Inactive"}</td>{canManage ? <td><div className="record-actions"><button className="record-action" onClick={() => openEditor(room)}>Edit</button><button className="record-action" onClick={() => onRoomStatus(room)}>{room.status === "active" ? "Deactivate" : "Activate"}</button><button className="record-action record-delete" onClick={() => onDeleteRoom(room)}>Delete</button></div></td> : null}</tr>;
      })}</tbody></table></div>{!vendorRooms.length ? <div className="enhancement-empty">Add a room under an accommodation type to start allocating employees.</div> : null}</section>

    {selectedRoom ? <section className="panel room-allocation-panel"><div className="panel-heading"><div><span className="eyebrow">{typeFor(selectedRoom)?.name} · {payPeriod}</span><h2>Room {selectedRoom.roomNumber}: employee allocations</h2></div><span className="muted-label">{roomEmployees.length}{selectedRoom.capacity ? ` / ${selectedRoom.capacity}` : ""} active roommates</span></div>{canManage && selectedRoom.status === "active" ? <div className="room-allocation-controls"><label><span>Add employee to this room</span><select value={allocationId} onChange={(event) => setAllocationId(event.target.value)}><option value="">Choose an active employee</option>{allocatable.map((employee) => <option value={employee.id} key={employee.id}>{employee.employeeCode} · {employee.name}{employee.roomNumber ? ` · currently ${employee.roomNumber}` : ""}</option>)}</select></label><button className="primary-button" disabled={!allocationId || isActing} onClick={() => void allocate()}>Allocate room</button></div> : null}<div className="table-scroll"><table className="data-table"><thead><tr><th>Employee</th><th>Employer unit</th><th>Gas share</th><th>Ration share</th><th>Provision share</th><th>Shared total</th>{canManage ? <th /> : null}</tr></thead><tbody>{roomEmployees.map((employee) => {
      const runIds = new Set(runs.filter((run) => run.payPeriod === payPeriod).map((run) => run.id));
      const charge = charges.find((entry) => entry.employeeId === employee.id && runIds.has(entry.runId));
      const total = (charge?.gasShare ?? 0) + (charge?.rationShare ?? 0) + (charge?.provisionShare ?? 0);
      return <tr key={employee.id}><td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td><td>{employee.clientUnitId}</td><td>{money(charge?.gasShare ?? 0)}</td><td>{money(charge?.rationShare ?? 0)}</td><td>{money(charge?.provisionShare ?? 0)}</td><td className="net-cell">{money(total)}</td>{canManage ? <td><button className="record-action" disabled={isActing || selectedExpense?.status === "finalized"} onClick={() => void onAction("allocate-room", `Removed ${employee.name} from the room`, { employeeId: employee.id, roomId: null })}>Remove</button></td> : null}</tr>;
    })}</tbody></table></div>{!roomEmployees.length ? <div className="enhancement-empty">No employees have been allocated to this room.</div> : null}</section> : null}

    {selectedRoom ? <form className="panel room-expense-panel" onSubmit={saveExpense}><div className="panel-heading"><div><span className="eyebrow">Per-head shared room deductions</span><h2>Gas + ration + provision ÷ active roommates</h2></div><span className={`enhancement-status ${selectedExpense?.status === "finalized" ? "status-positive" : "status-pending"}`}>{selectedExpense?.status === "finalized" ? "Finalized" : "Draft"}</span></div><fieldset className="room-expense-fields" disabled={!canManage || selectedExpense?.status === "finalized" || isActing}><label><span>Gas amount (₹)</span><input type="number" min="0" step="0.01" value={gasAmount} onChange={(event) => setGasAmount(Number(event.target.value))} /></label><label><span>Ration amount (₹)</span><input type="number" min="0" step="0.01" value={rationAmount} onChange={(event) => setRationAmount(Number(event.target.value))} /></label><label><span>Provision amount (₹)</span><input type="number" min="0" step="0.01" value={provisionAmount} onChange={(event) => setProvisionAmount(Number(event.target.value))} /></label><label><span>Expense remarks</span><input value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} /></label>{canManage && selectedExpense?.status !== "finalized" ? <button className="secondary-button" type="submit">Save room expenses</button> : null}</fieldset><div className="room-expense-calculation"><strong>Total {money(gasAmount + rationAmount + provisionAmount)}</strong><span>÷ {roomEmployees.length || 0} roommates</span><strong>≈ {money(roomEmployees.length ? (gasAmount + rationAmount + provisionAmount) / roomEmployees.length : 0)} per head</strong><small>Paise remainders are distributed exactly so the shares always equal the room total.</small></div><div className="room-expense-actions">{canManage && selectedExpense?.status === "draft" ? <button className="primary-button" type="button" disabled={!roomEmployees.length || isActing} onClick={() => void onAction("finalize-room-expense", `Finalized and split room ${selectedRoom.roomNumber} deductions`, { roomId: selectedRoom.id, expenseId: selectedExpense.id })}>Finalize & split per head</button> : null}{canManage && selectedExpense?.status === "finalized" ? <button className="secondary-button" type="button" disabled={isActing} onClick={() => { if (window.confirm(`Reopen room ${selectedRoom.roomNumber} and clear its finalized employee shares?`)) void onAction("reopen-room-expense", "Room expense reopened", { roomId: selectedRoom.id, expenseId: selectedExpense.id }); }}>Reopen deductions</button> : null}{selectedExpense?.status === "finalized" ? <button className="secondary-button" type="button" onClick={() => setReportRooms([selectedRoom])}>Print this room breakup</button> : null}{finalizedReports.length ? <button className="secondary-button" type="button" onClick={() => setReportRooms(finalizedReports)}>Print all finalized rooms ({finalizedReports.length})</button> : null}</div></form> : null}

    {reportRooms ? <RoomBreakupReport rooms={reportRooms} types={types} employees={employees} expenses={expenses} charges={charges} payPeriod={payPeriod} onClose={() => setReportRooms(null)} /> : null}
  </div>;
}

function RoomBreakupReport({ rooms, types, employees, expenses, charges, payPeriod, onClose }: { rooms: AccommodationRoom[]; types: AccommodationType[]; employees: Employee[]; expenses: RoomExpense[]; charges: AccommodationCharge[]; payPeriod: string; onClose: () => void }) {
  return <div className="modal-layer room-report-layer"><button className="modal-scrim" aria-label="Close room breakup report" onClick={onClose} /><div className="room-report-modal"><div className="modal-toolbar"><div><strong>{rooms.length === 1 ? "Room-wise salary deduction breakup" : "Bulk room-wise deduction breakups"}</strong><span>{payPeriod} · {rooms.length} room{rooms.length === 1 ? "" : "s"}</span></div><div><button className="secondary-button" onClick={() => window.print()}>Print / save PDF</button><button className="icon-button" aria-label="Close report" onClick={onClose}>×</button></div></div><div className="room-report-pages">{rooms.map((room) => {
    const expense = expenses.find((candidate) => candidate.roomId === room.id && candidate.payPeriod === payPeriod && candidate.status === "finalized");
    const deductions = expense ? charges.filter((charge) => charge.roomExpenseId === expense.id) : [];
    return <article className="room-report-page" key={room.id}><header><div><span className="eyebrow">Finalized accommodation recovery statement</span><h2>{types.find((type) => type.id === room.accommodationTypeId)?.name} · Room {room.roomNumber}</h2><p>{room.address ?? "Room-wise employee deduction breakup"}</p></div><strong>{payPeriod}</strong></header><section className="room-report-summary"><div><span>Gas</span><strong>{money(expense?.gasAmount ?? 0)}</strong></div><div><span>Ration</span><strong>{money(expense?.rationAmount ?? 0)}</strong></div><div><span>Provision</span><strong>{money(expense?.provisionAmount ?? 0)}</strong></div><div><span>Roommates</span><strong>{expense?.occupantCount ?? deductions.length}</strong></div><div><span>Shared total</span><strong>{money((expense?.gasAmount ?? 0) + (expense?.rationAmount ?? 0) + (expense?.provisionAmount ?? 0))}</strong></div></section><table className="data-table"><thead><tr><th>#</th><th>Employee</th><th>Gas</th><th>Ration</th><th>Provision</th><th>Total per head</th></tr></thead><tbody>{deductions.map((charge, index) => {
      const employee = employees.find((candidate) => candidate.id === charge.employeeId);
      return <tr key={charge.id}><td>{index + 1}</td><td><strong>{employee?.name ?? "Employee"}</strong><small>{employee?.employeeCode ?? charge.employeeId}</small></td><td>{money(charge.gasShare)}</td><td>{money(charge.rationShare)}</td><td>{money(charge.provisionShare)}</td><td><strong>{money(charge.gasShare + charge.rationShare + charge.provisionShare)}</strong></td></tr>;
    })}</tbody><tfoot><tr><td colSpan={2}><strong>Room total</strong></td><td>{money(deductions.reduce((sum, charge) => sum + charge.gasShare, 0))}</td><td>{money(deductions.reduce((sum, charge) => sum + charge.rationShare, 0))}</td><td>{money(deductions.reduce((sum, charge) => sum + charge.provisionShare, 0))}</td><td><strong>{money(deductions.reduce((sum, charge) => sum + charge.gasShare + charge.rationShare + charge.provisionShare, 0))}</strong></td></tr></tfoot></table><footer>Finalized by {expense?.finalizedBy ?? "authorized payroll user"}{expense?.finalizedAt ? ` · ${new Date(expense.finalizedAt).toLocaleString("en-IN")}` : ""}</footer></article>;
  })}</div></div></div>;
}
