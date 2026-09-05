import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Final enforcement for the exact requested Hostel Master flow.
const hostelPath = join(root, "app/hostel-master.tsx");
let hostel = await readFile(hostelPath, "utf8");

// A first Hostel/Area must be creatable even when no stored record exists yet.
hostel = hostel.replaceAll("vendorId: selected.vendorId,", "vendorId,");
hostel = hostel.replaceAll(
  "accommodationTypeId: selected.accommodationTypeId ?? typeId,",
  "accommodationTypeId: typeId,",
);
hostel = hostel.replaceAll(
  'const placeLabel = isOutsideRoom ? "Local area" : "Hostel";',
  'const placeLabel = isOutsideRoom ? "Area" : "Hostel";',
);

// Replace the visual accommodation cards with one Operational Master driven Room Category dropdown.
const gridStart = hostel.indexOf('        <div className="accommodation-type-grid">');
if (gridStart >= 0) {
  const sectionEnd = hostel.indexOf("      </section>", gridStart);
  if (sectionEnd >= 0) {
    const replacement = `        <div className="form-grid">
          <label className="form-span">
            <span>Accommodation Type / Room Category *</span>
            <select
              value={typeId}
              onChange={(event) => {
                setTypeId(event.target.value);
                setHostelId("");
              }}
              required
            >
              <option value="">Select accommodation type / room category</option>
              {activeTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <small className="muted-label">Loaded from Operational Masters</small>
          </label>
        </div>\n`;
    hostel = hostel.slice(0, gridStart) + replacement + hostel.slice(sectionEnd);
  }
}

hostel = hostel.replaceAll(
  "Step 1 · Accommodation type / room category",
  "Step 1 · Operational Master Room Category",
);
hostel = hostel.replaceAll(
  "Step 1 · Accommodation type",
  "Step 1 · Operational Master Room Category",
);
hostel = hostel.replaceAll(
  "Select accommodation type / room category from Operational Masters",
  "Select Accommodation Type / Room Category from Operational Masters",
);
hostel = hostel.replaceAll(
  "Select the accommodation category first",
  "Select Accommodation Type / Room Category from Operational Masters",
);
hostel = hostel.replaceAll("Stored local areas", "Stored areas");
hostel = hostel.replaceAll(
  "New {placeLabel.toLowerCase()} name *",
  "New {isOutsideRoom ? \"Area Name\" : \"Hostel Name\"} *",
);
hostel = hostel.replaceAll(
  "Create {placeLabel.toLowerCase()}",
  "Create {isOutsideRoom ? \"Area Name\" : \"Hostel\"}",
);

await writeFile(hostelPath, hostel, "utf8");

// Room recovery must behave like Add Recovery by Date: date is explicitly selected first.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

// Do not auto-fill the room recovery date. The rest of the form appears only after user selects it.
recovery = recovery.replace(
  /const \[roomRecoveryDate, setRoomRecoveryDate\] = useState\([\s\S]*?\)\s*;/,
  'const [roomRecoveryDate, setRoomRecoveryDate] = useState("");',
);
recovery = recovery.replaceAll("Room recovery date *", "Recovery date *");
recovery = recovery.replaceAll(
  "Applied only to confirmed roommates in this payroll month",
  "Select the recovery date first. Remaining room recovery fields will open after the date is selected.",
);
recovery = recovery.replaceAll(
  "Select date → accommodation category → sub category → room → confirm employees → enter recovery",
  "Select date → Accommodation Type / Room Category → Hostel or Area → Room → confirm employees → enter recovery",
);

// JOY_RECOVERY_PREVIEW_VISIBILITY_V3
// Room expenses are valid dated recovery inputs even before a payroll run exists.
// Show their per-head preview against allocated employees instead of leaving Recovery blank.
if (!recovery.includes("const recoveryPreviewPeriod")) {
  recovery = recovery.replace(
    `  run,
  employees,`,
    `  run,
  vendorId,
  employees,`,
  );
  recovery = recovery.replace(
    `  run: PayrollRun | null;
  employees: Employee[];`,
    `  run: PayrollRun | null;
  vendorId: string;
  employees: Employee[];`,
  );

  const finalizationMarker = `  const finalizations = run
    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)
    : [];`;
  recovery = recovery.replace(
    finalizationMarker,
    `${finalizationMarker}
  const recoveryVendorRoomIds = new Set(
    data.accommodationRooms
      .filter((room) => room.vendorId === vendorId)
      .map((room) => room.id),
  );
  const recoveryRoomEntries = data.roomExpenses.filter((expense) =>
    recoveryVendorRoomIds.has(expense.roomId),
  );
  const recoveryPreviewPeriod =
    run?.payPeriod ??
    [...new Set(recoveryRoomEntries.map((expense) => expense.payPeriod))]
      .sort((left, right) => right.localeCompare(left))[0] ??
    new Date().toISOString().slice(0, 7);`,
  );

  recovery = recovery.replace(
    `employee.roomId && run && !charge?.roomExpenseId
          ? data.roomExpenses.filter(
              (expense) =>
                expense.roomId === employee.roomId &&
                expense.payPeriod === run.payPeriod &&
                expense.status === "draft",`,
    `employee.roomId && !charge?.roomExpenseId
          ? recoveryRoomEntries.filter(
              (expense) =>
                expense.roomId === employee.roomId &&
                expense.payPeriod === recoveryPreviewPeriod &&
                expense.status === "draft",`,
  );

  recovery = recovery.replace(
    `  const roomRows = data.roomExpenses
    .filter((expense) => !run || expense.payPeriod === run.payPeriod)
    .map((expense) => ({`,
    `  const roomRows = recoveryRoomEntries
    .filter((expense) => expense.payPeriod === recoveryPreviewPeriod)
    .map((expense) => ({`,
  );

  recovery = recovery.replace(
    `    <div className="section-stack">
      {run?.status === "approved" ? (`,
    `    <div className="section-stack">
      <section className="panel recovery-overview-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Recovery visibility check</span>
            <h2>{run ? \`Recovery for \${recoveryPreviewPeriod}\` : \`Room recovery preview for \${recoveryPreviewPeriod}\`}</h2>
          </div>
          <span className="muted-label">
            {employeeRows.length} applicable employee{employeeRows.length === 1 ? "" : "s"} · {roomRows.length} dated room entr{roomRows.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {!run ? (
          <p className="form-note">
            <strong>No payroll run exists for this client and month.</strong>{" "}
            Draft Gas, Ration and Provision shares are shown below against each allocated employee.
            Create the payroll run to calculate Net before recovery and Final payable.
          </p>
        ) : null}
      </section>
      {run?.status === "approved" ? (`,
  );

  recovery = recovery.replace(
    `map(({ employee, charge, individual, shared, item }) => {`,
    `map(({ employee, charge, individual, shared, pendingShared, gasShare, rationShare, provisionShare, item }) => {`,
  );
  recovery = recovery.replace(
    `<td>₹{shared.toFixed(2)}</td>`,
    `<td>
                        <strong>₹{shared.toFixed(2)}</strong>
                        <small>
                          Gas ₹{gasShare.toFixed(2)} · Ration ₹{rationShare.toFixed(2)} · Provision ₹{provisionShare.toFixed(2)}
                        </small>
                        {pendingShared > 0 ? <small>Draft room-share preview</small> : null}
                      </td>`,
  );
}

// JOY_RECOVERY_CORE_CONTROLS_V4
// Keep the three requested Recovery functions visible. Employee recovery and its
// voucher keep their payroll/finalization safeguards; dated room recovery works
// independently of payroll-run creation.
recovery = recovery.replace(
  `    <div className="section-stack">
      {run && (canManage || canApprove) ? (
        <form`,
  `    <div className="section-stack">
      {(canManage || canApprove) ? (
        <form`,
);
recovery = recovery.replace(
  `      {run && (canManage || canApprove) ? (
        <form`,
  `      {(canManage || canApprove) ? (
        <form`,
);
recovery = recovery.replace(
  "<h2>Add recovery by date</h2>",
  "<h2>Employee-wise recovery by date</h2>",
);
recovery = recovery.replace(
  `            </span>
          </div>
          <label>
            <span>Employee *</span>`,
  `            </span>
          </div>
          {!run ? (
            <p className="form-note form-span">
              <strong>Create the payroll run to save employee-wise recovery.</strong>{" "}
              The employee selector remains visible so the missing payroll prerequisite is clear.
            </p>
          ) : null}
          <label>
            <span>Employee *</span>`,
);
recovery = recovery.replace(
  "disabled={isActing || !employeeId || amount <= 0}",
  "disabled={isActing || !run || !employeeId || amount <= 0}",
);
recovery = recovery.replace(
  /(?<!run && )run\??\.status === "approved"/g,
  'run && run.status === "approved"',
);
recovery = recovery.replace(
  ": isActing || !employeeId || amount <= 0",
  ": isActing || !run || !employeeId || amount <= 0",
);

