import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

const cleanupBody = `document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const tools=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));if(tools.length<2)return;const scored=tools.map((tool,index)=>{const select=tool.querySelector<HTMLSelectElement>("select");const labels=Array.from(tool.querySelectorAll("button")).map(button=>(button.textContent||"").trim());let score=0;if(select?.value)score+=100;if((select?.options.length||0)>1)score+=20;if(labels.some(text=>text.includes("Selected room")))score+=10;if(labels.some(text=>text.includes("All rooms")))score+=10;return{tool,index,score};});scored.sort((a,b)=>b.score-a.score||a.index-b.index);const keep=scored[0]?.tool??tools[0];tools.forEach(tool=>{if(tool!==keep)tool.remove();});});`;

source = source.replace(
  /function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/,
  `function removeDuplicateRoomPrintToolbars() {${cleanupBody}}`,
);

source = source.replace(
  /function removeDuplicateRoomRecoveryTools\(\)\{[\s\S]*?\}/,
  `function removeDuplicateRoomRecoveryTools(){${cleanupBody}}`,
);

await writeFile(path, source, "utf8");
console.log("Removed the right/blank duplicate Recovery room toolbar and preserved the selected working toolbar.");
