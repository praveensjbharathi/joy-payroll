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
    source += `\nfunction cleanupLegacyIdToolbar(){document.querySelectorAll<HTMLElement>(\".id-card-modal .modal-toolbar\").forEach(toolbar=>{toolbar.querySelectorAll<HTMLElement>(\"strong,button\").forEach(el=>{const text=(el.textContent||\"\").trim().toLowerCase();if(text===\"cr80 portrait employee id card · 54 × 85.6 mm\"||text===\"download front jpg\"||text===\"download back jpg\")el.remove();});});}\nconst legacyIdToolbarObserver=new MutationObserver(cleanupLegacyIdToolbar);legacyIdToolbarObserver.observe(document.documentElement,{childList:true,subtree:true});cleanupLegacyIdToolbar();\n`;
  }
  return source;
});

console.log("Removed legacy ID-card toolbar title and duplicate non-HQ JPG controls.");
