import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function patch(path, transform) {
  const full = join(root, path);
  const source = await readFile(full, "utf8");
  const updated = transform(source);
  if (updated !== source) await writeFile(full, updated, "utf8");
}

await patch("app/employee-id-card.tsx", (source) => {
  source = source.replace(/<strong>CR80 portrait employee ID card · 54 × 85\.6 mm<\/strong>/g, "");
  return source;
});

await patch("supabase-frontend/live-enhancements.ts", (source) => {
  if (!source.includes("function cleanupLegacyIdToolbar")) {
    source += `\nfunction cleanupLegacyIdToolbar(){document.querySelectorAll<HTMLElement>(\".id-card-modal .modal-toolbar\").forEach(toolbar=>{toolbar.querySelectorAll<HTMLElement>(\"strong\").forEach(el=>el.remove());toolbar.querySelectorAll<HTMLButtonElement>(\"button\").forEach(button=>{const text=(button.textContent||\"\").replace(/\\s+/g,\" \").trim().toLowerCase();const keep=text.includes(\"front hq jpg\")||text.includes(\"back hq jpg\")||text.includes(\"preparing front\")||text.includes(\"preparing back\")||text===\"×\"||button.classList.contains(\"icon-button\");if(!keep)button.remove();});});}\nconst legacyIdToolbarObserver=new MutationObserver(cleanupLegacyIdToolbar);legacyIdToolbarObserver.observe(document.documentElement,{childList:true,subtree:true});cleanupLegacyIdToolbar();\n`;
  }
  return source;
});

console.log("ID-card view now keeps only Download Front HQ JPG, Download Back HQ JPG and close.");
