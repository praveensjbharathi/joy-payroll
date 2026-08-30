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

const recoveryTotalsAnchor = /      <section className="panel table-panel">\n\s*<div className="panel-heading">\n\s*<div>\n\s*<span className="eyebrow">\s*Recovery totals by applicable employee\s*<\/span>/;
if (recoveryTotalsAnchor.test(recovery)) {
  recovery = recovery.replace(
    recoveryTotalsAnchor,
    `      <section className="panel table-panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">\n              Recovery totals by applicable employee\n            </span>`,
  );
}

await writeFile(recoveryPath, recovery, "utf8");
console.log("Normalized shared-hostel props and legacy recovery markers before deduction-lock release build.");
