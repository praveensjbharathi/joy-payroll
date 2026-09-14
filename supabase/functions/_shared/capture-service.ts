import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePermissions, normalizeRole } from "../payroll-api/generated/access-control.ts";
import { addDate, attendanceAccess, captureDate, groupPunches, localInstant, parseEmployeeQr, punchInstant, qrEmployee, reviewPunches, validDate, nearestEmployeeShift, type CapturePunch, type CaptureShift } from "../payroll-api/generated/attendance-capture.ts";

type Row = Record<string, unknown>;
export class CaptureError extends Error { constructor(message: string, public status = 400) { super(message); } }
function required(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new CaptureError(`${label} is required (up to ${max} characters).`);
  return value.trim();
}
function object(value: unknown): Row { if (!value || typeof value !== "object" || Array.isArray(value)) throw new CaptureError("Invalid request data."); return value as Row; }
function parsed(value: unknown) { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; } }
function scope(value: unknown): string[] { const list = parsed(value); return Array.isArray(list) ? list.filter(x => typeof x === "string") : []; }
function camel(row: Row): Row { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),v])); }
function checked<T>(result: { data: T; error: { message: string } | null }): T { if (result.error) throw new CaptureError("Unable to save or load attendance data. Refresh and try again.", 409); return result.data; }
async function audit(db: SupabaseClient, action: string, id: string, summary: string, actor: string) {
  checked(await db.from("audit_events").insert({ action,entity_type:"attendance_capture",entity_id:id,summary,actor_email:actor,created_at:new Date().toISOString() }));
}
export async function hashDeviceKey(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2,"0")).join("");
}
export function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false; let mismatch = 0;
  for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
