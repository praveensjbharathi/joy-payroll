import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/employee-id-card.tsx");
let source = await readFile(path, "utf8");

const renderer = `async function ensureHtml2Canvas(){
 const w=window as Window & {html2canvas?: (element:HTMLElement,options?:Record<string,unknown>)=>Promise<HTMLCanvasElement>};
 if(w.html2canvas)return w.html2canvas;
 await new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-joy-html2canvas="1"]');
  if(existing){if(w.html2canvas){resolve();return;}existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Unable to load the ID-card download renderer.")),{once:true});return;}
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";script.async=true;script.dataset.joyHtml2canvas="1";script.onload=()=>resolve();script.onerror=()=>reject(new Error("Unable to load the ID-card download renderer."));document.head.appendChild(script);
 });
 if(!w.html2canvas)throw new Error("ID-card download renderer did not initialize.");return w.html2canvas;
}
function prepareIdCardCaptureClone(doc:Document,side:"front"|"back"){
 const cloned=doc.querySelector<HTMLElement>(side==="front"?".id-card-modal .id-card-front":".id-card-modal .id-card-back");
 if(!cloned)return;
 const corporate=cloned.classList.contains("id-theme-corporate");
 const primary=corporate?"#0f5fbd":"#163f86",accent=corporate?"#17a6a6":"#e5a11a",soft=corporate?"#eef8fb":"#fff8e9",deep=corporate?"#0b376b":"#102f68";
 cloned.style.setProperty("--id-primary",primary);cloned.style.setProperty("--id-accent",accent);cloned.style.setProperty("--id-soft",soft);cloned.style.setProperty("--id-deep",deep);
 cloned.querySelectorAll<HTMLElement>("*").forEach(el=>{
  const cs=doc.defaultView?.getComputedStyle(el);if(!cs)return;
  const safe=(value:string,fallback:string)=>/\b(?:oklch|oklab|lab|lch|color)\s*\(/i.test(value)?fallback:value;
  el.style.color=safe(cs.color,"#172236");el.style.backgroundColor=safe(cs.backgroundColor,"transparent");
  el.style.borderTopColor=safe(cs.borderTopColor,"#dbe4ef");el.style.borderRightColor=safe(cs.borderRightColor,"#dbe4ef");el.style.borderBottomColor=safe(cs.borderBottomColor,"#dbe4ef");el.style.borderLeftColor=safe(cs.borderLeftColor,"#dbe4ef");
  el.style.outlineColor=safe(cs.outlineColor,"#dbe4ef");el.style.textDecorationColor=safe(cs.textDecorationColor,"#172236");
  if(/\b(?:oklch|oklab|lab|lch|color)\s*\(/i.test(cs.backgroundImage))el.style.backgroundImage="none";
  if(/\b(?:oklch|oklab|lab|lch|color)\s*\(/i.test(cs.boxShadow))el.style.boxShadow="none";
 });
 const company=cloned.querySelector<HTMLElement>(".id-card-company");if(company){company.style.background=\`linear-gradient(125deg,\${deep},\${primary})\`;company.style.borderBottomColor=accent;}
 const main=cloned.querySelector<HTMLElement>(".id-card-main");if(main)main.style.background=\`linear-gradient(180deg,#ffffff 0%,#ffffff 70%,\${soft} 100%)\`;
 if(side==="back"){cloned.style.background=\`linear-gradient(180deg,#ffffff 0%,#ffffff 76%,\${soft} 100%)\`;const header=cloned.querySelector<HTMLElement>("header");if(header){header.style.background=\`linear-gradient(125deg,\${deep},\${primary})\`;header.style.borderBottomColor=accent;header.style.color="#ffffff";}cloned.querySelectorAll<HTMLElement>("section").forEach(s=>s.style.background=soft);}
}
async function downloadPreviewCardJpeg(side:"front"|"back",employee:Employee){
 const card=document.querySelector<HTMLElement>(side==="front"?".id-card-modal .id-card-front":".id-card-modal .id-card-back");if(!card)throw new Error("ID-card preview is not available.");await document.fonts?.ready;const render=await ensureHtml2Canvas();
 const captured=await render(card,{backgroundColor:"#ffffff",scale:4,useCORS:true,allowTaint:false,logging:false,imageTimeout:15000,removeContainer:true,onclone:(doc:Document)=>prepareIdCardCaptureClone(doc,side)});
 const canvas=document.createElement("canvas");canvas.width=1276;canvas.height=2022;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("This browser cannot create the ID-card JPG.");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(captured,0,0,canvas.width,canvas.height);await saveJpeg(canvas,\`ID-\${employee.employeeCode}-\${employee.name.replace(/[^a-z0-9]+/gi,"-")}-\${side.toUpperCase()}-HQ.jpg\`);
}
async function saveJpeg(canvas:HTMLCanvasElement,filename:string)`;

source = source.replace(/async function ensureHtml2Canvas\(\)[\s\S]*?async function saveJpeg\(canvas:HTMLCanvasElement,filename:string\)/, renderer);
if (!source.includes("async function downloadPreviewCardJpeg")) source=source.replace("async function saveJpeg(canvas:HTMLCanvasElement,filename:string)",renderer);
source = source.replace(/const runDownload=async\(side:"front"\|"back"\)=>\{setImageBusy\(side\);try\{(?:if\(side==="front"\)await downloadFrontJpeg\(employee,vendor,unit,qr\);else await downloadBackJpeg\(employee,vendor\);|await downloadPreviewCardJpeg\(side,employee\);)\}catch\(error\)\{window\.alert\(error instanceof Error\?error\.message:"Unable to create JPG"\);\}finally\{setImageBusy\(null\);\}\};/,'const runDownload=async(side:"front"|"back")=>{setImageBusy(side);try{await downloadPreviewCardJpeg(side,employee);}catch(error){window.alert(error instanceof Error?error.message:"Unable to create JPG");}finally{setImageBusy(null);}};');
await writeFile(path,source,"utf8");
console.log("ID-card preview capture now sanitizes modern CSS color functions before html2canvas rendering.");
