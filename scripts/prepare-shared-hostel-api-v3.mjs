import { readFile, writeFile } from "node:fs/promises";

const path = "app/api/app-data/route.ts";
let source = await readFile(path, "utf8");

const normalizedVisibility = `    hostels: canView(permissions, "accommodation")
      ? allHostels.filter(
          (hostel) =>
            visibleVendorIds.has(hostel.vendorId) &&
            (access.profile.role !== "hostel_incharge" ||
              hostelScope.has(hostel.id)),
        )
      : [],
    hostelUtilityReadings: canView(permissions, "accommodation")
      ? allHostelReadings.filter((reading) =>
          allHostels.some(
            (hostel) =>
              hostel.id === reading.hostelId &&
              visibleVendorIds.has(hostel.vendorId),
          ),
        )
      : [],`;

const visibilityPattern = /    hostels: canView\(permissions, "accommodation"\)[\s\S]*?    hostelUtilityReadings: canView\(permissions, "accommodation"\)[\s\S]*?      : \[\],/;
if (!visibilityPattern.test(source))
  throw new Error("Unable to locate Hostel API visibility return block");
source = source.replace(visibilityPattern, normalizedVisibility);

const canonicalSaveHostel = `    } else if (action === "save-hostel") {
      const vendorId = textValue(payload.vendorId, "Client");
      const id = optionalValue(payload.id) ?? \`HOSTEL-\${crypto.randomUUID()}\`;
      const accommodationTypeId = textValue(
        payload.accommodationTypeId,
        "Accommodation type",
      );
      const [hostelType] = await db
        .select()
        .from(accommodationTypes)
        .where(eq(accommodationTypes.id, accommodationTypeId))
        .limit(1);
      if (!hostelType || hostelType.vendorId !== vendorId)
        throw new RequestError(
          "Select an accommodation type from this client",
          409,
        );
      const clientScope = Array.isArray(payload.clientScope)
        ? payload.clientScope.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const validUnits = await db
        .select({ id: clientUnits.id })
        .from(clientUnits)
        .where(eq(clientUnits.vendorId, vendorId));
      const validIds = new Set(validUnits.map((unit) => unit.id));
      if (clientScope.some((unitId) => !validIds.has(unitId)))
        throw new RequestError(
          "Hostel client mapping contains an invalid client unit",
          409,
        );
      const values = {
        vendorId,
        accommodationTypeId,
        name: textValue(payload.name, "Hostel name"),
        address: optionalValue(payload.address),
        inchargeName: optionalValue(payload.inchargeName),
        ebMeterNumber: optionalValue(payload.ebMeterNumber),
        clientScopeJson: JSON.stringify(clientScope),
        remarks: optionalValue(payload.remarks),
      };
      const [existing] = await db
        .select()
        .from(hostels)
        .where(eq(hostels.id, id))
        .limit(1);
      if (existing)
        await db.update(hostels).set(values).where(eq(hostels.id, id));
      else await db.insert(hostels).values({ id, ...values });`;

const saveHostelPattern = /    } else if \(action === "save-hostel"\) \{[\s\S]*?(?=\n    } else if \(action === )/;
if (saveHostelPattern.test(source)) {
  source = source.replace(saveHostelPattern, canonicalSaveHostel);
} else {
  const saveRoomAnchor = '    } else if (action === "save-room") {';
  if (!source.includes(saveRoomAnchor))
    throw new Error("Unable to locate save-hostel or save-room backend anchor");
  source = source.replace(saveRoomAnchor, `${canonicalSaveHostel}\n${saveRoomAnchor}`);
}

await writeFile(path, source, "utf8");
console.log("Normalized Hostel API visibility and save-hostel backend for multi-company shared-hostel release.");
