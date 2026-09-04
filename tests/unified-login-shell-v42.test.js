import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFileSync(url(path),'utf8');

test('one pre-auth shell owns Microsoft and email/password login',()=>{
  assert.ok(existsSync(url('frontend/auth-login-v42.js')),'auth-login-v42.js fehlt');
  const html=read('frontend/index.html');
  const app=read('frontend/app.js');
  const login=read('frontend/auth-login-v42.js');
  const portal=read('frontend/employee-portal-v37.js');

  assert.match(html,/auth-login-v42\.js[\s\S]*app\.js/,'Auth-Login muss vor app.js geladen werden.');
  assert.match(app,/UMAuthLogin\.render/,'renderAuthenticationRequired muss die gemeinsame Login-Shell verwenden.');
  assert.match(login,/\.auth\/login\/aad/);
  assert.match(login,/\/api\/auth\/password\/login/);
  assert.match(login,/autocomplete="username"/);
  assert.match(login,/autocomplete="current-password"/);
  assert.match(login,/credentials\s*:\s*['"]include['"]/);
  assert.match(login,/\/api\/auth\/password\/logout/);
  assert.match(login,/\.auth\/logout/);
  assert.match(login,/Externe Unterweisungen/);
  assert.doesNotMatch(login,/state\.companyId|x-company-id/i,'Login-UI darf keine Mandantenautorität übernehmen.');
  assert.doesNotMatch(html,/class="[^"]*login-action[^"]*"/,'Im Header darf kein zweiter Anmelden-Knopf parallel zur Login-Shell bleiben.');
  assert.doesNotMatch(portal,/function\s+renderUnifiedLogin|function\s+portalPasswordLogin|function\s+portalLogout/,'Mitarbeiterportal darf keinen zweiten Login-/Logout-Stack besitzen.');
  assert.doesNotMatch(portal,/MutationObserver[\s\S]{0,900}login-box/,'Mitarbeiterportal darf keinen Login nachträglich ersetzen.');
  assert.doesNotMatch(app,/login-box[\s\S]{0,800}Mit Microsoft anmelden[\s\S]{0,800}Sitzung abmelden/,'app.js darf keinen Microsoft-only Ersatzlogin mehr rendern.');
});

test('auth state stays separate from login markup and preserves tenant routing',()=>{
  const shell=read('frontend/auth-shell-v40.js');
  const app=read('frontend/app.js');
  assert.match(shell,/auth-pending/);
  assert.match(shell,/auth-required/);
  assert.match(shell,/auth-authenticated/);
  assert.match(app,/requiresCompanySelection/);
  assert.match(app,/showCompanySelection/);
  assert.match(app,/await loadCompanyData\(\)/);
});

test('shared logout clears password session before static-web-apps logout',()=>{
  const login=read('frontend/auth-login-v42.js');
  const passwordLogout=login.indexOf('/api/auth/password/logout');
  const platformLogout=login.indexOf('/.auth/logout');
  assert.ok(passwordLogout>=0 && platformLogout>passwordLogout,'Passwort-Session muss vor der Plattform-Sitzung beendet werden.');
});
