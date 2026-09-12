import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { applicableFields } from '../lib/employee-application.ts';
import * as validation from '../supabase/functions/employee-onboarding/validation.ts';

let handler, record, actor, mails, rejectMail, conflict, documents;
const validFields = {'Full name':'Test Applicant','Mobile number':'9999999999','Date of birth':'2000-01-01',Gender:'Male','Highest qualification':'10th / SSLC','Marital status':'Unmarried','Employment status':'Fresher','Reference 1 - Employee ID':'ref-1',Declaration:'Correct','Digital Signature (Type your full name)':'Test Applicant'};
const referrer = {id:"ref-1",employee_code:"REF-01",name:"Test Referrer",employment_type:"direct",status:"active"};
const original = { id: 'test-employee', name: 'Test Applicant', status: 'active', vendor_id: 'company-a', client_unit_id: 'unit-a', email_address: 'test@example.invalid', application_json: '{"Position Applied For":"Operator"}' };
function reset() { record = { ...original }; actor = { status: 'active', role: 'super_admin', email: 'hr@example.invalid' }; mails = []; rejectMail = false; conflict = false; documents = []; }
const admin = {
  auth: { getUser: async token => token === 'test-jwt' ? { data: { user: { email: 'hr@example.invalid', email_confirmed_at: 'today' } } } : { error: true, data: {} } },
  async rpc(name, values) {
    assert.equal(name, 'submit_existing_onboarding');
    if (conflict || record.application_json !== values.p_expected_application) return {data:false};
    record.application_json = values.p_application; documents = values.p_documents; return {data:true};
  },
  from(table) {
    let update, filters = [];
    const execute = () => {
      if (update) {
        if (conflict || filters.some(([k,v]) => record[k] !== v)) return { data: [], error: null };
        Object.assign(record, update); return { data: [{ id: record.id }], error: null };
      }
      const candidates = [record,referrer].filter(r=>r && filters.every(([k,v])=>r[k]===v));
      return { data: table === 'app_users' ? actor : candidates.map(r=>({...r})), error: null };
    };
    const query = { select() { return query; }, update(value) { update=value; return query; }, eq(k,v) { filters.push([k,v]); return query; }, is(k,v) { filters.push([k,v]); return query; }, order() {return query;}, limit() {return query;}, maybeSingle: async () => {const r=execute();return {...r,data:Array.isArray(r.data)?r.data[0] || null:r.data};}, insert: async () => ({error: null}), then(resolve,reject) { return Promise.resolve(execute()).then(resolve,reject); } };
    return query;
  }
};
const source = (await readFile(new URL('../supabase/functions/employee-onboarding/index.ts', import.meta.url), 'utf8')).split('\n').filter(line => !line.startsWith('import ')).join('\n');
const { canInvite, parseObject, tokenHash, validInvite, validatedFields, validatedDocuments, referenceOptions, applyReference, requestText } = validation;
const fakeDeno = { env: { get: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', JOY_SMTP_PASSWORD: 'test' })[key] }, serve: callback => {handler=callback;} };
new Function('Deno', 'createClient', 'nodemailer', 'canInvite', 'parseObject', 'tokenHash', 'validInvite', 'validatedFields', 'handleFresh', 'validatedDocuments', 'referenceOptions', 'applyReference', 'requestText', 'applicableFields', stripTypeScriptTypes(source))(
  fakeDeno, () => admin, { createTransport: () => ({ sendMail: async mail => { if(rejectMail)throw Error('SMTP offline');mails.push(mail);return {accepted:[mail.to]}; }, close() {} }) }, canInvite, parseObject, tokenHash, validInvite, validatedFields, () => { throw new Error("Unexpected fresh route"); }, validatedDocuments, referenceOptions, applyReference, requestText, applicableFields
);
async function request(body, jwt = 'test-jwt') { return handler(new Request('https://test.invalid', { method: 'POST', headers: { origin: 'https://joy-payroll.praveen-red-07.workers.dev', authorization: jwt ? `Bearer ${jwt}` : '', 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: original.id, ...body }) })); }
async function invite(sendEmail=false) { const r = await request({action:'create',sendEmail});assert.equal(r.status,200);const body=await r.json();return {...body,token:body.link.split('.').at(-1)}; }
test('endpoint blocks unauthenticated and out-of-scope invitations without sending', async () => {
  reset(); assert.equal((await request({action:'create',sendEmail:true}, '')).status,401);
  actor={...actor,role:'field_hr',permissions_json:'{}',client_scope_json:'[]',unit_scope_json:'[]'};
  assert.equal((await request({action:'create',sendEmail:true})).status,403);assert.equal(mails.length,0);
});
test('email, token-only read, submission and replay protection', async () => {
  reset(); const invitation = await invite(true); assert.equal(invitation.sent,true);assert.equal(mails.length,1);
  assert.ok(mails[0].text.includes(invitation.link));assert.ok(!record.application_json.includes(invitation.token));
  const read = await request({action:'read', token:invitation.token},'');assert.equal(read.status,200);assert.deepEqual(Object.keys(await read.json()).sort(),['expires','name','references']);
  const fields={...validFields,'Position Applied For':'Welder'};
  assert.equal((await request({action:'submit',token:invitation.token,fields:{...fields,salary_amount:'999999'}},'')).status,400);
  assert.equal((await request({action:'submit',token:invitation.token,fields},'')).status,200);
  assert.equal(JSON.parse(record.application_json)['Position Applied For'],'Welder');
  assert.equal((await request({action:'submit',token:invitation.token,fields},'')).status,403);
});
test('failed SMTP revokes link and returns failure; link-only sharing sends no mail',async()=>{
  reset();rejectMail=true;const r=await request({action:'create',sendEmail:true});assert.equal(r.status,502);assert.equal(record.application_json,original.application_json);
  reset();await invite();assert.equal(mails.length,0);
});
test('expiry, resend throttle and concurrent edits fail safely', async()=>{
  reset();const invitation=await invite();assert.equal((await request({action:'create'})).status,429);
  conflict=true;assert.equal((await request({action:'submit',token:invitation.token,fields:validFields},'')).status,409);
  conflict=false;const app=JSON.parse(record.application_json);app._joyOnboarding.expires=Date.now()-1;record.application_json=JSON.stringify(app);
  assert.equal((await request({action:'read',token:invitation.token},'')).status,403);
});

test('valid uploads save with submission; invalid references and files leave invitation usable', async()=>{
 reset(); const link=await invite();
 const doc={category:'Aadhar Front side',filename:'proof.pdf',dataUrl:'data:application/pdf;base64,'+btoa('%PDF-1.7\n%%EOF')};
 assert.equal((await request({action:'submit',token:link.token,fields:{...validFields,'Reference 1 - Employee ID':'bad'}},'')).status,400);
 assert.equal((await request({action:'submit',token:link.token,fields:validFields,documents:[{...doc,dataUrl:'data:image/svg+xml;base64,YQ=='}]},'')).status,400);
 assert.equal((await request({action:'submit',token:link.token,fields:{...validFields,'Reference 1 - Name':'Forged'},documents:[doc]},'')).status,200);
 assert.deepEqual(documents,[doc]); assert.equal(JSON.parse(record.application_json)['Reference 1 - Name'],'Test Referrer');
});