if (!recovery.includes('const [roomRecoveryDate, setRoomRecoveryDate]')) {
  recovery = recovery.replace(
    `  const [bulkVouchers, setBulkVouchers] = useState(false);`,
    `  const [bulkVouchers, setBulkVouchers] = useState(false);
  const [roomRecoveryDate, setRoomRecoveryDate] = useState("");`,
  );
}
if (!recovery.includes("const roomRecoveryPeriod")) {
  recovery = recovery.replace(
    `  function getRecoveryRoomNumber(employee: Employee) {`,
    `  const roomRecoveryPeriod = roomRecoveryDate
    ? roomRecoveryDate.slice(0, 7)
    : recoveryPreviewPeriod;
  function getRecoveryRoomNumber(employee: Employee) {`,
  );
}
recovery = recovery.replace(
  "expense.roomId === roomId && expense.payPeriod === run?.payPeriod",
  "expense.roomId === roomId && expense.payPeriod === roomRecoveryPeriod",
);
recovery = recovery.replace(
  "    if (!run || !selectedRecoveryRoom || !roomRecoveryConfirmed) return;",
  "    if (!roomRecoveryDate || !selectedRecoveryRoom || !roomRecoveryConfirmed) return;",
);
recovery = recovery.replace(
  '    const recoveryDate = roomRecoveryDate || run.periodEnd || `${run.payPeriod}-01`;\n',
  "",
);
recovery = recovery.replace(
  '    await onAction("save-room-expense", "Room-wise recovery saved for payroll month", {',
  '    await onAction("save-room-expense", "Dated room-wise recovery saved", {',
);
recovery = recovery.replace(
  `      payPeriod: run.payPeriod,
      gasAmount: roomRecoveryGas,`,
  `      payPeriod: roomRecoveryPeriod,
      gasAmount: roomRecoveryGas,`,
);
recovery = recovery.replaceAll("Date: recoveryDate", "Date: roomRecoveryDate");
recovery = recovery.replace(
  `      {run && (canManage || canApprove) ? (
        <section className="panel form-grid room-recovery-entry-panel">`,
  `      {(canManage || canApprove) ? (
        <section className="panel form-grid room-recovery-entry-panel">`,
);
recovery = recovery.replace(
  "<h2>Confirm roommates → enter Gas / Ration / Provision → save</h2>",
  "<h2>Room-wise recovery</h2>",
);
recovery = recovery.replace(
  `<span className="eyebrow">Add Recovery for Rooms</span>
              <h2>Select date → Accommodation Type / Room Category → Hostel or Area → Room → confirm employees → enter recovery</h2>`,
  `<span className="eyebrow">Dated room recovery entry</span>
              <h2>Room-wise recovery</h2>`,
);
recovery = recovery.replace(
  `          </div>
          <label>
            <span>Accommodation category *</span>`,
  `          </div>
          <label className="form-span">
            <span>Recovery date *</span>
            <input
              type="date"
              value={roomRecoveryDate}
              onChange={(event) => {
                setRoomRecoveryDate(event.target.value);
                chooseRecoveryRoom("");
              }}
              required
            />
          </label>
          <label>
            <span>Accommodation category *</span>`,
);
recovery = recovery.replace(
  `<select value={roomRecoveryScope} onChange={(event) => {`,
  `<select disabled={!roomRecoveryDate} value={roomRecoveryScope} onChange={(event) => {`,
);
recovery = recovery.replace(
  `onChange={(event) => setRoomRecoveryDate(event.target.value)}
              required`,
  `onChange={(event) => {
                setRoomRecoveryDate(event.target.value);
                chooseRecoveryRoom("");
              }}
              required`,
);
recovery = recovery.replaceAll(
  "disabled={!roomRecoveryScope}",
  "disabled={!roomRecoveryDate || !roomRecoveryScope}",
);
recovery = recovery.replaceAll(
  "disabled={!roomRecoveryScope || !roomRecoveryHostelId}",
  "disabled={!roomRecoveryDate || !roomRecoveryScope || !roomRecoveryHostelId}",
);
for (const field of ["Gas", "Ration", "Provision"]) {
  recovery = recovery.replace(
    `<input type="number" min="0" step="0.01" value={roomRecovery${field}}`,
    `<input disabled={!roomRecoveryDate || !selectedRecoveryRoom} type="number" min="0" step="0.01" value={roomRecovery${field}}`,
  );
}
recovery = recovery.replace(
  "disabled={isActing || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0}",
  "disabled={isActing || !roomRecoveryDate || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0}",
);
recovery = recovery.replace(
  "Save room-wise recovery for {run.payPeriod}",
  "Save dated room recovery entry for {roomRecoveryPeriod}",
);
recovery = recovery.replace(
  "Save dated room recovery entry for {run.payPeriod}",
  "Save dated room recovery entry for {roomRecoveryPeriod}",
);
recovery = recovery.replaceAll("Generate voucher", "Individual deduction voucher");
recovery = recovery.replace(
  `                        ) : canApprove ? (`,
  `                        ) : run && canApprove ? (`,
);
recovery = recovery.replace(
  `<small>Awaiting Super Admin approval</small>`,
  `<small>{run ? "Awaiting Super Admin approval" : "Payroll run required before finalization and voucher"}</small>`,
);
recovery = recovery.replace(
  /\) : run && canApprove \? \(\n\s*<button\n\s*className="primary-button"\n\s*disabled=\{isActing\}[\s\S]*?<small>\{run \? "Awaiting Super Admin approval" : "Payroll run required before finalization and voucher"\}<\/small>\n\s*\)\}/,
  `) : (
                          <div className="record-actions">
                            <button
                              type="button"
                              className="record-action"
                              disabled
                              title="Available after recovery finalization"
                            >
                              Individual deduction voucher
                            </button>
                            {run && canApprove ? (
                              <button
                                className="primary-button"
                                disabled={isActing}
                                onClick={() =>
                                  void onAction(
                                    "finalize-employee-recovery",
                                    "Recovery finalized and voucher generated",
                                    { employeeId: employee.id },
                                  )
                                }
                              >
                                Finalize recovery
                              </button>
                            ) : (
                              <small>{run ? "Awaiting Super Admin approval" : "Payroll run required before finalization and voucher"}</small>
                            )}
                          </div>
                        )}`,
);

