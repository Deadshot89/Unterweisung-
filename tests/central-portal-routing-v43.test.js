import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadPortalShell(){
  const context = { globalThis: null, document: undefined };
  context.globalThis = context;
  vm.runInNewContext(read('frontend/portal-shell-v43.js'), context);
  return context.UMPortalShell;
}

test('portal mode follows the approved role priority', () => {
  const shell = loadPortalShell();
  assert.equal(shell.resolvePortalMode(null, null), 'auth-required');
  assert.equal(shell.resolvePortalMode({roles:['system_admin']}, null), 'company-selection');
  assert.equal(shell.resolvePortalMode({roles:['system_admin','employee']}, 'company-a'), 'admin-portal');
  assert.equal(shell.resolvePortalMode({roles:['company_admin','employee'],companyId:'company-a'}, 'company-a'), 'admin-portal');
  assert.equal(shell.resolvePortalMode({roles:['hse','line_manager'],companyId:'company-a'}, 'company-a'), 'admin-portal');
  assert.equal(shell.resolvePortalMode({roles:['line_manager','employee'],companyId:'company-a'}, 'company-a'), 'employee-manager-portal');
  assert.equal(shell.resolvePortalMode({roles:['employee'],companyId:'company-a'}, 'company-a'), 'employee-portal');
  assert.equal(shell.resolvePortalMode({roles:['authenticated'],companyId:'company-a'}, 'company-a'), 'denied');
});
