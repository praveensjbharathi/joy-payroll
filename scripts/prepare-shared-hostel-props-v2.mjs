import { readFile, writeFile } from "node:fs/promises";

const path = "app/payroll-app.tsx";
let source = await readFile(path, "utf8");

function normalizeBlock(componentName, transform) {
  const start = source.indexOf(`<${componentName}`);
  if (start < 0) throw new Error(`Missing ${componentName} component invocation`);
  const end = source.indexOf("/>", start);
  if (end < 0) throw new Error(`Unclosed ${componentName} component invocation`);
  const before = source.slice(start, end + 2);
  const after = transform(before);
  source = source.slice(0, start) + after + source.slice(end + 2);
}

normalizeBlock("HostelMaster", (block) => {
  block = block.replace(/\n\s+vendors=\{data\.vendors\}/, "");
  block = block.replace(/\n\s+units=\{[\s\S]*?(?=\n\s+types=)/, "");
  block = block.replace(/types=\{[^\n]+\}/, "types={data.accommodationTypes}");
  block = block.replace(
    /vendorId=\{activeVendorId\}/,
    `vendorId={activeVendorId}\n              vendors={data.vendors}\n              units={data.units}`,
  );
  return block;
});

normalizeBlock("AccommodationControlCenter", (block) => {
  block = block.replace(/types=\{[^\n]+\}/, "types={data.accommodationTypes}");
  block = block.replace(/\n\s+units=\{[\s\S]*?(?=\n\s+rooms=)/, "\n                units={data.units}");
  return block;
});

await writeFile(path, source, "utf8");
console.log("Normalized HostelMaster and AccommodationControlCenter props for shared Joy-group accommodation.");
