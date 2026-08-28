import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "supabase-frontend/live-enhancements.ts");
let source = await readFile(path, "utf8");

const oldBlock = `function cleanIdToolbar() {
  document.querySelectorAll<HTMLElement>(".id-card-modal .modal-toolbar div").forEach((bar) => {
    Array.from(bar.querySelectorAll("button")).forEach((button) => {
      const text = button.textContent?.trim() ?? "";
      if (["Print front + back", "Download front JPG", "Download back JPG", "HR Download Front JPEG", "HR Download Back JPEG"].includes(text)) button.remove();
    });
  });
}`;

const newBlock = `function cleanIdToolbar() {
  document.querySelectorAll<HTMLElement>(".id-card-modal .modal-toolbar").forEach((toolbar) => {
    toolbar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const text = (button.textContent ?? "").replace(/\\s+/g, " ").trim().toLowerCase();
      const isClose = text === "×" || button.classList.contains("icon-button");
      const isFrontHQ = text.includes("front hq jpg") || text.includes("preparing front");
      const isBackHQ = text.includes("back hq jpg") || text.includes("preparing back");
      if (!isClose && !isFrontHQ && !isBackHQ) button.remove();
    });
    toolbar.querySelectorAll<HTMLElement>("strong").forEach((node) => node.remove());
  });
}`;

if (source.includes(oldBlock)) source = source.replace(oldBlock, newBlock);
else if (!source.includes('text.includes("front hq jpg")')) {
  throw new Error("Unable to locate ID toolbar cleanup block");
}

await writeFile(path, source, "utf8");
console.log("ID card toolbar restricted to Front HQ JPG, Back HQ JPG and close only.");
