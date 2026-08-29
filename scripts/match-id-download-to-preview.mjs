import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/employee-id-card.tsx");
let source = await readFile(path, "utf8");

if (!source.includes("async function downloadPreviewCardJpeg")) {
  source = source.replace(
    "async function saveJpeg(canvas:HTMLCanvasElement,filename:string)",
    `function collectDocumentCss(){let css="";for(const sheet of Array.from(document.styleSheets)){try{for(const rule of Array.from(sheet.cssRules)){const text=rule.cssText;if(!text.includes("@font-face")&&!/url\\(/i.test(text))css+=text+"\\n";}}catch{}}return css;}\nasync function downloadPreviewCardJpeg(side:"front"|"back",employee:Employee){\n const card=document.querySelector<HTMLElement>(side==="front"?".id-card-modal .id-card-front":".id-card-modal .id-card-back");\n if(!card)throw new Error("ID-card preview is not available.");\n await document.fonts?.ready;\n const rect=card.getBoundingClientRect();\n const clone=card.cloneNode(true) as HTMLElement;\n clone.style.width=rect.width+"px";clone.style.height=rect.height+"px";clone.style.margin="0";clone.style.transform="none";\n const css=collectDocumentCss();\n const xhtml=new XMLSerializer().serializeToString(clone);\n const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+rect.width+'" height="'+rect.height+'"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+css+'</style>'+xhtml+'</div></foreignObject></svg>';\n const svgUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);\n const image=await loadImage(svgUrl);\n const canvas=document.createElement("canvas");canvas.width=1276;canvas.height=2022;\n const ctx=canvas.getContext("2d");if(!ctx)throw new Error("This browser cannot create the ID-card JPG.");\n ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(image,0,0,canvas.width,canvas.height);\n await saveJpeg(canvas,\`ID-\${employee.employeeCode}-\${employee.name.replace(/[^a-z0-9]+/gi,"-")}-\${side.toUpperCase()}-HQ.jpg\`);\n}\nasync function saveJpeg(canvas:HTMLCanvasElement,filename:string)`,
  );
}

// Upgrade any previously generated Blob-URL SVG rasterizer. Chrome can reject
// foreignObject SVGs loaded through a Blob URL and surface "Unable to load an ID-card image".
source = source.replace(
  /const blob=new Blob\(\[svg\],\{type:"image\/svg\+xml;charset=utf-8"\}\);\s*const url=URL\.createObjectURL\(blob\);\s*try\{\s*const image=await loadImage\(url\);([\s\S]*?)\s*\}finally\{URL\.revokeObjectURL\(url\);\}/,
  'const svgUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg); const image=await loadImage(svgUrl);$1',
);
source = source.replace(
  'function collectDocumentCss(){let css="";for(const sheet of Array.from(document.styleSheets)){try{for(const rule of Array.from(sheet.cssRules))css+=rule.cssText+"\\n";}catch{}}return css;}',
  'function collectDocumentCss(){let css="";for(const sheet of Array.from(document.styleSheets)){try{for(const rule of Array.from(sheet.cssRules)){const text=rule.cssText;if(!text.includes("@font-face")&&!/url\\(/i.test(text))css+=text+"\\n";}}catch{}}return css;}',
);

source = source.replace(
  /const runDownload=async\(side:"front"\|"back"\)=>\{setImageBusy\(side\);try\{if\(side==="front"\)await downloadFrontJpeg\(employee,vendor,unit,qr\);else await downloadBackJpeg\(employee,vendor\);\}catch\(error\)\{window\.alert\(error instanceof Error\?error\.message:"Unable to create JPG"\);\}finally\{setImageBusy\(null\);\}\};/,
  'const runDownload=async(side:"front"|"back")=>{setImageBusy(side);try{await downloadPreviewCardJpeg(side,employee);}catch(error){window.alert(error instanceof Error?error.message:"Unable to create JPG");}finally{setImageBusy(null);}};',
);

await writeFile(path, source, "utf8");
console.log("ID-card HQ JPG downloads now use a Chrome-safe data-URL snapshot of the exact visible preview.");
