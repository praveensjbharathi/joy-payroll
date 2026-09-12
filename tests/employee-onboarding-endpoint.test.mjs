import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import * as validation from '../supabase/functions/employee-onboarding/validation.ts';

let handler, record, actor, mails, rejectMail, conflict;
const original = { id: 'test-employee', name: 'Test Applicant', status: 'active', vendor_id: 'company-a', client_unit_id: 'unit-a', email_address: 'test@example.invalid', application_json: '{"Position Applied For":"Operator"}' };
function reset() { record = { ...original }; actor = { status: 'active', role: 'super_admin', email: 'hr@example.invalid' }; mails = []; rejectMail = false; conflict = false; }
const admin = {
  auth: { getUser: async token => token === 'test-jwt' ? { data: { user: { email: 'hr@example.invalid', email_confirmed_at: 'today' } } } : { error: true, data: {} } },
  from(table) {
    let update, filters = [];
    const execute = () => {
      if (update) {
        if (conflict || filters.some(([k,v]) => record[k] !== v)) return { data: [], error: null };
        Object.assign(record, update); return { data: [{ id: record.id }], error: null };
      }
      return { data: table === 'app_users' ? actor : record && filters.every(([k,v]) => record[k] === v) ? { ...record } : null, error: null };
    };
    const query = { select() { return query; }, update(value) { update=value; return query; }, eq(k,v) { filters.push([k,v]); return query; }, is(k,v) { filters.push([k,v]); return query; }, maybeSingle: async () => execute(), insert: async () => ({error: null}), then(resolve,reject) { return Promise.resolve(execute()).then(resolve,reject); } };
    return query;
  }
};
const source = (await readFile(new URL('../supabase/functions/employee-onboarding/index.ts', import.meta.url), 'utf8')).split('\n').filter(line => !line.startsWith('import ')).join('\n');
const { canInvite, parseObject, tokenHash, validInvite, validatedFields } = validation;
const fakeDeno = { env: { get: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', JOY_SMTP_PASSWORD: 'test' })[key] }, serve: callback => {handler=callback;} };
new Function('Deno', 'createClient', 'nodemailer', 'canInvite', 'parseObject', 'tokenHash', 'validInvite', 'validatedFields', stripTypeScriptTypes(source))(
  fakeDeno, () => admin, { createTransport: () => ({ sendMail: async mail => { if(rejectMail)throw Error('SMTP offline');mails.push(mail);return {accepted:[mail.to]}; }, close() {} }) }, canInvite, parseObject, tokenHash, validInvite, validatedFields
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
  const read = await request({action:'read', token:invitation.token},'');assert.equal(read.status,200);assert.deepEqual(Object.keys(await read.json()).sort(),['expires','name']);
  const fields={Declaration:'Correct','Digital Signature (Type your full name)':'Test Applicant','Position Applied For':'Welder'};
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
  conflict=true;assert.equal((await request({action:'submit',token:invitation.token,fields:{Declaration:'Correct','Digital Signature (Type your full name)':'Test Applicant'}},'')).status,409);
  conflict=false;const app=JSON.parse(record.application_json);app._joyOnboarding.expires=Date.now()-1;record.application_json=JSON.stringify(app);
  assert.equal((await request({action:'read',token:invitation.token},'')).status,403);
});