// JOY_HANDWRITTEN_RECOVERY_FIXES_V1
// Reconcile the employee and room-wise statement from the authoritative
// accommodation-charge ledger, add period/date totals, and make the printed
// room statement and vouchers explicitly show their reconciled totals.
const roomRecoveryStateAnchor = `  const [roomRecoveryDate, setRoomRecoveryDate] = useState("");`;
if (recovery.includes(roomRecoveryStateAnchor) && !recovery.includes("const [roomRecoveryScope, setRoomRecoveryScope]")) {
  recovery = recovery.replace(
    roomRecoveryStateAnchor,
    `${roomRecoveryStateAnchor}
  type RecoveryScope = "" | "joy" | "outside";
  const [roomRecoveryScope, setRoomRecoveryScope] = useState<RecoveryScope>("");
  const [roomRecoveryHostelId, setRoomRecoveryHostelId] = useState("");
  const [roomRecoveryArea, setRoomRecoveryArea] = useState("");
  const [roomRecoveryId, setRoomRecoveryId] = useState("");
  const [roomRecoveryMembers, setRoomRecoveryMembers] = useState<string[]>([]);
  const [roomRecoveryConfirmed, setRoomRecoveryConfirmed] = useState(false);
  const [roomRecoveryGas, setRoomRecoveryGas] = useState(0);
  const [roomRecoveryRation, setRoomRecoveryRation] = useState(0);
  const [roomRecoveryProvision, setRoomRecoveryProvision] = useState(0);`,
  );
}
if (!recovery.includes("JOY_HANDWRITTEN_RECOVERY_FIXES_V1_APPLIED")) {
  if (!recovery.includes("const runCharges =")) {
    recovery = recovery.replace(
      `  const [bulkVouchers, setBulkVouchers] = useState(false);`,
      `  const [bulkVouchers, setBulkVouchers] = useState(false);
  // JOY_HANDWRITTEN_RECOVERY_FIXES_V1_APPLIED
  const runCharges = run
    ? charges.filter((charge) => charge.runId === run.id)
    : [];
  const entries = run
    ? data.recoveryEntries.filter((entry) => entry.runId === run.id)
    : [];
  const finalizations = run
    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)
    : [];
  const recoveryVendorRoomIds = new Set(
    data.accommodationRooms
      .filter((room) => room.vendorId === vendorId)
      .map((room) => room.id),
  );
  const recoveryRoomEntries = data.roomExpenses.filter((expense) =>
    recoveryVendorRoomIds.has(expense.roomId),
  );`,
    );
  } else {
    recovery = recovery.replace(
      `  const [bulkVouchers, setBulkVouchers] = useState(false);`,
      `  const [bulkVouchers, setBulkVouchers] = useState(false);
  // JOY_HANDWRITTEN_RECOVERY_FIXES_V1_APPLIED`,
    );
  }

  recovery = recovery.replace(
    `      const individual = datedDeduction > 0 ? datedDeduction : legacyIndividual;`,
    `      // accommodationCharges is the authoritative merged ledger. Dated
      // entries are its audit detail; replacing the ledger with only dated
      // rows drops room rent and caused ₹10,450 to print as ₹9,250.
      const individual = legacyIndividual;`,
  );
  recovery = recovery.replaceAll(
    "const individual = datedDeduction > 0 ? datedDeduction : legacyIndividual;",
    "const individual = legacyIndividual;",
  );

  recovery = recovery.replace(
    `  const roomPrintRooms = [...new Set([`,
    `  const roomPeriodTotals = roomRows.reduce(
    (totals, { expense }) => ({
      gas: totals.gas + expense.gasAmount,
      ration: totals.ration + expense.rationAmount,
      provision: totals.provision + expense.provisionAmount,
      overall:
        totals.overall +
        expense.gasAmount +
        expense.rationAmount +
        expense.provisionAmount,
      finalized:
        totals.finalized +
        (expense.status === "finalized"
          ? expense.gasAmount + expense.rationAmount + expense.provisionAmount
          : 0),
      draft:
        totals.draft +
        (expense.status === "draft"
          ? expense.gasAmount + expense.rationAmount + expense.provisionAmount
          : 0),
    }),
    { gas: 0, ration: 0, provision: 0, overall: 0, finalized: 0, draft: 0 },
  );
  const roomRecoveryDateTotals = Object.values(
    roomRows.reduce<
      Record<
        string,
        {
          date: string;
          status: string;
          gas: number;
          ration: number;
          provision: number;
          overall: number;
        }
      >
    >((totals, { expense }) => {
      for (const [date, component, amount] of [
        [expense.gasDate ?? \`${"${expense.payPeriod}"}-01\`, "gas", expense.gasAmount],
        [expense.rationDate ?? \`${"${expense.payPeriod}"}-01\`, "ration", expense.rationAmount],
        [expense.provisionDate ?? \`${"${expense.payPeriod}"}-01\`, "provision", expense.provisionAmount],
      ] as const) {
        if (amount <= 0) continue;
        const key = \`${"${date}"}|${"${expense.status}"}\`;
        totals[key] ??= {
          date,
          status: expense.status,
          gas: 0,
          ration: 0,
          provision: 0,
          overall: 0,
        };
        totals[key][component] += amount;
        totals[key].overall += amount;
      }
      return totals;
    }, {}),
  ).sort((left, right) =>
    left.date === right.date
      ? left.status.localeCompare(right.status)
      : left.date.localeCompare(right.date),
  );
  const roomPrintRooms = [...new Set([`,
  );

  recovery = recovery.replace(
    `    <div className="section-stack">
      {(canManage || canApprove) ? (`,
    `    <div className="section-stack">
      <section className="panel table-panel recovery-overview-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Room-wise recovery overview</span>
            <h2>Gas, Ration &amp; Provision totals · {recoveryPreviewPeriod}</h2>
          </div>
          <span className="muted-label">
            {roomRows.length} dated room entr{roomRows.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="room-recovery-summary room-recovery-period-summary">
          <div><span>Gas overall</span><strong>₹{roomPeriodTotals.gas.toFixed(2)}</strong></div>
          <div><span>Ration overall</span><strong>₹{roomPeriodTotals.ration.toFixed(2)}</strong></div>
          <div><span>Provision overall</span><strong>₹{roomPeriodTotals.provision.toFixed(2)}</strong></div>
          <div><span>Overall room recovery</span><strong>₹{roomPeriodTotals.overall.toFixed(2)}</strong></div>
          <div><span>Finalized</span><strong>₹{roomPeriodTotals.finalized.toFixed(2)}</strong></div>
          <div><span>Draft</span><strong>₹{roomPeriodTotals.draft.toFixed(2)}</strong></div>
        </div>
        {roomRecoveryDateTotals.length ? (
          <div className="table-scroll">
            <table className="data-table room-recovery-date-summary">
              <thead><tr><th>Date</th><th>Status</th><th>Gas</th><th>Ration</th><th>Provision</th><th>Overall</th></tr></thead>
              <tbody>
                {roomRecoveryDateTotals.map((row) => (
                  <tr key={\`${"${row.date}"}-${"${row.status}"}\`}>
                    <td><strong>{row.date}</strong></td><td>{row.status}</td>
                    <td>₹{row.gas.toFixed(2)}</td><td>₹{row.ration.toFixed(2)}</td>
                    <td>₹{row.provision.toFixed(2)}</td><td><strong>₹{row.overall.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="form-note">No room-wise Gas, Ration or Provision is recorded for this salary cycle.</p>
        )}
      </section>
      {(canManage || canApprove) ? (`,
  );

  recovery = recovery.replace(
    `      const provision = roomEmployees.length
        ? roomEmployees.reduce((sum, row) => sum + (row.charge?.provisionShare ?? 0), 0)
        : finalizedRoomRow?.expense.provisionAmount ?? 0;`,
    `      const provision = roomEmployees.length
        ? roomEmployees.reduce((sum, row) => sum + row.provisionShare, 0)
        : finalizedRoomRow?.expense.provisionAmount ?? 0;
      const roomTotalRecovery = roomEmployees.reduce((sum, row) => sum + row.total, 0);
      const roomReturnTotal = roomEmployees.reduce(
        (sum, row) => sum + (row.charge?.returnAmount ?? 0),
        0,
      );
      const roomFinalPayableTotal = roomEmployees.reduce(
        (sum, row) =>
          sum + Math.max(0, (row.item?.netPayable ?? 0) - row.pendingShared),
        0,
      );
      const roomPreRecoveryTotal = roomEmployees.reduce(
        (sum, row) =>
          sum +
          ((row.item?.netPayable ?? 0) +
            (row.item?.accommodationDeduction ?? 0) -
            (row.item?.returnAmount ?? 0)),
        0,
      );`,
  );
  recovery = recovery.replace(
    `summary.innerHTML = \`<div><span>Gas</span><strong>₹${"${gas.toFixed(2)}"}</strong></div><div><span>Ration</span><strong>₹${"${ration.toFixed(2)}"}</strong></div><div><span>Provision</span><strong>₹${"${provision.toFixed(2)}"}</strong></div><div><span>Roommates</span><strong>${"${roommates}"}</strong></div><div><span>Shared total</span><strong>₹${"${(gas + ration + provision).toFixed(2)}"}</strong></div>\`;`,
    `summary.innerHTML = \`<div><span>Gas</span><strong>₹${"${gas.toFixed(2)}"}</strong></div><div><span>Ration</span><strong>₹${"${ration.toFixed(2)}"}</strong></div><div><span>Provision</span><strong>₹${"${provision.toFixed(2)}"}</strong></div><div><span>Roommates</span><strong>${"${roommates}"}</strong></div><div><span>Shared total</span><strong>₹${"${(gas + ration + provision).toFixed(2)}"}</strong></div><div><span>Total recovery</span><strong>₹${"${roomTotalRecovery.toFixed(2)}"}</strong></div>\`;`,
  );
  recovery = recovery.replace(
    `        const header = clone.tHead?.rows[0];
        if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);
        sheet.appendChild(clone);`,
    `        const header = clone.tHead?.rows[0];
        if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);
        const printableHeaders = Array.from(header?.cells ?? []).map(
          (cell) => cell.textContent?.trim() ?? "",
        );
        const printableEmployeeIndex = printableHeaders.findIndex((label) => label === "Employee");
        if (header && printableEmployeeIndex >= 0)
          header.cells[printableEmployeeIndex].textContent = "Employee / Punching No.";
        const footer = clone.createTFoot();
        const totalRow = footer.insertRow();
        printableHeaders.forEach((label) => {
          const cell = totalRow.insertCell();
          if (label === "#") cell.textContent = "TOTAL";
          else if (label === "Employee") cell.textContent = \`ROOM ${"${roomName}"} TOTAL\`;
          else if (label === "Room") cell.textContent = roomName;
          else if (label === "Net before recovery") cell.textContent = \`₹${"${roomPreRecoveryTotal.toFixed(2)}"}\`;
          else if (label === "Gas") cell.textContent = \`₹${"${gas.toFixed(2)}"}\`;
          else if (label === "Ration") cell.textContent = \`₹${"${ration.toFixed(2)}"}\`;
          else if (label === "Provision") cell.textContent = \`₹${"${provision.toFixed(2)}"}\`;
          else if (label === "Total recovery") cell.textContent = \`₹${"${roomTotalRecovery.toFixed(2)}"}\`;
          else if (label === "Return") cell.textContent = \`₹${"${roomReturnTotal.toFixed(2)}"}\`;
          else if (label === "Final payable") cell.textContent = \`₹${"${roomFinalPayableTotal.toFixed(2)}"}\`;
        });
        sheet.appendChild(clone);`,
  );

  recovery = recovery.replace(
    `    if (charge.provisionShare)
      lines.push(["Provision share", charge.provisionShare]);
  }
  return (`,
    `    if (charge.provisionShare)
      lines.push(["Provision share", charge.provisionShare]);
  }
  const voucherTotal = lines.reduce((sum, [, value]) => sum + value, 0);
  return (`,
  );
  recovery = recovery.replace(
    `              {lines.map(([label, value], index) => (
                <tr key={\`${"${label}"}-${"${index}"}\`}>
                  <td>{label}</td>
                  <td>₹{value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>`,
    `              {lines.map(([label, value], index) => (
                <tr key={\`${"${label}"}-${"${index}"}\`}>
                  <td>{label}</td>
                  <td>₹{value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th>Total recovery</th><th>₹{voucherTotal.toFixed(2)}</th></tr></tfoot>
          </table>`,
  );
  recovery = recovery.replace(
    `            if (charge?.provisionShare)
              lines.push(["Provision share", charge.provisionShare]);
            return (`,
    `            if (charge?.provisionShare)
              lines.push(["Provision share", charge.provisionShare]);
            const voucherTotal = lines.reduce((sum, [, value]) => sum + value, 0);
            return (`,
  );
  recovery = recovery.replace(
    `                    {lines.map(([label, value], index) => (
                      <tr key={\`${"${label}"}-${"${index}"}\`}>
                        <td>{label}</td>
                        <td>₹{value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>`,
    `                    {lines.map(([label, value], index) => (
                      <tr key={\`${"${label}"}-${"${index}"}\`}>
                        <td>{label}</td>
                        <td>₹{value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th>Total recovery</th><th>₹{voucherTotal.toFixed(2)}</th></tr></tfoot>
                </table>`,
  );
}

