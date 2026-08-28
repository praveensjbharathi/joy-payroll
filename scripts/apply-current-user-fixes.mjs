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

await patch("app/employee-id-card.tsx", (source) => {
  source = source.replace(/<strong>CR80 portrait employee ID card · 54 × 85\.6 mm<\/strong>/g, "");
  source = source.replace(/<button[^>]*>Download front JPG<\/button>/gi, "");
  source = source.replace(/<button[^>]*>Download back JPG<\/button>/gi, "");
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  if (!source.includes("  salaryBasis: string;\n  fixedWorkingDays: number;")) {
    source = source.replace(
      "  overtimeHours: number;\n  fixedWorkingDays: number;",
      "  overtimeHours: number;\n  salaryBasis: string;\n  fixedWorkingDays: number;",
    );
  }

  const exactExport = String.raw`  function exportPayroll() {
    downloadCsv(\`payroll-register-${run.payPeriod}.csv\`, [
      [
        "Sl no",
        "Emp ID",
        "Name",
        "Pay Monthly/Daily",
        "Fixed W Days",
        "W Days",
        "NFH",
        "CO",
        "OD",
        "Sundays",
        "PL",
        "CL",
        "SL",
        "Payable Days",
        "Basic",
        "DA",
        "HRA",
        "CA",
        "Food Allowance",
        "Night Allowance",
        "OT Hrs",
        "OT Wages",
        "Attendance Bonus",
        "Arrears",
        "Holiday Wages",
        "Production Incentive",
        "Medical Allowance",
        "Gross Earnings",
        "PF Deductions",
        "ESI Deductions",
        "Professional Tax",
        "LWF",
        "Canteen",
        "Snacks",
        "Tent",
        "Advance",
        "Others",
        "TDS",
        "Medical insurance",
        "Total Deductions",
        "Net Payable",
      ],
      ...visible.map((item, index) => [
        index + 1,
        item.employeeCode,
        item.employeeName,
        item.salaryBasis === "daily" ? "Daily" : "Monthly",
        item.fixedWorkingDays,
        item.presentDays,
        item.nfhDays,
        item.compOffDays,
        item.onDutyDays,
        item.sundayDays,
        item.plDays,
        item.clDays,
        item.slDays,
        item.payableDays,
        item.basic,
        item.da,
        item.hra,
        item.conveyance,
        item.foodAllowance,
        item.nightAllowance,
        item.overtimeHours,
        item.overtimeWages,
        item.attendanceBonus,
        item.arrears,
        item.holidayWages,
        item.productionIncentive,
        item.medicalAllowance,
        item.grossEarnings,
        item.pfDeduction,
        item.esiDeduction,
        item.professionalTax,
        item.lwf,
        item.canteen,
        item.snacks,
        item.tent,
        item.advance,
        item.otherDeduction,
        item.tds,
        item.medicalInsurance,
        item.totalDeductions,
        item.netPayable,
      ]),
    ]);
  }`;
  source = source.replace(/  function exportPayroll\(\) \{[\s\S]*?\n  \}\n  return \(/, `${exactExport}\n  return (`);
  source = source.replace("Excel-compatible CSV", "Download 41-column payroll CSV");

  source = source.replace(
    `              units={data.units.filter(\n                (unit) => unit.vendorId === activeVendorId,\n              )}\n              types={currentTypes}`,
    `              units={data.units}\n              types={data.accommodationTypes}`,
  );

  // The pending hierarchy patch adds an email text box. Convert it to a selectable user list.
  source = source.replace(
    '<label><span>Approver / reporting manager email</span><input name="approvalManagerEmail" type="email" defaultValue={accessProfile?.approvalManagerEmail ?? ""} placeholder="manager@company.com" /></label>',
    `<label><span>Approver / reporting manager</span><select name="approvalManagerEmail" defaultValue={accessProfile?.approvalManagerEmail ?? ""}><option value="">Choose next approver</option>{appUsers.filter((user) => user.status === "active" && user.email !== accessProfile?.email).map((user) => (<option key={user.id} value={user.email}>{user.fullName ?? user.email} · {ROLE_LABELS[user.role]}</option>))}</select></label>`,
  );
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  if (!source.includes("salaryBasis: employees.salaryBasis")) {
    source = source.replace(
      "        overtimeHours: payrollItems.overtimeHours,\n        fixedWorkingDays: payrollItems.fixedWorkingDays,",
      "        overtimeHours: payrollItems.overtimeHours,\n        salaryBasis: employees.salaryBasis,\n        fixedWorkingDays: payrollItems.fixedWorkingDays,",
    );
  }

  // Hostels are shared across Joy group companies. Keep one owner record, but allow all mapped units.
  source = source.replace(
    `      const validUnits = await db\n        .select({ id: clientUnits.id })\n        .from(clientUnits)\n        .where(eq(clientUnits.vendorId, vendorId));`,
    `      const validUnits = await db\n        .select({ id: clientUnits.id })\n        .from(clientUnits);`,
  );

  source = source.replace(
    `        if (\n          !hostel ||\n          hostel.vendorId !== vendorId ||\n          hostel.accommodationTypeId !== accommodationTypeId ||\n          hostel.status !== "active"\n        )\n          throw new RequestError(\n            "Choose an active stored hostel or local area under this accommodation type",\n            409,\n          );`,
    `        const [hostelAccommodationType] = hostel?.accommodationTypeId\n          ? await db.select().from(accommodationTypes).where(eq(accommodationTypes.id, hostel.accommodationTypeId)).limit(1)\n          : [];\n        if (\n          !hostel ||\n          !hostelAccommodationType ||\n          hostelAccommodationType.name !== type.name ||\n          hostel.status !== "active"\n        )\n          throw new RequestError(\n            "Choose an active shared hostel or local area under the same accommodation type",\n            409,\n          );`,
  );

  const oldHostelVisibility = `    hostels: canView(permissions, "accommodation")\n      ? allHostels.filter(\n          (hostel) =>\n            visibleVendorIds.has(hostel.vendorId) &&\n            (access.profile.role !== "hostel_incharge" ||\n              hostelScope.has(hostel.id)),\n        )\n      : [],`;
  const newHostelVisibility = `    hostels: canView(permissions, "accommodation")\n      ? allHostels.filter((hostel) => {\n          if (access.profile.role === "hostel_incharge") return hostelScope.has(hostel.id);\n          if (unrestricted) return true;\n          let mappedUnits: string[] = [];\n          try { const parsed = JSON.parse(hostel.clientScopeJson || "[]"); if (Array.isArray(parsed)) mappedUnits = parsed; } catch {}\n          return visibleVendorIds.has(hostel.vendorId) || mappedUnits.some((unitId) => visibleUnitIds.has(unitId));\n        })\n      : [],`;
  source = source.replace(oldHostelVisibility, newHostelVisibility);
  return source;
});

await patch("app/hostel-master.tsx", (source) => {
  source = source.replace(
    `  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const typeHostels = hostels.filter(\n    (h) => h.vendorId === vendorId && h.accommodationTypeId === typeId,\n  );\n  const [hostelId, setHostelId] = useState("");`,
    `  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";\n  const typeHostels = hostels.filter((h) => {\n    const hostelTypeName = types.find((type) => type.id === h.accommodationTypeId)?.name ?? "";\n    return Boolean(selectedTypeName) && hostelTypeName === selectedTypeName;\n  });\n  const [hostelId, setHostelId] = useState("");`,
  );
  source = source.replace(
    `  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";\n  const isOutsideRoom`,
    `  const isOutsideRoom`,
  );
  source = source.replace(
    `      vendorId,\n      accommodationTypeId: typeId,\n      name: f.get("name"),`,
    `      vendorId: selected.vendorId,\n      accommodationTypeId: selected.accommodationTypeId ?? typeId,\n      name: f.get("name"),`,
  );
  source = source.replace(
    `{hostels.filter((h) => h.accommodationTypeId === t.id).length}{" "}`,
    `{hostels.filter((h) => types.find((type) => type.id === h.accommodationTypeId)?.name === t.name).length}{" "}`,
  );
  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  if (!source.includes("const [roomRecoveryHostelId")) {
    source = source.replace(
      `  const [bulkVouchers, setBulkVouchers] = useState(false);`,
      `  const [bulkVouchers, setBulkVouchers] = useState(false);\n  const [roomRecoveryHostelId, setRoomRecoveryHostelId] = useState("");\n  const [roomRecoveryRoomId, setRoomRecoveryRoomId] = useState("");\n  const [roomGas, setRoomGas] = useState(0);\n  const [roomRation, setRoomRation] = useState(0);\n  const [roomProvision, setRoomProvision] = useState(0);`,
    );

    source = source.replace(
      `  const roomRows = data.roomExpenses`,
      `  const recoveryHostels = data.hostels.filter((hostel) =>\n    data.accommodationRooms.some((room) =>\n      room.hostelId === hostel.id && employees.some((employee) => employee.roomId === room.id),\n    ),\n  );\n  const recoveryRooms = data.accommodationRooms.filter(\n    (room) => room.hostelId === roomRecoveryHostelId && employees.some((employee) => employee.roomId === room.id),\n  );\n  const roomOccupants = employees.filter((employee) => employee.roomId === roomRecoveryRoomId && employee.status === "active");\n  const currentRoomExpense = run\n    ? data.roomExpenses.find((expense) => expense.roomId === roomRecoveryRoomId && expense.payPeriod === run.payPeriod)\n    : undefined;\n  async function saveRoomRecovery(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!run || !roomRecoveryRoomId) return;\n    const ok = await onAction("save-room-expense", "Room-wise Gas, Ration and Provision saved", {\n      roomId: roomRecoveryRoomId,\n      payPeriod: run.payPeriod,\n      gasAmount: roomGas,\n      rationAmount: roomRation,\n      provisionAmount: roomProvision,\n    });\n    if (ok) { setRoomGas(0); setRoomRation(0); setRoomProvision(0); }\n  }\n  const roomRows = data.roomExpenses`,
    );

    const insertBefore = `      <section className="panel table-panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">Applicable employees only</span>`;
    const roomForm = `      {canManage && run ? (\n        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>\n          <div className="panel-heading form-span">\n            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>\n            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>\n          </div>\n          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>\n          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>\n          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>\n          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>\n          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>\n          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => \`${'${employee.employeeCode} · ${employee.name}'}\`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>\n          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>\n        </form>\n      ) : null}\n`;
    source = source.replace(insertBefore, roomForm + insertBefore);
  }
  return source;
});

await patch("supabase-frontend/live-enhancements.ts", (source) => {
  if (!source.includes("function removeDuplicateRoomRecoveryTools")) {
    source += `\nfunction removeDuplicateRoomRecoveryTools(){document.querySelectorAll<HTMLElement>(\".panel\").forEach(panel=>{const tools=Array.from(panel.querySelectorAll<HTMLElement>(\".room-print-toolbar\"));tools.slice(1).forEach(tool=>tool.remove());});}\nconst duplicateRoomToolObserver=new MutationObserver(removeDuplicateRoomRecoveryTools);duplicateRoomToolObserver.observe(document.documentElement,{childList:true,subtree:true});removeDuplicateRoomRecoveryTools();\n`;
  }
  return source;
});

console.log("Applied exact 41-column export, shared Joy-group hostel visibility, room-wise recovery entry, hierarchy dropdown, ID toolbar cleanup, and duplicate recovery control cleanup.");
