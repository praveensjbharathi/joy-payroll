import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(root, "app/payroll-app.tsx");
let source = await readFile(file, "utf8");

const marker = `  async function performAction(\n    action: string,\n    successMessage: string,\n    details: Record<string, unknown> = {},\n  ) {\n`;

if (!source.includes("payrollContextFreeActions")) {
  if (!source.includes(marker)) {
    throw new Error("Could not locate performAction in app/payroll-app.tsx");
  }
  source = source.replace(
    marker,
    `${marker}    const payrollContextFreeActions = new Set([\n      "save-accommodation-type",\n      "save-hostel",\n      "delete-hostel",\n      "save-room",\n      "assign-room-hostel",\n      "save-hostel-utility",\n      "approve-hostel-utility",\n      "save-vehicle",\n      "save-vehicle-record",\n      "save-utility-meter",\n      "save-eb-reading",\n      "save-shift",\n      "save-remark",\n      "create-vendor",\n      "save-client",\n      "create-unit",\n      "save-unit",\n      "save-app-user",\n      "save-own-profile",\n    ]);\n    const omitPayrollContext = payrollContextFreeActions.has(action);\n`,
  );
}

const oldContext = `          runId: currentRun?.id,\n          vendorId: activeVendorId,\n          unitId: activeUnitId,`;
const newContext = `          runId: omitPayrollContext ? undefined : currentRun?.id,\n          vendorId: activeVendorId,\n          unitId: omitPayrollContext ? undefined : activeUnitId,`;

if (source.includes(oldContext)) {
  source = source.replace(oldContext, newContext);
} else if (!source.includes(newContext)) {
  throw new Error("Could not locate shared action context payload");
}

await writeFile(file, source, "utf8");
console.log("Separated accommodation/master actions from payroll run and payroll item context.");
