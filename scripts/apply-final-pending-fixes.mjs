import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function patch(path, transform) {
  const full = join(root, path);
  const source = await readFile(full, "utf8");
  const updated = transform(source);
  if (updated !== source) await writeFile(full, updated, "utf8");
}
function once(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Unable to apply ${label}: expected source was not found.`);
  return source.replace(search, replacement);
}

await patch("db/schema.ts", (source) => {
  if (!source.includes('approvalLevel: integer("approval_level")')) {
    source = once(
      source,
      '  canApprovePayroll: integer("can_approve_payroll").notNull().default(0),\n  createdBy: text("created_by"),',
      '  canApprovePayroll: integer("can_approve_payroll").notNull().default(0),\n  approvalLevel: integer("approval_level").notNull().default(0),\n  approverUserId: text("approver_user_id"),\n  createdBy: text("created_by"),',
      "user approval hierarchy schema",
    );
  }
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  if (!source.includes("approvalLevel: Number(row.approvalLevel")) {
    source = once(
      source,
      '    canApprovePayroll: role === "super_admin" || Boolean(row.canApprovePayroll),\n    createdAt: row.createdAt,',
      '    canApprovePayroll: role === "super_admin" || Boolean(row.canApprovePayroll),\n    approvalLevel: role === "super_admin" ? 4 : Number(row.approvalLevel ?? 0),\n    approverUserId: row.approverUserId ?? null,\n    createdAt: row.createdAt,',
      "user hierarchy API output",
    );
  }
  if (!source.includes("approverUserId: role === \"super_admin\"")) {
    source = once(
      source,
      '    canApprovePayroll: canApprovePayroll ? 1 : 0,\n    updatedAt: now,',
      '    canApprovePayroll: canApprovePayroll ? 1 : 0,\n    approvalLevel: role === "super_admin" ? 4 : Math.max(0, Math.min(4, Number(payload.approvalLevel ?? 0) || 0)),\n    approverUserId: role === "super_admin" ? null : optionalValue(payload.approverUserId),\n    updatedAt: now,',
      "user hierarchy API save",
    );
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  if (!source.includes("  approvalLevel: number;")) {
    source = once(
      source,
      '  canApprovePayroll: boolean;\n  createdAt: string;',
      '  canApprovePayroll: boolean;\n  approvalLevel: number;\n  approverUserId: string | null;\n  createdAt: string;',
      "user hierarchy UI type",
    );
  }

  if (!source.includes("  appUsers,\n  vendors,")) {
    source = once(
      source,
      'function PayrollActionModal({\n  modal,\n  vendors,',
      'function PayrollActionModal({\n  modal,\n  appUsers,\n  vendors,',
      "PayrollActionModal appUsers parameter",
    );
    source = once(
      source,
      '  modal: ActiveModal;\n  vendors: Vendor[];',
      '  modal: ActiveModal;\n  appUsers: AppUserProfile[];\n  vendors: Vendor[];',
      "PayrollActionModal appUsers prop type",
    );
    source = once(
      source,
      '        <PayrollActionModal\n          modal={modal}\n          vendors={data.vendors}',
      '        <PayrollActionModal\n          modal={modal}\n          appUsers={data.appUsers}\n          vendors={data.vendors}',
      "PayrollActionModal appUsers call",
    );
  }

  if (!source.includes("approvalLevelDraft")) {
    source = once(
      source,
      '  const [approvalDraft, setApprovalDraft] = useState(\n    accessProfile?.canApprovePayroll ?? DEFAULT_APPROVAL_ACCESS[initialRole],\n  );',
      '  const [approvalDraft, setApprovalDraft] = useState(\n    accessProfile?.canApprovePayroll ?? DEFAULT_APPROVAL_ACCESS[initialRole],\n  );\n  const defaultApprovalLevel: Record<UserRole, number> = { super_admin: 4, hr_team: 3, payroll_team: 2, field_hr: 1, hostel_incharge: 0 };\n  const [approvalLevelDraft, setApprovalLevelDraft] = useState(\n    accessProfile?.approvalLevel ?? defaultApprovalLevel[initialRole],\n  );\n  const [approverUserIdDraft, setApproverUserIdDraft] = useState(\n    accessProfile?.approverUserId ?? "",\n  );',
      "approval hierarchy modal state",
    );
  }

  if (!source.includes("approvalLevel: approvalLevelDraft")) {
    source = once(
      source,
      '          canApprovePayroll: approvalDraft,\n          clientScope: clientScopeDraft,',
      '          canApprovePayroll: approvalDraft,\n          approvalLevel: approvalLevelDraft,\n          approverUserId: approverUserIdDraft || null,\n          clientScope: clientScopeDraft,',
      "approval hierarchy save payload",
    );
  }

  if (!source.includes("setApprovalLevelDraft(defaultApprovalLevel[role])")) {
    source = once(
      source,
      '                      setPermissionDraft({ ...DEFAULT_PERMISSIONS[role] });\n                      setApprovalDraft(DEFAULT_APPROVAL_ACCESS[role]);',
      '                      setPermissionDraft({ ...DEFAULT_PERMISSIONS[role] });\n                      setApprovalDraft(DEFAULT_APPROVAL_ACCESS[role]);\n                      setApprovalLevelDraft(defaultApprovalLevel[role]);\n                      setApproverUserIdDraft("");',
      "approval hierarchy role defaults",
    );
  }

  if (!source.includes('className="payroll-approval-hierarchy"')) {
    const hierarchy = String.raw`
              <section className="scope-assignment-panel payroll-approval-hierarchy">
                <header>
                  <div>
                    <span className="eyebrow">Payroll approval hierarchy</span>
                    <h3>Map this user in the approval chain</h3>
                  </div>
                  <small>Field HR → Payroll HR → HR Manager → Super Admin</small>
                </header>
                <div className="form-grid">
                  <label>
                    <span>Approval level</span>
                    <select
                      value={approvalLevelDraft}
                      disabled={userRole === "super_admin"}
                      onChange={(event) => setApprovalLevelDraft(Number(event.target.value))}
                    >
                      <option value={0}>Not in payroll approval chain</option>
                      <option value={1}>Level 1 · Field HR review</option>
                      <option value={2}>Level 2 · Payroll HR review</option>
                      <option value={3}>Level 3 · HR Manager approval</option>
                      <option value={4}>Level 4 · Final / Super Admin</option>
                    </select>
                  </label>
                  <label>
                    <span>Reports to / next approver</span>
                    <select
                      value={approverUserIdDraft}
                      disabled={userRole === "super_admin"}
                      onChange={(event) => setApproverUserIdDraft(event.target.value)}
                    >
                      <option value="">No mapped next approver</option>
                      {appUsers
                        .filter((user) => user.status === "active" && user.id !== accessProfile?.id)
                        .sort((a, b) => (a.approvalLevel ?? 0) - (b.approvalLevel ?? 0))
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName ?? user.email} · {ROLE_LABELS[user.role]} · L{user.approvalLevel ?? 0}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="form-note">
                  <strong>Approval mapping</strong>
                  <span>
                    This mapping records who this user reports to for payroll review. Final payroll locking still requires “Allow final payroll approval” and Payroll Full access.
                  </span>
                </div>
              </section>
`;
    const marker = '              <label\n                className={`approval-authority ${userRole === "super_admin" ? "approval-authority-fixed" : ""}`}';
    if (!source.includes(marker)) throw new Error("Unable to locate payroll approval authority control.");
    source = source.replace(marker, hierarchy + marker);
  }

  return source;
});

await patch("app/hostel-master.tsx", (source) => {
  if (!source.includes('key={`${selected.id}-edit`}')) {
    source = source.replace(
      '<form key={selected.id} className="form-grid" onSubmit={updateHostel}>',
      '<form key={`${selected.id}-edit`} className="form-grid" onSubmit={updateHostel}>',
    );
  }
  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  if (!source.includes("Employer unit</th>\n                <th>Net before recovery")) {
    const marker = "Net salary → recoveries → final payable";
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) throw new Error("Unable to locate finalized recovery statement.");
    const theadStart = source.indexOf("<thead>", markerIndex);
    const theadEnd = source.indexOf("</thead>", theadStart);
    const tbodyStart = source.indexOf("<tbody>", theadEnd);
    const tbodyEnd = source.indexOf("</tbody>", tbodyStart);
    if ([theadStart, theadEnd, tbodyStart, tbodyEnd].some((v) => v < 0))
      throw new Error("Unable to locate finalized recovery statement table.");

    const newHead = String.raw`<thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Room</th>
                <th>Employer unit</th>
                <th>Net before recovery</th>
                <th>Rent</th>
                <th>Bus</th>
                <th>Food</th>
                <th>Advance</th>
                <th>ID</th>
                <th>Medical</th>
                <th>Ticket</th>
                <th>Shoe</th>
                <th>Aadhaar</th>
                <th>Bank A/c</th>
                <th>T-shirt</th>
                <th>Old pending</th>
                <th>Gas</th>
                <th>Ration</th>
                <th>Provision</th>
                <th>Total recovery</th>
                <th>Return</th>
                <th>Final payable</th>
                <th>Voucher</th>
              </tr>
            </thead>`;

    const newBody = String.raw`<tbody>
              {employeeRows.map(({ employee, charge, total, item }, rowIndex) => {
                const preRecovery = item
                  ? item.netPayable + item.accommodationDeduction - item.returnAmount
                  : 0;
                const employerUnit = data.units.find((unit) => unit.id === employee.clientUnitId);
                return (
                  <tr key={employee.id}>
                    <td>{rowIndex + 1}</td>
                    <td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td>
                    <td>{employee.roomNumber ?? "—"}</td>
                    <td>{employerUnit ? `${employerUnit.clientName} · ${employerUnit.unitName}` : "—"}</td>
                    <td>₹{preRecovery.toFixed(2)}</td>
                    <td>₹{(charge?.rent ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.bus ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.food ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.advance ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.idCard ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.medical ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.ticket ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.shoe ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.aadhaarUpdate ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.bankAccountCharge ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.tshirt ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.oldPending ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.gasShare ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.rationShare ?? 0).toFixed(2)}</td>
                    <td>₹{(charge?.provisionShare ?? 0).toFixed(2)}</td>
                    <td><strong>₹{total.toFixed(2)}</strong></td>
                    <td>₹{(charge?.returnAmount ?? 0).toFixed(2)}</td>
                    <td><strong>₹{(item?.netPayable ?? 0).toFixed(2)}</strong></td>
                    <td>
                      {finalizations.some((finalized) => finalized.employeeId === employee.id) ? (
                        <div className="record-actions">
                          <button className="record-action" onClick={() => setVoucherEmployeeId(employee.id)}>Generate voucher</button>
                          {canApprove ? (
                            <button className="record-action" disabled={isActing} onClick={() => void onAction("reopen-employee-recovery", "Employee recovery reopened", { employeeId: employee.id })}>Reopen</button>
                          ) : null}
                        </div>
                      ) : canApprove ? (
                        <button className="primary-button" disabled={isActing} onClick={() => void onAction("finalize-employee-recovery", "Recovery finalized and voucher generated", { employeeId: employee.id })}>Finalize recovery</button>
                      ) : (
                        <small>Awaiting authorised approval</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>`;

    source = source.slice(0, theadStart) + newHead + source.slice(theadEnd + "</thead>".length, tbodyStart) + newBody + source.slice(tbodyEnd + "</tbody>".length);
  }
  return source;
});

await patch("app/globals.css", (source) => {
  if (source.includes("JOY_FINAL_PENDING_FIXES_20260828")) return source;
  return source + String.raw`

/* JOY_FINAL_PENDING_FIXES_20260828 */
.payroll-approval-hierarchy{margin-top:18px}.payroll-approval-hierarchy .form-grid{grid-template-columns:repeat(2,minmax(220px,1fr))}
@page joy-payslip { size:A4 portrait; margin:10mm; }
@page joy-recovery-slip { size:A4 portrait; margin:10mm; }
@media print {
  body[data-print-target="payslip"] .payslip-sheet,
  body[data-print-target="payslip"] .payslip-sheet * { visibility:visible!important; }
  body[data-print-target="payslip"] .payslip-sheet {
    page:joy-payslip; position:absolute!important; inset:0!important; width:190mm!important; min-height:277mm!important;
    margin:0 auto!important; padding:10mm!important; box-sizing:border-box!important; background:#fff!important; box-shadow:none!important;
  }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages,
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages * { visibility:visible!important; }
  body[data-print-target="bulk-payslips"] .bulk-payslip-pages { page:joy-payslip; position:absolute!important; inset:0!important; width:100%!important; }
  body[data-print-target="bulk-payslips"] .payslip-sheet,
  body[data-print-target="bulk-payslips"] .payslip-half-a4 { width:190mm!important; min-height:277mm!important; height:auto!important; margin:0 auto!important; padding:10mm!important; box-sizing:border-box!important; break-after:page!important; page-break-after:always!important; }
  body[data-print-target="bulk-payslips"] .payslip-sheet:last-child,
  body[data-print-target="bulk-payslips"] .payslip-half-a4:last-child { break-after:auto!important; page-break-after:auto!important; }
  body[data-print-target="voucher"] .advance-voucher,
  body[data-print-target="voucher"] .advance-voucher * { visibility:visible!important; }
  body[data-print-target="voucher"] .advance-voucher { page:joy-recovery-slip; width:190mm!important; min-height:277mm!important; margin:0 auto!important; padding:10mm!important; box-sizing:border-box!important; }
}
`;
});

console.log("Completed recovery statement detail columns, hostel edit remount, portrait payroll/recovery printing, and user approval hierarchy mapping.");