for (const [marker, message] of [
  ["Employee-wise recovery by date", "Employee-wise Recovery control is missing"],
  ["Room-wise recovery", "Room-wise Recovery control is missing"],
  ["Individual deduction voucher", "Individual deduction voucher control is missing"],
  ["roomRecoveryDate", "Room recovery date control is missing"],
]) {
  if (!recovery.includes(marker)) throw new Error(message);
}
if (
  !recovery.includes(`{(canManage || canApprove) ? (
        <form`)
)
  throw new Error("Employee-wise Recovery is still hidden without a payroll run");
if (!recovery.includes("Save dated room recovery entry for {roomRecoveryPeriod}"))
  throw new Error("Room-wise Recovery cannot save the selected date");
if (recovery.includes('type={run.status === "approved" ? "button" : "submit"}'))
  throw new Error("Employee-wise Recovery still crashes without a payroll run");
if (
  !recovery.includes(": isActing || !run || !employeeId || amount <= 0") &&
  !recovery.includes("disabled={isActing || !run || !employeeId || amount <= 0}")
)
  throw new Error("Employee-wise Recovery is not disabled before payroll creation");
if (!recovery.includes("const individual = legacyIndividual"))
  throw new Error("Employee recovery statement still drops non-dated recovery components");
if (!recovery.includes("Overall room recovery"))
  throw new Error("Room recovery period and date totals were not added");
if (!recovery.includes("ROOM ${roomName} TOTAL"))
  throw new Error("Room statement reconciled total row was not added");
if (!recovery.includes("Total recovery</th><th>₹{voucherTotal.toFixed(2)}"))
  throw new Error("Individual deduction voucher total was not added");

await writeFile(recoveryPath, recovery, "utf8");

const payrollAppPath = join(root, "app/payroll-app.tsx");
let payrollApp = await readFile(payrollAppPath, "utf8");

// JOY_PAYSLIP_HIDE_ROOM_RECOVERY_V1
// Room/accommodation recovery remains part of Final Payable and bank payment,
// but its label and breakup belong only to Recovery statements and vouchers.
// Preserve the configured company/employer payslip header unchanged.
if (!payrollApp.includes("const payslipHiddenRecoveryFields")) {
  payrollApp = payrollApp.replace(
    `  const deductions = configuredFields(
    unit.payslipDeductionsJson,
    deductionFields,
  ).map(`,
    `  const payslipHiddenRecoveryFields = new Set([
    "accommodationDeduction",
    "gasShare",
    "rationShare",
    "provisionShare",
  ]);
  const deductions = configuredFields(
    unit.payslipDeductionsJson,
    deductionFields,
  )
    .filter((field) => !payslipHiddenRecoveryFields.has(field))
    .map(`,
  );
}
if (!payrollApp.includes("vendorId={activeVendorId}\n              employees={data.employees.filter")) {
  payrollApp = payrollApp.replace(
    `              run={currentRun}
              employees={currentEmployees}
              items={currentItems}`,
    `              run={currentRun}
              vendorId={activeVendorId}
              employees={data.employees.filter(
                (employee) => employee.vendorId === activeVendorId,
              )}
              items={currentItems}`,
  );
}
if (!payrollApp.includes("vendorId={activeVendorId}\n              employees={data.employees.filter"))
  throw new Error("Recovery must receive all visible employees for the selected group company");
if (!payrollApp.includes("const payslipHiddenRecoveryFields"))
  throw new Error("Room-wise recovery is still exposed in the payslip");
if (!payrollApp.includes("const employerTitle = unit.payslipTitle ?? unit.clientName"))
  throw new Error("The configured payslip header was not preserved");
if (!recovery.includes("const recoveryPreviewPeriod"))
  throw new Error("Recovery preview period was not added");
if (!recovery.includes("JOY_RECOVERY_SCOPE_MAPPING_V2"))
  throw new Error("Recovery category concepts are not mapped to real accommodation type IDs");
if (recovery.includes("accommodationTypeId === roomRecoveryScope"))
  throw new Error("Recovery category labels are still compared directly with master IDs");
