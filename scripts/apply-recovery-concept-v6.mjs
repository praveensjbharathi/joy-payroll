import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/reports-recovery.tsx");
let app = await readFile(file, "utf8");

// Recovery is for overall payroll employees, but the employee summary/voucher list must
// contain ONLY employees who actually have an individual dated recovery or a room share.
app = app.replace(
  /const individual = charge\n        \? charge\.rent \+[\s\S]*?\n        : 0;\n      const shared = charge[\s\S]*?const dated = entries\.filter\(\(entry\) => entry\.employeeId === employee\.id\);\n      return \{\n        employee,\n        charge,\n        individual,\n        shared,\n        total: individual \+ shared,\n        item,\n        dated,\n      \};\n    \}\)\n    \.filter\([\s\S]*?\);/,
  `const legacyIndividual = charge
        ? charge.rent +
          charge.bus +
          charge.food +
          charge.advance +
          charge.idCard +
          charge.medical +
          charge.ticket +
          charge.shoe +
          charge.aadhaarUpdate +
          charge.bankAccountCharge +
          charge.tshirt +
          charge.oldPending
        : 0;
      const shared = charge
        ? charge.gasShare + charge.rationShare + charge.provisionShare
        : 0;
      const dated = entries.filter((entry) => entry.employeeId === employee.id);
      const datedDeduction = dated
        .filter((entry) => entry.recoveryType !== "returnAmount")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const individual = datedDeduction > 0 ? datedDeduction : legacyIndividual;
      return {
        employee,
        charge,
        individual,
        shared,
        total: individual + shared,
        item,
        dated,
      };
    })
    .filter((row) => row.individual > 0 || row.shared > 0);`,
);

