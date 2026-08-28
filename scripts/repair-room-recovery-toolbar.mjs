import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

source = source.replace(
  /function removeDuplicateRoomRecoveryTools\(\)\{[\s\S]*?removeDuplicateRoomRecoveryTools\(\);/,
  `function removeDuplicateRoomRecoveryTools(){document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const tools=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));if(tools.length<2)return;const functioning=tools.find(tool=>{const select=tool.querySelector<HTMLSelectElement>("select");const labels=Array.from(tool.querySelectorAll("button")).map(button=>(button.textContent||"").trim());return Boolean(select&&select.options.length>0&&labels.some(text=>text.includes("Selected room"))&&labels.some(text=>text.includes("All rooms")));})??tools[0];tools.forEach(tool=>{if(tool!==functioning)tool.remove();});});}
const duplicateRoomToolObserver=new MutationObserver(removeDuplicateRoomRecoveryTools);duplicateRoomToolObserver.observe(document.documentElement,{childList:true,subtree:true});removeDuplicateRoomRecoveryTools();`,
);

await writeFile(path, source, "utf8");
console.log("Preserved the functioning room dropdown + Selected room A4 landscape + All rooms A4 landscape toolbar and removed only broken duplicates.");
