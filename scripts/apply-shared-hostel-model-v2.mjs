import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const file = join(root, path);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await writeFile(file, after, "utf8");
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`Shared-hostel patch failed: ${label}`);
  return source.replace(oldText, newText);
}

await patch("db/schema.ts", (source) => {
  source = replaceOnce(
    source,
    `    ebMeterNumber: text("eb_meter_number"),\n    clientScopeJson: text("client_scope_json").notNull().default("[]"),`,
    `    ebMeterNumber: text("eb_meter_number"),\n    groupCompanyScopeJson: text("group_company_scope_json").notNull().default("[]"),\n    clientScopeJson: text("client_scope_json").notNull().default("[]"),`,
    "hostel group-company schema",
  );
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  source = replaceOnce(
    source,
    `  ebMeterNumber: string | null;\n  clientScopeJson: string;`,
    `  ebMeterNumber: string | null;\n  groupCompanyScopeJson: string;\n  clientScopeJson: string;`,
    "Hostel type group-company scope",
  );
  source = replaceOnce(
    source,
    `            <HostelMaster\n              vendorId={activeVendorId}\n              units={data.units.filter(\n                (unit) => unit.vendorId === activeVendorId,\n              )}\n              types={currentTypes}`,
    `            <HostelMaster\n              vendorId={activeVendorId}\n              vendors={data.vendors}\n              units={data.units}\n              types={data.accommodationTypes}`,
    "HostelMaster shared props",
  );
  source = replaceOnce(
    source,
    `                types={currentTypes}\n                hostels={data.hostels}\n                units={data.units.filter(\n                  (entry) => entry.vendorId === activeVendorId,\n                )}`,
    `                types={data.accommodationTypes}\n                hostels={data.hostels}\n                units={data.units}`,
    "AccommodationControlCenter shared props",
  );
  return source;
});

