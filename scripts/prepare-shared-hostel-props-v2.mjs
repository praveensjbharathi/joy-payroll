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

// The deduction-lock patch uses this as a source-stability marker only.
source = source.replace(
  "\n  recoveryEntries: RecoveryEntry[];\n",
  "\n    recoveryEntries: RecoveryEntry[];\n",
);

await writeFile(path, source, "utf8");

// Recovery V6 introduced an older room-month form. The final deduction-lock release
// owns room-wise dated recovery entry/edit/delete, so remove only that duplicate
// state/handlers/panel immediately before the new ledger transformer runs.
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

await writeFile(recoveryPath, recovery, "utf8");
console.log("Normalized shared-hostel props and removed legacy room-recovery collision before deduction-lock release build.");
