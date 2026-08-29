import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/employee-id-card.tsx");
let source = await readFile(path, "utf8");

// Remove any earlier preview-rasterizer implementation so this script can
// replace it deterministically on every production build.
source = source.replace(
  /function collectDocumentCss\(\)[\s\S]*?async function saveJpeg\(canvas:HTMLCanvasElement,filename:string\)/,
  `async function ensureHtml2Canvas(){
 const w=window as Window & {html2canvas?: (element:HTMLElement,options?:Record<string,unknown>)=>Promise<HTMLCanvasElement>};
 if(w.html2canvas)return w.html2canvas;
 await new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-joy-html2canvas="1"]');
  if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Unable to load the ID-card download renderer.")),{once:true});return;}
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  script.async=true;script.dataset.joyHtml2canvas="1";
  script.onload=()=>resolve();script.onerror=()=>reject(new Error("Unable to load the ID-card download renderer."));
  document.head.appendChild(script);
 });
 if(!w.html2canvas)throw new Error("ID-card download renderer did not initialize.");
 return w.html2canvas;
}
async function downloadPreviewCardJpeg(side:"front"|"back",employee:Employee){
 const card=document.querySelector<HTMLElement>(side==="front"?".id-card-modal .id-card-front":".id-card-modal .id-card-back");
 if(!card)throw new Error("ID-card preview is not available.");
 await document.fonts?.ready;
 const render=await ensureHtml2Canvas();
 const captured=await render(card,{backgroundColor:"#ffffff",scale:4,useCORS:true,allowTaint:false,logging:false,imageTimeout:15000,removeContainer:true});
 const canvas=document.createElement("canvas");canvas.width=1276;canvas.height=2022;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("This browser cannot create the ID-card JPG.");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(captured,0,0,canvas.width,canvas.height);
 await saveJpeg(canvas,\`ID-\${employee.employeeCode}-\${employee.name.replace(/[^a-z0-9]+/gi,"-")}-\${side.toUpperCase()}-HQ.jpg\`);
}
async function saveJpeg(canvas:HTMLCanvasElement,filename:string)`,
);

// Fresh source may not contain an earlier preview-rasterizer yet.
if (!source.includes("async function downloadPreviewCardJpeg")) {
  source = source.replace(
    "async function saveJpeg(canvas:HTMLCanvasElement,filename:string)",
    `async function ensureHtml2Canvas(){
 const w=window as Window & {html2canvas?: (element:HTMLElement,options?:Record<string,unknown>)=>Promise<HTMLCanvasElement>};
 if(w.html2canvas)return w.html2canvas;
 await new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-joy-html2canvas="1"]');
  if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Unable to load the ID-card download renderer.")),{once:true});return;}
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";script.async=true;script.dataset.joyHtml2canvas="1";script.onload=()=>resolve();script.onerror=()=>reject(new Error("Unable to load the ID-card download renderer."));document.head.appendChild(script);
 });
 if(!w.html2canvas)throw new Error("ID-card download renderer did not initialize.");return w.html2canvas;
}
async function downloadPreviewCardJpeg(side:"front"|"back",employee:Employee){
 const card=document.querySelector<HTMLElement>(side==="front"?".id-card-modal .id-card-front":".id-card-modal .id-card-back");if(!card)throw new Error("ID-card preview is not available.");await document.fonts?.ready;const render=await ensureHtml2Canvas();const captured=await render(card,{backgroundColor:"#ffffff",scale:4,useCORS:true,allowTaint:false,logging:false,imageTimeout:15000,removeContainer:true});const canvas=document.createElement("canvas");canvas.width=1276;canvas.height=2022;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("This browser cannot create the ID-card JPG.");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(captured,0,0,canvas.width,canvas.height);await saveJpeg(canvas,\`ID-\${employee.employeeCode}-\${employee.name.replace(/[^a-z0-9]+/gi,"-")}-\${side.toUpperCase()}-HQ.jpg\`);
}
async function saveJpeg(canvas:HTMLCanvasElement,filename:string)`,
  );
}

source = source.replace(
  /const runDownload=async\(side:"front"\|"back"\)=>\{setImageBusy\(side\);try\{if\(side==="front"\)await downloadFrontJpeg\(employee,vendor,unit,qr\);else await downloadBackJpeg\(employee,vendor\);\}catch\(error\)\{window\.alert\(error instanceof Error\?error\.message:"Unable to create JPG"\);\}finally\{setImageBusy\(null\);\}\};/,
  'const runDownload=async(side:"front"|"back")=>{setImageBusy(side);try{await downloadPreviewCardJpeg(side,employee);}catch(error){window.alert(error instanceof Error?error.message:"Unable to create JPG");}finally{setImageBusy(null);}};',
);
source = source.replace(
  /const runDownload=async\(side:"front"\|"back"\)=>\{setImageBusy\(side\);try\{await downloadPreviewCardJpeg\(side,employee\);\}catch\(error\)\{window\.alert\(error instanceof Error\?error\.message:"Unable to create JPG"\);\}finally\{setImageBusy\(null\);\}\};/,
  'const runDownload=async(side:"front"|"back")=>{setImageBusy(side);try{await downloadPreviewCardJpeg(side,employee);}catch(error){window.alert(error instanceof Error?error.message:"Unable to create JPG");}finally{setImageBusy(null);}};',
);

await writeFile(path, source, "utf8");
console.log("ID-card HQ JPG downloads now capture the exact visible preview with html2canvas instead of SVG foreignObject rasterization.");