if (
  !recovery.includes("Draft room-share preview") &&
  !recovery.includes("Draft room share")
)
  throw new Error("Employee room-share component detail was not added");

// JOY_HANDWRITTEN_PAYSLIP_PAYMENT_FIXES_V1
// The payslip reports salary earnings/statutory deductions only. Recovery
// remains in item.netPayable for Final Payable and every bank format. Bank
// downloads reserve the selected employees atomically in one click so the
// same salary cannot be exported twice.
if (!payrollApp.includes("JOY_HANDWRITTEN_PAYSLIP_PAYMENT_FIXES_V1_APPLIED")) {
  const payslipStart = payrollApp.indexOf("function PayslipSheet(");
  const payslipEnd = payrollApp.indexOf("function PayslipModal(", payslipStart);
  if (payslipStart < 0 || payslipEnd < 0)
    throw new Error("Payslip component was not found");
  let payslipSheet = payrollApp.slice(payslipStart, payslipEnd);
  payslipSheet = payslipSheet.replace(
    `  const range = run`,
    `  // JOY_HANDWRITTEN_PAYSLIP_PAYMENT_FIXES_V1_APPLIED
  const payslipTotalDeductions = Math.max(
    0,
    item.totalDeductions - item.accommodationDeduction,
  );
  const payslipNetPayable = Math.max(
    0,
    item.netPayable + item.accommodationDeduction - item.returnAmount,
  );
  const range = run`,
  );
  payslipSheet = payslipSheet.replace(
    `<b>{money(item.totalDeductions)}</b>`,
    `<b>{money(payslipTotalDeductions)}</b>`,
  );
  payslipSheet = payslipSheet.replace(
    `<strong>{money(item.netPayable)}</strong>`,
    `<strong>{money(payslipNetPayable)}</strong>`,
  );
  payslipSheet = payslipSheet.replace(
    `numberToWordsIndian(Math.round(item.netPayable))`,
    `numberToWordsIndian(Math.round(payslipNetPayable))`,
  );
  payrollApp =
    payrollApp.slice(0, payslipStart) +
    payslipSheet +
    payrollApp.slice(payslipEnd);

  const mailerStart = payrollApp.indexOf("function PayslipModal(");
  const mailerEnd = payrollApp.indexOf("function BulkPayslipModal(", mailerStart);
  if (mailerStart < 0 || mailerEnd < 0)
    throw new Error("Payslip email component was not found");
  let payslipModal = payrollApp.slice(mailerStart, mailerEnd);
  payslipModal = payslipModal.replace(
    `    if (!employee?.emailAddress || !run?.id || run.status !== "approved" || emailSending) return;
    setEmailSending(true);
    setEmailSent(false);
    setEmailMessage("");`,
    `    if (emailSending) return;
    setEmailSent(false);
    if (!employee?.emailAddress) {
      setEmailMessage("Add Employee Email ID in Employee Master before sending the salary slip.");
      return;
    }
    if (!run?.id || run.status !== "approved") {
      setEmailMessage("Approve payroll before sending salary slips.");
      return;
    }
    setEmailSending(true);
    setEmailMessage("");`,
  );
  payslipModal = payslipModal.replace(
    `disabled={!employee?.emailAddress || emailSending || run?.status !== "approved"}`,
    `disabled={emailSending}`,
  );
  payrollApp =
    payrollApp.slice(0, mailerStart) +
    payslipModal +
    payrollApp.slice(mailerEnd);

  const paymentsStart = payrollApp.indexOf("function PaymentsView(");
  const nextTopLevelFunction = payrollApp
    .slice(paymentsStart + 20)
    .search(/\nfunction [A-Za-z]/);
  const paymentsEnd =
    nextTopLevelFunction >= 0
      ? paymentsStart + 20 + nextTopLevelFunction + 1
      : payrollApp.length;
  if (paymentsStart < 0 || paymentsEnd < 0)
    throw new Error("Payments component was not found");
  let payments = payrollApp.slice(paymentsStart, paymentsEnd);
  payments = payments.replace(
    `  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedPaymentIds((current) => {
      const valid = current.filter((id) => bankItems.some((item) => item.id === id));
      return valid.length ? valid : bankItems.map((item) => item.id);
    });
  }, [run.id, items]);`,
    `  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [paymentSelectionLocked, setPaymentSelectionLocked] = useState(false);
  const [paymentAccommodationFilter, setPaymentAccommodationFilter] = useState("");
  const paymentSelectionStorageKey = \`joy-payment-selection:${"${run.id}"}\`;
  const bankItemKey = bankItems.map((item) => item.id).join("|");
  const paymentAccommodationTypes = [...new Set(
    bankItems.map((item) => item.accommodationType).filter(Boolean),
  )].sort();
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(paymentSelectionStorageKey) ?? "null",
      ) as { ids?: string[]; locked?: boolean } | null;
      const valid = (saved?.ids ?? []).filter((id) =>
        bankItems.some((item) => item.id === id),
      );
      if (saved?.locked && valid.length) {
        setSelectedPaymentIds(valid);
        setPaymentSelectionLocked(true);
        return;
      }
    } catch {
      window.localStorage.removeItem(paymentSelectionStorageKey);
    }
    setSelectedPaymentIds([]);
    setPaymentSelectionLocked(false);
  }, [run.id, bankItemKey]);
  function selectPaymentIds(ids: string[]) {
    if (paymentSelectionLocked) return;
    setSelectedPaymentIds([...new Set(ids)]);
    window.localStorage.removeItem(paymentSelectionStorageKey);
  }
  function lockPaymentSelection() {
    if (
      run.status !== "approved" ||
      !canExport ||
      !selectedPaymentIds.length ||
      bankValidationIssues.length
    ) return;
    window.localStorage.setItem(
      paymentSelectionStorageKey,
      JSON.stringify({ ids: selectedPaymentIds, locked: true }),
    );
    setPaymentSelectionLocked(true);
  }
  function unlockPaymentSelection() {
    window.localStorage.removeItem(paymentSelectionStorageKey);
    setPaymentSelectionLocked(false);
  }`,
  );
  payments = payments.replace(
    `  function exportRows(mode: "bank" | "cash") {
    const rows = mode === "bank" ? selectedBankItems : cashItems;`,
    `  function exportRows(mode: "bank" | "cash") {
    if (mode === "bank" && (!paymentSelectionLocked || run.status !== "approved")) return;
    const rows = mode === "bank" ? selectedBankItems : cashItems;`,
  );
  for (const name of ["exportIndianBank", "exportCubAnyBank", "exportCubToCub"]) {
    payments = payments.replace(
      `  function ${"${name}"}() {`,
      `  function ${"${name}"}() {
    if (!paymentSelectionLocked || run.status !== "approved") return;`,
    );
  }
  payments = payments.replace(
    `disabled={run.status !== "approved" || !canExport}`,
    `disabled={run.status !== "approved" || !canExport || !paymentSelectionLocked || !selectedBankItems.length || bankValidationIssues.length > 0}`,
  );
  payments = payments.replace(
    `          <div className="record-actions">
            <button className="secondary-button" type="button" onClick={() => setSelectedPaymentIds(bankItems.map((item) => item.id))}>Select all</button>
            <button className="secondary-button" type="button" onClick={() => setSelectedPaymentIds([])}>Clear selection</button>
          </div>`,
    `          <div className="record-actions payment-selection-controls">
            <select
              aria-label="Select employees by accommodation type"
              value={paymentAccommodationFilter}
              disabled={paymentSelectionLocked}
              onChange={(event) => {
                const value = event.target.value;
                setPaymentAccommodationFilter(value);
                selectPaymentIds(
                  value
                    ? bankItems.filter((item) => item.accommodationType === value).map((item) => item.id)
                    : [],
                );
              }}
            >
              <option value="">Accommodation-wise selection</option>
              {paymentAccommodationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <button className="secondary-button" type="button" disabled={paymentSelectionLocked} onClick={() => { setPaymentAccommodationFilter(""); selectPaymentIds(bankItems.map((item) => item.id)); }}>Select all</button>
            <button className="secondary-button" type="button" disabled={paymentSelectionLocked} onClick={() => { setPaymentAccommodationFilter(""); selectPaymentIds([]); }}>Clear selection</button>
            {paymentSelectionLocked ? (
              <button className="secondary-button" type="button" onClick={unlockPaymentSelection}>Unlock / change selection</button>
            ) : (
              <button className="primary-button" type="button" disabled={run.status !== "approved" || !canExport || !selectedBankItems.length || bankValidationIssues.length > 0} onClick={lockPaymentSelection}>Lock selected batch</button>
            )}
          </div>`,
  );
  payments = payments.replace(
    `<td><input type="checkbox" checked={selectedPaymentIds.includes(item.id)} onChange={(event) => setSelectedPaymentIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} /></td>`,
    `<td><input type="checkbox" disabled={paymentSelectionLocked} checked={selectedPaymentIds.includes(item.id)} onChange={(event) => selectPaymentIds(event.target.checked ? [...selectedPaymentIds, item.id] : selectedPaymentIds.filter((id) => id !== item.id))} /></td>`,
  );
  payments = payments.replace(
    `<div className="form-note"><strong>{selectedBankItems.length} employees selected</strong><span>Batch total: {money(selectedBankItems.reduce((sum, item) => sum + item.netPayable, 0))}</span><span>{bankValidationIssues.length ? \`${"${bankValidationIssues.length}"} employee(s) need bank account / IFSC before download.\` : "Bank validation complete · upload formats ready."}</span></div>`,
    `<div className="form-note"><strong>{selectedBankItems.length} employees selected · {paymentSelectionLocked ? "Selection locked" : "Lock required"}</strong><span>Batch total: {money(selectedBankItems.reduce((sum, item) => sum + item.netPayable, 0))}</span><span>{bankValidationIssues.length ? \`${"${bankValidationIssues.length}"} employee(s) need bank account / IFSC before download.\` : paymentSelectionLocked ? "Bank validation complete · locked upload formats ready." : "Review the employee batch, then lock it before downloading."}</span></div>`,
  );
  payments = payments.replaceAll(
    `disabled={!selectedBankItems.length || bankValidationIssues.length > 0 || !canExport}`,
    `disabled={run.status !== "approved" || !paymentSelectionLocked || !selectedBankItems.length || bankValidationIssues.length > 0 || !canExport}`,
  );
  payments = payments.replace(
    `exports are available for authorized checking, but use the file for payment only after payroll approval.`,
    `bank outputs remain locked until payroll approval and an explicit employee-batch selection lock.`,
  );
  payments = payments.replace(
    `Bank, cash and payslip outputs are now available.`,
    `Select the employees (or an accommodation group), review the total, and lock the batch before downloading a bank file.`,
  );
  payrollApp =
    payrollApp.slice(0, paymentsStart) +
    payments +
    payrollApp.slice(paymentsEnd);
}

