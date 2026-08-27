"use client";
import { useState, type FormEvent } from "react";
import type {
  AccommodationRoom,
  AccommodationType,
  ClientUnit,
  Employee,
  Hostel,
  HostelUtilityReading,
  RoomExpense,
} from "./payroll-app";
type Action = (
  action: string,
  message: string,
  details?: Record<string, unknown>,
) => Promise<boolean>;
type EntryType = "eb" | "water" | "payment" | "housekeeping" | "other";
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
function csv(filename: string, rows: Array<Array<string | number>>) {
  const body = rows
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function HostelMaster({
  vendorId,
  units,
  types,
  hostels,
  rooms,
  employees,
  readings,
  expenses,
  payPeriod,
  canManage,
  canApprove,
  isActing,
  onAction,
}: {
  vendorId: string;
  units: ClientUnit[];
  types: AccommodationType[];
  hostels: Hostel[];
  rooms: AccommodationRoom[];
  employees: Employee[];
  readings: HostelUtilityReading[];
  expenses: RoomExpense[];
  payPeriod: string;
  canManage: boolean;
  canApprove: boolean;
  isActing: boolean;
  onAction: Action;
}) {
  const activeTypes = types.filter(
    (t) =>
      t.vendorId === vendorId &&
      t.status === "active" &&
      !t.name.toLowerCase().includes("local/local"),
  );
  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");
  const typeHostels = hostels.filter(
    (h) => h.vendorId === vendorId && h.accommodationTypeId === typeId,
  );
  const [hostelId, setHostelId] = useState("");
  const [allocationEmployeeId, setAllocationEmployeeId] = useState("");
  const [allocationRoomId, setAllocationRoomId] = useState("");
  const [allocationRent, setAllocationRent] = useState(0);
  const selected = typeHostels.find((h) => h.id === hostelId) ?? typeHostels[0];
  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";
  const isOutsideRoom = selectedTypeName.toLowerCase().includes("outside");
  const placeLabel = isOutsideRoom ? "Local area" : "Hostel";
  const [entryType, setEntryType] = useState<EntryType>("eb");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState<"hostel" | "overall">("hostel");
  const [report, setReport] = useState<"readings" | "expenses">("readings");
  const eligibleRooms = rooms.filter(
      (r) => r.vendorId === vendorId && r.accommodationTypeId === typeId,
    ),
    hostelRooms = eligibleRooms.filter((r) => r.hostelId === selected?.id),
    periodExpenses = expenses.filter(
      (e) =>
        e.payPeriod === payPeriod && hostelRooms.some((r) => r.id === e.roomId),
    );
  const totals = periodExpenses.reduce(
    (s, e) => ({
      gas: s.gas + e.gasAmount,
      ration: s.ration + e.rationAmount,
      provision: s.provision + e.provisionAmount,
    }),
    { gas: 0, ration: 0, provision: 0 },
  );
  const scoped = readings
    .filter((r) =>
      scope === "overall"
        ? hostels.some((h) => h.id === r.hostelId && h.vendorId === vendorId)
        : r.hostelId === selected?.id,
    )
    .sort((a, b) => b.readingDate.localeCompare(a.readingDate));
  const reportRows = scoped.filter((r) =>
    report === "readings"
      ? ["eb", "water"].includes(r.utilityType)
      : !["eb", "water"].includes(r.utilityType),
  );
  const mappedUnitIds: string[] = selected
    ? (() => {
        try {
          const parsed = JSON.parse(selected.clientScopeJson || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];
  const unallocatedEmployees = employees.filter(
    (employee) =>
      employee.status === "active" &&
      !employee.roomId &&
      employee.accommodationType === selectedTypeName &&
      mappedUnitIds.includes(employee.clientUnitId),
  );
  async function createHostel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await onAction("save-hostel", `${placeLabel} created`, {
        vendorId,
        accommodationTypeId: typeId,
        name: f.get("name"),
        address: f.get("address"),
        inchargeName: f.get("inchargeName"),
        ebMeterNumber: f.get("ebMeterNumber"),
        clientScope: f.getAll("clientScope"),
        remarks: f.get("remarks"),
      })
    )
      e.currentTarget.reset();
  }
  async function createRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    if (
      await onAction(
        "save-room",
        `Room created under ${placeLabel.toLowerCase()}`,
        {
          vendorId,
          accommodationTypeId: typeId,
          hostelId: selected.id,
          roomNumber: f.get("roomNumber"),
          capacity: f.get("capacity"),
          address: selected.address,
          remarks: f.get("remarks"),
        },
      )
    )
      e.currentTarget.reset();
  }
  async function updateHostel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    await onAction("save-hostel", `${placeLabel} updated`, {
      id: selected.id,
      vendorId,
      accommodationTypeId: typeId,
      name: f.get("name"),
      address: f.get("address"),
      inchargeName: f.get("inchargeName"),
      ebMeterNumber: f.get("ebMeterNumber"),
      clientScope: f.getAll("clientScope"),
      remarks: f.get("remarks"),
    });
  }
  async function allocateEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!allocationEmployeeId || !allocationRoomId) return;
    if (
      await onAction("allocate-room", "Employee allocated to room", {
        employeeId: allocationEmployeeId,
        roomId: allocationRoomId,
        roomRentAmount: allocationRent,
      })
    ) {
      setAllocationEmployeeId("");
      setAllocationRoomId("");
      setAllocationRent(0);
    }
  }
  async function saveEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget),
      activityName =
        entryType === "payment"
          ? f.get("paymentType")
          : entryType === "housekeeping"
            ? "Housekeeping / cleaning"
            : f.get("activityName");
    if (
      await onAction("save-hostel-utility", "Hostel update saved", {
        hostelId: selected.id,
        utilityType: entryType,
        readingDate: date,
        readingValue: f.get("readingValue") ?? 0,
        tankerQuantity: f.get("quantity") ?? 0,
        amount: f.get("amount") ?? 0,
        activityName,
        remarks: f.get("remarks"),
      })
    )
      e.currentTarget.reset();
  }
  function exportReport() {
    csv(`hostel-${scope}-${report}-${payPeriod}.csv`, [
      [
        "Date",
        "Hostel",
        "Entry",
        "Activity",
        "Reading / quantity",
        "Consumption",
        "Paid amount",
        "Status",
      ],
      ...reportRows.map((r) => [
        r.readingDate,
        hostels.find((h) => h.id === r.hostelId)?.name ?? "",
        r.utilityType,
        r.activityName ?? "",
        r.utilityType === "eb"
          ? r.readingValue
          : r.utilityType === "water"
            ? `${r.tankerQuantity} L`
            : "",
        r.consumption,
        r.amount,
        r.status,
      ]),
    ]);
  }
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Step 1 · Accommodation type</span>
            <h2>Select the accommodation category first</h2>
          </div>
        </div>
        <div className="accommodation-type-grid">
          {activeTypes.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`accommodation-card accommodation-filter-card ${typeId === t.id ? "accommodation-filter-selected" : ""}`}
              onClick={() => {
                setTypeId(t.id);
                setHostelId("");
              }}
            >
              <span className="accommodation-icon">{t.name[0]}</span>
              <div>
                <span>{t.name}</span>
                <strong>
                  {hostels.filter((h) => h.accommodationTypeId === t.id).length}{" "}
                  {t.name.toLowerCase().includes("outside")
                    ? "areas"
                    : "hostels"}
                </strong>
                <small>
                  {rooms.filter((r) => r.accommodationTypeId === t.id).length}{" "}
                  rooms
                </small>
              </div>
            </button>
          ))}
        </div>
      </section>
      {typeId ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Step 2 · {placeLabel} master</span>
              <h2>
                Stored {isOutsideRoom ? "local areas" : "hostels"} under{" "}
                {activeTypes.find((t) => t.id === typeId)?.name}
              </h2>
            </div>
            <label>
              <span>{placeLabel} dropdown *</span>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => setHostelId(e.target.value)}
              >
                <option value="">
                  Choose stored {placeLabel.toLowerCase()}
                </option>
                {typeHostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canManage ? (
            <form className="form-grid" onSubmit={createHostel}>
              <label>
                <span>New {placeLabel.toLowerCase()} name *</span>
                <input name="name" required />
              </label>
              <label>
                <span>Address / location</span>
                <input name="address" />
              </label>
              <label>
                <span>
                  {isOutsideRoom ? "Area contact / owner" : "Hostel in-charge"}
                </span>
                <input name="inchargeName" />
              </label>
              <label>
                <span>EB meter number</span>
                <input name="ebMeterNumber" />
              </label>
              <section className="form-span payslip-field-selector">
                <strong>
                  Map this {placeLabel.toLowerCase()} to client employer units *
                </strong>
                <div className="scope-checkbox-grid">
                  {units.map((unit) => (
                    <label key={unit.id}>
                      <input
                        type="checkbox"
                        name="clientScope"
                        value={unit.id}
                      />
                      <span>
                        {unit.clientName} · {unit.unitName}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
              <label className="form-span">
                <span>Remarks</span>
                <input name="remarks" />
              </label>
              <button className="primary-button form-span" disabled={isActing}>
                Create {placeLabel.toLowerCase()}
              </button>
            </form>
          ) : null}
          {selected ? (
            <div className="hostel-selected-record">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">View / edit selected {placeLabel.toLowerCase()}</span>
                  <h2>{selected.name}</h2>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="record-action record-delete"
                    disabled={isActing}
                    onClick={() => {
                      if (window.confirm(`Delete ${selected.name}? This is allowed only when it has no rooms or history.`))
                        void onAction("delete-hostel", `${placeLabel} deleted`, { id: selected.id });
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <form className="form-grid" onSubmit={updateHostel}>
                <label><span>Name *</span><input name="name" defaultValue={selected.name} required disabled={!canManage} /></label>
                <label><span>Address / location</span><input name="address" defaultValue={selected.address ?? ""} disabled={!canManage} /></label>
                <label><span>{isOutsideRoom ? "Area contact / owner" : "Hostel in-charge"}</span><input name="inchargeName" defaultValue={selected.inchargeName ?? ""} disabled={!canManage} /></label>
                <label><span>EB meter number</span><input name="ebMeterNumber" defaultValue={selected.ebMeterNumber ?? ""} disabled={!canManage} /></label>
                <section className="form-span payslip-field-selector">
                  <strong>Mapped client employer units</strong>
                  <div className="scope-checkbox-grid">
                    {units.map((unit) => (
                      <label key={unit.id}>
                        <input type="checkbox" name="clientScope" value={unit.id} defaultChecked={mappedUnitIds.includes(unit.id)} disabled={!canManage} />
                        <span>{unit.clientName} · {unit.unitName}</span>
                      </label>
                    ))}
                  </div>
                </section>
                <label className="form-span"><span>Remarks</span><input name="remarks" defaultValue={selected.remarks ?? ""} disabled={!canManage} /></label>
                {canManage ? <button className="primary-button form-span" disabled={isActing}>Save changes and client mapping</button> : null}
              </form>
            </div>
          ) : null}
        </section>
      ) : null}
      {selected ? (
        <>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Step 3 · Room creation and mapping
                </span>
                <h2>{selected.name} rooms</h2>
              </div>
              <span className="muted-label">
                {hostelRooms.length} mapped rooms
              </span>
            </div>
            {canManage ? (
              <form className="form-grid" onSubmit={createRoom}>
                <label>
                  <span>Selected {placeLabel.toLowerCase()}</span>
                  <input value={selected.name} readOnly />
                </label>
                <label>
                  <span>Room number *</span>
                  <input name="roomNumber" required />
                </label>
                <label>
                  <span>Capacity</span>
                  <input
                    name="capacity"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </label>
                <label>
                  <span>Remarks</span>
                  <input name="remarks" />
                </label>
                <button
                  className="primary-button form-span"
                  disabled={isActing}
                >
                  Create and map room
                </button>
              </form>
            ) : null}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Capacity</th>
                    <th>Residents</th>
                    <th>Stored {placeLabel.toLowerCase()} mapping</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleRooms.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.roomNumber}</strong>
                      </td>
                      <td>{r.capacity || "Unlimited"}</td>
                      <td>
                        {
                          employees.filter(
                            (e) => e.roomId === r.id && e.status === "active",
                          ).length
                        }
                      </td>
                      <td>
                        {canManage ? (
                          <select
                            value={r.hostelId ?? ""}
                            onChange={(e) =>
                              e.target.value &&
                              void onAction(
                                "assign-room-hostel",
                                "Room mapped",
                                { roomId: r.id, hostelId: e.target.value },
                              )
                            }
                          >
                            <option value="">Not mapped</option>
                            {typeHostels.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          (typeHostels.find((h) => h.id === r.hostelId)?.name ??
                          "Not mapped")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Client-mapped room allocation</span>
                <h2>Unallocated employees eligible for {selected.name}</h2>
              </div>
              <span className="muted-label">{unallocatedEmployees.length} employees</span>
            </div>
            {canManage ? (
              <form className="form-grid" onSubmit={allocateEmployee}>
                <label><span>Employee *</span><select value={allocationEmployeeId} onChange={(e) => setAllocationEmployeeId(e.target.value)} required><option value="">Select eligible employee</option>{unallocatedEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.name}</option>)}</select></label>
                <label><span>Room *</span><select value={allocationRoomId} onChange={(e) => setAllocationRoomId(e.target.value)} required><option value="">Select room</option>{hostelRooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}</option>)}</select></label>
                <label><span>Individual monthly rent (₹) *</span><input type="number" min="0" step="0.01" value={allocationRent} onChange={(e) => setAllocationRent(Number(e.target.value))} required /></label>
                <button className="primary-button" disabled={isActing || !allocationEmployeeId || !allocationRoomId}>Allocate employee</button>
              </form>
            ) : null}
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Employee</th><th>Client employer</th><th>Accommodation type</th><th>Status</th></tr></thead><tbody>{unallocatedEmployees.map((employee) => { const unit = units.find((row) => row.id === employee.clientUnitId); return <tr key={employee.id}><td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td><td>{unit ? `${unit.clientName} · ${unit.unitName}` : "—"}</td><td>{employee.accommodationType}</td><td>Room unallocated</td></tr>; })}</tbody></table></div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Hostel daily operations</span>
                <h2>{selected.name}: readings, payments and activities</h2>
              </div>
              <span className="muted-label">
                Readings and expenses are separate
              </span>
            </div>
            {canManage ? (
              <form className="form-grid" onSubmit={saveEntry}>
                <label>
                  <span>Update type *</span>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as EntryType)}
                  >
                    <option value="eb">Daily EB meter reading</option>
                    <option value="water">Water ordered / quantity</option>
                    <option value="payment">Payment update</option>
                    <option value="housekeeping">
                      Housekeeping / cleaning
                    </option>
                    <option value="other">Other activity</option>
                  </select>
                </label>
                <label>
                  <span>Date *</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>
                {entryType === "eb" ? (
                  <label>
                    <span>Current EB reading *</span>
                    <input
                      name="readingValue"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                    />
                  </label>
                ) : null}
                {entryType === "water" ? (
                  <label>
                    <span>Water quantity (litres) *</span>
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                    />
                  </label>
                ) : null}
                {entryType === "payment" ? (
                  <label>
                    <span>Payment for *</span>
                    <select name="paymentType">
                      <option>Water order payment</option>
                      <option>EB bill payment</option>
                    </select>
                  </label>
                ) : null}
                {entryType === "other" ? (
                  <label>
                    <span>Other activity name *</span>
                    <input name="activityName" required />
                  </label>
                ) : null}
                {!["eb", "water"].includes(entryType) ? (
                  <label>
                    <span>Paid amount (₹) *</span>
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                    />
                  </label>
                ) : null}
                <label className="form-span">
                  <span>Remarks / supplier / bill reference</span>
                  <input name="remarks" />
                </label>
                <button
                  className="primary-button form-span"
                  disabled={isActing}
                >
                  Save hostel update
                </button>
              </form>
            ) : null}
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Hostel reports</span>
                <h2>Daily readings and expense reports</h2>
              </div>
              <div className="record-actions">
                <select
                  value={report}
                  onChange={(e) =>
                    setReport(e.target.value as "readings" | "expenses")
                  }
                >
                  <option value="readings">Daily EB & water</option>
                  <option value="expenses">Expenses & activities</option>
                </select>
                <select
                  value={scope}
                  onChange={(e) =>
                    setScope(e.target.value as "hostel" | "overall")
                  }
                >
                  <option value="hostel">Selected hostel</option>
                  <option value="overall">Overall hostels</option>
                </select>
                <button className="record-action" onClick={exportReport}>
                  Download CSV
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hostel</th>
                    <th>Entry / activity</th>
                    <th>Reading / quantity</th>
                    <th>Consumption</th>
                    <th>Paid amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.readingDate}</td>
                      <td>{hostels.find((h) => h.id === r.hostelId)?.name}</td>
                      <td>
                        {r.activityName ??
                          (r.utilityType === "eb"
                            ? "EB reading"
                            : "Water order")}
                      </td>
                      <td>
                        {r.utilityType === "eb"
                          ? r.readingValue
                          : r.utilityType === "water"
                            ? `${r.tankerQuantity} L`
                            : "—"}
                      </td>
                      <td>{r.utilityType === "eb" ? r.consumption : "—"}</td>
                      <td>
                        {!["eb", "water"].includes(r.utilityType)
                          ? money(r.amount)
                          : "—"}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        {r.status === "draft" && canApprove ? (
                          <button
                            className="record-action"
                            disabled={isActing}
                            onClick={() =>
                              void onAction(
                                "approve-hostel-utility",
                                "Hostel update approved",
                                { id: r.id },
                              )
                            }
                          >
                            Approve
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Room deductions · {payPeriod}</span>
                <h2>{selected.name}: cumulative Gas, Ration and Provision</h2>
              </div>
              <strong>
                {money(totals.gas + totals.ration + totals.provision)}
              </strong>
            </div>
            <div className="payment-summary-grid">
              <article>
                <div>
                  <small>Gas cylinders</small>
                  <strong>{money(totals.gas)}</strong>
                </div>
              </article>
              <article>
                <div>
                  <small>Ration</small>
                  <strong>{money(totals.ration)}</strong>
                </div>
              </article>
              <article>
                <div>
                  <small>Provision</small>
                  <strong>{money(totals.provision)}</strong>
                </div>
              </article>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Gas</th>
                    <th>Ration</th>
                    <th>Provision</th>
                    <th>Roommates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hostelRooms.map((room) => {
                    const x = periodExpenses.find((e) => e.roomId === room.id);
                    return (
                      <tr key={room.id}>
                        <td>{room.roomNumber}</td>
                        <td>
                          {x?.gasDate ?? "—"}
                          <small>{money(x?.gasAmount ?? 0)}</small>
                        </td>
                        <td>
                          {x?.rationDate ?? "—"}
                          <small>{money(x?.rationAmount ?? 0)}</small>
                        </td>
                        <td>
                          {x?.provisionDate ?? "—"}
                          <small>{money(x?.provisionAmount ?? 0)}</small>
                        </td>
                        <td>
                          {x?.occupantCount ||
                            employees.filter(
                              (e) =>
                                e.roomId === room.id && e.status === "active",
                            ).length}
                        </td>
                        <td>{x?.status ?? "Not entered"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
