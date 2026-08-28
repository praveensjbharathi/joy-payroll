import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");
if (!source.includes("JOY_ROOM_RECOVERY_SUMMARY_20260828")) {
  const beforeLoop = `    selectedRooms.forEach((roomName) => {`;
  const prep = `    const sharedHeading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find((node) => node.textContent?.includes("Gas, Ration & Provision split"));\n    const sharedTable = sharedHeading?.closest<HTMLElement>(".panel")?.querySelector<HTMLTableElement>("table") ?? null;\n    const sharedHeaders = Array.from(sharedTable?.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? "");\n    const sharedIndex = (label: string) => sharedHeaders.findIndex((header) => header === label);\n    const moneyNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, "")) || 0;\n    const moneyText = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);\n    selectedRooms.forEach((roomName) => {`;
  if (source.includes(beforeLoop)) source = source.replace(beforeLoop, prep);

  const append = `      sheet.append(h1, h2, clone); layer.appendChild(sheet);`;
  const replacement = `      const summary = document.createElement("div"); summary.className = "room-recovery-summary";\n      const sharedRow = Array.from(sharedTable?.tBodies[0]?.rows ?? []).find((row) => { const i = sharedIndex("Room"); return i >= 0 && row.cells[i]?.textContent?.trim() === roomName; });\n      const sharedCell = (label: string) => { const i = sharedIndex(label); return i >= 0 ? sharedRow?.cells[i]?.textContent?.trim() ?? "—" : "—"; };\n      const gas = moneyNumber(sharedCell("Gas")), ration = moneyNumber(sharedCell("Ration")), provision = moneyNumber(sharedCell("Provision"));\n      for (const [label, value] of [["Gas", sharedCell("Gas")], ["Ration", sharedCell("Ration")], ["Provision", sharedCell("Provision")], ["Roommates", sharedCell("Occupants")], ["Shared total", moneyText(gas + ration + provision)]]) { const box = document.createElement("div"); box.innerHTML = \`<span>\${label}</span><strong>\${value}</strong>\`; summary.appendChild(box); }\n      sheet.append(h1, h2, summary, clone); layer.appendChild(sheet);`;
  if (source.includes(append)) source = source.replace(append, replacement);

  source += `\n// JOY_ROOM_RECOVERY_SUMMARY_20260828\nconst roomSummaryStyle=document.createElement("style");roomSummaryStyle.textContent=\`.room-recovery-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:5px 0 8px}.room-recovery-summary div{border:1px solid #94a3b8;padding:5px 6px}.room-recovery-summary span{display:block;font-size:7.5pt;color:#64748b}.room-recovery-summary strong{display:block;font-size:9.5pt;color:#172236}\`;document.head.appendChild(roomSummaryStyle);\n`;
  await writeFile(path, source, "utf8");
}
console.log("Added Gas, Ration, Provision, Roommates and Shared total to each room recovery print sheet.");
