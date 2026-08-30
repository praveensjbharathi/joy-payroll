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

const canonicalSaveRoomValidation = `      const hostelId = textValue(payload.hostelId, "Hostel / local area");
      {
        const [hostel] = await db
          .select()
          .from(hostels)
          .where(eq(hostels.id, hostelId))
          .limit(1);
        if (
          !hostel ||
          hostel.vendorId !== vendorId ||
          hostel.accommodationTypeId !== accommodationTypeId ||
          hostel.status !== "active"
        )
          throw new RequestError(
            "Choose an active stored hostel or local area under this accommodation type",
            409,
          );
      }
      const values = {
        vendorId,
        accommodationTypeId,
        hostelId,`;

const saveRoomValidationPattern = /      const hostelId = textValue\(payload\.hostelId, "Hostel \/ local area"\);[\s\S]*?      const values = \{\n(?:        vendorId[^\n]*\n)?(?:        accommodationTypeId[^\n]*\n)?        hostelId,/;
if (!saveRoomValidationPattern.test(source))
  throw new Error("Unable to locate save-room hostel validation block");
source = source.replace(saveRoomValidationPattern, canonicalSaveRoomValidation);

const canonicalRoomEditValidation = `        if (!existing || existing.vendorId !== vendorId)
          throw new RequestError(
            "Accommodation room not found for this client",
            404,
          );`;
const roomEditValidationPattern = /        if \(!existing[^\n]*\)[\s\S]*?          \);/;
const saveRoomStart = source.indexOf('    } else if (action === "save-room") {');
const allocateRoomStart = source.indexOf('    } else if (action === "allocate-room") {');
if (saveRoomStart < 0 || allocateRoomStart < 0 || allocateRoomStart <= saveRoomStart)
  throw new Error("Unable to isolate save-room backend for edit validation normalization");
const beforeSaveRoom = source.slice(0, saveRoomStart);
let saveRoomBlock = source.slice(saveRoomStart, allocateRoomStart);
const afterSaveRoom = source.slice(allocateRoomStart);
if (!roomEditValidationPattern.test(saveRoomBlock))
  throw new Error("Unable to locate save-room edit validation block");
saveRoomBlock = saveRoomBlock.replace(roomEditValidationPattern, canonicalRoomEditValidation);
source = beforeSaveRoom + saveRoomBlock + afterSaveRoom;

const canonicalHostelUserScope = `    const assignedHostels = await db
      .select({ id: hostels.id, vendorId: hostels.vendorId })
      .from(hostels)
      .where(inArray(hostels.id, hostelScope));
    if (assignedHostels.length !== hostelScope.length)
      throw new RequestError(
        "One or more assigned hostels no longer exist",
        404,
      );
    clientScope = normalizedScope(
      assignedHostels.map((hostel) => hostel.vendorId),
    );
    unitScope = [];`;
const hostelUserScopePattern = /    const assignedHostels = await db[\s\S]*?    unitScope = \[[^\]]*\];/;
if (!hostelUserScopePattern.test(source))
  throw new Error("Unable to locate hostel in-charge scope block");
source = source.replace(hostelUserScopePattern, canonicalHostelUserScope);

// Current loadAppData uses db.select().from(payrollRuns) and
// db.select().from(accommodationCharges), so newly added schema columns are already
// returned automatically. Keep exact compatibility markers only so the historical
// deduction-lock transformer does not try to convert a projection that no longer exists.
const fullSelectCompatibility = `/* Full-select compatibility markers; fields are already returned by Drizzle select().
        issueCount: payrollRuns.issueCount,
        deductionsStatus: payrollRuns.deductionsStatus,
        deductionsLockedBy: payrollRuns.deductionsLockedBy,
        deductionsLockedAt: payrollRuns.deductionsLockedAt,
        approvedBy: payrollRuns.approvedBy,

        provisionShare: accommodationCharges.provisionShare,
        otherShare: accommodationCharges.otherShare,
        returnAmount: accommodationCharges.returnAmount,
*/\n`;
if (!source.includes("deductionsStatus: payrollRuns.deductionsStatus"))
  source = fullSelectCompatibility + source;

await writeFile(path, source, "utf8");
console.log("Normalized Hostel API and marked full-select deduction fields before multi-company release patch.");
