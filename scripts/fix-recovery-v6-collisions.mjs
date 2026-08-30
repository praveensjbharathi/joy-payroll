import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/reports-recovery.tsx");
let source = await readFile(path, "utf8");

// Remove the older room-recovery state block injected by apply-current-user-fixes.
source = source.replace(
  /\n  const \[roomRecoveryHostelId, setRoomRecoveryHostelId\] = useState\(""\);\n  const \[roomRecoveryRoomId, setRoomRecoveryRoomId\] = useState\(""\);\n  const \[roomGas, setRoomGas\] = useState\(0\);\n  const \[roomRation, setRoomRation\] = useState\(0\);\n  const \[roomProvision, setRoomProvision\] = useState\(0\);/,
  "",
);

// Remove the older hostel-only room recovery calculations/functions, keeping the new
// Joy Room / Outside Room recovery workflow added by Recovery V6.
source = source.replace(
  /\n  const recoveryHostels = data\.hostels\.filter\(\(hostel\) =>[\s\S]*?\n  const roomRows = data\.roomExpenses/,
  "\n  const roomRows = data.roomExpenses",
);

// Remove the old hostel-only recovery form so only the new category-aware form remains.
source = source.replace(
  /\n      \{canManage && run \? \(\n        <form className="panel form-grid room-recovery-entry"[\s\S]*?\n        <\/form>\n      \) : null\}\n/,
  "\n",
);

// Voucher must never be downloadable before the employee recovery has been finalized.
source = source.replace(
  /\n\s*<button\n\s*type="button"\n\s*className="record-action"\n\s*onClick=\{\(\) => setVoucherEmployeeId\(employee\.id\)\}\n\s*>\n\s*Download deduction voucher\n\s*<\/button>/g,
  "",
);

await writeFile(path, source, "utf8");
console.log("Recovery V6 collision cleanup applied: legacy hostel-only form removed and vouchers remain finalization-only.");
