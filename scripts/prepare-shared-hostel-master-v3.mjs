import { readFile, writeFile } from "node:fs/promises";

const path = "app/hostel-master.tsx";
let source = await readFile(path, "utf8");

source = source.replace(
  `  RoomExpense,\n} from "./payroll-app";`,
  `  RoomExpense,\n  Vendor,\n} from "./payroll-app";`,
);
source = source.replace(/  vendorId,\n  (?!vendors,)/, `  vendorId,\n  vendors,\n  `);
source = source.replace(
  `  vendorId: string;\n  units: ClientUnit[];`,
  `  vendorId: string;\n  vendors: Vendor[];\n  units: ClientUnit[];`,
);

const sharedBlock = `  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");
  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";
  const scopeValues = (value: string, fallback: string[] = []) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) && parsed.length ? parsed.filter((item): item is string => typeof item === "string") : fallback;
    } catch {
      return fallback;
    }
  };
  const groupCompaniesFor = (hostel: Hostel) =>
    scopeValues(hostel.groupCompanyScopeJson, [hostel.vendorId]);
  const typeNameForHostel = (hostel: Hostel) =>
    types.find((type) => type.id === hostel.accommodationTypeId)?.name ?? "";
  const typeHostels = hostels.filter(
    (hostel) =>
      groupCompaniesFor(hostel).includes(vendorId) &&
      typeNameForHostel(hostel) === selectedTypeName,
  );
  const [hostelId, setHostelId] = useState("");
  const [allocationEmployeeId, setAllocationEmployeeId] = useState("");
  const [allocationRoomId, setAllocationRoomId] = useState("");
  const [allocationRent, setAllocationRent] = useState(0);
  const selected = typeHostels.find((h) => h.id === hostelId) ?? typeHostels[0];`;

source = source.replace(
  /  const \[typeId, setTypeId\] = useState\(activeTypes\[0\]\?\.id \?\? ""\);[\s\S]*?  const selected = typeHostels\.find\(\(h\) => h\.id === hostelId\) \?\? typeHostels\[0\];(?:\n  const selectedTypeName = .*?;)?/,
  sharedBlock,
);

source = source.replace(
  /  const eligibleRooms = rooms\.filter\([\s\S]*?\n    \),\n    hostelRooms =/,
  `  const eligibleRooms = rooms.filter((room) => {
      const hostel = room.hostelId ? hostels.find((entry) => entry.id === room.hostelId) : null;
      const roomTypeName = types.find((type) => type.id === room.accommodationTypeId)?.name ?? "";
      if (roomTypeName !== selectedTypeName) return false;
      return hostel
        ? groupCompaniesFor(hostel).includes(vendorId)
        : room.vendorId === vendorId;
    }),
    hostelRooms =`,
);

source = source.replace(
  /async function createHostel\(e: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n  async function createRoom/,
  `async function createHostel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!typeId) return;
    if (
      await onAction("save-hostel", \`${"${placeLabel}"} created\`, {
        vendorId,
        accommodationTypeId: typeId,
        name: f.get("name"),
        address: f.get("address"),
        inchargeName: f.get("inchargeName"),
        ebMeterNumber: f.get("ebMeterNumber"),
        groupCompanyScope: f.getAll("groupCompanyScope"),
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

source = source.replace(
  /async function updateHostel\(e: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n  async function allocateEmployee/,
  `async function updateHostel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    await onAction("save-hostel", \`${"${placeLabel}"} updated\`, {
      id: selected.id,
      vendorId,
      accommodationTypeId: typeId,
      name: f.get("name"),
      address: f.get("address"),
      inchargeName: f.get("inchargeName"),
      ebMeterNumber: f.get("ebMeterNumber"),
      groupCompanyScope: f.getAll("groupCompanyScope"),
      clientScope: f.getAll("clientScope"),
      remarks: f.get("remarks"),
    });
  }
  async function allocateEmployee`,
);

if (!source.includes("const mappedCompanyIds")) {
  source = source.replace(
    `  const mappedUnitIds: string[] = selected\n    ? (() => {`,
    `  const mappedCompanyIds: string[] = selected ? groupCompaniesFor(selected) : [];\n  const mappedUnitIds: string[] = selected\n    ? (() => {`,
  );
}

const createScope = `              <section className="form-span payslip-field-selector">
                <strong>Applicable Joy group companies *</strong>
                <div className="scope-checkbox-grid">
                  {vendors.filter((vendor) => vendor.status === "active").map((vendor) => (
                    <label key={vendor.id}>
                      <input type="checkbox" name="groupCompanyScope" value={vendor.id} defaultChecked={vendor.id === vendorId} />
                      <span>{vendor.name}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="form-span payslip-field-selector">
                <strong>Map this {placeLabel.toLowerCase()} to client employer units *</strong>
                <div className="scope-checkbox-grid">
                  {units.filter((unit) => unit.status === "active").map((unit) => {
                    const company = vendors.find((vendor) => vendor.id === unit.vendorId);
                    return (
                      <label key={unit.id}>
                        <input type="checkbox" name="clientScope" value={unit.id} />
                        <span>{company?.code ?? "JOY"} · {unit.clientName} · {unit.unitName}</span>
                      </label>
                    );
                  })}
                </div>
              </section>`;
source = source.replace(
  /              <section className="form-span payslip-field-selector">\n                <strong>\n                  Map this \{placeLabel\.toLowerCase\(\)\} to client employer units \*\n                <\/strong>[\s\S]*?              <\/section>/,
  createScope,
);

const editScope = `                <section className="form-span payslip-field-selector">
                  <strong>Applicable Joy group companies</strong>
                  <div className="scope-checkbox-grid">
                    {vendors.filter((vendor) => vendor.status === "active").map((vendor) => (
                      <label key={vendor.id}>
                        <input type="checkbox" name="groupCompanyScope" value={vendor.id} defaultChecked={mappedCompanyIds.includes(vendor.id)} disabled={!canManage} />
                        <span>{vendor.name}</span>
                      </label>
                    ))}
                  </div>
                </section>
                <section className="form-span payslip-field-selector">
                  <strong>Mapped client employer units</strong>
                  <div className="scope-checkbox-grid">
                    {units.filter((unit) => unit.status === "active").map((unit) => {
                      const company = vendors.find((vendor) => vendor.id === unit.vendorId);
                      return (
                        <label key={unit.id}>
                          <input type="checkbox" name="clientScope" value={unit.id} defaultChecked={mappedUnitIds.includes(unit.id)} disabled={!canManage} />
                          <span>{company?.code ?? "JOY"} · {unit.clientName} · {unit.unitName}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>`;
source = source.replace(
  /                <section className="form-span payslip-field-selector">\n                  <strong>Mapped client employer units<\/strong>[\s\S]*?                <\/section>/,
  editScope,
);

await writeFile(path, source, "utf8");
console.log("Prepared final Hostel Master structure for one physical hostel shared across Joy companies and client units.");
