import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Exact requested Hostel/Area Master hierarchy:
// Operational Master Accommodation Type / Room Category -> Hostel or Area Name -> Rooms.
const hostelPath = join(root, "app/hostel-master.tsx");
let hostel = await readFile(hostelPath, "utf8");

// Force first-time creation to depend only on selected accommodation category.
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
      setHostelId("");
    }
  }
  async function createRoom`,
);

// Replace the card selector with one clear Operational Master dropdown.
hostel = hostel.replace(
  /<div className="accommodation-type-grid">[\s\S]*?<\/div>\n      <\/section>/,
  `<div className="form-grid">
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
            <small className="muted-label">Loaded directly from Operational Masters</small>
          </label>
        </div>
      </section>`,
);

hostel = hostel.replaceAll("Step 1 · Accommodation type", "Step 1 · Operational Master accommodation type / room category");
hostel = hostel.replaceAll("Select the accommodation category first", "Choose the Accommodation Type / Room Category created in Operational Masters");
hostel = hostel.replaceAll("Stored local areas", "Stored areas");
hostel = hostel.replaceAll('const placeLabel = isOutsideRoom ? "Local area" : "Hostel";', 'const placeLabel = isOutsideRoom ? "Area" : "Hostel";');

await writeFile(hostelPath, hostel, "utf8");

// Exact requested room-recovery flow:
// Date first -> then category -> subcategory -> room -> members -> recovery values.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

recovery = recovery.replaceAll("Room recovery date *", "Recovery date *");
recovery = recovery.replaceAll("Applied only to confirmed roommates in this payroll month", "Select the recovery date first. Then complete the room recovery details below.");

// Hide the rest of the room-recovery form until a date is selected.
const categoryStart = `          <label>\n            <span>Accommodation category *</span>`;
if (recovery.includes(categoryStart) && !recovery.includes("room-recovery-after-date")) {
  recovery = recovery.replace(
    categoryStart,
    `          {roomRecoveryDate ? (\n            <div className="form-span form-grid room-recovery-after-date">\n          <label>\n            <span>Accommodation Type / Room Category *</span>`,
  );

  const saveButtonEnd = `          <button className="primary-button form-span" disabled={isActing || !roomRecoveryDate || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0}>\n            Save room recovery for {run.payPeriod}\n          </button>`;
  if (recovery.includes(saveButtonEnd)) {
    recovery = recovery.replace(
      saveButtonEnd,
      `${saveButtonEnd}\n            </div>\n          ) : (\n            <div className="form-span empty-state">Select the recovery date to continue.</div>\n          )}`,
    );
  }
}

// Keep terminology aligned with Hostel/Area Master.
recovery = recovery.replaceAll("Sub category / Area name *", "Sub Category / Area Name *");
recovery = recovery.replaceAll("Sub category / Hostel name *", "Sub Category / Hostel Name *");

await writeFile(recoveryPath, recovery, "utf8");
console.log("Exact requested Hostel/Area Master dropdown flow and date-first Room Recovery flow applied.");
