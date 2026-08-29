import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

const cleanupBody = `document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const heading=panel.querySelector<HTMLElement>("h2");if(!heading?.textContent?.includes("Net salary")||!heading.textContent.includes("final payable"))return;const groups=Array.from(panel.querySelectorAll<HTMLElement>("div,section")).filter(node=>{const labels=Array.from(node.querySelectorAll(":scope > button")).map(button=>(button.textContent||"").trim());const hasSelected=labels.some(text=>text.includes("Selected room")&&text.includes("A4 landscape"));const hasAll=labels.some(text=>text.includes("All rooms")&&text.includes("A4 landscape"));return hasSelected&&hasAll&&Boolean(node.querySelector(":scope > select"));});if(groups.length<2)return;const ordered=[...groups].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left||a.getBoundingClientRect().top-b.getBoundingClientRect().top);const keep=ordered[0];groups.forEach(group=>{if(group!==keep)group.remove();});const toolbars=Array.from(panel.querySelectorAll<HTMLElement>(".room-print-toolbar"));toolbars.forEach(toolbar=>{if(toolbar!==keep&&toolbar.querySelector("select")&&Array.from(toolbar.querySelectorAll("button")).some(button=>(button.textContent||"").includes("All rooms")))toolbar.remove();});});`;

source = source.replace(
  /function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/,
  `function removeDuplicateRoomPrintToolbars() {${cleanupBody}}`,
);

source = source.replace(
  /function removeDuplicateRoomRecoveryTools\(\)\{[\s\S]*?\}/,
  `function removeDuplicateRoomRecoveryTools(){${cleanupBody}}`,
);

await writeFile(path, source, "utf8");
console.log("Recovery UI keeps only the left room selector and its two A4 landscape buttons; right-side duplicates are removed.");
