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
  /const \[roomRecoveryDate, setRoomRecoveryDate\] = useState\([\s\S]*?\n  \);/,
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
if (
  !recovery.includes("Draft room-share preview") &&
  !recovery.includes("Draft room share")
)
  throw new Error("Employee room-share component detail was not added");

await writeFile(payrollAppPath, payrollApp, "utf8");
console.log("Recovery visibility fixed: dated draft room entries now preview per employee before payroll creation.");

console.log("Enforced requested flow: Operational Master Room Category -> Hostel/Area creation, and date-first Add Recovery for Rooms.");