// The SMTP/email fixer can run before this script and leave a silent early
// return. Keep the prerequisite feedback present even when the payslip
// payment marker was already generated in an earlier build.
if (!payrollApp.includes("Approve payroll before sending salary slips.")) {
  const modalStart = payrollApp.indexOf("function PayslipModal(");
  const modalEnd = payrollApp.indexOf("function BulkPayslipModal(", modalStart);
  if (modalStart >= 0 && modalEnd > modalStart) {
    let payslipModal = payrollApp.slice(modalStart, modalEnd);
    payslipModal = payslipModal.replace(
      `    if (!employee?.emailAddress || !run?.id || run.status !== "approved" || emailSending) return;
    setEmailSending(true);
    setEmailSent(false);
    setEmailMessage("");`,
      `    if (emailSending) return;
    setEmailSent(false);
    if (!employee?.emailAddress) {
      setEmailMessage("Add Employee Email ID in Employee Master before sending the salary slip.");
      return;
    }
    if (!run?.id || run.status !== "approved") {
      setEmailMessage("Approve payroll before sending salary slips.");
      return;
    }
    setEmailSending(true);
    setEmailMessage("");`,
    );
    payrollApp =
      payrollApp.slice(0, modalStart) +
      payslipModal +
      payrollApp.slice(modalEnd);
  }
}

if (!payrollApp.includes("const payslipNetPayable"))
  throw new Error("Room recovery is still included in the displayed payslip net");
if (!payrollApp.includes("Approve payroll before sending salary slips."))
  throw new Error("Payslip email prerequisites are still silent");
if (!payrollApp.includes("JOY_ONE_CLICK_BANK_EXPORT_V1"))
  throw new Error("One-click bank output reservation was not added");
if (!payrollApp.includes("const bankDownloadBlockReason"))
  throw new Error("Bank output prerequisites are still hidden from the user");
if (!payrollApp.includes("JOY_FUND_LIMITED_BANK_BATCH_V4"))
  throw new Error("Fund-limited employee-wise bank batching is missing");
if (!payrollApp.includes("No employee is selected automatically"))
  throw new Error("Bank downloads still risk silently selecting every employee");
if (!payrollApp.includes("Download selected batch"))
  throw new Error("Selected employee bank batch does not have a clear download action");
if (!payrollApp.includes("isDownloaded || isLocked || !formatEligible"))
  throw new Error("Downloaded employee selection is not visibly disabled");
if (payrollApp.includes("lock the batch before downloading a bank file"))
  throw new Error("Obsolete manual bank batch lock guidance is still visible");
const hasPersistentPaymentBatchGuard =
  payrollApp.includes("download-payment-batch") &&
  payrollApp.includes("itemIds: exportItems.map");
if (
  !hasPersistentPaymentBatchGuard &&
  !payrollApp.includes("!paymentSelectionLocked || run.status !== \"approved\"")
)
  throw new Error("Bank format downloads do not enforce duplicate prevention");

