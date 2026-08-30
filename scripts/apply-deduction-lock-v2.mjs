import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const file = join(root, path);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await writeFile(file, after, "utf8");
}
function required(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`Deduction-lock patch failed: ${label}`);
  return source.replace(oldText, newText);
}
function requiredRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Deduction-lock patch failed: ${label}`);
  return source.replace(pattern, replacement);
}

await patch("db/schema.ts", (source) => {
  source = required(
    source,
    `  issueCount: integer("issue_count").notNull().default(0),\n  approvedBy: text("approved_by"),`,
    `  issueCount: integer("issue_count").notNull().default(0),\n  deductionsStatus: text("deductions_status").notNull().default("open"),\n  deductionsLockedBy: text("deductions_locked_by"),\n  deductionsLockedAt: text("deductions_locked_at"),\n  approvedBy: text("approved_by"),`,
    "payroll deduction lock columns",
  );
  source = required(
    source,
    `    provisionPaymentReference: text("provision_payment_reference"),\n    occupantCount: integer("occupant_count").notNull().default(0),`,
    `    provisionPaymentReference: text("provision_payment_reference"),\n    otherAmount: real("other_amount").notNull().default(0),\n    occupantCount: integer("occupant_count").notNull().default(0),`,
    "room expense other amount",
  );
  source = required(
    source,
    `  provisionShare: real("provision_share").notNull().default(0),\n  returnAmount: real("return_amount").notNull().default(0),`,
    `  provisionShare: real("provision_share").notNull().default(0),\n  otherShare: real("other_share").notNull().default(0),\n  returnAmount: real("return_amount").notNull().default(0),`,
    "room other share",
  );
  if (!source.includes("export const roomRecoveryEntries")) {
    const marker = `export const recoveryFinalizations = sqliteTable(`;
    if (!source.includes(marker)) throw new Error("Deduction-lock patch failed: recovery finalization marker");
    const table = `export const roomRecoveryEntries = sqliteTable(\n  "room_recovery_entries",\n  {\n    id: text("id").primaryKey(),\n    roomId: text("room_id").notNull().references(() => accommodationRooms.id),\n    payPeriod: text("pay_period").notNull(),\n    entryDate: text("entry_date").notNull(),\n    recoveryType: text("recovery_type").notNull(),\n    amount: real("amount").notNull().default(0),\n    reference: text("reference"),\n    notes: text("notes"),\n    createdBy: text("created_by"),\n    createdAt: text("created_at").notNull().default(sql\`CURRENT_TIMESTAMP\`),\n    updatedBy: text("updated_by"),\n    updatedAt: text("updated_at").notNull().default(sql\`CURRENT_TIMESTAMP\`),\n  },\n);\n\n`;
    source = source.replace(marker, table + marker);
  }
  return source;
});

await patch("lib/payroll-calculations.ts", (source) => {
  source = required(
    source,
    `"oldPending", "gasShare", "rationShare", "provisionShare"]`,
    `"oldPending", "gasShare", "rationShare", "provisionShare", "otherShare"]`,
    "other shared recovery total",
  );
  source = required(
    source,
    `numberValue(item.professionalTax) + numberValue(item.lwf) + numberValue(item.tds));`,
    `numberValue(item.professionalTax) + numberValue(item.lwf) + numberValue(item.tds) + numberValue(item.medicalInsurance));`,
    "insurance statutory classification",
  );
  return source;
});

await patch("lib/payroll-operations.ts", (source) => {
  source = required(
    source,
    `export function splitRoomExpenses(amounts: { gasAmount: number; rationAmount: number; provisionAmount: number }, employeeIds: string[]) {`,
    `export function splitRoomExpenses(amounts: { gasAmount: number; rationAmount: number; provisionAmount: number; otherAmount?: number }, employeeIds: string[]) {`,
    "split room other input",
  );
  source = required(
    source,
    `  const provision = splitMoneyEqually(amounts.provisionAmount, uniqueEmployees.length);\n  return uniqueEmployees.map((employeeId, index) => ({`,
    `  const provision = splitMoneyEqually(amounts.provisionAmount, uniqueEmployees.length);\n  const other = splitMoneyEqually(amounts.otherAmount ?? 0, uniqueEmployees.length);\n  return uniqueEmployees.map((employeeId, index) => ({`,
    "split room other values",
  );
  source = required(
    source,
    `    provisionShare: provision[index],\n    total: Math.round((gas[index] + ration[index] + provision[index]) * 100) / 100,`,
    `    provisionShare: provision[index],\n    otherShare: other[index],\n    total: Math.round((gas[index] + ration[index] + provision[index] + other[index]) * 100) / 100,`,
    "split room other share",
  );
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  source = required(
    source,
    `  issueCount: number;\n  approvedBy: string | null;`,
    `  issueCount: number;\n  deductionsStatus: "open" | "locked";\n  deductionsLockedBy: string | null;\n  deductionsLockedAt: string | null;\n  approvedBy: string | null;`,
    "PayrollRun deduction lock type",
  );
  source = required(
    source,
    `  provisionShare: number;\n  returnAmount: number;`,
    `  provisionShare: number;\n  otherShare: number;\n  returnAmount: number;`,
    "AccommodationCharge otherShare type",
  );
  source = required(
    source,
    `  provisionPaymentReference: string | null;\n  occupantCount: number;`,
    `  provisionPaymentReference: string | null;\n  otherAmount: number;\n  occupantCount: number;`,
    "RoomExpense other amount type",
  );
  if (!source.includes("export type RoomRecoveryEntry")) {
    const marker = `export type RecoveryFinalization = {`;
    if (!source.includes(marker)) throw new Error("Deduction-lock patch failed: RecoveryFinalization type marker");
    const type = `export type RoomRecoveryEntry = {\n  id: string;\n  roomId: string;\n  payPeriod: string;\n  entryDate: string;\n  recoveryType: string;\n  amount: number;\n  reference: string | null;\n  notes: string | null;\n  createdBy: string | null;\n  createdAt: string;\n  updatedBy: string | null;\n  updatedAt: string;\n};\n\n`;
    source = source.replace(marker, type + marker);
  }
  source = required(
    source,
    `  recoveryEntries: RecoveryEntry[];\n  recoveryFinalizations: RecoveryFinalization[];`,
    `  recoveryEntries: RecoveryEntry[];\n  roomRecoveryEntries: RoomRecoveryEntry[];\n  recoveryFinalizations: RecoveryFinalization[];`,
    "AppData room recovery entries",
  );

  source = required(
    source,
    `                  : "Review the attendance-based calculations, then approve the final salary run."}`,
    `                  : run.deductionsStatus !== "locked"\n                    ? "Review salary and live recoveries, then verify and lock deductions before final payroll approval."\n                    : "Deductions are locked. Review the final payable and approve payroll."}`,
    "PayrollRunView deduction lock guidance",
  );

  source = required(
    source,
    `                onEmployees={() => setActiveSection("employees")}\n              />`,
    `                onEmployees={() => setActiveSection("employees")}\n                onDeductions={() => setActiveSection("recoveries")}\n              />`,
    "PayrollRunView deductions navigation prop",
  );
  source = required(
    source,
    `  onEmployees,\n}: {`,
    `  onEmployees,\n  onDeductions,\n}: {`,
    "PayrollRunView deductions signature",
  );
  source = required(
    source,
    `  onEmployees: () => void;\n}) {`,
    `  onEmployees: () => void;\n  onDeductions: () => void;\n}) {`,
    "PayrollRunView deductions type",
  );

  const approveOld = `              ) : run.status !== "approved" ? (\n                canApprove ? (\n                  <button\n                    className="primary-button"\n                    disabled={isActing || run.grossEarnings <= 0}\n                    onClick={() =>\n                      onAction(\n                        "approve",\n                        "Payroll approved and payment outputs unlocked",\n                      )\n                    }\n                  >\n                    <Icon name="check" size={17} />\n                    Approve payroll\n                  </button>\n                ) : (\n                  <span className="access-mode-note">\n                    <Icon name="alert" size={15} />\n                    Awaiting an authorised approver\n                  </span>\n                )\n              ) : (`;
  const approveNew = `              ) : run.status !== "approved" ? (\n                canApprove ? (\n                  run.deductionsStatus !== "locked" ? (\n                    <button className="primary-button" disabled={isActing} onClick={onDeductions}>\n                      <Icon name="file" size={17} />\n                      Verify & lock deductions first\n                    </button>\n                  ) : (\n                    <button\n                      className="primary-button"\n                      disabled={isActing || run.grossEarnings <= 0}\n                      onClick={() => onAction("approve", "Payroll approved and payment outputs unlocked")}\n                    >\n                      <Icon name="check" size={17} />\n                      Approve payroll\n                    </button>\n                  )\n                ) : (\n                  <span className="access-mode-note">\n                    <Icon name="alert" size={15} />\n                    {run.deductionsStatus === "locked" ? "Awaiting an authorised payroll approver" : "Deductions must be verified and locked first"}\n                  </span>\n                )\n              ) : (`;
  source = required(source, approveOld, approveNew, "Payroll approval UI lock sequence");

  const totalCard = `        <MetricCard\n          label="Total deductions"\n          value={compactMoney(\n            run.statutoryDeductions +\n              run.otherDeductions +\n              run.accommodationDeductions,\n          )}\n          note={\`${"${compactMoney(run.statutoryDeductions)}"} statutory\`}\n          tone="amber"\n          icon="file"\n        />`;
  const splitCards = `        <MetricCard\n          label="Statutory deductions"\n          value={compactMoney(run.statutoryDeductions)}\n          note="EPF · ESI · PT · LWF · TDS · Insurance"\n          tone="amber"\n          icon="file"\n        />\n        <MetricCard\n          label="Company recoveries"\n          value={compactMoney(run.otherDeductions + run.accommodationDeductions)}\n          note="Advance · ID · room · supplies · other"\n          tone="violet"\n          icon="calculator"\n        />`;
  source = required(source, totalCard, splitCards, "dashboard deduction separation");

  source = required(
    source,
    `    {\n      label: "Approval",\n      detail: run.status === "approved" ? "Approved" : "Pending",`,
    `    {\n      label: "Deductions lock",\n      detail: run.deductionsStatus === "locked" ? "Verified & locked" : "Open for edit",\n      state: run.deductionsStatus === "locked" ? "complete" : "attention",\n    },\n    {\n      label: "Approval",\n      detail: run.status === "approved" ? "Approved" : run.deductionsStatus === "locked" ? "Ready for approval" : "Waiting for deduction lock",`,
    "dashboard workflow deduction lock step",
  );

  source = required(
    source,
    `    recoveryEntries: RecoveryEntry[];`,
    `    recoveryEntries: RecoveryEntry[];`,
    "type stability marker",
  );
  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  source = required(
    source,
    `  PayrollRun,\n  RecoveryEntry,`,
    `  PayrollRun,\n  RecoveryEntry,\n  RoomRecoveryEntry,`,
    "room recovery type import",
  );
  if (!source.includes("const roomRecoveryLabels")) {
    source = required(
      source,
      `const recoveryLabels: Record<string, string> = {`,
      `const roomRecoveryLabels: Record<string, string> = {\n  gas: "Gas / cylinder",\n  ration: "Ration",\n  provision: "Provision",\n  bathroom: "Bathroom / sanitation",\n  housekeeping: "Housekeeping",\n  other: "Other / reason",\n};\n\nconst recoveryLabels: Record<string, string> = {`,
      "room recovery labels",
    );
  }
  source = required(
    source,
    `  const [recoveryType, setRecoveryType] = useState("advance");\n  const [amount, setAmount] = useState(0);`,
    `  const [recoveryType, setRecoveryType] = useState("advance");\n  const [editingRecoveryId, setEditingRecoveryId] = useState<string | null>(null);\n  const [amount, setAmount] = useState(0);`,
    "individual recovery edit state",
  );
  source = required(
    source,
    `  const [bulkVouchers, setBulkVouchers] = useState(false);\n  const runCharges = run`,
    `  const [bulkVouchers, setBulkVouchers] = useState(false);\n  const applicableRooms = data.accommodationRooms.filter((room) => employees.some((employee) => employee.roomId === room.id));\n  const [roomRecoveryId, setRoomRecoveryId] = useState("");\n  const [roomRecoveryDate, setRoomRecoveryDate] = useState(run?.periodStart ?? \`${"${run?.payPeriod ?? new Date().toISOString().slice(0, 7)}"}-01\`);\n  const [roomRecoveryType, setRoomRecoveryType] = useState("gas");\n  const [roomRecoveryAmount, setRoomRecoveryAmount] = useState(0);\n  const [roomRecoveryReference, setRoomRecoveryReference] = useState("");\n  const [roomRecoveryNotes, setRoomRecoveryNotes] = useState("");\n  const [editingRoomRecoveryId, setEditingRoomRecoveryId] = useState<string | null>(null);\n  const deductionsLocked = run?.deductionsStatus === "locked" || run?.status === "approved";\n  const canEditDeductions = Boolean(canManage && run && !deductionsLocked);\n  const roomRecoveryRows = run\n    ? data.roomRecoveryEntries.filter((entry) => entry.payPeriod === run.payPeriod && applicableRooms.some((room) => room.id === entry.roomId))\n    : [];\n  const companyRecoveries = run ? run.otherDeductions + run.accommodationDeductions : 0;\n  const runCharges = run`,
    "room recovery states and live summary",
  );

  const addRecoveryOld = `  async function addRecovery(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!run) return;\n    const ok = await onAction(\n      "save-recovery-entry",\n      "Date-wise recovery added",\n      { employeeId, recoveryDate, recoveryType, amount, reference, notes },\n    );\n    if (ok) {\n      setAmount(0);\n      setReference("");\n      setNotes("");\n    }\n  }`;
  const addRecoveryNew = `  async function addRecovery(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!run || !canEditDeductions) return;\n    const ok = await onAction(\n      editingRecoveryId ? "update-recovery-entry" : "save-recovery-entry",\n      editingRecoveryId ? "Date-wise recovery updated" : "Date-wise recovery added",\n      { recoveryId: editingRecoveryId ?? undefined, employeeId, recoveryDate, recoveryType, amount, reference, notes },\n    );\n    if (ok) {\n      setEditingRecoveryId(null);\n      setAmount(0);\n      setReference("");\n      setNotes("");\n    }\n  }\n  function editRecovery(entry: RecoveryEntry) {\n    setEditingRecoveryId(entry.id);\n    setEmployeeId(entry.employeeId);\n    setRecoveryDate(entry.recoveryDate);\n    setRecoveryType(entry.recoveryType);\n    setAmount(entry.amount);\n    setReference(entry.reference ?? "");\n    setNotes(entry.notes ?? "");\n  }\n  async function saveRoomRecovery(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!run || !roomRecoveryId || !canEditDeductions) return;\n    const ok = await onAction(\n      editingRoomRecoveryId ? "update-room-recovery-entry" : "save-room-recovery-entry",\n      editingRoomRecoveryId ? "Room day-wise recovery updated" : "Room day-wise recovery added",\n      { roomRecoveryEntryId: editingRoomRecoveryId ?? undefined, roomId: roomRecoveryId, payPeriod: run.payPeriod, entryDate: roomRecoveryDate, recoveryType: roomRecoveryType, amount: roomRecoveryAmount, reference: roomRecoveryReference, notes: roomRecoveryNotes },\n    );\n    if (ok) {\n      setEditingRoomRecoveryId(null);\n      setRoomRecoveryAmount(0);\n      setRoomRecoveryReference("");\n      setRoomRecoveryNotes("");\n    }\n  }\n  function editRoomRecovery(entry: RoomRecoveryEntry) {\n    setEditingRoomRecoveryId(entry.id);\n    setRoomRecoveryId(entry.roomId);\n    setRoomRecoveryDate(entry.entryDate);\n    setRoomRecoveryType(entry.recoveryType);\n    setRoomRecoveryAmount(entry.amount);\n    setRoomRecoveryReference(entry.reference ?? "");\n    setRoomRecoveryNotes(entry.notes ?? "");\n  }`;
  source = required(source, addRecoveryOld, addRecoveryNew, "recovery edit and room ledger handlers");

  source = required(
    source,
    `      {canManage && run ? (`,
    `      {run ? (\n        <section className="panel">\n          <div className="panel-heading">\n            <div><span className="eyebrow">Month-end deduction control</span><h2>Payroll → deductions → deduction lock → payroll lock</h2></div>\n            <span className={\`enhancement-status ${"${deductionsLocked ? \"status-positive\" : \"status-pending\"}"}\`}>{deductionsLocked ? "Deductions locked" : "Deductions open"}</span>\n          </div>\n          <div className="batch-summary-strip">\n            <span>Gross <strong>₹{run.grossEarnings.toFixed(2)}</strong></span>\n            <span>Statutory <strong>₹{run.statutoryDeductions.toFixed(2)}</strong></span>\n            <span>Company recoveries <strong>₹{companyRecoveries.toFixed(2)}</strong></span>\n            <span>Final payable <strong>₹{run.netPayable.toFixed(2)}</strong></span>\n          </div>\n          <p className="muted-label">Statutory = EPF, ESI, PT, LWF, TDS/Income Tax and Insurance. Company recoveries = advance, ID card, employee-wise recoveries and room-wise shared recoveries.</p>\n          <div className="record-actions">\n            {!deductionsLocked && canManage ? (\n              <button className="primary-button" disabled={isActing} onClick={() => void onAction("lock-deductions", "Deductions verified and locked")}>Verify & Lock Deductions</button>\n            ) : null}\n            {run.deductionsStatus === "locked" && run.status !== "approved" && canApprove ? (\n              <button className="secondary-button" disabled={isActing} onClick={() => { if (window.confirm("Reopen deductions for correction? Payroll approval will remain blocked until you lock them again.")) void onAction("reopen-deductions", "Deductions reopened for correction"); }}>Reopen Deductions</button>\n            ) : null}\n          </div>\n          {run.deductionsLockedAt ? <small>Locked by {run.deductionsLockedBy ?? "authorised user"} · {new Date(run.deductionsLockedAt).toLocaleString("en-IN")}</small> : null}\n        </section>\n      ) : null}\n      {canEditDeductions && run ? (`,
    "deduction lock control panel",
  );
  source = required(
    source,
    `            Add dated recovery\n          </button>`,
    `            {editingRecoveryId ? "Save recovery changes" : "Add dated recovery"}\n          </button>\n          {editingRecoveryId ? <button className="secondary-button form-span" type="button" onClick={() => { setEditingRecoveryId(null); setAmount(0); setReference(""); setNotes(""); }}>Cancel edit</button> : null}`,
    "individual edit button label",
  );

  source = required(
    source,
    `                        {canManage ? (\n                          <button\n                            className="record-action record-delete"`,
    `                        {canEditDeductions ? (\n                          <button className="record-action" disabled={isActing} onClick={() => editRecovery(entry)}>Edit</button>\n                        ) : null}\n                        {canEditDeductions ? (\n                          <button\n                            className="record-action record-delete"`,
    "individual recovery edit/delete controls",
  );

  const insertMarker = `      <section className="panel table-panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">\n              Recovery totals by applicable employee`;
  if (!source.includes("Room-wise day ledger")) {
    if (!source.includes(insertMarker)) throw new Error("Deduction-lock patch failed: room ledger insertion marker");
    const roomPanel = `      <section className="panel table-panel">\n        <div className="panel-heading"><div><span className="eyebrow">Room-wise day ledger</span><h2>Gas, ration, provision & other shared recoveries</h2></div><span className="muted-label">Every save updates employee final payable live</span></div>\n        {canEditDeductions && applicableRooms.length ? (\n          <form className="form-grid" onSubmit={(event) => void saveRoomRecovery(event)}>\n            <label><span>Room *</span><select value={roomRecoveryId} onChange={(event) => setRoomRecoveryId(event.target.value)} required><option value="">Choose room</option>{applicableRooms.map((room) => <option value={room.id} key={room.id}>{room.roomNumber}</option>)}</select></label>\n            <label><span>Date *</span><input type="date" value={roomRecoveryDate} onChange={(event) => setRoomRecoveryDate(event.target.value)} required /></label>\n            <label><span>Type *</span><select value={roomRecoveryType} onChange={(event) => setRoomRecoveryType(event.target.value)}>{Object.entries(roomRecoveryLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>\n            <label><span>Amount (₹) *</span><input type="number" min="0.01" step="0.01" value={roomRecoveryAmount} onChange={(event) => setRoomRecoveryAmount(Number(event.target.value))} required /></label>\n            <label><span>Payment / reference</span><input value={roomRecoveryReference} onChange={(event) => setRoomRecoveryReference(event.target.value)} /></label>\n            <label><span>Reason / remarks</span><input value={roomRecoveryNotes} onChange={(event) => setRoomRecoveryNotes(event.target.value)} /></label>\n            <button className="primary-button form-span" disabled={isActing || !roomRecoveryId || roomRecoveryAmount <= 0}>{editingRoomRecoveryId ? "Save room recovery changes" : "Add room recovery"}</button>\n            {editingRoomRecoveryId ? <button className="secondary-button form-span" type="button" onClick={() => { setEditingRoomRecoveryId(null); setRoomRecoveryAmount(0); setRoomRecoveryReference(""); setRoomRecoveryNotes(""); }}>Cancel edit</button> : null}\n          </form>\n        ) : null}\n        <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Room</th><th>Type</th><th>Amount</th><th>Reference / reason</th><th>Actions</th></tr></thead><tbody>\n          {roomRecoveryRows.map((entry) => { const room = data.accommodationRooms.find((candidate) => candidate.id === entry.roomId); return <tr key={entry.id}><td>{entry.entryDate}</td><td><strong>{room?.roomNumber ?? entry.roomId}</strong></td><td>{roomRecoveryLabels[entry.recoveryType] ?? entry.recoveryType}</td><td><strong>₹{entry.amount.toFixed(2)}</strong></td><td>{entry.reference ?? "—"}<small>{entry.notes}</small></td><td><div className="record-actions">{canEditDeductions ? <><button className="record-action" disabled={isActing} onClick={() => editRoomRecovery(entry)}>Edit</button><button className="record-action record-delete" disabled={isActing} onClick={() => { if (window.confirm("Delete this room recovery entry?")) void onAction("delete-room-recovery-entry", "Room recovery entry deleted", { roomRecoveryEntryId: entry.id, roomId: entry.roomId, payPeriod: entry.payPeriod }); }}>Delete</button></> : <small>Locked</small>}</div></td></tr>; })}\n        </tbody></table></div>\n        {!roomRecoveryRows.length ? <div className="enhancement-empty">No room-wise dated recoveries are recorded for this payroll month.</div> : null}\n      </section>\n`;
    source = source.replace(insertMarker, roomPanel + insertMarker);
  }

  source = required(
    source,
    `                <th>Gas / Ration / Provision</th>`,
    `                <th>Room shared recoveries</th>`,
    "employee recovery room label",
  );
  source = required(
    source,
    `        ? charge.gasShare + charge.rationShare + charge.provisionShare\n        : 0;`,
    `        ? charge.gasShare + charge.rationShare + charge.provisionShare + charge.otherShare\n        : 0;`,
    "employee shared recovery total",
  );
  source = required(
    source,
    `                <th>Provision</th>\n                <th>Per head</th>`,
    `                <th>Provision</th>\n                <th>Other</th>\n                <th>Per head</th>`,
    "room summary other header",
  );
  source = required(
    source,
    `                  <td>₹{expense.provisionAmount.toFixed(2)}</td>\n                  <td>\n                    <strong>\n                      ₹\n                      {(\n                        (expense.gasAmount +\n                          expense.rationAmount +\n                          expense.provisionAmount) /`,
    `                  <td>₹{expense.provisionAmount.toFixed(2)}</td>\n                  <td>₹{expense.otherAmount.toFixed(2)}</td>\n                  <td>\n                    <strong>\n                      ₹\n                      {(\n                        (expense.gasAmount +\n                          expense.rationAmount +\n                          expense.provisionAmount +\n                          expense.otherAmount) /`,
    "room summary other value",
  );
  source = required(
    source,
    `    if (charge.provisionShare)\n      lines.push(["Provision share", charge.provisionShare]);`,
    `    if (charge.provisionShare) lines.push(["Provision share", charge.provisionShare]);\n    if (charge.otherShare) lines.push(["Other room share", charge.otherShare]);`,
    "voucher other room share",
  );
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  source = required(
    source,
    `  recoveryEntries,\n  recoveryFinalizations,`,
    `  recoveryEntries,\n  roomRecoveryEntries,\n  recoveryFinalizations,`,
    "route room recovery import",
  );
  source = required(
    source,
    `      "save-recovery-entry",\n      "delete-recovery-entry",`,
    `      "save-recovery-entry",\n      "update-recovery-entry",\n      "delete-recovery-entry",\n      "save-room-recovery-entry",\n      "update-room-recovery-entry",\n      "delete-room-recovery-entry",\n      "lock-deductions",\n      "reopen-deductions",`,
    "action permissions for deduction workflow",
  );
  source = required(
    source,
    `      "save-room-expense",\n      "save-hostel-utility",`,
    `      "save-room-expense",\n      "save-room-recovery-entry",\n      "update-room-recovery-entry",\n      "delete-room-recovery-entry",\n      "save-hostel-utility",`,
    "hostel in-charge room ledger access",
  );

  source = required(
    source,
    `  if (editable && run.status === "approved")\n    throw new RequestError(\n      "This payroll run is approved. Reopen it before making changes.",\n      409,\n    );\n  return run;`,
    `  if (editable && run.status === "approved")\n    throw new RequestError("This payroll run is approved. Reopen it before making changes.", 409);\n  if (editable && run.deductionsStatus === "locked")\n    throw new RequestError("Deductions are locked for this payroll. Reopen Deductions before changing attendance, salary or recoveries.", 409);\n  return run;`,
    "global editable run deduction lock",
  );

  source = required(
    source,
    `        issueCount: payrollRuns.issueCount,\n        approvedBy: payrollRuns.approvedBy,`,
    `        issueCount: payrollRuns.issueCount,\n        deductionsStatus: payrollRuns.deductionsStatus,\n        deductionsLockedBy: payrollRuns.deductionsLockedBy,\n        deductionsLockedAt: payrollRuns.deductionsLockedAt,\n        approvedBy: payrollRuns.approvedBy,`,
    "run selection lock fields",
  );
  source = required(
    source,
    `        provisionShare: accommodationCharges.provisionShare,\n        returnAmount: accommodationCharges.returnAmount,`,
    `        provisionShare: accommodationCharges.provisionShare,\n        otherShare: accommodationCharges.otherShare,\n        returnAmount: accommodationCharges.returnAmount,`,
    "charge selection other share",
  );

  source = required(
    source,
    `    allRoomExpenseRows,\n    allBatchRows,`,
    `    allRoomExpenseRows,\n    allRoomRecoveryRows,\n    allBatchRows,`,
    "load room recovery destructure",
  );
  source = required(
    source,
    `    db\n      .select()\n      .from(accommodationRoomExpenses)\n      .orderBy(desc(accommodationRoomExpenses.payPeriod)),\n    db\n      .select()\n      .from(payrollBatches)`,
    `    db\n      .select()\n      .from(accommodationRoomExpenses)\n      .orderBy(desc(accommodationRoomExpenses.payPeriod)),\n    db\n      .select()\n      .from(roomRecoveryEntries)\n      .orderBy(desc(roomRecoveryEntries.entryDate), desc(roomRecoveryEntries.createdAt)),\n    db\n      .select()\n      .from(payrollBatches)`,
    "load room recovery query",
  );
  source = required(
    source,
    `  const roomExpenseRows = allRoomExpenseRows.filter((expense) =>\n    visibleRoomIds.has(expense.roomId),\n  );\n  const batchRows`,
    `  const roomExpenseRows = allRoomExpenseRows.filter((expense) => visibleRoomIds.has(expense.roomId));\n  const roomRecoveryRows = allRoomRecoveryRows.filter((entry) => visibleRoomIds.has(entry.roomId));\n  const batchRows`,
    "visible room recovery rows",
  );
  source = required(
    source,
    `    roomExpenses: canView(permissions, "accommodation") ? roomExpenseRows : [],\n    payrollBatches:`,
    `    roomExpenses: canView(permissions, "accommodation") ? roomExpenseRows : [],\n    roomRecoveryEntries: canView(permissions, "accommodation") ? roomRecoveryRows : [],\n    payrollBatches:`,
    "AppData room recovery return",
  );

  source = required(
    source,
    `      status:\n        run.status === "approved"\n          ? "approved"`,
    `      status:\n        run.status === "approved"\n          ? "approved"`,
    "recalc status stability marker",
  );

  if (!source.includes("const roomRecoveryTypes")) {
    const marker = `const datedRecoveryFields = [`;
    if (!source.includes(marker)) throw new Error("Deduction-lock patch failed: datedRecoveryFields marker");
    const helpers = `const roomRecoveryTypes = ["gas", "ration", "provision", "bathroom", "housekeeping", "other"] as const;\n\nasync function roomRecoveryRuns(db: Db, roomId: string, payPeriod: string) {\n  const occupants = await db.select().from(employees).where(and(eq(employees.roomId, roomId), eq(employees.status, "active")));\n  const runs: PayrollRunRow[] = [];\n  for (const employee of occupants) {\n    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.clientUnitId, employee.clientUnitId), eq(payrollRuns.payPeriod, payPeriod))).limit(1);\n    if (run && !runs.some((candidate) => candidate.id === run.id)) runs.push(run);\n  }\n  return { occupants, runs };\n}\n\nasync function assertRoomRecoveryMutable(db: Db, roomId: string, payPeriod: string) {\n  const { occupants, runs } = await roomRecoveryRuns(db, roomId, payPeriod);\n  const locked = runs.find((run) => run.status === "approved" || run.deductionsStatus === "locked");\n  if (locked) throw new RequestError("This shared room has a payroll with deductions already locked. Reopen Deductions for the affected payroll before editing or deleting room recoveries.", 409);\n  return { occupants, runs };\n}\n\nasync function syncRoomRecoveryLedger(db: Db, roomId: string, payPeriod: string) {\n  const [room] = await db.select().from(accommodationRooms).where(eq(accommodationRooms.id, roomId)).limit(1);\n  if (!room) throw new RequestError("Accommodation room not found", 404);\n  const entries = await db.select().from(roomRecoveryEntries).where(and(eq(roomRecoveryEntries.roomId, roomId), eq(roomRecoveryEntries.payPeriod, payPeriod)));\n  const totals = { gasAmount: 0, rationAmount: 0, provisionAmount: 0, otherAmount: 0 };\n  for (const entry of entries) {\n    if (entry.recoveryType === "gas") totals.gasAmount += entry.amount;\n    else if (entry.recoveryType === "ration") totals.rationAmount += entry.amount;\n    else if (entry.recoveryType === "provision") totals.provisionAmount += entry.amount;\n    else totals.otherAmount += entry.amount;\n  }\n  for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] = roundMoney(totals[key]);\n  const latest = (type: string) => entries.filter((entry) => entry.recoveryType === type).sort((a,b) => b.entryDate.localeCompare(a.entryDate))[0];\n  const [existingExpense] = await db.select().from(accommodationRoomExpenses).where(and(eq(accommodationRoomExpenses.roomId, roomId), eq(accommodationRoomExpenses.payPeriod, payPeriod))).limit(1);\n  const expenseId = existingExpense?.id ?? \`ROOMEXP-\${crypto.randomUUID()}\`;\n  const expenseValues = {\n    ...totals,\n    gasDate: latest("gas")?.entryDate ?? null, gasPaymentReference: latest("gas")?.reference ?? null,\n    rationDate: latest("ration")?.entryDate ?? null, rationPaymentReference: latest("ration")?.reference ?? null,\n    provisionDate: latest("provision")?.entryDate ?? null, provisionPaymentReference: latest("provision")?.reference ?? null,\n    status: "draft", finalizedBy: null, finalizedAt: null, updatedAt: new Date().toISOString(),\n  };\n  if (existingExpense) await db.update(accommodationRoomExpenses).set(expenseValues).where(eq(accommodationRoomExpenses.id, existingExpense.id));\n  else await db.insert(accommodationRoomExpenses).values({ id: expenseId, roomId, payPeriod, ...expenseValues });\n\n  const { occupants, runs } = await roomRecoveryRuns(db, roomId, payPeriod);\n  const runByUnit = new Map(runs.map((run) => [run.clientUnitId, run]));\n  const shares = splitRoomExpenses(totals, occupants.map((employee) => employee.id));\n  const activeIds = new Set(occupants.map((employee) => employee.id));\n  const stale = await db.select().from(accommodationCharges).where(eq(accommodationCharges.roomExpenseId, expenseId));\n  const affectedRunIds = new Set<string>();\n  for (const charge of stale.filter((charge) => !activeIds.has(charge.employeeId))) {\n    await db.update(accommodationCharges).set({ roomExpenseId: null, gasShare: 0, rationShare: 0, provisionShare: 0, otherShare: 0 }).where(eq(accommodationCharges.id, charge.id));\n    affectedRunIds.add(charge.runId);\n  }\n  for (const share of shares) {\n    const employee = occupants.find((candidate) => candidate.id === share.employeeId);\n    if (!employee) continue;\n    const run = runByUnit.get(employee.clientUnitId);\n    if (!run) continue;\n    const fullRent = positiveValue(employee.roomRentAmount ?? 0, "Room rent");\n    const joinedLate = Boolean(employee.dateOfJoining?.startsWith(\`${"${payPeriod}"}-\`) && Number(employee.dateOfJoining.slice(8,10)) > room.rentCutoffDay);\n    const rent = roundMoney(fullRent * (joinedLate ? room.lateJoinRentPercent / 100 : 1));\n    const values = { roomExpenseId: expenseId, roomNumber: room.roomNumber, gasShare: share.gasShare, rationShare: share.rationShare, provisionShare: share.provisionShare, otherShare: share.otherShare, rent };\n    const [charge] = await db.select().from(accommodationCharges).where(and(eq(accommodationCharges.runId, run.id), eq(accommodationCharges.employeeId, employee.id))).limit(1);\n    if (charge) await db.update(accommodationCharges).set(values).where(eq(accommodationCharges.id, charge.id));\n    else await db.insert(accommodationCharges).values({ runId: run.id, employeeId: employee.id, ...values });\n    affectedRunIds.add(run.id);\n  }\n  await db.update(accommodationRoomExpenses).set({ occupantCount: occupants.length, ...expenseValues }).where(eq(accommodationRoomExpenses.id, expenseId));\n  for (const affectedRunId of affectedRunIds) await recalculateRun(db, affectedRunId, false);\n  return { room, entries, occupants, runs, expenseId, totals };\n}\n\n`;
    source = source.replace(marker, helpers + marker);
  }

  source = required(
    source,
    `    provisionShare: share.provisionShare,\n      rent,`,
    `    provisionShare: share.provisionShare,\n      otherShare: share.otherShare,\n      rent,`,
    "legacy finalize room other share",
  );
  source = required(
    source,
    `          provisionShare: 0,\n        })`,
    `          provisionShare: 0,\n          otherShare: 0,\n        })`,
    "legacy reopen room other share clear",
  );
  source = required(
    source,
    `        provisionPaymentReference: optionalValue(\n          payload.provisionPaymentReference,\n        ),\n        notes: optionalValue(payload.notes),`,
    `        provisionPaymentReference: optionalValue(\n          payload.provisionPaymentReference,\n        ),\n        otherAmount: positiveValue(payload.otherAmount ?? 0, "Other room expense"),\n        notes: optionalValue(payload.notes),`,
    "legacy room other amount",
  );

  const recoveryBlockPattern = /    \} else if \(action === "save-recovery-entry"\) \{[\s\S]*?    \} else if \(action === "finalize-employee-recovery"\) \{/;
  const recoveryReplacement = `    } else if (action === "save-recovery-entry" || action === "update-recovery-entry") {\n      const run = await requireRun(db, runId, true);\n      const recoveryId = action === "update-recovery-entry" ? textValue(payload.recoveryId, "Recovery entry") : null;\n      const employeeId = textValue(payload.employeeId, "Employee");\n      const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);\n      if (!employee || employee.clientUnitId !== run.clientUnitId) throw new RequestError("Employee not found in this payroll unit", 404);\n      const recoveryDate = dateValue(payload.recoveryDate, "Recovery date");\n      const { start, end } = periodRange(run.payPeriod, run.periodStart, run.periodEnd);\n      if (recoveryDate < start || recoveryDate >= end) throw new RequestError(\`Recovery date must be inside the salary cycle \${start} to \${new Date(new Date(\`${end}T00:00:00Z\`).getTime() - 86400000).toISOString().slice(0,10)}\`);\n      const recoveryType = textValue(payload.recoveryType, "Recovery type");\n      if (!datedRecoveryFields.includes(recoveryType as (typeof datedRecoveryFields)[number])) throw new RequestError("Unsupported recovery type");\n      const amount = positiveValue(payload.amount, "Recovery amount");\n      if (amount <= 0) throw new RequestError("Recovery amount must be greater than zero");\n      await db.delete(recoveryFinalizations).where(and(eq(recoveryFinalizations.runId, runId), eq(recoveryFinalizations.employeeId, employeeId)));\n      const values = { employeeId, recoveryDate, recoveryType, amount, reference: optionalValue(payload.reference), notes: optionalValue(payload.notes) };\n      if (recoveryId) {\n        const [existing] = await db.select().from(recoveryEntries).where(and(eq(recoveryEntries.id, recoveryId), eq(recoveryEntries.runId, runId))).limit(1);\n        if (!existing) throw new RequestError("Recovery entry not found", 404);\n        await db.update(recoveryEntries).set(values).where(eq(recoveryEntries.id, recoveryId));\n      } else {\n        await db.insert(recoveryEntries).values({ id: \`REC-\${crypto.randomUUID()}\`, runId, ...values, createdBy: actorEmail });\n      }\n      await syncDatedRecoveries(db, runId, employeeId);\n      await writeAudit(db, recoveryId ? "recovery_updated" : "recovery_added", "employee", employeeId, \`${recoveryId ? "Updated" : "Added"} \${recoveryType} recovery ₹\${amount.toFixed(2)} for \${employee.employeeCode} on \${recoveryDate}\`, actorEmail);\n    } else if (action === "delete-recovery-entry") {\n      await requireRun(db, runId, true);\n      const recoveryId = textValue(payload.recoveryId, "Recovery entry");\n      const [entry] = await db.select().from(recoveryEntries).where(and(eq(recoveryEntries.id, recoveryId), eq(recoveryEntries.runId, runId))).limit(1);\n      if (!entry) throw new RequestError("Recovery entry not found", 404);\n      await db.delete(recoveryFinalizations).where(and(eq(recoveryFinalizations.runId, runId), eq(recoveryFinalizations.employeeId, entry.employeeId)));\n      await db.delete(recoveryEntries).where(eq(recoveryEntries.id, recoveryId));\n      await syncDatedRecoveries(db, runId, entry.employeeId);\n      await writeAudit(db, "recovery_deleted", "employee", entry.employeeId, \`Deleted dated \${entry.recoveryType} recovery\`, actorEmail);\n    } else if (action === "finalize-employee-recovery") {`;
  source = requiredRegex(source, recoveryBlockPattern, recoveryReplacement, "individual recovery editable block");

  source = required(
    source,
    `    } else if (action === "save-accommodation") {`,
    `    } else if (action === "save-room-recovery-entry" || action === "update-room-recovery-entry") {\n      const roomId = textValue(payload.roomId, "Room");\n      const payPeriod = periodValue(payload.payPeriod);\n      const { occupants } = await assertRoomRecoveryMutable(db, roomId, payPeriod);\n      if (!occupants.length) throw new RequestError("Allocate at least one active employee to the room before adding shared recoveries", 409);\n      const entryDate = dateValue(payload.entryDate, "Recovery date");\n      if (!entryDate.startsWith(\`${"${payPeriod}"}-\`)) throw new RequestError("Room recovery date must belong to the selected payroll month");\n      const recoveryType = textValue(payload.recoveryType, "Room recovery type");\n      if (!roomRecoveryTypes.includes(recoveryType as (typeof roomRecoveryTypes)[number])) throw new RequestError("Unsupported room recovery type");\n      const amount = positiveValue(payload.amount, "Room recovery amount");\n      if (amount <= 0) throw new RequestError("Room recovery amount must be greater than zero");\n      const entryId = action === "update-room-recovery-entry" ? textValue(payload.roomRecoveryEntryId, "Room recovery entry") : \`ROOMREC-\${crypto.randomUUID()}\`;\n      const values = { roomId, payPeriod, entryDate, recoveryType, amount, reference: optionalValue(payload.reference), notes: optionalValue(payload.notes), updatedBy: actorEmail, updatedAt: new Date().toISOString() };\n      if (action === "update-room-recovery-entry") {\n        const [existing] = await db.select().from(roomRecoveryEntries).where(eq(roomRecoveryEntries.id, entryId)).limit(1);\n        if (!existing || existing.roomId !== roomId || existing.payPeriod !== payPeriod) throw new RequestError("Room recovery entry not found", 404);\n        await db.update(roomRecoveryEntries).set(values).where(eq(roomRecoveryEntries.id, entryId));\n      } else {\n        await db.insert(roomRecoveryEntries).values({ id: entryId, ...values, createdBy: actorEmail, createdAt: new Date().toISOString() });\n      }\n      const synced = await syncRoomRecoveryLedger(db, roomId, payPeriod);\n      await writeAudit(db, action === "update-room-recovery-entry" ? "room_recovery_updated" : "room_recovery_added", "room", roomId, \`${action === "update-room-recovery-entry" ? "Updated" : "Added"} \${recoveryType} room recovery ₹\${amount.toFixed(2)} for \${synced.room.roomNumber}\`, actorEmail);\n    } else if (action === "delete-room-recovery-entry") {\n      const entryId = textValue(payload.roomRecoveryEntryId, "Room recovery entry");\n      const [entry] = await db.select().from(roomRecoveryEntries).where(eq(roomRecoveryEntries.id, entryId)).limit(1);\n      if (!entry) throw new RequestError("Room recovery entry not found", 404);\n      await assertRoomRecoveryMutable(db, entry.roomId, entry.payPeriod);\n      await db.delete(roomRecoveryEntries).where(eq(roomRecoveryEntries.id, entryId));\n      const synced = await syncRoomRecoveryLedger(db, entry.roomId, entry.payPeriod);\n      await writeAudit(db, "room_recovery_deleted", "room", entry.roomId, \`Deleted \${entry.recoveryType} room recovery from \${synced.room.roomNumber}\`, actorEmail);\n    } else if (action === "save-accommodation") {`,
    "room recovery actions",
  );

  source = required(
    source,
    `        "provisionShare",\n        "returnAmount",`,
    `        "provisionShare",\n        "otherShare",\n        "returnAmount",`,
    "manual accommodation other share field",
  );
  source = required(
    source,
    `        values.provisionShare = existing.provisionShare;\n      }`,
    `        values.provisionShare = existing.provisionShare;\n        values.otherShare = existing.otherShare;\n      }`,
    "preserve room other share",
  );

  source = required(
    source,
    `    } else if (action === "approve") {\n      const run = await requireRun(db, runId, true);`,
    `    } else if (action === "lock-deductions") {\n      const run = await requireRun(db, runId);\n      if (run.status === "approved") throw new RequestError("Approved payroll deductions are already locked", 409);\n      if (run.deductionsStatus === "locked") throw new RequestError("Deductions are already locked for this payroll", 409);\n      await recalculateRun(db, run.id, false);\n      const chargeRows = await db.select().from(accommodationCharges).where(eq(accommodationCharges.runId, run.id));\n      const recoveryRows = await db.select().from(recoveryEntries).where(eq(recoveryEntries.runId, run.id));\n      const employeeIds = new Set([...chargeRows.filter((charge) => accommodationTotal(charge).accommodationDeduction > 0 || accommodationTotal(charge).returnAmount > 0).map((charge) => charge.employeeId), ...recoveryRows.map((entry) => entry.employeeId)]);\n      const employeesInRun = await db.select().from(employees).where(eq(employees.clientUnitId, run.clientUnitId));\n      for (const employeeId of employeeIds) {\n        const employee = employeesInRun.find((candidate) => candidate.id === employeeId);\n        if (!employee) continue;\n        const [existing] = await db.select().from(recoveryFinalizations).where(and(eq(recoveryFinalizations.runId, run.id), eq(recoveryFinalizations.employeeId, employeeId))).limit(1);\n        if (!existing) await db.insert(recoveryFinalizations).values({ id: \`RECFIN-\${crypto.randomUUID()}\`, runId: run.id, employeeId, voucherNumber: \`DRV-\${run.payPeriod.replace("-", "")}-\${employee.employeeCode}\`, finalizedBy: actorEmail, finalizedAt: new Date().toISOString() });\n      }\n      const lockedAt = new Date().toISOString();\n      await db.update(payrollRuns).set({ deductionsStatus: "locked", deductionsLockedBy: actorEmail, deductionsLockedAt: lockedAt, updatedAt: lockedAt }).where(eq(payrollRuns.id, run.id));\n      await writeAudit(db, "deductions_locked", "payroll_run", run.id, "Verified and locked employee-wise and room-wise company recoveries before payroll approval", actorEmail);\n    } else if (action === "reopen-deductions") {\n      if (!access.profile.canApprovePayroll && access.profile.role !== "super_admin") throw new RequestError("Only an authorised payroll approver can reopen locked deductions", 403);\n      const run = await requireRun(db, runId);\n      if (run.status === "approved") throw new RequestError("Reopen payroll before reopening deductions", 409);\n      await db.delete(recoveryFinalizations).where(eq(recoveryFinalizations.runId, run.id));\n      await db.update(payrollRuns).set({ deductionsStatus: "open", deductionsLockedBy: null, deductionsLockedAt: null, updatedAt: new Date().toISOString() }).where(eq(payrollRuns.id, run.id));\n      await writeAudit(db, "deductions_reopened", "payroll_run", run.id, "Reopened deductions for day-wise corrections; payroll approval locked again", actorEmail);\n    } else if (action === "approve") {\n      const run = await requireRun(db, runId);\n      if (run.status === "approved") throw new RequestError("Payroll is already approved", 409);\n      if (run.deductionsStatus !== "locked") throw new RequestError("Verify & Lock Deductions before final payroll approval", 409);`,
    "deduction lock actions and approval enforcement",
  );

  source = required(
    source,
    `      await db.delete(recoveryEntries).where(eq(recoveryEntries.runId, runId));\n      await db\n        .delete(accommodationCharges)`,
    `      await db.delete(recoveryEntries).where(eq(recoveryEntries.runId, runId));\n      await db.delete(recoveryFinalizations).where(eq(recoveryFinalizations.runId, runId));\n      await db\n        .delete(accommodationCharges)`,
    "delete run finalizations",
  );

  return source;
});

console.log("Applied live day-wise deductions, room recovery ledger, deduction lock, statutory/company separation, and payroll approval gate.");
