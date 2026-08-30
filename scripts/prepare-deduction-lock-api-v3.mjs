import { readFile, writeFile } from "node:fs/promises";

const path = "app/api/app-data/route.ts";
let source = await readFile(path, "utf8");

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start)
    throw new Error(`Unable to isolate backend block: ${startMarker}`);
  return { start, end, text: source.slice(start, end) };
}

// Legacy room-expense entry remains available for backwards compatibility. Include
// the new Other bucket so it stays mathematically aligned with the dated room ledger.
{
  const { start, end, text } = blockBetween(
    '    } else if (action === "save-room-expense") {',
    '    } else if (action === "finalize-room-expense") {',
  );
  let next = text;
  if (!next.includes("otherAmount: positiveValue")) {
    const marker = `        provisionPaymentReference: optionalValue(\n          payload.provisionPaymentReference,\n        ),`;
    if (!next.includes(marker))
      throw new Error("Unable to locate legacy provision payment reference");
    next = next.replace(
      marker,
      `${marker}\n        otherAmount: positiveValue(payload.otherAmount ?? 0, "Other room expense"),`,
    );
  }
  source = source.slice(0, start) + next + source.slice(end);
}

// Reopening a legacy finalized room expense must clear every room-shared component,
// including the new Other share, before recalculation.
{
  const { start, end, text } = blockBetween(
    '    } else if (action === "reopen-room-expense") {',
    '    } else if (action === "save-shift") {',
  );
  let next = text;
  if (!next.includes("otherShare: 0")) {
    const marker = "          provisionShare: 0,";
    if (!next.includes(marker))
      throw new Error("Unable to locate legacy provision-share reset");
    next = next.replace(marker, `${marker}\n          otherShare: 0,`);
  }
  source = source.slice(0, start) + next + source.slice(end);
}

await writeFile(path, source, "utf8");
console.log("Prepared legacy room-expense paths for the final deduction-lock API.");
