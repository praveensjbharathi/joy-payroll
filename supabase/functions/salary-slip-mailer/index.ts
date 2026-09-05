import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import nodemailer from "npm:nodemailer@6.9.16";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;const SMTP_HOST=Deno.env.get("JOY_SMTP_HOST")??"mail.joycorporatesolutions.com";const SMTP_PORT=Number(Deno.env.get("JOY_SMTP_PORT")??"465");const SMTP_USER=Deno.env.get("JOY_SMTP_USER")??"noreply@joycorporatesolutions.com";const SMTP_PASSWORD=Deno.env.get("JOY_SMTP_PASSWORD")??"";const ALLOWED_ORIGINS=new Set(["https://joy-payroll.praveen-red-07.workers.dev","https://payroll.joycorporatesolutions.com"]);const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function cors(o:string|null){const a=o&&ALLOWED_ORIGINS.has(o)?o:[...ALLOWED_ORIGINS][0];return{"access-control-allow-origin":a,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type, x-client-info","cache-control":"no-store","content-type":"application/json",vary:"Origin"}}function json(b:unknown,s:number,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:cors(o)})}function n(v:unknown){return Number(v??0)||0}function money(v:unknown){return `Rs. ${n(v).toLocaleString("en-IN",{maximumFractionDigits:2})}`}function monthLabel(p:string){const[y,m]=p.split("-").map(Number);return new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric"}).format(new Date(Date.UTC(y,m-1,1)))}
function safe(v:unknown,f="—"){const s=String(v??"").replace(/[\r\n]+/g," ").trim();return s||f}
function displayDate(v:unknown){const value=String(v??"").slice(0,10);const parts=value.split("-");return parts.length===3?parts.reverse().join("/"):value}
function amountWords(v:number){const o=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],t=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"],two=(x:number)=>x<20?o[x]:`${t[Math.floor(x/10)]}${x%10?` ${o[x%10]}`:""}`,three=(x:number)=>x<100?two(x):`${o[Math.floor(x/100)]} Hundred${x%100?` ${two(x%100)}`:""}`;let x=Math.round(Math.abs(v));if(!x)return"Zero Rupees Only";const p:string[]=[];const c=Math.floor(x/1e7);if(c){p.push(`${three(c)} Crore`);x%=1e7}const l=Math.floor(x/1e5);if(l){p.push(`${three(l)} Lakh`);x%=1e5}const th=Math.floor(x/1e3);if(th){p.push(`${three(th)} Thousand`);x%=1e3}if(x)p.push(three(x));return`${p.join(" ")} Rupees Only`}
async function embedVendorLogo(pdf:PDFDocument,dataUrl:unknown){const value=String(dataUrl??"");if(!value.startsWith("data:image/"))return null;try{const comma=value.indexOf(",");if(comma<0)return null;const meta=value.slice(0,comma).toLowerCase();const b64=value.slice(comma+1);const raw=atob(b64);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);if(meta.includes("png"))return await pdf.embedPng(bytes);if(meta.includes("jpeg")||meta.includes("jpg"))return await pdf.embedJpg(bytes);return null}catch(e){console.error("Logo embed failed",e);return null}}
async function buildPdf({item,employee,run,vendor,unit}:any){const salaryDeductions=Math.max(0,n(item.total_deductions)-n(item.accommodation_deduction));const salaryNetPayable=Math.max(0,n(item.net_payable)+n(item.accommodation_deduction)-n(item.return_amount));const pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89]),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),logo=await embedVendorLogo(pdf,vendor.logo_data_url),W=page.getWidth(),L=42,R=W-42,cw=R-L,navy=rgb(.07,.22,.42),blue=rgb(.18,.43,.72),line=rgb(.76,.80,.85),paleBlue=rgb(.90,.94,.99),paleGreen=rgb(.90,.97,.94),tc=rgb(.12,.15,.20),muted=rgb(.38,.43,.50);const txt=(v:string,x:number,y:number,z=8,f=reg,c=tc,m?:number)=>page.drawText(v,{x,y,size:z,font:f,color:c,maxWidth:m}),center=(v:string,y:number,z=8,f=reg,c=tc)=>txt(v,(W-f.widthOfTextAtSize(v,z))/2,y,z,f,c),box=(x:number,y:number,w:number,h:number,fill?:any)=>page.drawRectangle({x,y,width:w,height:h,borderWidth:.6,borderColor:line,...(fill?{color:fill}:{})});let y=802;if(logo){const d=logo.scale(1),h=42,w=h*d.width/d.height;page.drawImage(logo,{x:150-w/2,y:y-10,width:w,height:h})}center("EMPLOYEE SALARY SLIP",y,16,bold,tc);center(monthLabel(run.pay_period).toUpperCase(),y-20,8,bold,blue);y-=42;page.drawLine({start:{x:L,y},end:{x:R,y},thickness:1.5,color:blue});y-=22;center(`${safe(vendor.legal_name,vendor.name)} - Payslip`,y,10,reg,tc);y-=16;center(`Work location - ${safe(unit.client_name)} - ${safe(unit.unit_name)}, ${safe(unit.location)}`,y,6.8,reg,muted);y-=14;center(safe(unit.payslip_address,"No.16, Krishna complex, Avinashi - Coimbatore Rd, Thennampalayam, Arasur, Coimbatore, Tamil Nadu 641407"),y,6.2,reg,muted);y-=14;center(safe(unit.payslip_contact,"Contact: 9080776580, 7825906580 | info@joycorporatesolutions.com | www.joyindia.in"),y,6.2,reg,blue);y-=22;const col=cw/4,rh=37,cell=(x:number,top:number,w:number,l:string,v:string)=>{if(!String(v??"").trim()||v==="—")return;box(x,top-rh,w,rh);txt(l,x+8,top-13,7,reg,muted);txt(v,x+8,top-27,9,bold,tc,w-14)};cell(L,y,col,"Employee ID",safe(employee.employee_code));cell(L+col,y,col,"Employee name",safe(employee.name));cell(L+2*col,y,col,"Department",safe(employee.department));cell(L+3*col,y,col,"Employer / unit",`${safe(unit.client_name)} - ${safe(unit.unit_name)}`);y-=rh;box(L,y-rh,cw,rh);txt("Payroll period",L+8,y-13,5.8,reg,muted);txt(`${safe(run.period_start??run.pay_period)} to ${safe(run.period_end??run.pay_period)}`,L+8,y-27,7.2,bold);const workingParts:string[]=[["Fixed W days",item.fixed_working_days],["W days",item.present_days],["NFH",item.nfh_days],["CO",item.comp_off_days],["OD",item.on_duty_days],["Sundays",item.sunday_days],["PL",item.pl_days],["CL",item.cl_days],["SL",item.sl_days],["Payable days",item.payable_days],["OT hours",item.overtime_hours]].filter(([,value])=>n(value)!==0).map(([label,value])=>`${label} ${safe(value,"")}`);if(workingParts.length){box(L,y-34,cw,34);txt(workingParts.join(" | "),L+8,y-20,7,reg,muted,cw-16)}y-=34;cell(L,y,col,"UAN / EPF",safe(employee.uan_masked,""));cell(L+col,y,col,"ESI number",safe(employee.esi_masked,""));cell(L+2*col,y,col,"Bank account",safe(employee.bank_account_masked,""));cell(L+3*col,y,col,"IFSC",safe(employee.ifsc_masked,""));y-=rh;
cell(L,y,col,"Bank name",safe(employee.bank_name,""));cell(L+col,y,col,"Bank branch",safe(employee.bank_branch,""));cell(L+2*col,y,col,"Date of joining (DOJ)",displayDate(employee.date_of_joining));box(L+3*col,y-rh,col,rh);
y-=rh+10;const half=cw/2,hh=22;page.drawRectangle({x:L,y:y-hh,width:half,height:hh,color:paleBlue,borderWidth:.5,borderColor:line});page.drawRectangle({x:L+half,y:y-hh,width:half,height:hh,color:paleBlue,borderWidth:.5,borderColor:line});txt("EARNINGS",L+8,y-14,6.6,reg,navy);txt("AMOUNT",L+half-48,y-14,6.6,bold,navy);txt("DEDUCTIONS",L+half+8,y-14,6.6,reg,navy);txt("AMOUNT",R-48,y-14,6.6,bold,navy);y-=hh;const es:any[]=[["Basic",item.basic],["DA",item.da],["HRA",item.hra],["Conveyance",item.conveyance],["Food Allowance",item.food_allowance],["Night Allowance",item.night_allowance],["Overtime Wages",item.overtime_wages],["Attendance Bonus",item.attendance_bonus],["Arrears",item.arrears],["Holiday Wages",item.holiday_wages],["Production Incentive",item.production_incentive],["Medical Allowance",item.medical_allowance]].filter((r:any)=>n(r[1])!==0),ds:any[]=[["PF Deduction",item.pf_deduction],["ESI Deduction",item.esi_deduction],["Professional Tax",item.professional_tax],["LWF",item.lwf],["Canteen",item.canteen],["Snacks",item.snacks],["Tent",item.tent],["Advance",item.advance],["Other Deduction",item.other_deduction],["TDS",item.tds],["Medical Insurance",item.medical_insurance]].filter((r:any)=>n(r[1])!==0);const rows=Math.max(5,es.length,ds.length),rr=22;for(let i=0;i<rows;i++){box(L,y-rr,half,rr);box(L+half,y-rr,half,rr);const e=es[i],d=ds[i];if(e){txt(e[0],L+8,y-14,6.7,reg,muted);txt(money(e[1]),L+half-60,y-14,7.2,bold)}if(d){txt(d[0],L+half+8,y-14,6.7,reg,muted);txt(money(d[1]),R-60,y-14,7.2,bold)}y-=rr}box(L,y-rr,half,rr,rgb(.96,.97,.98));box(L+half,y-rr,half,rr,rgb(.96,.97,.98));if(n(item.gross_earnings)!==0){txt("Gross earnings",L+8,y-14,8.5,bold);txt(money(item.gross_earnings),L+half-60,y-14,8.5,bold)}if(salaryDeductions!==0){txt("Total deductions",L+half+8,y-14,8.5,bold);txt(money(salaryDeductions),R-60,y-14,8.5,bold)}y-=rr+12;page.drawRectangle({x:L,y:y-36,width:cw,height:36,color:paleGreen,borderWidth:.5,borderColor:line});if(salaryNetPayable!==0){txt("Net payable",L+10,y-22,8.5,bold,rgb(.05,.34,.20));txt(money(salaryNetPayable),R-90,y-24,15,bold,rgb(.05,.34,.20))}y-=36;box(L,y-34,cw,34);if(salaryNetPayable!==0){txt("Amount in words",L+8,y-12,7,reg,muted);txt(amountWords(n(salaryNetPayable)),L+8,y-26,8,reg)}y-=50;center("*** This is a computer-generated document and does not require a physical signature. ***",y,6.2,reg,muted);return await pdf.save()}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:"Origin not allowed"},403,null);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return json({error:"POST required"},405,origin);
  try{
    if(!SMTP_PASSWORD)return json({error:"SMTP password is not configured"},503,origin);
    const auth=req.headers.get("authorization")??"",token=auth.startsWith("Bearer ")?auth.slice(7):"",userResult=await admin.auth.getUser(token);
    if(userResult.error||!userResult.data.user?.email)return json({error:"Verified Joy Payroll login required"},401,origin);
    const actorEmail=userResult.data.user.email.toLowerCase();
    const body=await req.json().catch(()=>({}));
    const runId=String(body?.runId??"").trim();
    const sendAll=body?.sendAll===true;
    const requestedIds=Array.isArray(body?.itemIds)
      ? [...new Set(body.itemIds.map((value:unknown)=>String(value??"").trim()).filter(Boolean))]
      : [];
    const transport=nodemailer.createTransport({host:SMTP_HOST,port:SMTP_PORT,secure:true,auth:{user:SMTP_USER,pass:SMTP_PASSWORD},tls:{servername:SMTP_HOST}});
    const sendOne=async(item:any,employee:any,run:any,vendor:any,unit:any)=>{
      if(!employee)return {status:"skipped",employeeCode:safe(item.employee_code),reason:"Employee record not found"};
      if(!employee.email_address)return {status:"skipped",employeeCode:safe(employee.employee_code),reason:"Employee email ID is missing in Employee Master"};
      try{
        const pdfBytes=await buildPdf({item,employee,run,vendor,unit});
        await transport.sendMail({
          from:"Joy Payroll <"+SMTP_USER+">",
          to:employee.email_address,
          subject:"Salary Slip - "+monthLabel(run.pay_period)+" - "+employee.name,
          text:"Dear "+employee.name+",\n\nPlease find attached your salary slip for "+monthLabel(run.pay_period)+".\n\nNet payable: "+money(Math.max(0,n(item.net_payable)+n(item.accommodation_deduction)-n(item.return_amount)))+"\nEmployer: "+unit.client_name+" - "+unit.unit_name+"\n\nRegards,\n"+vendor.legal_name,
          attachments:[{filename:"Salary_Slip_"+safe(employee.employee_code)+"_"+run.pay_period+".pdf",content:pdfBytes,contentType:"application/pdf"}]
        });
        await admin.from("audit_events").insert({action:"salary-slip-email-sent",entity_type:"payroll_item",entity_id:item.id,summary:"Salary slip emailed to "+employee.email_address,actor_email:actorEmail});
        return {status:"sent",employeeCode:safe(employee.employee_code),recipient:employee.email_address};
      }catch(error){
        console.error("Salary slip email failed",error);
        return {status:"failed",employeeCode:safe(employee.employee_code),recipient:employee.email_address,reason:error instanceof Error?error.message:"Unable to send salary slip email"};
      }
    };
    if(sendAll||runId||requestedIds.length){
      if(!runId)return json({error:"Payroll run is required for bulk salary-slip sending"},400,origin);
      const{data:bulkRun,error:bulkRunError}=await admin.from("payroll_runs").select("*").eq("id",runId).single();
      if(bulkRunError||!bulkRun)return json({error:"Payroll run not found"},404,origin);
      if(String(bulkRun.status).toLowerCase()!=="approved")return json({error:"Approve payroll before sending salary slips"},409,origin);
      const{data:allItems,error:bulkItemsError}=await admin.from("payroll_items").select("*").eq("run_id",runId);
      if(bulkItemsError)return json({error:bulkItemsError.message},500,origin);
      const selected=requestedIds.length?(allItems??[]).filter((item:any)=>requestedIds.includes(item.id)):(allItems??[]);
      if(!selected.length)return json({error:"No payroll items found for this run"},404,origin);
      const[{data:vendor,error:vendorError},{data:unit,error:unitError}]=await Promise.all([
        admin.from("vendors").select("*").eq("id",bulkRun.vendor_id).single(),
        admin.from("client_units").select("*").eq("id",bulkRun.client_unit_id).single()
      ]);
      if(vendorError||!vendor||unitError||!unit)return json({error:"Company or client unit not found"},404,origin);
      const employeeIds=[...new Set(selected.map((item:any)=>item.employee_id).filter(Boolean))];
      const{data:bulkEmployees,error:employeeError}=await admin.from("employees").select("*").in("id",employeeIds);
      if(employeeError)return json({error:employeeError.message},500,origin);
      const employeeById=new Map((bulkEmployees??[]).map((employee:any)=>[employee.id,employee]));
      const orderedSelected=[...selected].sort((left:any,right:any)=>{
        const leftEmployee:any=employeeById.get(left.employee_id),rightEmployee:any=employeeById.get(right.employee_id);
        return safe(leftEmployee?.name,"").localeCompare(safe(rightEmployee?.name,""),"en",{sensitivity:"base",numeric:true})||safe(leftEmployee?.employee_code,"").localeCompare(safe(rightEmployee?.employee_code,""),"en",{sensitivity:"base",numeric:true});
      });
      const details=[];
      for(const item of orderedSelected)details.push(await sendOne(item,employeeById.get(item.employee_id),bulkRun,vendor,unit));
      const sentCount=details.filter((detail:any)=>detail.status==="sent").length;
      const skippedCount=details.filter((detail:any)=>detail.status==="skipped").length;
      const failedCount=details.filter((detail:any)=>detail.status==="failed").length;
      return json({sent:true,bulk:true,total:selected.length,sentCount,skippedCount,failedCount,details},200,origin);
    }
    const itemId=String(body?.itemId??"").trim();
    if(!itemId)return json({error:"Payroll item is required"},400,origin);
    const{data:item,error:itemError}=await admin.from("payroll_items").select("*").eq("id",itemId).single();
    if(itemError||!item)return json({error:"Payroll item not found"},404,origin);
    const[{data:employee},{data:run}]=await Promise.all([
      admin.from("employees").select("*").eq("id",item.employee_id).single(),
      admin.from("payroll_runs").select("*").eq("id",item.run_id).single()
    ]);
    if(!employee||!run)return json({error:"Employee or payroll run not found"},404,origin);
    if(String(run.status).toLowerCase()!=="approved")return json({error:"Approve payroll before sending salary slips"},409,origin);
    const[{data:vendor},{data:unit}]=await Promise.all([
      admin.from("vendors").select("*").eq("id",run.vendor_id).single(),
      admin.from("client_units").select("*").eq("id",run.client_unit_id).single()
    ]);
    if(!vendor||!unit)return json({error:"Company or client unit not found"},404,origin);
    const result=await sendOne(item,employee,run,vendor,unit);
    if(result.status!=="sent")return json({error:result.reason??"Unable to send salary slip email"},400,origin);
    return json({sent:true,recipient:result.recipient,template:"portal-download-match-v3-with-company-logo"},200,origin);
  }catch(error){
    console.error("Salary slip email request failed",error);
    return json({error:error instanceof Error?error.message:"Unable to send salary slip email"},500,origin);
  }
});
