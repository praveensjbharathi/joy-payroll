import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");
recovery = recovery.replace(
  '.filter((row) => row.charge || row.dated.length || row.shared > 0);',
  '.filter((row) => row.charge || row.dated.length || row.shared > 0 || Boolean(row.item && row.employee.roomNumber));',
);
await writeFile(recoveryPath, recovery, "utf8");

const livePath = join(root, "supabase-frontend/live-enhancements.ts");
let live = await readFile(livePath, "utf8");
const cleanup = `document.querySelectorAll<HTMLElement>(".panel").forEach(panel=>{const heading=panel.querySelector<HTMLElement>("h2");if(!heading?.textContent?.includes("Net salary")||!heading.textContent.includes("final payable"))return;const selectedButtons=Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).filter(button=>(button.textContent||"").includes("Selected room · A4 landscape"));if(selectedButtons.length<2)return;const groups=selectedButtons.map(button=>{let node:HTMLElement|null=button.parentElement;while(node&&node!==panel&&!node.querySelector("select"))node=node.parentElement;return node&&node!==panel?node:button.parentElement;}).filter((node):node is HTMLElement=>Boolean(node));const unique=[...new Set(groups)];if(unique.length<2)return;const keep=[...unique].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];unique.forEach(group=>{if(group!==keep)group.remove();});});`;
live = live.replace(/function removeDuplicateRoomPrintToolbars\(\) \{[\s\S]*?\n\}/, `function removeDuplicateRoomPrintToolbars() {${cleanup}}`);
live += `\n// Final Recovery safeguard: keep the left working room controls only.\nfunction keepLeftRecoveryRoomControls(){${cleanup}}\nconst recoveryRoomObserver=new MutationObserver(keepLeftRecoveryRoomControls);\nrecoveryRoomObserver.observe(document.documentElement,{childList:true,subtree:true});\nkeepLeftRecoveryRoomControls();\n`;
await writeFile(livePath, live, "utf8");

console.log("Recovery fixed: left room controls retained, right duplicate removed, room payroll employees restored.");
