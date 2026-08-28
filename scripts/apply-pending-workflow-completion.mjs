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
  if (!source.includes(search)) throw new Error(`Unable to apply ${label}`);
  return source.replace(search, replacement);
}

await patch("app/employee-id-card.tsx", (source) => {
  source = source.replace('<button className="secondary-button" onClick={preparePrint}>Print front + back</button>\n            ', "");
  source = source.replace('HR Download Front JPEG', 'Download Front HQ JPG');
  source = source.replace('HR Download Back JPEG', 'Download Back HQ JPG');
  return source;
});

await patch("app/hostel-master.tsx", (source) => {
  if (!source.includes('key={`hostel-edit-${selected.id}`}')) {
    source = once(
      source,
      '<form className="form-grid" onSubmit={updateHostel}>',
      '<form key={`hostel-edit-${selected.id}`} className="form-grid" onSubmit={updateHostel}>',
      "selected hostel edit form remount",
    );
  }
  return source;
});

await patch("db/schema.ts", (source) => {
  if (!source.includes('approvalManagerEmail: text("approval_manager_email")')) {
    source = once(
      source,
      '  canApprovePayroll: integer("can_approve_payroll").notNull().default(0),',
      '  canApprovePayroll: integer("can_approve_payroll").notNull().default(0),\n  approvalManagerEmail: text("approval_manager_email"),\n  approvalSequence: integer("approval_sequence").notNull().default(0),',
      "user payroll approval hierarchy schema",
    );
  }
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  if (!source.includes("approvalManagerEmail: row.approvalManagerEmail")) {
    source = once(
      source,
      '    canApprovePayroll: role === "super_admin" || Boolean(row.canApprovePayroll),\n    createdAt: row.createdAt,',
      '    canApprovePayroll: role === "super_admin" || Boolean(row.canApprovePayroll),\n    approvalManagerEmail: row.approvalManagerEmail,\n    approvalSequence: row.approvalSequence,\n    createdAt: row.createdAt,',
      "approval hierarchy profile mapping",
    );
  }
  if (!source.includes("approvalManagerEmail: optionalValue(payload.approvalManagerEmail)")) {
    source = once(
      source,
      '    canApprovePayroll: canApprovePayroll ? 1 : 0,\n    updatedAt: now,',
      '    canApprovePayroll: canApprovePayroll ? 1 : 0,\n    approvalManagerEmail: role === "super_admin" ? null : optionalValue(payload.approvalManagerEmail)?.toLowerCase() ?? null,\n    approvalSequence: role === "super_admin" ? 999 : positiveValue(payload.approvalSequence ?? 0, "Approval sequence", 999),\n    updatedAt: now,',
      "approval hierarchy save mapping",
    );
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  if (!source.includes("approvalManagerEmail: string | null;")) {
    source = once(
      source,
      '  canApprovePayroll: boolean;\n  createdAt: string;',
      '  canApprovePayroll: boolean;\n  approvalManagerEmail: string | null;\n  approvalSequence: number;\n  createdAt: string;',
      "approval hierarchy frontend type",
    );
  }
  if (!source.includes("approvalManagerEmail: fields.approvalManagerEmail")) {
    source = once(
      source,
      '          canApprovePayroll: approvalDraft,\n          clientScope: clientScopeDraft,',
      '          canApprovePayroll: approvalDraft,\n          approvalManagerEmail: fields.approvalManagerEmail,\n          approvalSequence: fields.approvalSequence,\n          clientScope: clientScopeDraft,',
      "approval hierarchy submit mapping",
    );
  }
  if (!source.includes("Payroll approval hierarchy")) {
    const marker = '              <label\n                className={`approval-authority ${userRole === "super_admin" ? "approval-authority-fixed" : ""}`}' ;
    const block = `              <section className="scope-assignment-panel approval-hierarchy-panel">\n                <header><div><span className="eyebrow">Payroll approval hierarchy</span><h3>Map reporting approver</h3></div><small>Recommended: Field HR → Payroll HR → HR Manager → Super Admin</small></header>\n                {userRole === "super_admin" ? (\n                  <div className="form-note">Super Admin is the final authority and can approve directly.</div>\n                ) : (\n                  <div className="form-grid">\n                    <label><span>Approver / reporting manager email</span><input name="approvalManagerEmail" type="email" defaultValue={accessProfile?.approvalManagerEmail ?? ""} placeholder="manager@company.com" /></label>\n                    <label><span>Approval sequence</span><input name="approvalSequence" type="number" min="0" max="999" defaultValue={accessProfile?.approvalSequence ?? (userRole === "field_hr" ? 1 : userRole === "payroll_team" ? 2 : 3)} /></label>\n                  </div>\n                )}\n              </section>\n`;
    if (!source.includes(marker)) throw new Error("Unable to apply payroll approval hierarchy UI");
    source = source.replace(marker, block + marker);
  }
  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  if (!source.includes("<th>Employer unit</th>")) {
    const oldHead = `              <tr>\n                <th>Employee</th>\n                <th>Room</th>\n                <th>Net before recovery</th>\n                <th>Individual recovery</th>\n                <th>Gas / Ration / Provision</th>\n                <th>Return</th>\n                <th>Final payable</th>\n                <th>Voucher</th>\n              </tr>`;
    const newHead = `              <tr>\n                <th>#</th><th>Employee</th><th>Employer unit</th><th>Room</th><th>Net before recovery</th>\n                <th>Rent</th><th>Bus</th><th>Food</th><th>Advance</th><th>ID</th><th>Medical</th><th>Ticket</th><th>Shoe</th><th>Aadhaar</th><th>Bank A/c</th><th>T-shirt</th><th>Old pending</th>\n                <th>Gas</th><th>Ration</th><th>Provision</th><th>Total recovery</th><th>Return</th><th>Final payable</th><th>Voucher</th>\n              </tr>`;
    source = once(source, oldHead, newHead, "detailed recovery table headers");

    const oldMap = `              {employeeRows.map(\n                ({ employee, charge, individual, shared, item }) => {`;
    const newMap = `              {employeeRows.map(\n                ({ employee, charge, individual, shared, item }, rowIndex) => {`;
    source = once(source, oldMap, newMap, "detailed recovery row index");

    const oldCells = `                      <td>\n                        <strong>{employee.name}</strong>\n                        <small>{employee.employeeCode}</small>\n                      </td>\n                      <td>{employee.roomNumber ?? "—"}</td>\n                      <td>₹{preRecovery.toFixed(2)}</td>\n                      <td>₹{individual.toFixed(2)}</td>\n                      <td>₹{shared.toFixed(2)}</td>\n                      <td>₹{(charge?.returnAmount ?? 0).toFixed(2)}</td>\n                      <td>\n                        <strong>₹{(item?.netPayable ?? 0).toFixed(2)}</strong>\n                      </td>`;
    const newCells = `                      <td>{rowIndex + 1}</td>\n                      <td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td>\n                      <td>{(() => { const u = data.units.find((entry) => entry.id === employee.clientUnitId); return u ? \`${'${u.clientName} · ${u.unitName}'}\` : "—"; })()}</td>\n                      <td>{employee.roomNumber ?? "—"}</td>\n                      <td>₹{preRecovery.toFixed(2)}</td>\n                      <td>₹{(charge?.rent ?? 0).toFixed(2)}</td><td>₹{(charge?.bus ?? 0).toFixed(2)}</td><td>₹{(charge?.food ?? 0).toFixed(2)}</td><td>₹{(charge?.advance ?? 0).toFixed(2)}</td><td>₹{(charge?.idCard ?? 0).toFixed(2)}</td><td>₹{(charge?.medical ?? 0).toFixed(2)}</td><td>₹{(charge?.ticket ?? 0).toFixed(2)}</td><td>₹{(charge?.shoe ?? 0).toFixed(2)}</td><td>₹{(charge?.aadhaarUpdate ?? 0).toFixed(2)}</td><td>₹{(charge?.bankAccountCharge ?? 0).toFixed(2)}</td><td>₹{(charge?.tshirt ?? 0).toFixed(2)}</td><td>₹{(charge?.oldPending ?? 0).toFixed(2)}</td>\n                      <td>₹{(charge?.gasShare ?? 0).toFixed(2)}</td><td>₹{(charge?.rationShare ?? 0).toFixed(2)}</td><td>₹{(charge?.provisionShare ?? 0).toFixed(2)}</td>\n                      <td><strong>₹{(individual + shared).toFixed(2)}</strong></td><td>₹{(charge?.returnAmount ?? 0).toFixed(2)}</td><td><strong>₹{(item?.netPayable ?? 0).toFixed(2)}</strong></td>`;
    source = once(source, oldCells, newCells, "detailed recovery table cells");
  }
  source = source.replace('Print / Save PDF', 'Print recovery slip · A4 portrait');
  return source;
});

await patch("supabase-frontend/live-enhancements.ts", (source) => {
  if (!source.includes("JOY_PENDING_WORKFLOW_COMPLETION_20260828")) {
    source += `\n// JOY_PENDING_WORKFLOW_COMPLETION_20260828\nconst extra = document.createElement("style");\nextra.textContent = \`\n@page joy-payslip { size:A4 portrait; margin:10mm; }\n@page joy-recovery-slip { size:A4 portrait; margin:10mm; }\n.room-recovery-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:8px 0 12px}.room-recovery-summary div{border:1px solid #cbd5e1;padding:7px}.room-recovery-summary span{display:block;font-size:8pt;color:#64748b}.room-recovery-summary strong{display:block;font-size:10pt}.room-recovery-print-sheet table{font-size:7pt!important}.room-recovery-print-sheet th,.room-recovery-print-sheet td{padding:3px!important;white-space:nowrap}\n@media print{body[data-print-target=\\"payslip\\"] .payslip-sheet,body[data-print-target=\\"payslip\\"] .payslip-sheet *{visibility:visible!important}body[data-print-target=\\"payslip\\"] .payslip-sheet{page:joy-payslip;position:absolute!important;inset:0!important;width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important}body[data-print-target=\\"recovery-slip\\"] .advance-voucher,body[data-print-target=\\"recovery-slip\\"] .advance-voucher *{visibility:visible!important}body[data-print-target=\\"recovery-slip\\"] .advance-voucher{page:joy-recovery-slip;position:absolute!important;inset:0!important;width:190mm!important;min-height:277mm!important;margin:0 auto!important;padding:10mm!important;box-sizing:border-box!important}}\n\`;\ndocument.head.appendChild(extra);\n\nfunction addPortraitPrintButtons(){\n  document.querySelectorAll<HTMLElement>(".payslip-sheet").forEach((sheet)=>{\n    const modal=sheet.closest<HTMLElement>(".modal-layer"); const toolbar=modal?.querySelector<HTMLElement>(".modal-toolbar div");\n    if(toolbar && !toolbar.querySelector(".joy-payslip-print")){const b=document.createElement("button");b.type="button";b.className="secondary-button joy-payslip-print";b.textContent="Print payslip · A4 portrait";b.onclick=()=>{document.body.dataset.printTarget="payslip";const c=()=>{delete document.body.dataset.printTarget;window.removeEventListener("afterprint",c)};window.addEventListener("afterprint",c);window.print();setTimeout(c,1800)};toolbar.prepend(b)}\n  });\n  document.querySelectorAll<HTMLElement>(".advance-voucher").forEach((sheet)=>{const modal=sheet.closest<HTMLElement>(".modal-layer");const toolbar=modal?.querySelector<HTMLElement>(".modal-toolbar div");const b=toolbar?.querySelector<HTMLButtonElement>("button.secondary-button");if(b && !b.dataset.joyPortrait){b.dataset.joyPortrait="1";b.textContent="Print recovery slip · A4 portrait";b.onclick=()=>{document.body.dataset.printTarget="recovery-slip";const c=()=>{delete document.body.dataset.printTarget;window.removeEventListener("afterprint",c)};window.addEventListener("afterprint",c);window.print();setTimeout(c,1800)}}});\n}\nconst portraitObserver=new MutationObserver(addPortraitPrintButtons);portraitObserver.observe(document.documentElement,{childList:true,subtree:true});addPortraitPrintButtons();\n`;
  }
  source = source.replace('const room = row.cells[1]?.textContent?.trim() || "—";', 'const headers = Array.from(table.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? ""); const roomIndex = Math.max(0, headers.findIndex((header) => header === "Room")); const room = row.cells[roomIndex]?.textContent?.trim() || "—";');
  source = source.replace('const rooms = [...new Set(rows.map((row) => row.cells[1]?.textContent?.trim() || "—").filter(Boolean))];', 'const headerLabels = Array.from(table.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? ""); const roomColumnIndex = Math.max(0, headerLabels.findIndex((header) => header === "Room")); const rooms = [...new Set(rows.map((row) => row.cells[roomColumnIndex]?.textContent?.trim() || "—").filter(Boolean))];');
  source = source.replace('const room = row.cells[1]?.textContent?.trim() || "—"; if (room !== roomName)', 'const room = row.cells[roomColumnIndex]?.textContent?.trim() || "—"; if (room !== roomName)');
  return source;
});

console.log("Completed remaining Joy Payroll UI/workflow items: only HQ ID JPG actions, hostel edit remount, detailed room recovery register, A4 portrait payslip/recovery printing, and payroll approval hierarchy mapping.");
