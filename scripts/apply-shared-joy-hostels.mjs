import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hostelPath = join(root, "app/hostel-master.tsx");
const appPath = join(root, "app/payroll-app.tsx");

let hostel = await readFile(hostelPath, "utf8");

// Always rebuild the complete type-selection block. The production preparation
// pipeline runs more than once, so this must be safely idempotent even when an
// earlier patch script restores part of HostelMaster between passes.
const typeBlockPattern = /  const \[typeId, setTypeId\] = useState\(activeTypes\[0\]\?\.id \?\? ""\);[\s\S]*?  const \[hostelId, setHostelId\] = useState\(""\);/;
const sharedTypeBlock = `  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");
  const selectedType = activeTypes.find((t) => t.id === typeId);
  const normalizeAccommodationName = (value: string) =>
    value.trim().toLowerCase().replace(/\\s+/g, " ");
  const isJoySharedAccommodation = (value: string) => {
    const name = normalizeAccommodationName(value);
    return name.includes("joy") && (name.includes("hostel") || name.includes("room"));
  };
  const joyShared = Boolean(
    selectedType && isJoySharedAccommodation(selectedType.name),
  );
  const equivalentTypeIds = joyShared
    ? types
        .filter((t) => t.status === "active" && isJoySharedAccommodation(t.name))
        .map((t) => t.id)
    : [typeId];
  const typeHostels = hostels.filter((h) =>
    joyShared
      ? Boolean(
          h.accommodationTypeId &&
            equivalentTypeIds.includes(h.accommodationTypeId),
        )
      : h.vendorId === vendorId && h.accommodationTypeId === typeId,
  );
  const [hostelId, setHostelId] = useState("");`;

if (!typeBlockPattern.test(hostel)) {
  throw new Error("Unable to locate HostelMaster accommodation type block");
}
hostel = hostel.replace(typeBlockPattern, sharedTypeBlock);

hostel = hostel.replace(
  /  const selectedTypeName = .*?;\n/,
  '  const selectedTypeName = selectedType?.name ?? "";\n',
);

hostel = hostel.replace(
  /  const eligibleRooms = rooms\.filter\([\s\S]*?\n    \),\n    hostelRooms =/,
  `  const eligibleRooms = rooms.filter((r) =>
      joyShared
        ? equivalentTypeIds.includes(r.accommodationTypeId)
        : r.vendorId === vendorId && r.accommodationTypeId === typeId,
    ),
    hostelRooms =`,
);

hostel = hostel.replace(
  '      scope === "overall"\n        ? hostels.some((h) => h.id === r.hostelId && h.vendorId === vendorId)\n        : r.hostelId === selected?.id,',
  `      scope === "overall"
        ? typeHostels.some((h) => h.id === r.hostelId)
        : r.hostelId === selected?.id,`,
);

hostel = hostel.replace(
  '      employee.accommodationType === selectedTypeName &&\n      mappedUnitIds.includes(employee.clientUnitId),',
  `      (joyShared
        ? isJoySharedAccommodation(employee.accommodationType)
        : employee.accommodationType === selectedTypeName) &&
      mappedUnitIds.includes(employee.clientUnitId),`,
);

// Editing a shared hostel must preserve the company/type that originally owns
// that stored hostel record instead of reassigning it to the currently selected company.
hostel = hostel.replace(
  '      vendorId,\n      accommodationTypeId: typeId,\n      name: f.get("name"),',
  '      vendorId: selected.vendorId,\n      accommodationTypeId: selected.accommodationTypeId ?? typeId,\n      name: f.get("name"),',
);

if (!hostel.includes("Joy Group shared hostel")) {
  hostel = hostel.replace(
    '          <div className="panel-heading">\n            <div>\n              <span className="eyebrow">Step 2 · {placeLabel} master</span>',
    `          <div className="panel-heading">
            <div>
              <span className="eyebrow">Step 2 · {placeLabel} master</span>
              {joyShared ? (
                <small className="muted-label">
                  Joy Group shared hostel · usable by Joy Manpower Service and Joy Corporate Solutions client units
                </small>
              ) : null}`,
  );
}

await writeFile(hostelPath, hostel, "utf8");

let app = await readFile(appPath, "utf8");
// Hostel Master gets the full group unit/type lists. HostelMaster itself keeps
// non-Joy accommodation company-specific and shares only Joy Hostel / Joy Room.
app = app.replace(
  /              units=\{data\.units\.filter\(\n                \(unit\) => unit\.vendorId === activeVendorId,\n              \)\}\n              types=\{currentTypes\}/g,
  `              units={data.units}
              types={data.accommodationTypes}`,
);
await writeFile(appPath, app, "utf8");

console.log(
  "Joy Hostel sharing enabled across Joy Manpower Service and Joy Corporate Solutions while keeping non-Joy accommodation company-specific.",
);
