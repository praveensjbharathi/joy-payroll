import { readFile, writeFile } from "node:fs/promises";

const path = "app/api/app-data/route.ts";
let source = await readFile(path, "utf8");

const normalized = `    hostels: canView(permissions, "accommodation")
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

const pattern = /    hostels: canView\(permissions, "accommodation"\)[\s\S]*?    hostelUtilityReadings: canView\(permissions, "accommodation"\)[\s\S]*?      : \[\],/;
if (!pattern.test(source)) throw new Error("Unable to locate Hostel API visibility return block");
source = source.replace(pattern, normalized);

await writeFile(path, source, "utf8");
console.log("Normalized Hostel API visibility block for multi-company shared-hostel release.");