await patch("app/hostel-master.tsx", (source) => {
  source = replaceOnce(
    source,
    `  RoomExpense,\n} from "./payroll-app";`,
    `  RoomExpense,\n  Vendor,\n} from "./payroll-app";`,
    "HostelMaster Vendor import",
  );
  source = replaceOnce(
    source,
    `  vendorId,\n  units,`,
    `  vendorId,\n  vendors,\n  units,`,
    "HostelMaster vendors argument",
  );
  source = replaceOnce(
    source,
    `  vendorId: string;\n  units: ClientUnit[];`,
    `  vendorId: string;\n  vendors: Vendor[];\n  units: ClientUnit[];`,
    "HostelMaster vendors type",
  );

  const oldFilter = `  const activeTypes = types.filter(\n    (t) =>\n      t.vendorId === vendorId &&\n      t.status === "active" &&\n      !t.name.toLowerCase().includes("local/local"),\n  );\n  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const typeHostels = hostels.filter(\n    (h) => h.vendorId === vendorId && h.accommodationTypeId === typeId,\n  );\n  const [hostelId, setHostelId] = useState("");\n  const [allocationEmployeeId, setAllocationEmployeeId] = useState("");\n  const [allocationRoomId, setAllocationRoomId] = useState("");\n  const [allocationRent, setAllocationRent] = useState(0);\n  const selected = typeHostels.find((h) => h.id === hostelId) ?? typeHostels[0];\n  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";`;
  const newFilter = `  const activeTypes = types.filter(\n    (t) =>\n      t.vendorId === vendorId &&\n      t.status === "active" &&\n      !t.name.toLowerCase().includes("local/local"),\n  );\n  const [typeId, setTypeId] = useState(activeTypes[0]?.id ?? "");\n  const selectedTypeName = activeTypes.find((t) => t.id === typeId)?.name ?? "";\n  const scopeValues = (value: string, fallback: string[] = []) => {\n    try {\n      const parsed = JSON.parse(value || "[]");\n      return Array.isArray(parsed) && parsed.length ? parsed.filter((item): item is string => typeof item === "string") : fallback;\n    } catch {\n      return fallback;\n    }\n  };\n  const groupCompaniesFor = (hostel: Hostel) =>\n    scopeValues(hostel.groupCompanyScopeJson, [hostel.vendorId]);\n  const typeNameForHostel = (hostel: Hostel) =>\n    types.find((type) => type.id === hostel.accommodationTypeId)?.name ?? "";\n  const typeHostels = hostels.filter(\n    (hostel) =>\n      groupCompaniesFor(hostel).includes(vendorId) &&\n      typeNameForHostel(hostel) === selectedTypeName,\n  );\n  const [hostelId, setHostelId] = useState("");\n  const [allocationEmployeeId, setAllocationEmployeeId] = useState("");\n  const [allocationRoomId, setAllocationRoomId] = useState("");\n  const [allocationRent, setAllocationRent] = useState(0);\n  const selected = typeHostels.find((h) => h.id === hostelId) ?? typeHostels[0];`;
  source = replaceOnce(source, oldFilter, newFilter, "shared hostel filtering");

  source = replaceOnce(
    source,
    `  const eligibleRooms = rooms.filter(\n      (r) => r.vendorId === vendorId && r.accommodationTypeId === typeId,\n    ),`,
    `  const eligibleRooms = rooms.filter((room) => {\n      const hostel = room.hostelId ? hostels.find((entry) => entry.id === room.hostelId) : null;\n      const roomTypeName = types.find((type) => type.id === room.accommodationTypeId)?.name ?? "";\n      if (roomTypeName !== selectedTypeName) return false;\n      return hostel\n        ? groupCompaniesFor(hostel).includes(vendorId)\n        : room.vendorId === vendorId;\n    }),`,
    "shared room filtering in HostelMaster",
  );

  source = replaceOnce(
    source,
    `        clientScope: f.getAll("clientScope"),\n        remarks: f.get("remarks"),`,
    `        groupCompanyScope: f.getAll("groupCompanyScope"),\n        clientScope: f.getAll("clientScope"),\n        remarks: f.get("remarks"),`,
    "create hostel group-company payload",
  );
  const updatePayloadOld = `      ebMeterNumber: f.get("ebMeterNumber"),\n      clientScope: f.getAll("clientScope"),\n      remarks: f.get("remarks"),`;
  const updatePayloadNew = `      ebMeterNumber: f.get("ebMeterNumber"),\n      groupCompanyScope: f.getAll("groupCompanyScope"),\n      clientScope: f.getAll("clientScope"),\n      remarks: f.get("remarks"),`;
  source = replaceOnce(source, updatePayloadOld, updatePayloadNew, "update hostel group-company payload");

  const createScopeOld = `              <section className="form-span payslip-field-selector">\n                <strong>\n                  Map this {placeLabel.toLowerCase()} to client employer units *\n                </strong>\n                <div className="scope-checkbox-grid">\n                  {units.map((unit) => (\n                    <label key={unit.id}>\n                      <input\n                        type="checkbox"\n                        name="clientScope"\n                        value={unit.id}\n                      />\n                      <span>\n                        {unit.clientName} · {unit.unitName}\n                      </span>\n                    </label>\n                  ))}\n                </div>\n              </section>`;
  const createScopeNew = `              <section className="form-span payslip-field-selector">\n                <strong>Applicable Joy group companies *</strong>\n                <div className="scope-checkbox-grid">\n                  {vendors.filter((vendor) => vendor.status === "active").map((vendor) => (\n                    <label key={vendor.id}>\n                      <input type="checkbox" name="groupCompanyScope" value={vendor.id} defaultChecked={vendor.id === vendorId} />\n                      <span>{vendor.name}</span>\n                    </label>\n                  ))}\n                </div>\n              </section>\n              <section className="form-span payslip-field-selector">\n                <strong>Map this {placeLabel.toLowerCase()} to client employer units *</strong>\n                <div className="scope-checkbox-grid">\n                  {units.filter((unit) => unit.status === "active").map((unit) => {\n                    const company = vendors.find((vendor) => vendor.id === unit.vendorId);\n                    return (\n                      <label key={unit.id}>\n                        <input type="checkbox" name="clientScope" value={unit.id} />\n                        <span>{company?.code ?? "JOY"} · {unit.clientName} · {unit.unitName}</span>\n                      </label>\n                    );\n                  })}\n                </div>\n              </section>`;
  source = replaceOnce(source, createScopeOld, createScopeNew, "hostel create group-company UI");

  source = replaceOnce(
    source,
    `  const mappedUnitIds: string[] = selected\n    ? (() => {`,
    `  const mappedCompanyIds: string[] = selected ? groupCompaniesFor(selected) : [];\n  const mappedUnitIds: string[] = selected\n    ? (() => {`,
    "mapped company ids",
  );

  const editScopeOld = `                <section className="form-span payslip-field-selector">\n                  <strong>Mapped client employer units</strong>\n                  <div className="scope-checkbox-grid">\n                    {units.map((unit) => (\n                      <label key={unit.id}>\n                        <input type="checkbox" name="clientScope" value={unit.id} defaultChecked={mappedUnitIds.includes(unit.id)} disabled={!canManage} />\n                        <span>{unit.clientName} · {unit.unitName}</span>\n                      </label>\n                    ))}\n                  </div>\n                </section>`;
  const editScopeNew = `                <section className="form-span payslip-field-selector">\n                  <strong>Applicable Joy group companies</strong>\n                  <div className="scope-checkbox-grid">\n                    {vendors.filter((vendor) => vendor.status === "active").map((vendor) => (\n                      <label key={vendor.id}>\n                        <input type="checkbox" name="groupCompanyScope" value={vendor.id} defaultChecked={mappedCompanyIds.includes(vendor.id)} disabled={!canManage} />\n                        <span>{vendor.name}</span>\n                      </label>\n                    ))}\n                  </div>\n                </section>\n                <section className="form-span payslip-field-selector">\n                  <strong>Mapped client employer units</strong>\n                  <div className="scope-checkbox-grid">\n                    {units.filter((unit) => unit.status === "active").map((unit) => {\n                      const company = vendors.find((vendor) => vendor.id === unit.vendorId);\n                      return (\n                        <label key={unit.id}>\n                          <input type="checkbox" name="clientScope" value={unit.id} defaultChecked={mappedUnitIds.includes(unit.id)} disabled={!canManage} />\n                          <span>{company?.code ?? "JOY"} · {unit.clientName} · {unit.unitName}</span>\n                        </label>\n                      );\n                    })}\n                  </div>\n                </section>`;
  source = replaceOnce(source, editScopeOld, editScopeNew, "hostel edit group-company UI");
  return source;
});

