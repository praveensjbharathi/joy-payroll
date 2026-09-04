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

await writeFile(recoveryPath, recovery, "utf8");

const payrollAppPath = join(root, "app/payroll-app.tsx");
let payrollApp = await readFile(payrollAppPath, "utf8");
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
