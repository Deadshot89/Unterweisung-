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

test('index keeps one neutral internal shell instead of a baked-in admin website', () => {
  const html=read('frontend/index.html');
  assert.match(html, /<nav[^>]*id="portalNavigation"[^>]*class="tabs primary-tabs"[^>]*hidden[^>]*><\/nav>/);
  assert.match(html, /auth-login-v42\.js[\s\S]*portal-shell-v43\.js[\s\S]*app\.js/);
  assert.doesNotMatch(html, /<nav[^>]*primary-tabs[^>]*>[\s\S]*data-view="companies"/);
  assert.equal((html.match(/id="portalNavigation"/g)||[]).length,1);
});

test('application resolves the portal mode immediately after /api/me and before company data', () => {
  const app=read('frontend/app.js');
  assert.match(app, /portalMode:\s*['"]auth-pending['"]/);
  assert.match(app, /function\s+resolveCurrentPortalMode\(\)/);
  assert.match(app, /UMPortalShell\.resolvePortalMode\(state\.me,\s*state\.companyId\)/);
  assert.match(app, /function\s+applyCurrentPortalMode\(\)/);
  assert.match(app, /UMPortalShell\.applyPortalMode\(state\.portalMode,\s*\{onNavigate:setView\}\)/);
  assert.match(app, /const\s+mode\s*=\s*applyCurrentPortalMode\(\)/);
  assert.match(app, /mode\s*===\s*['"]company-selection['"]/);
  assert.match(app, /mode\s*===\s*['"]denied['"]/);
  assert.match(app, /function\s+renderPortalAccessDenied\(\)/);
  assert.doesNotMatch(app, /document\.querySelectorAll\(['"]\.tabs button['"]\)\.forEach\(b=>b\.addEventListener/);
});

test('role guard prevents direct admin views from employee portal modes', () => {
  const guard=read('frontend/role-guard-v20.js');
  assert.match(guard,/function\s+portalModeAllowsView/);
  assert.match(guard,/employee-portal/);
  assert.match(guard,/employee-manager-portal/);
  assert.match(guard,/admin-portal/);
  assert.match(guard,/portalModeAllowsView\(view\).*hasAnyRole/s);
  assert.match(guard,/#portalNavigation|portalNavigation/);
});

test('role-guard denied recovery remains usable under script-src self CSP', () => {
  const guard=read('frontend/role-guard-v20.js');
  assert.doesNotMatch(guard,/\sonclick\s*=/i);
  assert.match(guard,/data-role-guard-action/);
  assert.match(guard,/addEventListener\(['"]click['"]/);
});
