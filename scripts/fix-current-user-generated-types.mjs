import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function update(path, fn) {
  const full = join(root, path);
  const source = await readFile(full, "utf8");
  const next = fn(source);
  if (next !== source) await writeFile(full, next, "utf8");
}

await update("app/payroll-app.tsx", (source) => {
  if (!source.includes("  appUsers,\n  vendors,")) {
    source = source.replace(
      "function PayrollActionModal({\n  modal,\n  vendors,",
      "function PayrollActionModal({\n  modal,\n  appUsers,\n  vendors,",
    );
    source = source.replace(
      "  modal: ActiveModal;\n  vendors: Vendor[];",
      "  modal: ActiveModal;\n  appUsers: AppUserProfile[];\n  vendors: Vendor[];",
    );
    source = source.replace(
      "        <PayrollActionModal\n          modal={modal}\n          vendors={data.vendors}",
      "        <PayrollActionModal\n          modal={modal}\n          appUsers={data.appUsers}\n          vendors={data.vendors}",
    );
  }
  return source;
});

await update("app/hostel-master.tsx", (source) => {
  // Creating a new hostel always belongs to the currently selected Joy group company.
  source = source.replace(
    "      vendorId: selected.vendorId,\n      accommodationTypeId: selected.accommodationTypeId ?? typeId,\n      name: f.get(\"name\"),",
    "      vendorId,\n      accommodationTypeId: typeId,\n      name: f.get(\"name\"),",
  );
  return source;
});

console.log("Fixed hierarchy user dropdown props and shared-hostel creation typing.");
