import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

const cleanupBody = `document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const heading=panel.querySelector<HTMLElement>("h2");if(!heading?.textContent?.includes("Net salary")||!heading.textContent.includes("final payable"))return;const tools=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));if(tools.length<2)return;const valid=tools.filter(tool=>{const select=tool.querySelector<HTMLSelectElement>("select");const labels=Array.from(tool.querySelectorAll("button")).map(button=>(button.textContent||"").trim());return Boolean(select&&(select.options.length>1||Array.from(select.options).some(option=>(option.textContent||"").trim()==="Select room"))&&labels.some(text=>text.includes("Selected room"))&&labels.some(text=>text.includes("All rooms")));});const candidates=valid.length?valid:tools;const keep=[...candidates].sort((a,b)=>{const ax=a.getBoundingClientRect().left;const bx=b.getBoundingClientRect().left;return ax-bx||tools.indexOf(a)-tools.indexOf(b);})[0]??tools[0];tools.forEach(tool=>{if(tool!==keep)tool.remove();});});`;

source = source.replace(
  /function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/,
  `function removeDuplicateRoomPrintToolbars() {${cleanupBody}}`,
);

source = source.replace(
  /function removeDuplicateRoomRecoveryTools\(\)\{[\s\S]*?\}/,
  `function removeDuplicateRoomRecoveryTools(){${cleanupBody}}`,
);

await writeFile(path, source, "utf8");
console.log("Kept only the left working Recovery room dropdown/buttons and removed the right duplicate controls.");
