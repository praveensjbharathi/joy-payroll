import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Final enforcement for the exact requested Hostel Master flow.
const hostelPath = join(root, "app/hostel-master.tsx");
let hostel = await readFile(hostelPath, "utf8");

// A first Hostel/Area must be creatable even when no stored record exists yet.
hostel = hostel.replaceAll("vendorId: selected.vendorId,", "vendorId,");
hostel = hostel.replaceAll(
  "accommodationTypeId: selected.accommodationTypeId ?? typeId,",
  "accommodationTypeId: typeId,",
);
hostel = hostel.replaceAll(
  'const placeLabel = isOutsideRoom ? "Local area" : "Hostel";',
  'const placeLabel = isOutsideRoom ? "Area" : "Hostel";',
);

// Replace the visual accommodation cards with one Operational Master driven Room Category dropdown.
const gridStart = hostel.indexOf('        <div className="accommodation-type-grid">');
if (gridStart >= 0) {
  const sectionEnd = hostel.indexOf("      </section>", gridStart);
  if (sectionEnd >= 0) {
    const replacement = `        <div className="form-grid">
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
            <small className="muted-label">Loaded from Operational Masters</small>
          </label>
        </div>\n`;
    hostel = hostel.slice(0, gridStart) + replacement + hostel.slice(sectionEnd);
  }
}

hostel = hostel.replaceAll(
  "Step 1 · Accommodation type / room category",
  "Step 1 · Operational Master Room Category",
);
hostel = hostel.replaceAll(
  "Step 1 · Accommodation type",
  "Step 1 · Operational Master Room Category",
);
hostel = hostel.replaceAll(
  "Select accommodation type / room category from Operational Masters",
  "Select Accommodation Type / Room Category from Operational Masters",
);
hostel = hostel.replaceAll(
  "Select the accommodation category first",
  "Select Accommodation Type / Room Category from Operational Masters",
);
hostel = hostel.replaceAll("Stored local areas", "Stored areas");
hostel = hostel.replaceAll(
  "New {placeLabel.toLowerCase()} name *",
  "New {isOutsideRoom ? \"Area Name\" : \"Hostel Name\"} *",
);
hostel = hostel.replaceAll(
  "Create {placeLabel.toLowerCase()}",
  "Create {isOutsideRoom ? \"Area Name\" : \"Hostel\"}",
);

await writeFile(hostelPath, hostel, "utf8");

// Room recovery must behave like Add Recovery by Date: date is explicitly selected first.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

// Do not auto-fill the room recovery date. The rest of the form appears only after user selects it.
recovery = recovery.replace(
  /const \[roomRecoveryDate, setRoomRecoveryDate\] = useState\([\s\S]*?\n  \);/,
  'const [roomRecoveryDate, setRoomRecoveryDate] = useState("");',
);
recovery = recovery.replaceAll("Room recovery date *", "Recovery date *");
recovery = recovery.replaceAll(
  "Applied only to confirmed roommates in this payroll month",
  "Select the recovery date first. Remaining room recovery fields will open after the date is selected.",
);
recovery = recovery.replaceAll(
  "Select date → accommodation category → sub category → room → confirm employees → enter recovery",
  "Select date → Accommodation Type / Room Category → Hostel or Area → Room → confirm employees → enter recovery",
);

await writeFile(recoveryPath, recovery, "utf8");
console.log("Enforced requested flow: Operational Master Room Category -> Hostel/Area creation, and date-first Add Recovery for Rooms.");
