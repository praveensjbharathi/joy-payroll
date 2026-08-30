import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const routePath = join(root, "app/api/app-data/route.ts");
let source = await readFile(routePath, "utf8");

const canonical = `    } else if (action === "save-hostel") {
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

const blockPattern = /    } else if \(action === "save-hostel"\) \{[\s\S]*?(?=\n    } else if \(action === )/;
if (blockPattern.test(source)) {
  source = source.replace(blockPattern, canonical);
} else {
  const anchor = '    } else if (action === "save-room") {';
  if (!source.includes(anchor)) {
    throw new Error("Unable to locate save-hostel or save-room backend anchor");
  }
  source = source.replace(anchor, `${canonical}\n${anchor}`);
}

await writeFile(routePath, source, "utf8");
console.log("Normalized generated save-hostel backend for shared Joy-group accommodation.");
