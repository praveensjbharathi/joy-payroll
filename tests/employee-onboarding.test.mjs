import test from 'node:test';
import assert from 'node:assert/strict';
import { canInvite, validatedFields, tokenHash, validInvite } from '../supabase/functions/employee-onboarding/validation.ts';
const employee = { vendor_id: 'company-a', client_unit_id: 'unit-a' };
const hr = { status: 'active', role: 'field_hr', permissions_json: '{}', client_scope_json: '["company-a"]', unit_scope_json: '["unit-a"]' };
test('inviting requires active employee management access and assigned company and HR unit', () => {
  assert.equal(canInvite(hr, employee), true);
  for (const change of [{ status: 'inactive' }, { role: 'unknown' }, { permissions_json: '{"employees":"view"}' }, { client_scope_json: '[]' }, { unit_scope_json: '["other"]' }, { unit_scope_json: 'malformed' }]) assert.equal(canInvite({ ...hr, ...change }, employee), false);
  assert.equal(canInvite({ status: 'active', role: 'super_admin' }, employee), true);
  assert.equal(canInvite({ ...hr, role: 'payroll_team' }, employee), false);
});
test('application rejects payroll mutation, metadata overwrite and excessive input', () => {
  const fields = { Declaration: 'Correct', 'Digital Signature (Type your full name)': 'Test Applicant', 'Position Applied For': 'Operator' };
  assert.deepEqual(validatedFields(fields), fields);
  for (const extra of [{ salary_amount: '999999' }, { bank_account_masked: '12345' }, { _joyOnboarding: '{}' }, { 'Position Applied For': 'x'.repeat(2001) }]) assert.throws(() => validatedFields({ ...fields, ...extra }));
  assert.throws(() => validatedFields({ Declaration: 'yes' }));
});
test('invitation rejects wrong, expired and consumed tokens', async () => {
  const hash = await tokenHash('a'.repeat(64));
  assert.notEqual(hash, 'a'.repeat(64));
  const invitation = { hash, expires: 2000 };
  assert.equal(validInvite(invitation, hash, 1000), true);
  assert.equal(validInvite(invitation, await tokenHash('b'.repeat(64)), 1000), false);
  assert.equal(validInvite(invitation, hash, 2000), false);
  assert.equal(validInvite({ ...invitation, submitted: 'today' }, hash, 1000), false);
});
