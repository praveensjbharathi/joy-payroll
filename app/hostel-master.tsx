"use client";

import { useState, type FormEvent } from "react";
import type { AccommodationRoom, Employee, Hostel, HostelUtilityReading, RoomExpense } from "./payroll-app";

type Action = (action: string, message: string, details?: Record<string, unknown>) => Promise<boolean>;
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export function HostelMaster({ vendorId, hostels, rooms, employees, readings, expenses, payPeriod, canManage, canApprove, isActing, onAction }: { vendorId: string; hostels: Hostel[]; rooms: AccommodationRoom[]; employees: Employee[]; readings: HostelUtilityReading[]; expenses: RoomExpense[]; payPeriod: string; canManage: boolean; canApprove: boolean; isActing: boolean; onAction: Action }) {
  const available = hostels.filter((hostel) => hostel.vendorId === vendorId);
  const [hostelId, setHostelId] = useState(available[0]?.id ?? "");
  const selected = available.find((hostel) => hostel.id === hostelId) ?? available[0];
  const [utilityType, setUtilityType] = useState<"eb" | "water_purchase">("eb");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const hostelRooms = rooms.filter((room) => room.hostelId === selected?.id);
  const periodExpenses = expenses.filter((expense) => expense.payPeriod === payPeriod && hostelRooms.some((room) => room.id === expense.roomId));
  const totals = periodExpenses.reduce((sum, expense) => ({ gas: sum.gas + expense.gasAmount, ration: sum.ration + expense.rationAmount, provision: sum.provision + expense.provisionAmount }), { gas: 0, ration: 0, provision: 0 });
  const selectedReadings = readings.filter((reading) => reading.hostelId === selected?.id);

  async function createHostel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await onAction("save-hostel", "Hostel master saved", { vendorId, name: form.get("name"), address: form.get("address"), inchargeName: form.get("inchargeName"), ebMeterNumber: form.get("ebMeterNumber"), remarks: form.get("remarks") })) event.currentTarget.reset();
  }

  async function saveUtility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    if (await onAction("save-hostel-utility", utilityType === "eb" ? "EB reading saved" : "Water purchase saved", { hostelId: selected.id, utilityType, readingDate, readingValue: form.get("readingValue"), tankerQuantity: form.get("quantity"), amount: form.get("amount"), remarks: form.get("remarks") })) event.currentTarget.reset();
  }

  return <div className="section-stack">
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Hostel master</span><h2>Hostels, rooms, EB and water purchases</h2></div><label><span>Selected hostel</span><select value={selected?.id ?? ""} onChange={(event) => setHostelId(event.target.value)}><option value="">Choose hostel</option>{available.map((hostel) => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}</select></label></div>
      {canManage ? <form className="form-grid" onSubmit={createHostel}><label><span>Hostel name *</span><input name="name" required /></label><label><span>Address</span><input name="address" /></label><label><span>In-charge</span><input name="inchargeName" /></label><label><span>EB meter number</span><input name="ebMeterNumber" /></label><label className="form-span"><span>Remarks</span><input name="remarks" /></label><button className="primary-button form-span" disabled={isActing}>Add hostel</button></form> : null}
    </section>

    {selected ? <><section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Room allocation</span><h2>{selected.name}: mapped rooms</h2></div><span className="muted-label">{hostelRooms.length} rooms · {employees.filter((employee) => hostelRooms.some((room) => room.id === employee.roomId) && employee.status === "active").length} residents</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Room</th><th>Residents</th><th>Hostel mapping</th></tr></thead><tbody>{rooms.filter((room) => room.vendorId === vendorId).map((room) => <tr key={room.id}><td>{room.roomNumber}</td><td>{employees.filter((employee) => employee.roomId === room.id && employee.status === "active").length}</td><td>{canManage ? <select value={room.hostelId ?? ""} onChange={(event) => event.target.value && void onAction("assign-room-hostel", "Room mapped to hostel", { roomId: room.id, hostelId: event.target.value })}><option value="">Not mapped</option>{available.map((hostel) => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}</select> : available.find((hostel) => hostel.id === room.hostelId)?.name ?? "Not mapped"}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Daily hostel operations</span><h2>EB reading and water purchase update</h2></div></div>{canManage ? <form className="form-grid" onSubmit={saveUtility}><label><span>Record type</span><select value={utilityType} onChange={(event) => setUtilityType(event.target.value as "eb" | "water_purchase")}><option value="eb">EB meter reading</option><option value="water_purchase">Water purchase</option></select></label><label><span>Date</span><input type="date" value={readingDate} onChange={(event) => setReadingDate(event.target.value)} required /></label>{utilityType === "eb" ? <label><span>Meter reading</span><input name="readingValue" type="number" min="0" step="0.01" required /></label> : <label><span>Water quantity (litres)</span><input name="quantity" type="number" min="0" step="0.01" required /></label>}<label><span>Amount (₹)</span><input name="amount" type="number" min="0" step="0.01" /></label><label className="form-span"><span>Remarks / supplier</span><input name="remarks" /></label><button className="primary-button form-span" disabled={isActing}>Save for approval</button></form> : null}<div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Reading / quantity</th><th>Consumption</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{selectedReadings.map((reading) => <tr key={reading.id}><td>{reading.readingDate}</td><td>{reading.utilityType === "eb" ? "EB" : "Water purchase"}</td><td>{reading.utilityType === "eb" ? reading.readingValue : `${reading.tankerQuantity} L`}</td><td>{reading.utilityType === "eb" ? reading.consumption : "—"}</td><td>{money(reading.amount)}</td><td>{reading.status}</td><td>{reading.status === "draft" && canApprove ? <button className="record-action" disabled={isActing} onClick={() => void onAction("approve-hostel-utility", "Hostel operation approved", { id: reading.id })}>Approve</button> : null}</td></tr>)}</tbody></table></div></section>

    <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">Cumulative room deductions · {payPeriod}</span><h2>{selected.name}: salary-finalization summary</h2></div><strong>{money(totals.gas + totals.ration + totals.provision)}</strong></div><div className="payment-summary-grid"><article><div><small>Gas cylinders</small><strong>{money(totals.gas)}</strong></div></article><article><div><small>Ration</small><strong>{money(totals.ration)}</strong></div></article><article><div><small>Provision</small><strong>{money(totals.provision)}</strong></div></article></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Room</th><th>Gas date / amount</th><th>Ration date / amount</th><th>Provision date / amount</th><th>Occupants</th><th>Status</th></tr></thead><tbody>{hostelRooms.map((room) => { const expense = periodExpenses.find((entry) => entry.roomId === room.id); return <tr key={room.id}><td>{room.roomNumber}</td><td>{expense?.gasDate ?? "—"}<small>{money(expense?.gasAmount ?? 0)}</small></td><td>{expense?.rationDate ?? "—"}<small>{money(expense?.rationAmount ?? 0)}</small></td><td>{expense?.provisionDate ?? "—"}<small>{money(expense?.provisionAmount ?? 0)}</small></td><td>{expense?.occupantCount || employees.filter((employee) => employee.roomId === room.id && employee.status === "active").length}</td><td>{expense?.status ?? "Not entered"}</td></tr>; })}</tbody></table></div><small className="muted-label">Only finalized Gas, Ration and Provision shares flow into salary. EB and water purchases remain hostel operating expenses.</small></section></> : null}
  </div>;
}
