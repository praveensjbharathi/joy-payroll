import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/reports-recovery.tsx");
let source = await readFile(path, "utf8");

if (!source.includes('const [roomPrintRoom, setRoomPrintRoom]')) {
  source = source.replace(
    '  const [bulkVouchers, setBulkVouchers] = useState(false);',
    '  const [bulkVouchers, setBulkVouchers] = useState(false);\n  const [roomPrintRoom, setRoomPrintRoom] = useState("");',
  );
}

if (!source.includes('function printRoomRecovery(')) {
  source = source.replace(
    '  async function addRecovery(event: FormEvent<HTMLFormElement>) {',
    `  const roomPrintRooms = [...new Set(employeeRows.map(({ employee }) => employee.roomNumber ?? "—"))]\n    .filter((room) => room && room !== "—")\n    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));\n\n  function printRoomRecovery(selectedRooms: string[]) {\n    if (!selectedRooms.length) return;\n    const panel = document.querySelector<HTMLElement>(".recovery-final-payable-panel");\n    const table = panel?.querySelector<HTMLTableElement>("table");\n    if (!table) return;\n    const headerLabels = Array.from(table.tHead?.rows[0]?.cells ?? []).map(\n      (cell) => cell.textContent?.trim() ?? "",\n    );\n    const roomIndex = headerLabels.findIndex((label) => label === "Room");\n    const voucherIndex = headerLabels.findIndex((label) => label === "Voucher");\n    if (roomIndex < 0) return;\n    const sourceRows = Array.from(table.tBodies[0]?.rows ?? []);\n\n    document.querySelector(".room-recovery-print-layer")?.remove();\n    const layer = document.createElement("div");\n    layer.className = "room-recovery-print-layer";\n\n    selectedRooms.forEach((roomName) => {\n      const matchedRows = sourceRows.filter(\n        (row) => (row.cells[roomIndex]?.textContent?.trim() || "—") === roomName,\n      );\n      if (!matchedRows.length) return;\n      const roomEmployees = employeeRows.filter(\n        ({ employee }) => employee.roomNumber === roomName,\n      );\n      const gas = roomEmployees.reduce((sum, row) => sum + (row.charge?.gasShare ?? 0), 0);\n      const ration = roomEmployees.reduce((sum, row) => sum + (row.charge?.rationShare ?? 0), 0);\n      const provision = roomEmployees.reduce(\n        (sum, row) => sum + (row.charge?.provisionShare ?? 0),\n        0,\n      );\n\n      const sheet = document.createElement("section");\n      sheet.className = "room-recovery-print-sheet";\n      const h1 = document.createElement("h1");\n      h1.textContent = "FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";\n      const h2 = document.createElement("h2");\n      h2.textContent = \`Room: \${roomName}\`;\n      const summary = document.createElement("div");\n      summary.className = "room-recovery-summary";\n      summary.innerHTML = \`<div><span>Gas</span><strong>₹\${gas.toFixed(2)}</strong></div><div><span>Ration</span><strong>₹\${ration.toFixed(2)}</strong></div><div><span>Provision</span><strong>₹\${provision.toFixed(2)}</strong></div><div><span>Roommates</span><strong>\${matchedRows.length}</strong></div><div><span>Shared total</span><strong>₹\${(gas + ration + provision).toFixed(2)}</strong></div>\`;\n\n      const clone = table.cloneNode(true) as HTMLTableElement;\n      Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {\n        const room = row.cells[roomIndex]?.textContent?.trim() || "—";\n        if (room !== roomName) row.remove();\n        else if (voucherIndex >= 0 && row.cells[voucherIndex]) row.deleteCell(voucherIndex);\n      });\n      const header = clone.tHead?.rows[0];\n      if (header && voucherIndex >= 0 && header.cells[voucherIndex]) header.deleteCell(voucherIndex);\n      sheet.append(h1, h2, summary, clone);\n      layer.appendChild(sheet);\n    });\n\n    if (!layer.children.length) return;\n    document.body.appendChild(layer);\n    const pageStyle = document.createElement("style");\n    pageStyle.textContent = "@page{size:A4 landscape;margin:8mm;}";\n    document.head.appendChild(pageStyle);\n    const cleanup = () => {\n      layer.remove();\n      pageStyle.remove();\n      window.removeEventListener("afterprint", cleanup);\n    };\n    window.addEventListener("afterprint", cleanup);\n    window.print();\n    window.setTimeout(cleanup, 3000);\n  }\n\n  async function addRecovery(event: FormEvent<HTMLFormElement>) {`,
  );
}

source = source.replace(
  `      <section className="panel table-panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">\n              Recovery totals by applicable employee`,
  `      <section className="panel table-panel recovery-final-payable-panel">\n        <div className="panel-heading">\n          <div>\n            <span className="eyebrow">\n              Recovery totals by applicable employee`,
);

if (!source.includes('Selected room · A4 landscape')) {
  source = source.replace(
    `          {finalizations.length ? (\n            <button`,
    `          <div className="room-print-toolbar">\n            <select\n              aria-label="Select room for recovery statement"\n              value={roomPrintRoom}\n              onChange={(event) => setRoomPrintRoom(event.target.value)}\n            >\n              <option value="">Select room</option>\n              {roomPrintRooms.map((room) => (\n                <option key={room} value={room}>{room}</option>\n              ))}\n            </select>\n            <button\n              type="button"\n              className="secondary-button"\n              disabled={!roomPrintRoom}\n              onClick={() => printRoomRecovery([roomPrintRoom])}\n            >\n              Selected room · A4 landscape\n            </button>\n            <button\n              type="button"\n              className="primary-button"\n              disabled={!roomPrintRooms.length}\n              onClick={() => printRoomRecovery(roomPrintRooms)}\n            >\n              All rooms · A4 landscape\n            </button>\n          </div>\n          {finalizations.length ? (\n            <button`,
  );
}

await writeFile(path, source, "utf8");
console.log("Restored Recovery room dropdown and working Selected room / All rooms A4 landscape print controls directly in React.");
