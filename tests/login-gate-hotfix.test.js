import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('anonymous startup is fail-closed and never selects or seeds Essentra', () => {
  const app = read('frontend/app.js');
  const index = read('frontend/index.html');
  assert.match(app, /companyId:\s*null/, 'Frontend state must start without a company context');
  assert.doesNotMatch(app, /fetch\(['"]\/seed\/essentra-startdata\.json/, 'Cloud startup must never fall back to Essentra seed data');
  assert.match(app, /if\s*\(state\.companyId[^)]*\)[^\n]*x-company-id/s, 'Company header must only be sent after an explicit company context exists');
  assert.match(index, /id="companySelectionGate"/, 'A dedicated login/company gate must exist before the workspace');
  assert.match(index, /id="portalNavigation"[^>]*hidden/, 'Primary navigation must be hidden before authentication');
  assert.doesNotMatch(index, />Essentra aktiv</, 'The anonymous shell must not present Essentra as active');
});

test('central login shell offers Microsoft and password login on the same website', () => {
  assert.ok(existsSync('frontend/auth-login-v42.js'), 'Shared login shell is missing');
  const login = read('frontend/auth-login-v42.js');
  const index = read('frontend/index.html');
  assert.match(login, /Mit Microsoft anmelden/);
  assert.match(login, /E-Mail und Passwort/);
  assert.match(login, /\/api\/auth\/password\/login/);
  assert.ok(index.indexOf('/auth-login-v42.js') >= 0 && index.indexOf('/auth-login-v42.js') < index.indexOf('/app.js'), 'Login shell must load before app.js');
});

test('live deployment includes the managed API and its runtime settings bridge', () => {
  const workflow = read('.github/workflows/azure-static-web-apps.yml');
  assert.match(workflow, /api_location:\s*["']?api["']?/);
  assert.match(workflow, /prepare-managed-api-settings\.js/);
  assert.ok(existsSync('scripts/prepare-managed-api-settings.js'), 'Managed API runtime settings script is missing');
});

test('production auth cannot use dev bypass and system admin must choose a company', () => {
  const auth = read('api/src/lib/auth.js');
  const me = read('api/src/functions/me.js');
  assert.match(auth, /devBypass\s*&&\s*!base\.isAuthenticated\s*&&\s*base\.isLocalDev/, 'Dev bypass must be impossible outside local development');
  assert.match(auth, /systemAdminSelectionContext/);
  assert.match(auth, /companyId:\s*null/);
  assert.match(me, /requiresCompanySelection/);
});

test('password authentication backend is part of the same managed API', () => {
  assert.ok(existsSync('api/src/functions/passwordAuth.js'), 'Password login/logout endpoints are missing');
  assert.ok(existsSync('api/src/lib/passwordAuth.js'), 'Password session implementation is missing');
});
