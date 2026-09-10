import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { applicationSections, type ApplicationDocument } from "./employee-application";

export async function buildApplicationPdf(source: HTMLElement, documents: ApplicationDocument[], fonts?: Uint8Array[]) {
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes=fonts || await Promise.all([new URL('../assets/fonts/application-regular.ttf',import.meta.url),new URL('../assets/fonts/application-bold.ttf',import.meta.url)].map(async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error('Unable to load PDF fonts. Please retry.');return new Uint8Array(await response.arrayBuffer());
  }));
  const regular=await pdf.embedFont(fontBytes[0],{subset:true});
  const bold=await pdf.embedFont(fontBytes[1],{subset:true});
  const ink=rgb(.08,.16,.25), blue=rgb(.1,.25,.4), line=rgb(.78,.82,.87);
  let page!:PDFPage; let y=0;
  const margin=36, width=523;
  const clean=(text:string)=>text.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...').replace(/\u20b9/g,'Rs.');
  const wrap=(text:string, max:number, strong=false)=>{
    const font=strong?bold:regular; const result:string[]=[];
    for(const paragraph of clean(text).split('\n')) {
      let current='';
      for(const word of paragraph.split(/\s+/)) {
        const candidate=current ? current+' '+word : word;
        if(font.widthOfTextAtSize(candidate,10)<=max){current=candidate;continue;}
        if(current){result.push(current);current='';}
        for(const character of word){
          if(font.widthOfTextAtSize(current+character,10)>max && current){result.push(current);current='';}
          current+=character;
        }
      }
      result.push(current || ' ');
    }
    return result;
  };
  const newPage=()=>{page=pdf.addPage([595.28,841.89]);y=800;};
  const ensure=(height:number)=>{if(y-height<42)newPage();};
  const text=(value:string,strong=false)=>{
    for(const row of wrap(value,width,strong)){ensure(15);page.drawText(row,{x:margin,y:y-11,size:10,font:strong?bold:regular,color:ink});y-=15;}
    y-=5;
  };
  const heading=(value:string)=>{
    const lines=wrap(value,width-14,true);ensure(lines.length*15+45);
    page.drawRectangle({x:margin,y:y-lines.length*15-12,width,height:lines.length*15+12,color:blue});
    for(const row of lines){page.drawText(row,{x:margin+7,y:y-16,size:10,font:bold,color:rgb(1,1,1)});y-=15;}
    y-=20;
  };
  const table=(element:Element,narrow=false)=>{
    const tableWidth=narrow?395:width, firstColumn=narrow?145:190;
    let index=0;
    for(const row of Array.from(element.querySelectorAll('tr'))){
      const cells=Array.from(row.querySelectorAll('td,th')).map(c=>c.textContent?.trim()||'');
      if(cells.length<2)continue;
      const left=wrap(cells[0],firstColumn-14,true),right=wrap(cells.slice(1).join(' | '),tableWidth-firstColumn-14);
      const count=Math.max(left.length,right.length);
      if(count*13+12<=740)ensure(count*13+12);
      for(let offset=0;offset<count;){
        ensure(31);
        const fit=Math.max(1,Math.min(count-offset,Math.floor((y-50)/13)));
        const height=fit*13+12;
        page.drawRectangle({x:margin,y:y-height,width:tableWidth,height,borderColor:line,borderWidth:.5,color:index%2?rgb(1,1,1):rgb(.96,.97,.99)});
        page.drawLine({start:{x:margin+firstColumn,y},end:{x:margin+firstColumn,y:y-height},thickness:.5,color:line});
        for(let i=0;i<fit;i++){
          if(left[offset+i])page.drawText(left[offset+i],{x:margin+6,y:y-16-i*13,size:10,font:bold,color:ink});
          if(right[offset+i])page.drawText(right[offset+i],{x:margin+firstColumn+6,y:y-16-i*13,size:10,font:regular,color:ink});
        }
        y-=height;offset+=fit;
      }
      index++;
    }
    y-=8;
  };
  const embedImage=async(dataUrl:string)=>{
    if(dataUrl.startsWith('data:image/png'))return pdf.embedPng(dataUrl);
    if(dataUrl.startsWith('data:image/jpeg'))return pdf.embedJpg(dataUrl);
    // Convert an existing WebP employee photo/signature without changing its proportions.
    const img=new Image();img.src=dataUrl;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img,0,0);return pdf.embedPng(canvas.toDataURL('image/png'));
  };
  newPage();
  const article=source.querySelector('.joy-application-document')||source;
  const brand=article.querySelector('.application-brand');
  const logo=brand?.querySelector<HTMLImageElement>('img');
  if(logo){const image=await embedImage(logo.src);const size=image.scaleToFit(45,45);page.drawImage(image,{x:margin,y:y-45,width:size.width,height:size.height});y-=53;}
  heading(brand?.querySelector('h1')?.textContent||'JOY CORPORATE SOLUTIONS PRIVATE LIMITED');
  text('e-Job Application Form | www.joyindia.in');
  const photo=article.querySelector<HTMLImageElement>('.application-photo img:not(.application-signature)');
  const signature=article.querySelector<HTMLImageElement>('.application-signature');
  const headerY=y;
  y-=40;
  page.drawRectangle({x:455,y:y-92,width:90,height:92,borderColor:line,borderWidth:.7});
  if(photo){const image=await embedImage(photo.src);const size=image.scaleToFit(84,86);page.drawImage(image,{x:458+(84-size.width)/2,y:y-89+(86-size.height)/2,width:size.width,height:size.height});}
  else page.drawText('Passport photo',{x:461,y:y-45,size:9,font:regular,color:ink});
  if(signature){const image=await embedImage(signature.src);const size=image.scaleToFit(90,26);page.drawImage(image,{x:455,y:y-124,width:size.width,height:size.height});}
  y=headerY;
  const visit=async(element:Element):Promise<void>=>{
    if(element.matches('style,.application-brand,.application-photo'))return;
    if(element.tagName==='TABLE'){table(element,element===article.querySelector('table'));if(element===article.querySelector('table'))y=Math.min(y,headerY-172);return;}
    if(element.tagName==='H2'){heading(element.textContent||'');return;}
    if(element.tagName==='P'){
      const value=element.textContent||'';
      if(value.startsWith('Digital signature (typed name):'))return;
      text(value);return;
    }
    if(element.tagName==='IMG'){
      const image=await embedImage((element as HTMLImageElement).src);const size=image.scaleToFit(135,55);ensure(65);page.drawImage(image,{x:margin,y:y-size.height,width:size.width,height:size.height});y-=size.height+10;return;
    }
    for(const child of Array.from(element.children))await visit(child);
  };
  for(const child of Array.from(article.children))await visit(child);
  const applicationPages=pdf.getPages();
  applicationPages.forEach((p,index)=>p.drawText(`Application | ${index+1} / ${applicationPages.length}`,{x:margin,y:23,size:8,font:regular,color:blue}));
  const order=applicationSections.find(s=>s.title==='Supporting document links')!.fields;
  const sorted=[...documents].sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category));
  for(const doc of sorted){
    try {
      if(doc.dataUrl.startsWith('data:application/pdf;')){
        const attachment=await PDFDocument.load(doc.dataUrl);
        for(const p of await pdf.copyPages(attachment,attachment.getPageIndices()))pdf.addPage(p);
      }else{
        newPage();heading(doc.category);text(doc.filename);
        const image=await embedImage(doc.dataUrl);const size=image.scaleToFit(width,y-50);
        page.drawImage(image,{x:margin+(width-size.width)/2,y:Math.max(42,y-size.height),width:size.width,height:size.height});
      }
    }catch{throw new Error(`Cannot include ${doc.filename}. Replace it with an unprotected PDF, PNG or JPEG and try again.`);}
  }
  return pdf.save();
}

export async function downloadApplicationPdf(source:HTMLElement,documents:ApplicationDocument[],code:string){
  const bytes=await buildApplicationPdf(source,documents);
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download=`application-${code.replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
