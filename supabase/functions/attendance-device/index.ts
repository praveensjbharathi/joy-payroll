import { createClient } from "@supabase/supabase-js";
import { authenticateDevice, CaptureError, ingestDevicePunches } from "../_shared/capture-service.ts";
const url=Deno.env.get("SUPABASE_URL"),dictionary=Deno.env.get("SUPABASE_SECRET_KEYS");
const key=(dictionary?JSON.parse(dictionary).default:null)||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if(!url||!key) throw new Error("Server database credentials are missing.");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
export default { async fetch(request:Request) {
  const headers={"cache-control":"no-store"};
  try {
    if(request.method!=="POST") return Response.json({error:"POST is required."},{status:405,headers});
    if(request.headers.has("origin")) return Response.json({error:"Use the authenticated HR page for browser imports."},{status:403,headers});
    const device=await authenticateDevice(db,request.headers.get("x-joy-device-key")||"");
    if(Number(request.headers.get("content-length"))>250000) throw new CaptureError("Send at most 500 punches per request.",413);
    const body=await request.text(); if(body.length>250000) throw new CaptureError("Request too large.",413);
    let input;try { input=JSON.parse(body); } catch { throw new CaptureError("Send valid JSON."); }
    const result=await ingestDevicePunches(db,device,input?.events,"biometric_api",`device:${device.id}`);
    return Response.json(result,{status:result.rejected.length?207:200,headers});
  } catch(error) {
    if(error instanceof CaptureError) return Response.json({error:error.message},{status:error.status,headers});
    console.error("Attendance device request failed",error instanceof Error?error.message:"unknown");
    return Response.json({error:"Unable to receive attendance punches."},{status:500,headers});
  }
}};
