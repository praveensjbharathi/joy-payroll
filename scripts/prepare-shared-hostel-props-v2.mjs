import { readFile, writeFile } from "node:fs/promises";

const path = "app/payroll-app.tsx";
let source = await readFile(path, "utf8");

function normalizeBlock(componentName, transform) {
  const start = source.indexOf(`<${componentName}`);
  if (start < 0) throw new Error(`Missing ${componentName} component invocation`);
  const end = source.indexOf("/>", start);
  if (end < 0) throw new Error(`Unclosed ${componentName} component invocation`);
  const before = source.slice(start, end + 2);
  const after = transform(before);
  source = source.slice(0, start) + after + source.slice(end + 2);
}

normalizeBlock("HostelMaster", (block) => {
  block = block.replace(/\n\s+vendors=\{data\.vendors\}/, "");
  block = block.replace(/\n\s+units=\{[\s\S]*?(?=\n\s+types=)/, "");
  block = block.replace(/types=\{[^\n]+\}/, "types={data.accommodationTypes}");
  block = block.replace(
    /vendorId=\{activeVendorId\}/,
    `vendorId={activeVendorId}\n              vendors={data.vendors}\n              units={data.units}`,
  );
  return block;
});

normalizeBlock("AccommodationControlCenter", (block) => {
  block = block.replace(/types=\{[^\n]+\}/, "types={data.accommodationTypes}");
  block = block.replace(/\n\s+units=\{[\s\S]*?(?=\n\s+rooms=)/, "\n                units={data.units}");
  return block;
});

source = source.replace(
  "\n  recoveryEntries: RecoveryEntry[];\n",
  "\n    recoveryEntries: RecoveryEntry[];\n",
);

await writeFile(path, source, "utf8");

const recoveryPath = "app/reports-recovery.tsx";
let recovery = await readFile(recoveryPath, "utf8");

recovery = recovery.replace(
  /\n  const \[roomRecoveryScope, setRoomRecoveryScope\][\s\S]*?(?=\n  const runCharges = run)/,
  "",
);
recovery = recovery.replace(
  /\n  const (?:recoveryAccommodationTypes|joyRecoveryTypeIds) =[\s\S]*?(?=\n  async function addRecovery\()/,
  "",
);
recovery = recovery.replace(
  /\n      \{run && \(canManage \|\| canApprove\) \? \(\n        <section className="panel form-grid room-recovery-entry-panel">[\s\S]*?\n        <\/section>\n      \) : null\}/,
  "",
);
recovery = recovery.replace(
  "      {run && (canManage || canApprove) ? (",
  "      {canManage && run ? (",
);
recovery = recovery.replace(
  '{run.status === "approved" ? "Reopen payroll to add recovery" : "Add dated recovery"}',
  "Add dated recovery",
);

if (!recovery.includes("Room-wise day ledger")) {
  const labelIndex = recovery.indexOf("Recovery totals by applicable employee");
  if (labelIndex < 0) throw new Error("Recovery totals section was not found");
  const sectionStart = recovery.lastIndexOf(
    '<section className="panel table-panel">',
    labelIndex,
  );
  if (sectionStart < 0) throw new Error("Recovery totals panel start was not found");
  const lineStart = recovery.lastIndexOf("\n", sectionStart) + 1;
  const roomPanel = `      <section className="panel table-panel">\n        <div className="panel-heading"><div><span className="eyebrow">Room-wise day ledger</span><h2>Gas, ration, provision & other shared recoveries</h2></div><span className="muted-label">Every save updates employee final payable live</span></div>\n        {canEditDeductions && applicableRooms.length ? (\n          <form className="form-grid" onSubmit={(event) => void saveRoomRecovery(event)}>\n            <label><span>Room *</span><select value={roomRecoveryId} onChange={(event) => setRoomRecoveryId(event.target.value)} required><option value="">Choose room</option>{applicableRooms.map((room) => <option value={room.id} key={room.id}>{room.roomNumber}</option>)}</select></label>\n            <label><span>Date *</span><input type="date" value={roomRecoveryDate} onChange={(event) => setRoomRecoveryDate(event.target.value)} required /></label>\n            <label><span>Type *</span><select value={roomRecoveryType} onChange={(event) => setRoomRecoveryType(event.target.value)}>{Object.entries(roomRecoveryLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>\n            <label><span>Amount (₹) *</span><input type="number" min="0.01" step="0.01" value={roomRecoveryAmount} onChange={(event) => setRoomRecoveryAmount(Number(event.target.value))} required /></label>\n            <label><span>Payment / reference</span><input value={roomRecoveryReference} onChange={(event) => setRoomRecoveryReference(event.target.value)} /></label>\n            <label><span>Reason / remarks</span><input value={roomRecoveryNotes} onChange={(event) => setRoomRecoveryNotes(event.target.value)} /></label>\n            <button className="primary-button form-span" disabled={isActing || !roomRecoveryId || roomRecoveryAmount <= 0}>{editingRoomRecoveryId ? "Save room recovery changes" : "Add room recovery"}</button>\n            {editingRoomRecoveryId ? <button className="secondary-button form-span" type="button" onClick={() => { setEditingRoomRecoveryId(null); setRoomRecoveryAmount(0); setRoomRecoveryReference(""); setRoomRecoveryNotes(""); }}>Cancel edit</button> : null}\n          </form>\n        ) : null}\n        <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Room</th><th>Type</th><th>Amount</th><th>Reference / reason</th><th>Actions</th></tr></thead><tbody>\n          {roomRecoveryRows.map((entry) => { const room = data.accommodationRooms.find((candidate) => candidate.id === entry.roomId); return <tr key={entry.id}><td>{entry.entryDate}</td><td><strong>{room?.roomNumber ?? entry.roomId}</strong></td><td>{roomRecoveryLabels[entry.recoveryType] ?? entry.recoveryType}</td><td><strong>₹{entry.amount.toFixed(2)}</strong></td><td>{entry.reference ?? "—"}<small>{entry.notes}</small></td><td><div className="record-actions">{canEditDeductions ? <><button className="record-action" disabled={isActing} onClick={() => editRoomRecovery(entry)}>Edit</button><button className="record-action record-delete" disabled={isActing} onClick={() => { if (window.confirm("Delete this room recovery entry?")) void onAction("delete-room-recovery-entry", "Room recovery entry deleted", { roomRecoveryEntryId: entry.id, roomId: entry.roomId, payPeriod: entry.payPeriod }); }}>Delete</button></> : <small>Locked</small>}</div></td></tr>; })}\n        </tbody></table></div>\n        {!roomRecoveryRows.length ? <div className="enhancement-empty">No room-wise dated recoveries are recorded for this payroll month.</div> : null}\n      </section>\n`;
  recovery = recovery.slice(0, lineStart) + roomPanel + recovery.slice(lineStart);
}

await writeFile(recoveryPath, recovery, "utf8");
console.log("Normalized shared-hostel props and inserted final room day-ledger before deduction-lock release build.");
