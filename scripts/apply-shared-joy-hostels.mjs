import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hostelPath = join(root, "app/hostel-master.tsx");
const appPath = join(root, "app/payroll-app.tsx");

let hostel = await readFile(hostelPath, "utf8");

// Add one shared-hostel resolver. Joy Room / Joy Hostel categories are group-common;
// other accommodation categories remain company-specific.
if (!hostel.includes("const isJoySharedAccommodation")) {
  hostel = hostel.replace(
    '  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const typeHostels = hostels.filter(\n    (h) => h.vendorId === vendorId && h.accommodationTypeId === typeId,\n  );',
    `  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const selectedType = activeTypes.find((t) => t.id === typeId);\n  const normalizeAccommodationName = (value: string) => value.trim().toLowerCase().replace(/\\s+/g, " ");\n  const isJoySharedAccommodation = (value: string) => {\n    const name = normalizeAccommodationName(value);\n    return name.includes("joy") && (name.includes("hostel") || name.includes("room"));\n  };\n  const joyShared = Boolean(selectedType && isJoySharedAccommodation(selectedType.name));\n  const equivalentTypeIds = joyShared\n    ? types.filter((t) => isJoySharedAccommodation(t.name)).map((t) => t.id)\n    : [typeId];\n  const typeHostels = hostels.filter((h) =>\n    joyShared\n      ? Boolean(h.accommodationTypeId && equivalentTypeIds.includes(h.accommodationTypeId))\n      : h.vendorId === vendorId && h.accommodationTypeId === typeId,\n  );`,
  );
}

hostel = hostel.replace(
  '  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";',
  '  const selectedTypeName = selectedType?.name ?? "";',
);

hostel = hostel.replace(
  '  const eligibleRooms = rooms.filter(\n      (r) => r.vendorId === vendorId && r.accommodationTypeId === typeId,\n    ),',
  `  const eligibleRooms = rooms.filter((r) =>\n      joyShared\n        ? equivalentTypeIds.includes(r.accommodationTypeId)\n        : r.vendorId === vendorId && r.accommodationTypeId === typeId,\n    ),`,
);

hostel = hostel.replace(
  '      scope === "overall"\n        ? hostels.some((h) => h.id === r.hostelId && h.vendorId === vendorId)\n        : r.hostelId === selected?.id,',
  `      scope === "overall"\n        ? typeHostels.some((h) => h.id === r.hostelId)\n        : r.hostelId === selected?.id,`,
);

hostel = hostel.replace(
  '      employee.accommodationType === selectedTypeName &&\n      mappedUnitIds.includes(employee.clientUnitId),',
  `      (joyShared\n        ? isJoySharedAccommodation(employee.accommodationType)\n        : employee.accommodationType === selectedTypeName) &&\n      mappedUnitIds.includes(employee.clientUnitId),`,
);

hostel = hostel.replace(
  '      vendorId,\n      accommodationTypeId: typeId,\n      name: f.get("name"),',
  '      vendorId: selected.vendorId,\n      accommodationTypeId: selected.accommodationTypeId ?? typeId,\n      name: f.get("name"),',
);

// Show clear UI note only for the shared Joy category.
if (!hostel.includes("Joy Group shared hostel")) {
  hostel = hostel.replace(
    '          <div className="panel-heading">\n            <div>\n              <span className="eyebrow">Step 2 · {placeLabel} master</span>',
    `          <div className="panel-heading">\n            <div>\n              <span className="eyebrow">Step 2 · {placeLabel} master</span>\n              {joyShared ? <small className="muted-label">Joy Group shared hostel · usable by Joy Manpower Service and Joy Corporate Solutions client units</small> : null}`,
  );
}

await writeFile(hostelPath, hostel, "utf8");

let app = await readFile(appPath, "utf8");
// Hostel Master needs the complete Joy Group unit/type list so one common hostel can
// be mapped to employer units under both Joy Manpower and Joy Corporate.
app = app.replace(
  `              units={data.units.filter(\n                (unit) => unit.vendorId === activeVendorId,\n              )}\n              types={currentTypes}`,
  `              units={data.units}\n              types={data.accommodationTypes}`,
);
await writeFile(appPath, app, "utf8");

console.log("Joy Hostel sharing enabled across Joy Manpower Service and Joy Corporate Solutions while keeping non-Joy accommodation company-specific.");
