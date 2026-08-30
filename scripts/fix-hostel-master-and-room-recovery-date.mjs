import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Hostel / Area Master must follow Accommodation Type from Operational Masters.
// Also fix the shared-hostel production patch which can accidentally make first-time
// creation depend on an already-selected hostel record.
const hostelPath = join(root, "app/hostel-master.tsx");
let hostel = await readFile(hostelPath, "utf8");

// Keep accommodation categories driven by Operational Master for the current group company.
hostel = hostel.replace(
  /const activeTypes = types\.filter\(\n    \(t\) =>\n      t\.vendorId === vendorId &&\n      t\.status === "active" &&\n      !t\.name\.toLowerCase\(\)\.includes\("local\/local"\),\n  \);/,
  `const activeTypes = types.filter(
    (t) =>
      t.vendorId === vendorId &&
      t.status === "active" &&
      !t.name.toLowerCase().includes("local/local"),
  );`,
);

// First-time create must use the chosen Operational Master category, not selected hostel.
hostel = hostel.replace(
  /async function createHostel\(e: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n  async function createRoom/,
  `async function createHostel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!typeId) return;
    if (
      await onAction("save-hostel", \`${'${placeLabel}'} created\`, {
        vendorId,
        accommodationTypeId: typeId,
        name: f.get("name"),
        address: f.get("address"),
        inchargeName: f.get("inchargeName"),
        ebMeterNumber: f.get("ebMeterNumber"),
        clientScope: f.getAll("clientScope"),
        remarks: f.get("remarks"),
      })
    ) {
      e.currentTarget.reset();
    }
  }
  async function createRoom`,
);

// Make the hierarchy explicit to the operator.
hostel = hostel.replaceAll("Step 1 · Accommodation type", "Step 1 · Accommodation type / room category");
hostel = hostel.replaceAll("Select the accommodation category first", "Select accommodation type / room category from Operational Masters");
hostel = hostel.replace(
  "Step 2 · {placeLabel} master",
  "Step 2 · {isOutsideRoom ? \"Area name\" : \"Hostel\"} master",
);
hostel = hostel.replace(
  "New {placeLabel.toLowerCase()} name *",
  "New {isOutsideRoom ? \"area name\" : \"hostel name\"} *",
);
hostel = hostel.replace(
  "Create {placeLabel.toLowerCase()}",
  "Create {isOutsideRoom ? \"area name\" : \"hostel\"}",
);

await writeFile(hostelPath, hostel, "utf8");

// Add Recovery for Rooms should work like Add Recovery by Date: choose one date first,
// then accommodation category -> hostel/area -> room -> confirmed members -> amounts.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

if (!recovery.includes("roomRecoveryDate")) {
  recovery = recovery.replace(
    '  const [roomRecoveryConfirmed, setRoomRecoveryConfirmed] = useState(false);',
    `  const [roomRecoveryConfirmed, setRoomRecoveryConfirmed] = useState(false);
  const [roomRecoveryDate, setRoomRecoveryDate] = useState(
    run?.periodStart ?? \`${'${run?.payPeriod ?? new Date().toISOString().slice(0, 7)}'}-01\`,
  );`,
  );
}

recovery = recovery.replace(
  /const recoveryDate = run\.periodEnd \?\? `\$\{run\.payPeriod\}-01`;/,
  "const recoveryDate = roomRecoveryDate || run.periodEnd || `${run.payPeriod}-01`;",
);

recovery = recovery.replaceAll(
  "Room-wise monthly recovery entry",
  "Add Recovery for Rooms",
);
recovery = recovery.replaceAll(
  "Confirm roommates → enter Gas / Ration / Provision → save",
  "Select date → accommodation category → sub category → room → confirm employees → enter recovery",
);

if (!recovery.includes("Room recovery date *")) {
  recovery = recovery.replace(
    `<span className="muted-label">Applied only to confirmed roommates in this payroll month</span>
          </div>
          <label>
            <span>Accommodation category *</span>`,
    `<span className="muted-label">Applied only to confirmed roommates in this payroll month</span>
          </div>
          <label>
            <span>Room recovery date *</span>
            <input
              type="date"
              value={roomRecoveryDate}
              onChange={(event) => setRoomRecoveryDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Accommodation category *</span>`,
  );
}

recovery = recovery.replace(
  /disabled=\{isActing \|\| !roomRecoveryId \|\| !roomRecoveryConfirmed \|\| roomRecoveryMembers\.length === 0\}/,
  "disabled={isActing || !roomRecoveryDate || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0}",
);

await writeFile(recoveryPath, recovery, "utf8");
console.log("Hostel/Area Master creation fixed and Add Recovery for Rooms now includes date-wise entry flow.");
