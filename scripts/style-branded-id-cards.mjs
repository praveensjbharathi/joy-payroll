import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const cardPath = join(root, "app/employee-id-card.tsx");
let card = await readFile(cardPath, "utf8");

card = card.replace(
  '<article className="employee-id-card id-card-front">',
  '<article className={`employee-id-card id-card-front ${corporate ? "id-theme-corporate" : "id-theme-manpower"}`}>',
);
card = card.replace(
  '<article className="employee-id-card id-card-back">',
  '<article className={`employee-id-card id-card-back ${corporate ? "id-theme-corporate" : "id-theme-manpower"}`}>',
);

card = card.replace(
  'const companyName=vendor?.legalName??vendor?.name??"JOY GROUPS";let headerX=34;',
  'const companyName=vendor?.legalName??vendor?.name??"JOY GROUPS";const corporate=companyName.toLowerCase().includes("corporate");const primary=corporate?"#0f5fbd":"#163f86";const accent=corporate?"#17a6a6":"#e5a11a";ctx.fillStyle=primary;ctx.fillRect(0,0,w,145);ctx.fillStyle=accent;ctx.beginPath();ctx.arc(w+15,-8,150,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.15;ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(w-45,130,115,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;let headerX=34;',
);
card = card.replace('ctx.fillStyle="#145dc7";ctx.fillRect(0,0,w,145);', '');
card = card.replace('ctx.fillStyle="#145dc7";ctx.textAlign="center";', 'ctx.fillStyle=primary;ctx.textAlign="center";');

card = card.replace(
  'ctx.fillStyle="#145dc7";ctx.fillRect(0,0,w,105);',
  'const primary=corporate?"#0f5fbd":"#163f86",accent=corporate?"#17a6a6":"#e5a11a";ctx.fillStyle=primary;ctx.fillRect(0,0,w,105);ctx.fillStyle=accent;ctx.fillRect(0,100,w,5);ctx.globalAlpha=.13;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(w-25,18,96,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;',
);

await writeFile(cardPath, card, "utf8");

const cssPath = join(root, "app/globals.css");
let css = await readFile(cssPath, "utf8");
if (!css.includes("JOY_BRANDED_ID_CARD_THEMES_20260829")) {
  css += `

/* JOY_BRANDED_ID_CARD_THEMES_20260829 */
.employee-id-card{position:relative;overflow:hidden;border:1px solid #d9e2ec!important;box-shadow:0 18px 38px rgba(15,34,65,.16)!important;background:#fff!important}
.employee-id-card::before{content:"";position:absolute;pointer-events:none;border-radius:999px;opacity:.10}
.employee-id-card.id-theme-corporate{--id-primary:#0f5fbd;--id-accent:#17a6a6;--id-soft:#eef8fb;--id-deep:#0b376b}
.employee-id-card.id-theme-manpower{--id-primary:#163f86;--id-accent:#e5a11a;--id-soft:#fff8e9;--id-deep:#102f68}
.employee-id-card.id-theme-corporate::before{width:34mm;height:34mm;right:-14mm;top:12mm;background:linear-gradient(145deg,var(--id-primary),var(--id-accent))}
.employee-id-card.id-theme-manpower::before{width:32mm;height:32mm;right:-13mm;top:13mm;background:linear-gradient(145deg,var(--id-primary),var(--id-accent))}
.id-card-company{position:relative!important;overflow:hidden!important;background:linear-gradient(125deg,var(--id-deep),var(--id-primary))!important;border-bottom:4px solid var(--id-accent)!important;padding:5.2mm 4.8mm!important;min-height:25mm!important}
.id-card-company::after{content:"";position:absolute;width:31mm;height:31mm;border-radius:50%;right:-9mm;top:-14mm;background:var(--id-accent);opacity:.88}
.id-card-company::before{content:"";position:absolute;width:23mm;height:23mm;border-radius:50%;right:5mm;bottom:-16mm;background:#fff;opacity:.12}
.id-card-company>img,.id-card-company>div{position:relative;z-index:2}
.id-card-company img{background:rgba(255,255,255,.98)!important;border-radius:3.2mm!important;padding:1.4mm!important;box-shadow:0 5px 14px rgba(0,0,0,.16)!important}
.id-card-company b{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.16)!important;letter-spacing:.015em!important}
.id-card-company span{color:rgba(255,255,255,.88)!important;letter-spacing:.14em!important}
.id-card-front .id-card-main{position:relative!important;background:linear-gradient(180deg,#fff 0%,#fff 70%,var(--id-soft) 100%)!important}
.id-card-front .employee-id-photo-image,.id-card-front .employee-id-photo{border:2px solid #fff!important;outline:2px solid color-mix(in srgb,var(--id-primary) 35%,#dbe4ef)!important;box-shadow:0 8px 18px rgba(22,48,86,.16)!important}
.id-card-front .id-card-person h2{color:var(--id-deep)!important}
.id-card-front .id-card-person>strong{color:var(--id-primary)!important}
.id-card-right-details div{border-bottom-color:color-mix(in srgb,var(--id-primary) 14%,#e4e9ef)!important}
.id-card-right-details dt{color:#708197!important}
.id-card-right-details dd{color:#172236!important}
.id-card-qr{background:#fff!important;border:1px solid color-mix(in srgb,var(--id-primary) 25%,#dbe4ef)!important;border-radius:2.5mm!important;padding:1mm!important;box-shadow:0 5px 12px rgba(22,48,86,.10)!important}
.id-card-back{background:linear-gradient(180deg,#fff 0%,#fff 76%,var(--id-soft) 100%)!important}
.id-card-back>header{position:relative!important;background:linear-gradient(125deg,var(--id-deep),var(--id-primary))!important;color:#fff!important;border-bottom:4px solid var(--id-accent)!important;letter-spacing:.08em!important}
.id-card-back>section{border-top:1px solid color-mix(in srgb,var(--id-primary) 20%,#dbe4ef)!important;background:var(--id-soft)!important;border-radius:3mm!important;padding:3mm!important}
.id-card-back>section strong{color:var(--id-deep)!important}
`;
}
await writeFile(cssPath, css, "utf8");
console.log("Applied separate premium ID-card themes for Joy Corporate Solutions and Joy Manpower Service, including HQ JPG styling.");