// JOY_PAYSLIP_UPLOADED_HEADERS_NONZERO_V1
// Salary-import runs use the uploaded payroll register's canonical headers,
// and payslips omit every zero/blank field instead of printing dashes.
if (!payrollApp.includes("JOY_PAYSLIP_UPLOADED_HEADERS_NONZERO_V1_APPLIED")) {
  const payslipStart = payrollApp.indexOf("function PayslipSheet(");
  const payslipEnd = payrollApp.indexOf("function PayslipModal(", payslipStart);
  if (payslipStart < 0 || payslipEnd < 0)
    throw new Error("Payslip component was not found for uploaded-header cleanup");
  let payslipSheet = payrollApp.slice(payslipStart, payslipEnd);
  const earningsStart = payslipSheet.indexOf("  const earnings =");
  const deductionsStart = payslipSheet.indexOf("  const payslipHiddenRecoveryFields", earningsStart);
  if (earningsStart < 0 || deductionsStart < 0)
    throw new Error("Payslip earning fields were not found");
  const earningsBlock = `  // JOY_PAYSLIP_UPLOADED_HEADERS_NONZERO_V1_APPLIED
  const uploadedEarningFieldOrder = [
    "basic", "da", "hra", "conveyance", "foodAllowance", "nightAllowance",
    "overtimeWages", "attendanceBonus", "arrears", "holidayWages",
    "productionIncentive", "medicalAllowance",
  ];
  const uploadedDeductionFieldOrder = [
    "pfDeduction", "esiDeduction", "professionalTax", "lwf", "canteen",
    "snacks", "tent", "advance", "otherDeduction", "tds", "medicalInsurance",
  ];
  const sourceEarningFields = run?.processingMode === "salary_import"
    ? uploadedEarningFieldOrder
    : configuredFields(unit.payslipEarningsJson, earningFields);
  const sourceDeductionFields = run?.processingMode === "salary_import"
    ? uploadedDeductionFieldOrder
    : configuredFields(unit.payslipDeductionsJson, deductionFields);
  const earnings = sourceEarningFields
    .map(
      (field) =>
        [readableField(field), Number(item[field as keyof PayrollItem] ?? 0)] as [
          string,
          number,
        ],
    )
    .filter(([, value]) => value !== 0);
  const uploadedAttendanceHeaders = [
    ["Fixed W days", item.fixedWorkingDays],
    ["W days", item.presentDays],
    ["NFH", item.nfhDays],
    ["CO", item.compOffDays],
    ["OD", item.onDutyDays],
    ["Sundays", item.sundayDays],
    ["PL", item.plDays],
    ["CL", item.clDays],
    ["SL", item.slDays],
    ["Payable days", item.payableDays],
    ["OT hours", item.overtimeHours],
  ].filter(([, value]) => Number(value) !== 0) as Array<[string, number]>;
  `;
  payslipSheet =
    payslipSheet.slice(0, earningsStart) +
    earningsBlock +
    payslipSheet.slice(deductionsStart);
  const hiddenStart = payslipSheet.indexOf("  const payslipHiddenRecoveryFields");
  const rangeStart = payslipSheet.indexOf("  const range = run", hiddenStart);
  const deductionsBlock = `  const payslipHiddenRecoveryFields = new Set([
    "accommodationDeduction",
    "gasShare",
    "rationShare",
    "provisionShare",
  ]);
  const deductions = sourceDeductionFields
    .filter((field) => !payslipHiddenRecoveryFields.has(field))
    .map(
      (field) =>
        [readableField(field), Number(item[field as keyof PayrollItem] ?? 0)] as [
          string,
          number,
        ],
    )
    .filter(([, value]) => value !== 0);
  const payslipTotalDeductions = Math.max(
    0,
    item.totalDeductions - item.accommodationDeduction,
  );
  const payslipNetPayable = Math.max(
    0,
    item.netPayable + item.accommodationDeduction - item.returnAmount,
  );
`;
  if (hiddenStart < 0 || rangeStart < 0)
    throw new Error("Payslip deduction fields were not found");
  payslipSheet =
    payslipSheet.slice(0, hiddenStart) +
    deductionsBlock +
    payslipSheet.slice(rangeStart);

  payslipSheet = payslipSheet.replace(
    `        <div className="payslip-attendance-inline">
          <span><b>Fixed W days</b> {item.fixedWorkingDays}</span>
          <span><b>W days</b> {item.presentDays}</span>
          <span><b>NFH</b> {item.nfhDays}</span>
          <span><b>CO</b> {item.compOffDays}</span>
          <span><b>OD</b> {item.onDutyDays}</span>
          <span><b>Sundays</b> {item.sundayDays}</span>
          <span><b>PL</b> {item.plDays}</span>
          <span><b>CL</b> {item.clDays}</span>
          <span><b>SL</b> {item.slDays}</span>
          <span><b>Payable days</b> {item.payableDays}</span>
          <span><b>OT hours</b> {item.overtimeHours}</span>
        </div>`,
    `        {uploadedAttendanceHeaders.length ? (
          <div className="payslip-attendance-inline">
            {uploadedAttendanceHeaders.map(([label, value]) => (
              <span key={label}><b>{label}</b> {value}</span>
            ))}
          </div>
        ) : null}`,
  );
  const optionalMeta = [
    [
      `<div>\n          <span>UAN / EPF</span>\n          <strong>{employee?.uanMasked ?? "—"}</strong>\n        </div>`,
      `{employee?.uanMasked ? (\n          <div>\n            <span>UAN / EPF</span>\n            <strong>{employee.uanMasked}</strong>\n          </div>\n        ) : null}`,
    ],
    [
      `<div>\n          <span>ESI number</span>\n          <strong>{employee?.esiMasked ?? "—"}</strong>\n        </div>`,
      `{employee?.esiMasked ? (\n          <div>\n            <span>ESI number</span>\n            <strong>{employee.esiMasked}</strong>\n          </div>\n        ) : null}`,
    ],
    [
      `<div>\n          <span>Bank account</span>\n          <strong>{employee?.bankAccountMasked ?? item.bankAccountMasked ?? "—"}</strong>\n        </div>`,
      `{(employee?.bankAccountMasked ?? item.bankAccountMasked) ? (\n          <div>\n            <span>Bank account</span>\n            <strong>{employee?.bankAccountMasked ?? item.bankAccountMasked}</strong>\n          </div>\n        ) : null}`,
    ],
    [
      `<div>\n          <span>IFSC</span>\n          <strong>{employee?.ifscMasked ?? item.ifscMasked ?? "—"}</strong>\n        </div>`,
      `{(employee?.ifscMasked ?? item.ifscMasked) ? (\n          <div>\n            <span>IFSC</span>\n            <strong>{employee?.ifscMasked ?? item.ifscMasked}</strong>\n          </div>\n        ) : null}`,
    ],
    [
      `<div>\n          <span>Bank name</span>\n          <strong>{employee?.bankName ?? "—"}</strong>\n        </div>`,
      `{employee?.bankName ? (\n          <div>\n            <span>Bank name</span>\n            <strong>{employee.bankName}</strong>\n          </div>\n        ) : null}`,
    ],
    [
      `<div>\n          <span>Bank branch</span>\n          <strong>{employee?.bankBranch ?? "—"}</strong>\n        </div>`,
      `{employee?.bankBranch ? (\n          <div>\n            <span>Bank branch</span>\n            <strong>{employee.bankBranch}</strong>\n          </div>\n        ) : null}`,
    ],
  ];
  for (const [from, to] of optionalMeta) payslipSheet = payslipSheet.replace(from, to);
  payslipSheet = payslipSheet.replace(
    `      {item.importedGrossEarnings !== null || item.importedNetPayable !== null ? (`,
    `      {([item.importedGrossEarnings, item.importedTotalDeductions, item.importedNetPayable].some((value) => value !== null && Number(value) !== 0)) ? (`,
  );
  payslipSheet = payslipSheet.replace(
    `          <footer>\n            <span>Total deductions</span>\n            <b>{money(payslipTotalDeductions)}</b>\n          </footer>`,
    `          {payslipTotalDeductions > 0 ? (\n            <footer>\n              <span>Total deductions</span>\n              <b>{money(payslipTotalDeductions)}</b>\n            </footer>\n          ) : null}`,
  );
  payslipSheet = payslipSheet.replace(
    `        <section>\n          <h4>\n            <span>Earnings</span>`,
    `        {earnings.length ? (\n          <section>\n            <h4>\n              <span>Earnings</span>`,
  );
  payslipSheet = payslipSheet.replace(
    `          </footer>\n        </section>\n        <section>\n          <h4>\n            <span>Deductions</span>`,
    `            </footer>\n          </section>\n        ) : null}\n        {deductions.length || payslipTotalDeductions > 0 ? (\n          <section>\n            <h4>\n              <span>Deductions</span>`,
  );
  payslipSheet = payslipSheet.replace(
    `          {payslipTotalDeductions > 0 ? (\n            <footer>\n              <span>Total deductions</span>\n              <b>{money(payslipTotalDeductions)}</b>\n            </footer>\n          ) : null}\n        </section>`,
    `            {payslipTotalDeductions > 0 ? (\n              <footer>\n                <span>Total deductions</span>\n                <b>{money(payslipTotalDeductions)}</b>\n              </footer>\n            ) : null}\n          </section>\n        ) : null}`,
  );
  payrollApp =
    payrollApp.slice(0, payslipStart) +
    payslipSheet +
    payrollApp.slice(payslipEnd);
}

// Repair salary-only totals if an older generated PayslipSheet already has
// the uploaded-header marker but lost these declarations during replacement.
if (!payrollApp.includes("const payslipTotalDeductions")) {
  const payslipStart = payrollApp.indexOf("function PayslipSheet");
  if (payslipStart >= 0) {
    const nextTopLevelFunction = payrollApp
      .slice(payslipStart + 20)
      .search(/\nfunction [A-Za-z]/);
    const payslipEnd =
      nextTopLevelFunction >= 0
        ? payslipStart + 20 + nextTopLevelFunction + 1
        : payrollApp.length;
    let payslipSheet = payrollApp.slice(payslipStart, payslipEnd);
    const salaryOnlyTotals = `  const payslipTotalDeductions = Math.max(
    0,
    item.totalDeductions - item.accommodationDeduction,
  );
  const payslipNetPayable = Math.max(
    0,
    item.netPayable + item.accommodationDeduction - item.returnAmount,
  );
`;
    const rangeMarker = "  const range = run";
    const rangeAt = payslipSheet.indexOf(rangeMarker);
    if (rangeAt >= 0) {
      payslipSheet =
        payslipSheet.slice(0, rangeAt) +
        salaryOnlyTotals +
        payslipSheet.slice(rangeAt);
      payrollApp =
        payrollApp.slice(0, payslipStart) +
        payslipSheet +
        payrollApp.slice(payslipEnd);
    }
  }
}