// The dated recovery input must remain visible to payroll managers and approvers.
app = app.replace(
  /\{canManage && run \? \(/,
  `{run && (canManage || canApprove) ? (`,
);

// Dated entries are input records only. Voucher is generated after month-end finalization,
// not once for every individual dated entry.
app = app.replace(
  /\s*\{entry\.recoveryType === "advance" \? \([\s\S]*?\) : null\}\n/g,
  "\n",
);

// Room-wise recovery entry state.
if (!app.includes("roomRecoveryScope")) {
  app = app.replace(
    `  const [bulkVouchers, setBulkVouchers] = useState(false);`,
    `  const [bulkVouchers, setBulkVouchers] = useState(false);
  const [roomRecoveryScope, setRoomRecoveryScope] = useState<"" | "joy" | "outside">("");
  const [roomRecoveryHostelId, setRoomRecoveryHostelId] = useState("");
  const [roomRecoveryArea, setRoomRecoveryArea] = useState("");
  const [roomRecoveryId, setRoomRecoveryId] = useState("");
  const [roomRecoveryMembers, setRoomRecoveryMembers] = useState<string[]>([]);
  const [roomRecoveryGas, setRoomRecoveryGas] = useState(0);
  const [roomRecoveryRation, setRoomRecoveryRation] = useState(0);
  const [roomRecoveryProvision, setRoomRecoveryProvision] = useState(0);
  const [roomRecoveryConfirmed, setRoomRecoveryConfirmed] = useState(false);`,
  );
}

if (!app.includes("async function saveRoomWiseRecovery")) {
  app = app.replace(
    `  async function addRecovery(event: FormEvent<HTMLFormElement>) {`,
    `  const joyRecoveryTypeIds = data.accommodationTypes
    .filter((type) => {
      const name = type.name.toLowerCase();
      return name.includes("joy") && (name.includes("room") || name.includes("hostel"));
    })
    .map((type) => type.id);
  const outsideRecoveryTypeIds = data.accommodationTypes
    .filter((type) => type.name.toLowerCase().includes("outside"))
    .map((type) => type.id);
  const recoveryScopeTypeIds = roomRecoveryScope === "joy"
    ? joyRecoveryTypeIds
    : roomRecoveryScope === "outside"
      ? outsideRecoveryTypeIds
      : [];
  const recoveryHostels = data.hostels.filter(
    (hostel) => hostel.status === "active" &&
      (!hostel.accommodationTypeId || recoveryScopeTypeIds.includes(hostel.accommodationTypeId)),
  );
  const recoveryAreas = [...new Set(
    data.accommodationRooms
      .filter((room) => room.status === "active" && outsideRecoveryTypeIds.includes(room.accommodationTypeId))
      .map((room) => room.address?.trim() ?? "")
      .filter(Boolean),
  )].sort();
  const recoveryRooms = data.accommodationRooms.filter((room) => {
    if (room.status !== "active" || !recoveryScopeTypeIds.includes(room.accommodationTypeId)) return false;
    if (roomRecoveryScope === "joy" && roomRecoveryHostelId && room.hostelId !== roomRecoveryHostelId) return false;
    if (roomRecoveryScope === "outside" && roomRecoveryArea && (room.address?.trim() ?? "") !== roomRecoveryArea) return false;
    return true;
  });
  const selectedRecoveryRoom = data.accommodationRooms.find((room) => room.id === roomRecoveryId);
  const existingRecoveryRoomMembers = employees.filter((employee) => employee.roomId === roomRecoveryId);

  function chooseRecoveryRoom(roomId: string) {
    setRoomRecoveryId(roomId);
    setRoomRecoveryConfirmed(false);
    const memberIds = employees.filter((employee) => employee.roomId === roomId).map((employee) => employee.id);
    setRoomRecoveryMembers(memberIds);
    const saved = data.roomExpenses.find((expense) => expense.roomId === roomId && expense.payPeriod === run?.payPeriod);
    setRoomRecoveryGas(saved?.gasAmount ?? 0);
    setRoomRecoveryRation(saved?.rationAmount ?? 0);
    setRoomRecoveryProvision(saved?.provisionAmount ?? 0);
  }

  async function confirmRecoveryRoomMembers() {
    if (!selectedRecoveryRoom) return;
    const current = new Set(existingRecoveryRoomMembers.map((employee) => employee.id));
    const desired = new Set(roomRecoveryMembers);
    for (const employeeId of desired) {
      if (!current.has(employeeId)) {
        const employee = employees.find((row) => row.id === employeeId);
        await onAction("allocate-room", "Employee added to recovery room", {
          roomId: selectedRecoveryRoom.id,
          employeeId,
          roomRentAmount: employee?.roomRentAmount ?? 0,
        });
      }
    }
    for (const employeeId of current) {
      if (!desired.has(employeeId)) {
        await onAction("allocate-room", "Employee removed from recovery room", {
          employeeId,
          roomId: null,
        });
      }
    }
    setRoomRecoveryConfirmed(true);
  }

  async function saveRoomWiseRecovery() {
    if (!run || !selectedRecoveryRoom || !roomRecoveryConfirmed) return;
    const recoveryDate = run.periodEnd ?? \`${'${run.payPeriod}'}-01\`;
    await onAction("save-room-expense", "Room-wise recovery saved for payroll month", {
      roomId: selectedRecoveryRoom.id,
      payPeriod: run.payPeriod,
      gasAmount: roomRecoveryGas,
      gasDate: recoveryDate,
      gasCylinderCount: 0,
      gasPaymentReference: "Recovery",
      rationAmount: roomRecoveryRation,
      rationDate: recoveryDate,
      rationPaymentReference: "Recovery",
      provisionAmount: roomRecoveryProvision,
      provisionDate: recoveryDate,
      provisionPaymentReference: "Recovery",
      notes: "Saved from Recovery page after roommate confirmation",
    });
  }

  async function addRecovery(event: FormEvent<HTMLFormElement>) {`,
  );
}

// Insert room-wise recovery entry ahead of the room recovery register.
if (!app.includes("Room-wise monthly recovery entry")) {
  app = app.replace(
    `      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Shared room recoveries</span>`,
    `      {run && (canManage || canApprove) ? (
        <section className="panel form-grid room-recovery-entry-panel">
          <div className="panel-heading form-span">
            <div>
              <span className="eyebrow">Room-wise monthly recovery entry</span>
              <h2>Confirm roommates → enter Gas / Ration / Provision → save</h2>
            </div>
            <span className="muted-label">Applied only to confirmed roommates in this payroll month</span>
          </div>
          <label>
            <span>Accommodation category *</span>
            <select value={roomRecoveryScope} onChange={(event) => {
              setRoomRecoveryScope(event.target.value as "" | "joy" | "outside");
              setRoomRecoveryHostelId("");
              setRoomRecoveryArea("");
              chooseRecoveryRoom("");
            }}>
              <option value="">Select category</option>
              <option value="joy">Joy Room / Joy Hostel</option>
              <option value="outside">Outside Room</option>
            </select>
          </label>
          {roomRecoveryScope === "joy" ? (
            <label>
              <span>Joy Hostel *</span>
              <select value={roomRecoveryHostelId} onChange={(event) => {
                setRoomRecoveryHostelId(event.target.value);
                chooseRecoveryRoom("");
              }}>
                <option value="">Select hostel</option>
                {recoveryHostels.map((hostel) => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}
              </select>
            </label>
          ) : null}
          {roomRecoveryScope === "outside" ? (
            <label>
              <span>Area name *</span>
              <select value={roomRecoveryArea} onChange={(event) => {
                setRoomRecoveryArea(event.target.value);
                chooseRecoveryRoom("");
              }}>
                <option value="">Select area</option>
                {recoveryAreas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span>Room *</span>
            <select value={roomRecoveryId} onChange={(event) => chooseRecoveryRoom(event.target.value)} disabled={!roomRecoveryScope}>
              <option value="">Select room</option>
              {recoveryRooms.map((room) => <option key={room.id} value={room.id}>Room {room.roomNumber}</option>)}
            </select>
          </label>
          {selectedRecoveryRoom ? (
            <div className="form-span panel room-recovery-member-confirmation">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Roommate confirmation</span>
                  <h3>Are these the employees staying in Room {selectedRecoveryRoom.roomNumber}?</h3>
                </div>
                <span className="muted-label">{roomRecoveryMembers.length} selected</span>
              </div>
              <div className="room-recovery-member-grid">
                {employees.filter((employee) => employee.status === "active").map((employee) => (
                  <label key={employee.id} className="room-recovery-member-option">
                    <input
                      type="checkbox"
                      checked={roomRecoveryMembers.includes(employee.id)}
                      onChange={(event) => {
                        setRoomRecoveryConfirmed(false);
                        setRoomRecoveryMembers((current) => event.target.checked
                          ? [...new Set([...current, employee.id])]
                          : current.filter((id) => id !== employee.id));
                      }}
                    />
                    <span><strong>{employee.employeeCode}</strong> · {employee.name}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="secondary-button" disabled={isActing} onClick={() => void confirmRecoveryRoomMembers()}>
                {roomRecoveryConfirmed ? "Roommates confirmed ✓" : "Confirm / update room employees"}
              </button>
            </div>
          ) : null}
          <label>
            <span>Gas amount (₹)</span>
            <input type="number" min="0" step="0.01" value={roomRecoveryGas} onChange={(event) => setRoomRecoveryGas(Number(event.target.value))} />
          </label>
          <label>
            <span>Ration amount (₹)</span>
            <input type="number" min="0" step="0.01" value={roomRecoveryRation} onChange={(event) => setRoomRecoveryRation(Number(event.target.value))} />
          </label>
          <label>
            <span>Provision amount (₹)</span>
            <input type="number" min="0" step="0.01" value={roomRecoveryProvision} onChange={(event) => setRoomRecoveryProvision(Number(event.target.value))} />
          </label>
          <div className="form-span room-expense-calculation">
            <strong>Total ₹{(roomRecoveryGas + roomRecoveryRation + roomRecoveryProvision).toFixed(2)}</strong>
            <span>÷ {roomRecoveryMembers.length} confirmed roommates</span>
            <strong>Per head ₹{(roomRecoveryMembers.length ? (roomRecoveryGas + roomRecoveryRation + roomRecoveryProvision) / roomRecoveryMembers.length : 0).toFixed(2)}</strong>
          </div>
          <button type="button" className="primary-button form-span" disabled={isActing || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0} onClick={() => void saveRoomWiseRecovery()}>
            Save room-wise recovery for {run.payPeriod}
          </button>
        </section>
      ) : null}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Shared room recoveries</span>`,
  );
}

// Make voucher wording match the recovery concept and show month-end total recovery.
app = app.replaceAll("Final employee deduction voucher", "Final recovery voucher");
app = app.replaceAll("Bulk finalized deduction vouchers", "Bulk finalized recovery vouchers");
app = app.replaceAll("FINAL SALARY DEDUCTION ACKNOWLEDGEMENT", "FINAL SALARY RECOVERY ACKNOWLEDGEMENT");

await writeFile(file, app, "utf8");
console.log("Recovery V6 applied: overall employee input, applicable-only vouchers, restored dated recovery entry, roommate confirmation and room-wise monthly Gas/Ration/Provision recovery.");
