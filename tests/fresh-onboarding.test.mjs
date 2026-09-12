import test from 'node:test';
import assert from 'node:assert/strict';
import { handleFresh } from '../supabase/functions/employee-onboarding/fresh.ts';
import { tokenHash } from '../supabase/functions/employee-onboarding/validation.ts';
const fields = {'Full name':'Dummy New Applicant','Mobile number':'9999999999','Date of birth':'2000-01-01',Gender:'Male','Highest qualification':'10th / SSLC','Marital status':'Unmarried','Employment status':'Fresher','Reference 1 - Employee ID':'ref',Declaration:'Correct','Digital Signature (Type your full name)':'Dummy New Applicant'};
const proof = {category:'Bank Proofs',filename:'dummy.pdf',dataUrl:'data:application/pdf;base64,'+btoa('%PDF-1.7\n%%EOF')};
test('new applicant documents commit with answers, remain private, and survive HR review',async()=>{
 const token='a'.repeat(64), hash=await tokenHash(token);
 let record={id:'INV-dummy',name:'New applicant',vendor_id:'joy',client_unit_id:'unit',token_hash:hash,expires_at:new Date(Date.now()+60000).toISOString(),submitted_at:null,application_json:{},documents_json:[]};
 const ref={id:'ref',employee_code:'DIRECT-1',name:'Direct Referrer',status:'active',employment_type:'direct'};
 const admin={from(table){let filters=[],changes; const run=()=>{
   const candidates=(table==='employees'?[ref]:[record]).filter(r=>filters.every(([op,k,v])=>op==='gt'?r[k]>v:r[k]===v));
   if(changes && candidates.length) record={...record,...changes};
   return {data:candidates.map(r=>({...r,...(changes||{})})),error:null};
 }; const q={select(){return q;},eq(k,v){filters.push(['eq',k,v]);return q;},is(k,v){filters.push(['eq',k,v]);return q;},gt(k,v){filters.push(['gt',k,v]);return q;},order(){return q;},limit(){return q;},update(v){changes=v;return q;},insert:async()=>({}),maybeSingle:async()=>{const r=run();return {...r,data:r.data[0]||null};},then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}};return q;}};
 const request=async(body,actor=null)=>handleFresh({admin,body:{employeeId:record.id,token,...body},actor,json:(body,status=200)=>({body,status})});
 const read=await request({action:'read'});assert.equal(read.status,200);assert.deepEqual(read.body.references,[{id:'ref',employeeCode:'DIRECT-1',name:'Direct Referrer'}]);assert.ok(!('documents_json' in read.body));
 assert.equal((await request({action:'submit',fields:{...fields,'Reference 1 - Employee ID':''},documents:[proof]})).status,400);assert.equal(record.token_hash,hash);
 assert.equal((await request({action:'submit',fields,documents:[proof]})).status,200);assert.deepEqual(record.documents_json,[proof]);assert.equal(record.application_json['Reference 1 - Name'],'Direct Referrer');assert.equal(record.token_hash,null);
 assert.equal((await request({action:'submit',fields,documents:[proof]})).status,403);
 assert.equal((await request({action:'documents'})).status,403);
 assert.equal((await request({action:'documents'},{status:'active',role:'field_hr',client_scope_json:'[]',unit_scope_json:'[]',permissions_json:'{}'})).status,403);
 assert.deepEqual((await request({action:'documents'},{status:'active',role:'super_admin'})).body.documents,[proof]);
});
