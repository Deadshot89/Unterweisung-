import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../api/src/lib/auth.js', import.meta.url), 'utf8');
const me = readFileSync(new URL('../api/src/functions/me.js', import.meta.url), 'utf8');

test('system admin is not silently assigned the default company', () => {
  assert.doesNotMatch(auth, /if\(isSystemAdmin&&!selected\)selected=\{companyId:defaultCompanyId\(\)/);
  assert.match(auth, /companyId:null/);
});

test('/api/me exposes company-selection state', () => {
  assert.match(me, /requiresCompanySelection/);
  assert.match(me, /ctx\.roles\.includes\(Roles\.SYSTEM_ADMIN\)/);
});