if (!payrollApp.includes("uploadedEarningFieldOrder"))
  throw new Error("Payslip does not use uploaded payroll header order");
if (!payrollApp.includes(".filter(([, value]) => value !== 0)"))
  throw new Error("Payslip zero-value fields were not removed");
if (!payrollApp.includes("uploadedAttendanceHeaders.length ?"))
  throw new Error("Payslip zero-value attendance headers were not removed");

await writeFile(payrollAppPath, payrollApp, "utf8");

// JOY_READABLE_PAYSLIP_ROOM_PRINT_V1
// Keep the established A4 layouts, but replace the inherited 5-7pt document
// text with readable print sizes. This late-loaded stylesheet also overrides
// the older emergency 7pt room-statement rule in live-enhancements.ts.
const liveEnhancementsPath = join(root, "supabase-frontend/live-enhancements.ts");
let liveEnhancements = await readFile(liveEnhancementsPath, "utf8");
if (!liveEnhancements.includes("JOY_READABLE_PAYSLIP_ROOM_PRINT_V1")) {
  liveEnhancements += `

// JOY_READABLE_PAYSLIP_ROOM_PRINT_V1
const joyReadablePayrollPrintStyle = document.createElement("style");
joyReadablePayrollPrintStyle.dataset.joyReadablePayrollPrint = "true";
joyReadablePayrollPrintStyle.textContent = [
  ".payslip-sheet h2{font-size:24px!important;line-height:1.2!important}",
  ".payslip-sheet header strong{font-size:12px!important}",
  ".payslip-company h3{font-size:17px!important;line-height:1.25!important}",
  ".payslip-company p{font-size:11px!important;line-height:1.45!important}",
  ".payslip-company span{font-size:10px!important}",
  ".payslip-meta span{font-size:10px!important;line-height:1.25!important}",
  ".payslip-meta strong{font-size:12px!important;line-height:1.3!important}",
  ".payslip-columns h4{font-size:11px!important}",
  ".payslip-columns section>div{font-size:11px!important;line-height:1.3!important}",
  ".payslip-columns section>footer{font-size:12px!important}",
  ".payslip-net>div span{font-size:12px!important}",
  ".payslip-net>div strong{font-size:22px!important}",
  ".payslip-net p{font-size:11px!important;line-height:1.4!important}",
  ".payslip-net p span{font-size:10px!important}",
  ".payslip-footnote{font-size:10px!important;line-height:1.4!important}",
  ".payslip-meta .payslip-attendance-inline{font-size:11px!important}",
  "@media print{",
  ".payslip-sheet h2{font-size:18pt!important}",
  ".payslip-sheet header strong{font-size:9.5pt!important}",
  ".payslip-company h3{font-size:13pt!important}",
  ".payslip-company p{font-size:9pt!important;line-height:1.35!important}",
  ".payslip-company span{font-size:8.5pt!important}",
  ".payslip-meta span{font-size:8.5pt!important}",
  ".payslip-meta strong{font-size:10pt!important}",
  ".payslip-columns h4{font-size:9.5pt!important}",
  ".payslip-columns section>div{font-size:9.5pt!important;line-height:1.25!important}",
  ".payslip-columns section>footer{font-size:10pt!important}",
  ".payslip-net>div span{font-size:10.5pt!important}",
  ".payslip-net>div strong{font-size:17pt!important}",
  ".payslip-net p{font-size:9.5pt!important}",
  ".payslip-net p span{font-size:8.5pt!important}",
  ".payslip-footnote{font-size:9pt!important}",
  ".payslip-meta .payslip-attendance-inline{font-size:9pt!important}",
  ".room-recovery-print-sheet h1{font-size:20pt!important;line-height:1.15!important}",
  ".room-recovery-print-sheet h2{font-size:15pt!important;line-height:1.2!important}",
  ".room-recovery-print-sheet .room-recovery-summary span{font-size:9pt!important}",
  ".room-recovery-print-sheet .room-recovery-summary strong{font-size:11pt!important}",
  ".room-recovery-print-sheet table{font-size:8pt!important;line-height:1.15!important}",
  ".room-recovery-print-sheet th,.room-recovery-print-sheet td{font-size:8pt!important;line-height:1.15!important;padding:2.5px 2px!important}",
  ".room-recovery-print-sheet footer{font-size:11pt!important}",
  "}",
].join("\\n");
document.head.appendChild(joyReadablePayrollPrintStyle);
// END_JOY_READABLE_PAYSLIP_ROOM_PRINT_V1
`;
}
if (!liveEnhancements.includes("joyReadablePayrollPrintStyle"))
  throw new Error("Readable payslip and room-statement print sizes were not added");
if (!liveEnhancements.includes(".room-recovery-print-sheet table{font-size:8pt!important"))
  throw new Error("Room-wise salary recovery statement font was not increased");
if (!liveEnhancements.includes(".payslip-columns section>div{font-size:9.5pt!important"))
  throw new Error("Payslip body font was not increased");

// JOY_HANDWRITTEN_RECOVERY_PRINT_V1
// Let the React room printer build both selected-room and all-room sheets so
// the same reconciled totals are used. The older V4 all-room listener cloned
// rows before totals were added and is intentionally left as a no-op.
liveEnhancements = liveEnhancements.replace(
  /function joyRecoveryPrintAllRoomsV4\(\)\{(?:return;)?const panel[\s\S]*?\nfunction joyBuildAllRoomSheetsV4/,
  "function joyRecoveryPrintAllRoomsV4(){return;}\nfunction joyBuildAllRoomSheetsV4",
);
if (!liveEnhancements.includes("JOY_HANDWRITTEN_RECOVERY_PRINT_V1")) {
  liveEnhancements += `

// JOY_HANDWRITTEN_RECOVERY_PRINT_V1
const joyRecoveryReconciliationStyle = document.createElement("style");
joyRecoveryReconciliationStyle.dataset.joyRecoveryReconciliation = "true";
joyRecoveryReconciliationStyle.textContent = [
  ".room-recovery-period-summary{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}",
  ".room-recovery-date-summary th,.room-recovery-date-summary td{text-align:right}",
  ".room-recovery-date-summary th:first-child,.room-recovery-date-summary td:first-child,.room-recovery-date-summary th:nth-child(2),.room-recovery-date-summary td:nth-child(2){text-align:left}",
  ".payment-selection-controls select{min-width:220px}",
  ".payment-batch-selector input[type=checkbox]:disabled{cursor:not-allowed;opacity:.65}",
  "@media print{",
  ".room-recovery-print-sheet .room-recovery-summary{grid-template-columns:repeat(auto-fit,minmax(105px,1fr))!important}",
  ".room-recovery-print-sheet thead th:nth-child(2){min-width:130px!important}",
  ".room-recovery-print-sheet tbody td:nth-child(2) small{display:block!important;font-size:11pt!important;line-height:1.25!important;font-weight:900!important;letter-spacing:.35px!important;color:#0f172a!important;margin-top:2px!important}",
  ".room-recovery-print-sheet tfoot td{font-size:9pt!important;font-weight:900!important;background:#eef3f8!important;border-top:2px solid #334155!important}",
  "}",
].join("\\n");
document.head.appendChild(joyRecoveryReconciliationStyle);
// END_JOY_HANDWRITTEN_RECOVERY_PRINT_V1
`;
}
if (!liveEnhancements.includes("function joyRecoveryPrintAllRoomsV4(){return;}"))
  throw new Error("Legacy all-room printer still bypasses reconciled totals");
if (!liveEnhancements.includes("font-size:11pt!important;line-height:1.25!important;font-weight:900"))
  throw new Error("Punching number font was not enlarged on the room statement");
await writeFile(liveEnhancementsPath, liveEnhancements, "utf8");

console.log("Recovery visibility fixed: dated draft room entries now preview per employee before payroll creation.");

console.log("Enforced requested flow: Operational Master Room Category -> Hostel/Area creation, and date-first Add Recovery for Rooms.");