async function rows(db: SupabaseClient, table: string, columns: string, filters: Record<string,string>, time?: {from:string;to:string}) {
  const result: Row[]=[];
  for (let offset=0;offset<10000;offset+=500) {
    let query=db.from(table).select(columns).order("id").range(offset,offset+499);
    for (const [key,value] of Object.entries(filters)) query=query.eq(key,value);
    if(time) query=query.gte("punched_at",time.from).lt("punched_at",time.to);
    const page=checked(await query) as unknown as Row[]; result.push(...page);
    if(page.length<500) return result;
  }
  throw new CaptureError("This selection has too many records. Contact the Super Admin to narrow the capture report.");
}
async function punchesFor(db: SupabaseClient, unitId: string, date: string, employeeId?: string) {
  return (await rows(db,"attendance_punches","*",{client_unit_id:unitId,...(employeeId?{employee_id:employeeId}:{})},
    {from:localInstant(`${addDate(date,-1)}T00:00`),to:localInstant(`${addDate(date,2)}T00:00`)})).map(camel) as unknown as CapturePunch[];
}
async function shiftsFor(db: SupabaseClient, unit: Row) {
  const result=await rows(db,"shift_definitions","*",{vendor_id:String(unit.vendor_id),status:"active"});
  return result.filter(s=>!s.client_unit_id||s.client_unit_id===unit.id).map(camel) as unknown as CaptureShift[];
}
async function requireCaptureAccess(db: SupabaseClient, email: string, unitId: string, manage: boolean) {
  const profile=checked(await db.from("app_users").select("role,status,permissions_json,client_scope_json,unit_scope_json").eq("email",email).maybeSingle());
  if (!profile) throw new CaptureError("An active Joy Payroll access profile is required.",403);
  const unit=checked(await db.from("client_units").select("id,vendor_id,status,client_name,unit_name").eq("id",unitId).maybeSingle());
  if (!unit) throw new CaptureError("Client unit not found.",404);
  const role=normalizeRole(profile.role),permissions=normalizePermissions(role,parsed(profile.permissions_json));
  // Unknown stored roles must fail closed rather than inherit Field HR privileges.
  if (!attendanceAccess({role:String(profile.role),status:profile.status,attendance:permissions.attendance,clientScope:scope(profile.client_scope_json),unitScope:scope(profile.unit_scope_json)},
      {id:unitId,vendorId:unit.vendor_id},manage)) throw new CaptureError("Your profile does not have attendance access for this client unit.",403);
  if(manage && unit.status!=="active") throw new CaptureError("Reactivate the client unit before capturing attendance.",409);
  return {unit,role,permissions};
}
async function deviceFor(db:SupabaseClient,id:string,unitId?:string) {
  const device=checked(await db.from("attendance_devices").select("*").eq("id",id).maybeSingle());
  if(!device || (unitId && device.client_unit_id!==unitId)) throw new CaptureError("Device not found in this client unit.",404);
  return device;
}
const employeeColumns="id,name,employee_code,client_unit_id,vendor_id,status,date_of_joining,date_of_leaving,default_shift,shift_pattern,applicable_shifts_json,photo_data_url";
export async function ingestDevicePunches(db: SupabaseClient, device: Row, events: unknown, source: "biometric_api"|"biometric_import", actor: string) {
  if(device.status!=="active") throw new CaptureError("This biometric device is inactive.",403);
  const unit=checked(await db.from("client_units").select("status").eq("id",device.client_unit_id).maybeSingle());
  if(!unit || unit.status!=="active") throw new CaptureError("This client unit is inactive.",403);
  if(!Array.isArray(events)||events.length<1||events.length>500) throw new CaptureError("Send between 1 and 500 punch events.");
  const mappings=await rows(db,"attendance_device_mappings","*",{device_id:String(device.id),status:"active"});
  const employees=await rows(db,"employees","id,client_unit_id,status,date_of_joining,date_of_leaving",{client_unit_id:String(device.client_unit_id)});
  const accepted: Row[]=[], rejected: {row:number;reason:string}[]=[];
  for(let i=0;i<events.length;i++) {
    try {
      const event=object(events[i]),userId=required(event.deviceUserId,"Device user ID",100),direction=event.direction;
      if(direction!==undefined&&direction!=="auto"&&direction!=="in"&&direction!=="out") throw new CaptureError("Direction must be in, out or auto.");
      const instant=punchInstant(event.punchedAt),mapping=mappings.find(m=>m.device_user_id===userId),employee=employees.find(e=>e.id===mapping?.employee_id);
      if(!mapping||!employee) throw new CaptureError("Device user ID has no active employee mapping. Add the mapping and re-import this row.");
      const day=captureDate(instant);
      if(String(employee.date_of_joining)>day || (employee.date_of_leaving && String(employee.date_of_leaving)<day) || (employee.status!=="active"&&!employee.date_of_leaving)) throw new CaptureError("Punch is outside the employee's employment dates.");
      const eventId=event.eventId?required(event.eventId,"Event ID",150):null;
      accepted.push({row_index:i+1,id:crypto.randomUUID(),client_unit_id:device.client_unit_id,employee_id:employee.id,device_id:device.id,device_user_id:userId,
        punched_at:instant,direction:direction==="out"?"out":"in",source,event_key:await hashDeviceKey(`${device.id}|${userId}|${instant}`),external_event_id:eventId,
        shift_code:mapping.shift_code,status:"pending",created_by:actor,created_at:new Date().toISOString()});
    } catch(e) { rejected.push({row:i+1,reason:e instanceof Error?e.message:"Invalid punch"}); }
  }
  const result=accepted.length?checked(await db.rpc("ingest_attendance_punches",{p_rows:accepted})):{inserted:0,duplicates:0,rejected:[]};
  const inserted=Number(result.inserted),duplicates=Number(result.duplicates);
  rejected.push(...result.rejected);
  if(inserted) await audit(db,"biometric_punches_received",String(device.id),`${source}: ${inserted} punches saved; ${duplicates} duplicates; ${rejected.length} rejected.`,actor);
  return {inserted,duplicates,rejected};
}
export async function handleCapture(db: SupabaseClient, email: string, payload: Row): Promise<Row> {
  const action=required(payload.action,"Action"),unitId=required(payload.unitId,"Client unit"),manage=!["capture-load","capture-month-load","capture-month-confirm"].includes(action);
  const {unit,role,permissions}=await requireCaptureAccess(db,email,unitId,manage);
  if(action==="capture-month-load"||action==="capture-month-confirm") {
    const runId=required(payload.runId,"Payroll run");
    const run=checked(await db.from("payroll_runs").select("id,client_unit_id,status,processing_mode").eq("id",runId).maybeSingle());
    if(!run||run.client_unit_id!==unitId) throw new CaptureError("Payroll run not found in this unit.",404);
    if(action==="capture-month-confirm") {
      if(permissions.payroll!=="manage") throw new CaptureError("Payroll management access is required for final salary-source confirmation.",403);
      const result=await db.rpc("confirm_payroll_attendance",{p_run:runId,p_source:payload.source,p_actor:email,p_notes:required(payload.notes,"Final review note",500)});
      if(result.error) throw new CaptureError(result.error.code==="P0001"?result.error.message:"Unable to confirm attendance. Refresh and try again.",409);
      return {saved:true,refreshPayrollRunId:runId,...result.data};
    }
    const review=checked(await db.rpc("payroll_attendance_review",{p_run:runId}));
    return {review};
  }
  if(action==="capture-load") {
    const date=validDate(payload.date),shifts=await shiftsFor(db,unit);
    const [punches,attendance]=await Promise.all([
      punchesFor(db,unitId,date),
      rows(db,"attendance_entries","id,employee_id,attendance_date,status_code,shift_code,overtime_hours,updated_at,employees!inner(client_unit_id)",{attendance_date:date,"employees.client_unit_id":unitId}),
    ]);
    const result:Row={date,shifts,punches,attendance:attendance.map(camel),groups:groupPunches(punches,shifts).filter(g=>g.date===date)};
    if(payload.includeMetadata!==false) {
      const [employees,devices]=await Promise.all([
        rows(db,"employees",employeeColumns,{client_unit_id:unitId}),
        rows(db,"attendance_devices","id,client_unit_id,name,model,status,created_at,updated_at",{client_unit_id:unitId}),
      ]);
      const mappings:Row[]=[];
      for(const d of devices) mappings.push(...await rows(db,"attendance_device_mappings","*",{device_id:String(d.id)}));
      Object.assign(result,{unit:camel(unit),employees:employees.map(camel),devices:devices.map(camel),mappings:mappings.map(camel)});
    }
    return result;
  }

  if(["capture-create-device","capture-device-status","capture-rotate-key","capture-map-device"].includes(action)) {
    if(role!=="super_admin") throw new CaptureError("Only Super Admin can register devices, change keys and map biometric IDs.",403);
    const now=new Date().toISOString();
    if(action==="capture-create-device") {
      const id=crypto.randomUUID(),secret=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");
      checked(await db.from("attendance_devices").insert({id,client_unit_id:unitId,name:required(payload.name,"Device name",120),model:typeof payload.model==="string"?payload.model.slice(0,200):null,token_hash:await hashDeviceKey(secret),created_by:email,created_at:now,updated_at:now}));
      await audit(db,"attendance_device_registered",id,"Registered biometric device for client unit "+unitId,email);
      return {id,key:`${id}.${secret}`};
    }
    const device=await deviceFor(db,required(payload.deviceId,"Device"),unitId);
    if(action==="capture-device-status") {
      if(payload.status!=="active"&&payload.status!=="inactive") throw new CaptureError("Choose active or inactive.");
      checked(await db.from("attendance_devices").update({status:payload.status,updated_at:now}).eq("id",device.id));
      await audit(db,"attendance_device_status",device.id,`Changed device to ${payload.status}`,email); return {saved:true};
    }
    if(action==="capture-rotate-key") {
      const secret=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");
      checked(await db.from("attendance_devices").update({token_hash:await hashDeviceKey(secret),updated_at:now}).eq("id",device.id));
      await audit(db,"attendance_device_key_rotated",device.id,"Rotated the device connection key",email);return {key:`${device.id}.${secret}`};
    }
    const employeeId=required(payload.employeeId,"Employee"),deviceUserId=required(payload.deviceUserId,"Device user ID",100),shiftCode=required(payload.shiftCode,"Shift");
    const employee=checked(await db.from("employees").select("id,client_unit_id,status").eq("id",employeeId).maybeSingle());
    if(!employee||employee.client_unit_id!==unitId||(payload.status==="active"&&employee.status!=="active")) throw new CaptureError("Choose an active employee in this unit.");
    if(payload.status!=="inactive"&&!(await shiftsFor(db,unit)).some(s=>s.name===shiftCode)) throw new CaptureError("Choose an active shift assigned to this unit.");
    const existing=checked(await db.from("attendance_device_mappings").select("id,employee_id").eq("device_id",device.id).eq("device_user_id",deviceUserId).maybeSingle());
    if(existing&&existing.employee_id!==employeeId) throw new CaptureError("This device user ID belongs to another employee. Use a new terminal user ID to preserve punch history.",409);
    if(payload.status!=="active"&&payload.status!=="inactive") throw new CaptureError("Choose active or inactive mapping.");
    checked(await db.from("attendance_device_mappings").upsert({id:existing?.id||crypto.randomUUID(),device_id:device.id,device_user_id:deviceUserId,employee_id:employeeId,shift_code:shiftCode,status:payload.status,created_by:email,...(!existing?{created_at:now}:{}),updated_at:now},{onConflict:"device_id,device_user_id"}));
    await audit(db,"attendance_device_mapping_saved",device.id,`Mapped terminal user ${deviceUserId} to ${employeeId}; shift ${shiftCode}; ${payload.status}`,email);return {saved:true};
  }
  if(action==="capture-import") return ingestDevicePunches(db,await deviceFor(db,required(payload.deviceId,"Device"),unitId),payload.events,"biometric_import",email);
  if(action==="capture-qr"||action==="capture-correction") {
    const employeeId=action==="capture-qr"?parseEmployeeQr(payload.qr).employeeId:required(payload.employeeId,"Employee");
    const found=checked(await db.from("employees").select(employeeColumns.replace(",photo_data_url","")).eq("id",employeeId).eq("client_unit_id",unitId).maybeSingle());
    const employees=found?[camel(found as unknown as Row)]:[];
    const employee=action==="capture-qr"?qrEmployee(payload.qr,employees as unknown as {id:string;employeeCode:string;clientUnitId:string;status:string;defaultShift:string}[],unitId):employees.find(e=>e.id===payload.employeeId);
    if(!employee) throw new CaptureError("Employee not found in this unit.",404);
    const direction=action==="capture-qr"?"in":payload.direction;if(direction!=="in"&&direction!=="out") throw new CaptureError("Choose IN or OUT.");
    const availableShifts=await shiftsFor(db,unit);
    const shiftCode=action==="capture-qr"?nearestEmployeeShift(employee as unknown as {defaultShift:string;shiftPattern:string;applicableShiftsJson:string},availableShifts,new Date().toISOString()).name:required(payload.shiftCode||employee.defaultShift,"Shift");
    if(!(await shiftsFor(db,unit)).some(s=>s.name===shiftCode)) throw new CaptureError("Choose an active shift assigned to this unit.");
    const instant=action==="capture-qr"?new Date().toISOString():punchInstant(payload.punchedAt);
    const remarks=action==="capture-correction"?required(payload.reason,"Correction reason",500):null;
    if(remarks&&remarks.length<5) throw new CaptureError("Give a clear correction reason (at least 5 characters).");
    const requestId=required(payload.requestId,"Request ID",100);
    const result=checked(await db.from("attendance_punches").upsert({id:crypto.randomUUID(),client_unit_id:unitId,employee_id:employee.id,punched_at:instant,direction,source:action==="capture-qr"?"qr":"hr_correction",event_key:await hashDeviceKey(`${email}|${requestId}`),shift_code:shiftCode,remarks,created_by:email,created_at:new Date().toISOString()},{onConflict:"event_key",ignoreDuplicates:true}).select("id,punched_at,direction,shift_code"));
    return {saved:!!result?.length,duplicate:!result?.length,punchedAt:result?.[0]?.punched_at||instant,direction:result?.[0]?.direction,shiftCode:result?.[0]?.shift_code};
  }
  if(action==="capture-ignore") {
    const reason=required(payload.reason,"Reason",500);if(reason.length<5) throw new CaptureError("Give a clear reason (at least 5 characters).");
    const id=required(payload.punchId,"Punch"),now=new Date().toISOString();
    const result=checked(await db.from("attendance_punches").update({status:"ignored",remarks:reason,reviewed_by:email,reviewed_at:now}).eq("id",id).eq("client_unit_id",unitId).eq("status","pending").select("id"));
    if(!result?.length) throw new CaptureError("Only a pending punch in your unit can be ignored. Refresh the page.",409);
    await audit(db,"attendance_punch_ignored",id,reason,email); return {saved:true};
  }
  if(action==="capture-post") {
    const date=validDate(payload.date),employeeId=required(payload.employeeId,"Employee"),shifts=await shiftsFor(db,unit);
    const pending=await punchesFor(db,unitId,date,employeeId),group=groupPunches(pending,shifts).find(g=>g.date===date);
    if(!group) throw new CaptureError("No pending punch pairs remain for this employee and date. Refresh the page.",409);
    const ids=payload.punchIds;if(!Array.isArray(ids)||ids.length!==group.punches.length||new Set(ids).size!==ids.length||group.punches.some(p=>!ids.includes(p.id))) throw new CaptureError("Punches changed. Refresh and review all punches before posting.",409);
    const shift=shifts.find(s=>s.name===payload.shiftCode);if(!shift) throw new CaptureError("Select an active shift for this client unit.");
    const review=reviewPunches(group,shift),ot=Number(payload.overtimeHours),status=payload.statusCode;
    if(typeof payload.overtimeHours!=="number"||!Number.isFinite(ot)||ot<0||ot>24) throw new CaptureError("Approved OT must be between 0 and 24 hours.");
    if(!["P","HD","A","L","WO","H","HP"].includes(String(status)) || (["A","L","WO","H"].includes(String(status))&&ot>0)) throw new CaptureError("Choose the appropriate worked-day status for OT (P, HD or HP).");
    const remarks=typeof payload.reason==="string"?payload.reason.trim().slice(0,500):"";
    if((ot!==review.suggestedOt||status!==review.suggestedStatus||payload.expectedUpdatedAt)&&remarks.length<5) throw new CaptureError("Give a reason for adjusted status, OT or replacement of existing attendance.");
    const result=await db.rpc("post_captured_attendance",{p_unit:unitId,p_employee:employeeId,p_date:date,p_ids:ids,p_values:{...review,statusCode:status,shiftCode:shift.name,overtimeHours:ot,remarks},p_actor:email,p_expected:typeof payload.expectedUpdatedAt==="string"?payload.expectedUpdatedAt:null,p_approval:crypto.randomUUID()});
    if(result.error) throw new CaptureError(result.error.code==="P0001"?result.error.message:"Attendance changed while posting. Refresh and review before retrying.",409);
    return {saved:true,...result.data,unitId};
  }
  throw new CaptureError("Unknown attendance capture action.");
}
export async function authenticateDevice(db:SupabaseClient,key:string) {
  const match=/^([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(key);
  if(!match) throw new CaptureError("A valid device key is required.",401);
  const result=await db.from("attendance_devices").select("*").eq("id",match[1]).maybeSingle();
  if(result.error||!result.data||result.data.status!=="active"||!constantEqual(await hashDeviceKey(match[2]),String(result.data.token_hash))) throw new CaptureError("A valid active device key is required.",401);
  return result.data as Row;
}
