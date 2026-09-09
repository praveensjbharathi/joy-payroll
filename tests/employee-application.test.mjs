import assert from 'node:assert/strict';
import test from 'node:test';
import { readApplication, safeApplicationImage, applicationSections } from '../lib/employee-application.ts';

test('application parsing handles legacy records and malformed data', () => {
  for (const value of [null, '', 'invalid', '[]', 'null']) assert.deepEqual(readApplication(value), {});
  assert.deepEqual(readApplication('{"Date":"2026-09-09","bad":12}'), {Date:'2026-09-09'});
});
test('signature previews reject external URLs and executable image types', () => {
  for (const value of ['javascript:alert(1)', 'https://example.com/track.png', 'data:image/svg+xml;base64,PHN2Zz4=']) assert.equal(safeApplicationImage(value), undefined);
  assert.equal(safeApplicationImage('data:image/png;base64,YQ=='), 'data:image/png;base64,YQ==');
});
test('application field names are unique and retain separate declarations', () => {
  const names=applicationSections.flatMap(s => s.fields);
  assert.equal(new Set(names).size,names.length);
  assert.ok(names.includes('Declaration'));
  assert.ok(names.includes('Digital Signature (Type your full name)'));
});