await patch("app/payroll-enhancements.tsx", (source) => {
  const oldRooms = `  const vendorTypes = types.filter((type) => type.vendorId === vendorId);\n  const vendorRooms = rooms.filter(\n    (room) =>\n      room.vendorId === vendorId &&\n      (typeFilter === "all" || room.accommodationTypeId === typeFilter),\n  );`;
  const newRooms = `  const vendorTypes = types.filter((type) => type.vendorId === vendorId);\n  const hostelCompanyScope = (hostel: AppData["hostels"][number]) => {\n    try {\n      const values = JSON.parse(hostel.groupCompanyScopeJson || "[]");\n      return Array.isArray(values) && values.length ? values : [hostel.vendorId];\n    } catch { return [hostel.vendorId]; }\n  };\n  const selectedFilterName = typeFilter === "all" ? null : types.find((type) => type.id === typeFilter)?.name ?? null;\n  const vendorRooms = rooms.filter((room) => {\n    const hostel = room.hostelId ? hostels.find((entry) => entry.id === room.hostelId) : null;\n    const roomTypeName = types.find((type) => type.id === room.accommodationTypeId)?.name ?? "";\n    const companyMatch = hostel ? hostelCompanyScope(hostel).includes(vendorId) : room.vendorId === vendorId;\n    return companyMatch && (!selectedFilterName || roomTypeName === selectedFilterName);\n  });`;
  source = replaceOnce(source, oldRooms, newRooms, "AccommodationControlCenter shared rooms");

  const oldHostelFilter = `                  .filter(\n                    (hostel) =>\n                      hostel.vendorId === vendorId &&\n                      hostel.accommodationTypeId ===\n                        roomDraft.accommodationTypeId &&\n                      hostel.status === "active",\n                  )`;
  const newHostelFilter = `                  .filter((hostel) => {\n                    const selectedTypeName = types.find((type) => type.id === roomDraft.accommodationTypeId)?.name ?? "";\n                    const hostelTypeName = types.find((type) => type.id === hostel.accommodationTypeId)?.name ?? "";\n                    return hostel.status === "active" && hostelCompanyScope(hostel).includes(vendorId) && hostelTypeName === selectedTypeName;\n                  })`;
  source = replaceOnce(source, oldHostelFilter, newHostelFilter, "shared hostel room dropdown");
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  source = replaceOnce(
    source,
    `  if (\n    access.profile.role === "hr_team" &&\n    !access.profile.unitScope.includes(unitId)\n  ) {`,
    `  if (\n    (access.profile.role === "hr_team" || access.profile.role === "field_hr") &&\n    !access.profile.unitScope.includes(unitId)\n  ) {`,
    "Field HR unit scoping",
  );

  const roomScopeOld = `  const roomId = optionalValue(payload.roomId);\n  if (roomId) {\n    const [room] = await db\n      .select()\n      .from(accommodationRooms)\n      .where(eq(accommodationRooms.id, roomId))\n      .limit(1);\n    if (!room) throw new RequestError("Accommodation room not found", 404);\n    requireClientScope(access, room.vendorId);\n  }`;
  const roomScopeNew = `  const roomId = optionalValue(payload.roomId);\n  if (roomId) {\n    const [room] = await db.select().from(accommodationRooms).where(eq(accommodationRooms.id, roomId)).limit(1);\n    if (!room) throw new RequestError("Accommodation room not found", 404);\n    if (room.hostelId) {\n      const [hostel] = await db.select().from(hostels).where(eq(hostels.id, room.hostelId)).limit(1);\n      if (!hostel) throw new RequestError("Hostel / local area not found", 404);\n      const companies = normalizedScope(hostel.groupCompanyScopeJson);\n      const companyScope = companies.length ? companies : [hostel.vendorId];\n      const mappedUnits = normalizedScope(hostel.clientScopeJson);\n      if (access.profile.role === "payroll_team" && !companyScope.some((id) => access.profile.clientScope.includes(id)))\n        throw new RequestError("Your payroll access does not include this shared hostel", 403);\n      if ((access.profile.role === "hr_team" || access.profile.role === "field_hr") && !mappedUnits.some((id) => access.profile.unitScope.includes(id)))\n        throw new RequestError("Your employer-unit access does not include this shared hostel", 403);\n    } else {\n      requireClientScope(access, room.vendorId);\n    }\n  }`;
  source = replaceOnce(source, roomScopeOld, roomScopeNew, "shared room action scope");

  source = replaceOnce(
    source,
    `    allHostels,\n    allHostelReadings,`,
    `    allHostels,\n    allHostelReadings,`,
    "load tuple marker",
  );

  const roomRowsOld = `  const roomRows = allRoomRows.filter((room) => {\n    if (!visibleVendorIds.has(room.vendorId)) return false;\n    if (access.profile.role === "hostel_incharge")\n      return Boolean(room.hostelId && hostelScope.has(room.hostelId));\n    if (unrestricted || access.profile.role !== "hr_team") return true;\n    const occupants = allEmployeeRows.filter(\n      (employee) => employee.roomId === room.id && employee.status === "active",\n    );\n    return (\n      occupants.length === 0 ||\n      occupants.some((employee) => visibleEmployeeIds.has(employee.id))\n    );\n  });`;
  const roomRowsNew = `  const hostelCompanyScope = (hostel: typeof allHostels[number]) => {\n    const values = normalizedScope(hostel.groupCompanyScopeJson);\n    return values.length ? values : [hostel.vendorId];\n  };\n  const sharedHostelVisible = (hostel: typeof allHostels[number]) => {\n    if (access.profile.role === "hostel_incharge") return hostelScope.has(hostel.id);\n    const companyVisible = hostelCompanyScope(hostel).some((id) => visibleVendorIds.has(id));\n    if (!companyVisible) return false;\n    if (unrestricted || (access.profile.role !== "hr_team" && access.profile.role !== "field_hr")) return true;\n    const mappedUnits = normalizedScope(hostel.clientScopeJson);\n    return mappedUnits.some((id) => visibleUnitIds.has(id));\n  };\n  const visibleSharedHostelIds = new Set(allHostels.filter(sharedHostelVisible).map((hostel) => hostel.id));\n  const roomRows = allRoomRows.filter((room) => {\n    if (room.hostelId) return visibleSharedHostelIds.has(room.hostelId);\n    if (!visibleVendorIds.has(room.vendorId)) return false;\n    if (unrestricted || (access.profile.role !== "hr_team" && access.profile.role !== "field_hr")) return true;\n    const occupants = allEmployeeRows.filter((employee) => employee.roomId === room.id && employee.status === "active");\n    return occupants.length === 0 || occupants.some((employee) => visibleEmployeeIds.has(employee.id));\n  });`;
  source = replaceOnce(source, roomRowsOld, roomRowsNew, "shared room visibility");

  const hostelsReturnOld = `    hostels: canView(permissions, "accommodation")\n      ? allHostels.filter(\n          (hostel) =>\n            visibleVendorIds.has(hostel.vendorId) &&\n            (access.profile.role !== "hostel_incharge" ||\n              hostelScope.has(hostel.id)),\n        )\n      : [],\n    hostelUtilityReadings: canView(permissions, "accommodation")\n      ? allHostelReadings.filter((reading) =>\n          allHostels.some(\n            (hostel) =>\n              hostel.id === reading.hostelId &&\n              visibleVendorIds.has(hostel.vendorId),\n          ),\n        )\n      : [],`;
  const hostelsReturnNew = `    hostels: canView(permissions, "accommodation")\n      ? allHostels.filter(sharedHostelVisible)\n      : [],\n    hostelUtilityReadings: canView(permissions, "accommodation")\n      ? allHostelReadings.filter((reading) => visibleSharedHostelIds.has(reading.hostelId))\n      : [],`;
  source = replaceOnce(source, hostelsReturnOld, hostelsReturnNew, "shared hostel API visibility");

  const assignValidationOld = `  if (!room) return { ...values, roomId: null, roomNumber: null };\n  if (\n    room.vendorId !== values.vendorId ||\n    room.accommodationTypeId !== type.id\n  ) {\n    throw new RequestError(\n      "The selected room does not belong to this client and accommodation type",\n      409,\n    );\n  }`;
  const assignValidationNew = `  if (!room) return { ...values, roomId: null, roomNumber: null };\n  if (room.hostelId) {\n    const [hostel] = await db.select().from(hostels).where(eq(hostels.id, room.hostelId)).limit(1);\n    if (!hostel) throw new RequestError("Hostel / local area not found", 404);\n    const companies = normalizedScope(hostel.groupCompanyScopeJson);\n    const companyScope = companies.length ? companies : [hostel.vendorId];\n    const unitScope = normalizedScope(hostel.clientScopeJson);\n    const [hostelType] = hostel.accommodationTypeId\n      ? await db.select().from(accommodationTypes).where(eq(accommodationTypes.id, hostel.accommodationTypeId)).limit(1)\n      : [];\n    if (!companyScope.includes(values.vendorId) || !unitScope.includes(values.clientUnitId) || hostelType?.name !== type.name)\n      throw new RequestError("The selected shared room is not mapped to this Joy company, client employer unit, and accommodation type", 409);\n  } else if (room.vendorId !== values.vendorId || room.accommodationTypeId !== type.id) {\n    throw new RequestError("The selected room does not belong to this client and accommodation type", 409);\n  }`;
  source = replaceOnce(source, assignValidationOld, assignValidationNew, "shared room employee assignment");

  const saveHostelStart = `    } else if (action === "save-hostel") {\n      const vendorId = textValue(payload.vendorId, "Client");\n      const id = optionalValue(payload.id) ?? \`HOSTEL-\${crypto.randomUUID()}\`;\n      const accommodationTypeId = textValue(\n        payload.accommodationTypeId,\n        "Accommodation type",\n      );\n      const [hostelType] = await db\n        .select()\n        .from(accommodationTypes)\n        .where(eq(accommodationTypes.id, accommodationTypeId))\n        .limit(1);\n      if (!hostelType || hostelType.vendorId !== vendorId)\n        throw new RequestError(\n          "Select an accommodation type from this client",\n          409,\n        );\n      const clientScope = Array.isArray(payload.clientScope)\n        ? payload.clientScope.filter(\n            (value): value is string => typeof value === "string",\n          )\n        : [];\n      const validUnits = await db\n        .select({ id: clientUnits.id })\n        .from(clientUnits)\n        .where(eq(clientUnits.vendorId, vendorId));\n      const validIds = new Set(validUnits.map((unit) => unit.id));\n      if (clientScope.some((unitId) => !validIds.has(unitId)))\n        throw new RequestError(\n          "Hostel client mapping contains an invalid client unit",\n          409,\n        );\n      const values = {\n        vendorId,\n        accommodationTypeId,\n        name: textValue(payload.name, "Hostel name"),\n        address: optionalValue(payload.address),\n        inchargeName: optionalValue(payload.inchargeName),\n        ebMeterNumber: optionalValue(payload.ebMeterNumber),\n        clientScopeJson: JSON.stringify(clientScope),\n        remarks: optionalValue(payload.remarks),\n      };\n      const [existing] = await db\n        .select()\n        .from(hostels)\n        .where(eq(hostels.id, id))\n        .limit(1);\n      if (existing)\n        await db.update(hostels).set(values).where(eq(hostels.id, id));\n      else await db.insert(hostels).values({ id, ...values });`;
  const saveHostelNew = `    } else if (action === "save-hostel") {\n      const requestedVendorId = textValue(payload.vendorId, "Joy group company");\n      const existingId = optionalValue(payload.id);\n      const id = existingId ?? \`HOSTEL-\${crypto.randomUUID()}\`;\n      const requestedTypeId = textValue(payload.accommodationTypeId, "Accommodation type");\n      const [requestedType] = await db.select().from(accommodationTypes).where(eq(accommodationTypes.id, requestedTypeId)).limit(1);\n      if (!requestedType || requestedType.vendorId !== requestedVendorId)\n        throw new RequestError("Select an accommodation type from the active Joy group company", 409);\n      const groupCompanyScope = normalizedScope(payload.groupCompanyScope);\n      if (!groupCompanyScope.length) throw new RequestError("Select at least one applicable Joy group company");\n      const validCompanies = await db.select({ id: vendors.id }).from(vendors).where(inArray(vendors.id, groupCompanyScope));\n      if (validCompanies.length !== groupCompanyScope.length) throw new RequestError("One or more selected Joy group companies no longer exist", 404);\n      const [existing] = existingId ? await db.select().from(hostels).where(eq(hostels.id, existingId)).limit(1) : [];\n      const ownerVendorId = existing?.vendorId ?? (groupCompanyScope.includes(requestedVendorId) ? requestedVendorId : groupCompanyScope[0]);\n      const [ownerType] = await db.select().from(accommodationTypes).where(and(eq(accommodationTypes.vendorId, ownerVendorId), eq(accommodationTypes.name, requestedType.name))).limit(1);\n      if (!ownerType) throw new RequestError(\`Create the \${requestedType.name} accommodation type for the selected Joy company before sharing this hostel\`, 409);\n      const clientScope = normalizedScope(payload.clientScope);\n      if (!clientScope.length) throw new RequestError("Select at least one client employer unit for this hostel / area");\n      const validUnits = await db.select({ id: clientUnits.id, vendorId: clientUnits.vendorId }).from(clientUnits).where(inArray(clientUnits.id, clientScope));\n      if (validUnits.length !== clientScope.length || validUnits.some((unit) => !groupCompanyScope.includes(unit.vendorId)))\n        throw new RequestError("Every mapped client employer unit must belong to a selected Joy group company", 409);\n      const name = textValue(payload.name, "Hostel name");\n      if (!existingId) {\n        const all = await db.select().from(hostels);\n        const duplicate = all.find((hostel) => hostel.name.trim().toLowerCase() === name.toLowerCase());\n        if (duplicate) throw new RequestError("This physical hostel / area already exists. Open the stored record and add the Joy company or client mapping instead of creating a duplicate.", 409);\n      }\n      const values = {\n        vendorId: ownerVendorId,\n        accommodationTypeId: ownerType.id,\n        name,\n        address: optionalValue(payload.address),\n        inchargeName: optionalValue(payload.inchargeName),\n        ebMeterNumber: optionalValue(payload.ebMeterNumber),\n        groupCompanyScopeJson: JSON.stringify(groupCompanyScope),\n        clientScopeJson: JSON.stringify(clientScope),\n        remarks: optionalValue(payload.remarks),\n      };\n      if (existing) await db.update(hostels).set(values).where(eq(hostels.id, id));\n      else await db.insert(hostels).values({ id, ...values });`;
  source = replaceOnce(source, saveHostelStart, saveHostelNew, "shared save-hostel backend");

  const saveRoomValidationOld = `      const hostelId = textValue(payload.hostelId, "Hostel / local area");\n      {\n        const [hostel] = await db\n          .select()\n          .from(hostels)\n          .where(eq(hostels.id, hostelId))\n          .limit(1);\n        if (\n          !hostel ||\n          hostel.vendorId !== vendorId ||\n          hostel.accommodationTypeId !== accommodationTypeId ||\n          hostel.status !== "active"\n        )\n          throw new RequestError(\n            "Choose an active stored hostel or local area under this accommodation type",\n            409,\n          );\n      }\n      const values = {\n        vendorId,\n        accommodationTypeId,\n        hostelId,`;
  const saveRoomValidationNew = `      const hostelId = textValue(payload.hostelId, "Hostel / local area");\n      const [hostel] = await db.select().from(hostels).where(eq(hostels.id, hostelId)).limit(1);\n      if (!hostel || hostel.status !== "active") throw new RequestError("Choose an active stored hostel or local area", 409);\n      const companies = normalizedScope(hostel.groupCompanyScopeJson);\n      const companyScope = companies.length ? companies : [hostel.vendorId];\n      const [hostelType] = hostel.accommodationTypeId ? await db.select().from(accommodationTypes).where(eq(accommodationTypes.id, hostel.accommodationTypeId)).limit(1) : [];\n      if (!companyScope.includes(vendorId) || hostelType?.name !== type.name)\n        throw new RequestError("This shared hostel / area is not mapped to the active Joy company and accommodation type", 409);\n      if (!existingId) {\n        const duplicates = await db.select().from(accommodationRooms).where(eq(accommodationRooms.hostelId, hostelId));\n        if (duplicates.some((room) => room.roomNumber.trim().toLowerCase() === String(payload.roomNumber ?? "").trim().toLowerCase()))\n          throw new RequestError("This room already exists inside the shared hostel / area", 409);\n      }\n      const values = {\n        vendorId: hostel.vendorId,\n        accommodationTypeId: hostel.accommodationTypeId ?? accommodationTypeId,\n        hostelId,`;
  source = replaceOnce(source, saveRoomValidationOld, saveRoomValidationNew, "shared save-room backend");

  source = replaceOnce(
    source,
    `        if (!existing || existing.vendorId !== vendorId)\n          throw new RequestError(\n            "Accommodation room not found for this client",\n            404,\n          );`,
    `        if (!existing || (existing.hostelId && existing.hostelId !== hostelId))\n          throw new RequestError("Accommodation room not found in the selected shared hostel", 404);`,
    "shared room edit validation",
  );

  const hostelUserScopeOld = `    const assignedHostels = await db\n      .select({ id: hostels.id, vendorId: hostels.vendorId })\n      .from(hostels)\n      .where(inArray(hostels.id, hostelScope));\n    if (assignedHostels.length !== hostelScope.length)\n      throw new RequestError(\n        "One or more assigned hostels no longer exist",\n        404,\n      );\n    clientScope = normalizedScope(\n      assignedHostels.map((hostel) => hostel.vendorId),\n    );\n    unitScope = [];`;
  const hostelUserScopeNew = `    const assignedHostels = await db.select().from(hostels).where(inArray(hostels.id, hostelScope));\n    if (assignedHostels.length !== hostelScope.length) throw new RequestError("One or more assigned hostels no longer exist", 404);\n    clientScope = normalizedScope(assignedHostels.flatMap((hostel) => {\n      const scope = normalizedScope(hostel.groupCompanyScopeJson);\n      return scope.length ? scope : [hostel.vendorId];\n    }));\n    unitScope = normalizedScope(assignedHostels.flatMap((hostel) => normalizedScope(hostel.clientScopeJson)));`;
  source = replaceOnce(source, hostelUserScopeOld, hostelUserScopeNew, "hostel in-charge shared scopes");
  return source;
});

console.log("Applied shared physical hostel/area model across Joy group companies and client employer units.");
