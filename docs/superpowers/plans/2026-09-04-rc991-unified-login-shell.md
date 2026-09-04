# RC991 Unified Login Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed Microsoft-only / employee-portal login behavior with one pre-authentication shell that offers Microsoft Entra and E-Mail/Passwort while preserving the existing role and tenant flow.

**Architecture:** Extract the approved dual-login UI and password-session actions from `employee-portal-v37.js` into a small auth-only module loaded before `app.js`. `app.js` decides when authentication is required; `auth-shell-v40.js` controls `auth-pending`, `auth-required`, and `auth-authenticated`. The old header Microsoft-login action and portal MutationObserver workaround are removed so there is exactly one visible internal login surface.

**Tech Stack:** Vanilla browser JavaScript, Azure Static Web Apps Entra route, existing password-auth API, Node `node:test` static contract tests.

**Spec:** `docs/superpowers/specs/2026-09-04-rc991-login-and-admin-preview-design.md`

## Global Constraints

- Target branch is `rc991-unified-learning-portal`.
- `main` stays unchanged until separate production approval.
- Internal login offers exactly two equivalent paths: `/.auth/login/aad` and `/api/auth/password/login`.
- Both login paths must resolve through the same existing `/api/me` role/company flow after authentication.
- `system_admin` must stop at company selection before `/api/bootstrap`.
- `company_admin`, `hse`, `line_manager`, and `employee` continue directly into their server-authorized company context.
- Non-system users requesting a foreign `x-company-id` must continue to receive 403.
- External personal instruction links remain independent from internal login.
- Passwords must not be stored or logged in frontend code.
- Logout must clear the password cookie endpoint and then end the Static Web Apps session.
- No migration, seed, import, or automatic data repair belongs to this block.

---

## File Structure

- Create `frontend/auth-login-v42.js`: single responsibility for rendering dual login and handling password login/logout.
- Modify `frontend/index.html`: load the common auth module before `app.js` and remove the old header-only Microsoft login action.
- Modify `frontend/app.js`: route `renderAuthenticationRequired()` into the common login module.
- Modify `frontend/employee-portal-v37.js`: remove duplicate login renderer, password login/logout functions, MutationObserver replacement, and duplicate logout binding.
- Keep `frontend/auth-shell-v40.js`: visual auth-state controller only.
- Create `tests/unified-login-shell-v42.test.js`: focused contract for one login shell, endpoints, autocomplete, logout, and absence of duplicate login surfaces.
- Modify `tests/employee-portal-contract.test.js`: point login semantics at the shared auth module.
- Modify `package.json`: register the new test in `pretest`.

### Task 1: Add a failing contract for one shared dual-login shell

**Files:**
- Create: `tests/unified-login-shell-v42.test.js`
- Modify: `tests/employee-portal-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `frontend/index.html`, `frontend/app.js`, `frontend/auth-shell-v40.js`, `frontend/employee-portal-v37.js`, planned `frontend/auth-login-v42.js`.
- Produces: RED tests that reject the current Microsoft-only app login, header login duplication, and portal MutationObserver replacement.

- [ ] **Step 1: Create `tests/unified-login-shell-v42.test.js`**

```js
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
  assert.doesNotMatch(html,/class="[^"]*login-action[^"]*"/,'Der alte Header-Login darf nicht als zweiter Loginweg sichtbar bleiben.');
  assert.match(app,/UMAuthLogin\.render/,'renderAuthenticationRequired muss die gemeinsame Login-Shell verwenden.');
  assert.match(login,/\.auth\/login\/aad/);
  assert.match(login,/\/api\/auth\/password\/login/);
  assert.match(login,/autocomplete="username"/);
  assert.match(login,/autocomplete="current-password"/);
  assert.match(login,/credentials\s*:\s*['"]include['"]/);
  assert.match(login,/\/api\/auth\/password\/logout/);
  assert.match(login,/\.auth\/logout/);
  assert.doesNotMatch(portal,/MutationObserver[\s\S]{0,900}login-box/,'Mitarbeiterportal darf keinen zweiten Login nachträglich ersetzen.');
  assert.doesNotMatch(portal,/function\s+renderUnifiedLogin|function\s+portalPasswordLogin|function\s+portalLogout/);
  assert.doesNotMatch(app,/login-box[\s\S]{0,800}Mit Microsoft anmelden[\s\S]{0,800}Sitzung abmelden/,'app.js darf keinen Microsoft-only Ersatzlogin mehr rendern.');
});

test('auth state remains separate from login markup and tenant routing',()=>{
  const shell=read('frontend/auth-shell-v40.js');
  const app=read('frontend/app.js');
  assert.match(shell,/auth-pending/);
  assert.match(shell,/auth-required/);
  assert.match(shell,/auth-authenticated/);
  assert.match(app,/requiresCompanySelection/);
  assert.match(app,/showCompanySelection/);
  assert.match(app,/await loadCompanyData\(\)/);
});
```

- [ ] **Step 2: Move the employee portal login contract to the common auth module**

Replace the existing login test in `tests/employee-portal-contract.test.js` with:
```js
test('login page offers Microsoft and email/password without changing role semantics', () => {
  const html = read('frontend/index.html');
  const login = read('frontend/auth-login-v42.js');
  assert.match(html, /auth-login-v42\.js/);
  assert.match(login, /E-Mail und Passwort/);
  assert.match(login, /\.auth\/login\/aad/);
  assert.match(login, /\/api\/auth\/password\/login/);
  assert.match(login, /credentials\s*:\s*['\"]include['\"]/);
});
```

- [ ] **Step 3: Register the new contract in `pretest`**

Add `tests/unified-login-shell-v42.test.js` to the `node --test ...` list in `package.json` immediately after `tests/tenant-isolation-login-v40.test.js`.

- [ ] **Step 4: Verify RED**

```bash
node --test tests/unified-login-shell-v42.test.js tests/employee-portal-contract.test.js tests/tenant-isolation-login-v40.test.js
```

Expected: RED because `auth-login-v42.js` is absent, the header still exposes `.login-action`, `app.js` still owns Microsoft-only login markup, and the portal still contains the replacement hack.

- [ ] **Step 5: Commit the RED contract**

```bash
git add tests/unified-login-shell-v42.test.js tests/employee-portal-contract.test.js package.json
git commit -m "test(rc991): require one shared dual-auth login shell"
```

### Task 2: Create the focused shared auth-login module

**Files:**
- Create: `frontend/auth-login-v42.js`
- Modify: `frontend/index.html`
- Test: `tests/unified-login-shell-v42.test.js`

**Interfaces:**
- Consumes: a target DOM element supplied by caller.
- Produces: frozen `globalThis.UMAuthLogin` with `render({target,message})`, `passwordLogin(event)`, and `logout(event)`.

- [ ] **Step 1: Create `frontend/auth-login-v42.js` with no app-state or tenant authority**

```js
(function(root){
  const escapeHtml=(value='')=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function render({target,message=''}){
    if(!target)return;
    const detail=String(message||'').replace(/^.*?Fehler:\s*/,'').trim();
    target.hidden=false;
    target.innerHTML=`<section class="dual-login-shell">
      <div class="dual-login-head"><span class="portal-badge">Unterweisungsmanager</span><h2>Anmeldung</h2><p class="muted">Microsoft oder E-Mail und Passwort – beide Wege verwenden dieselben Rollen und Firmenrechte.</p></div>
      <div class="dual-login-grid">
        <div class="card dual-login-card"><h3>Mit Microsoft anmelden</h3><p>Für Benutzer mit Microsoft-/Entra-Konto. Deine hinterlegte Rolle bestimmt anschließend den Funktionsumfang.</p><a class="btn primary" href="/.auth/login/aad">Mit Microsoft anmelden</a></div>
        <div class="card dual-login-card"><h3>E-Mail und Passwort</h3><p>Für interne Benutzer ohne Microsoft-Konto. Die Rechte entsprechen der im Benutzerkonto hinterlegten Rolle.</p>
          <form id="authPasswordLogin"><div class="field"><label for="authLoginEmail">E-Mail</label><input id="authLoginEmail" type="email" autocomplete="username" required></div>
          <div class="field"><label for="authLoginPassword">Passwort</label><input id="authLoginPassword" type="password" autocomplete="current-password" required></div>
          <button class="primary" type="submit">Anmelden</button><div id="authLoginResult" class="employee-login-error">${detail?`<div class="notice warning">${escapeHtml(detail)}</div>`:''}</div></form></div>
      </div><p class="muted" style="text-align:center;margin-top:18px">Externe Unterweisungen bleiben unabhängig davon über ihren persönlichen Link erreichbar.</p>
    </section>`;
    document.getElementById('authPasswordLogin')?.addEventListener('submit',passwordLogin);
  }

  async function passwordLogin(event){
    event?.preventDefault();
    const result=document.getElementById('authLoginResult');
    if(result)result.textContent='Anmeldung wird geprüft …';
    try{
      const response=await fetch('/api/auth/password/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:document.getElementById('authLoginEmail')?.value||'',password:document.getElementById('authLoginPassword')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Anmeldung fehlgeschlagen.');
      location.reload();
    }catch(error){
      if(result)result.innerHTML=`<div class="notice dangerbox">${escapeHtml(error.message||error)}</div>`;
    }
  }

  async function logout(event){
    event?.preventDefault();
    try{await fetch('/api/auth/password/logout',{method:'POST',credentials:'include'});}catch{}
    location.href='/.auth/logout';
  }

  function bindLogout(){
    const action=document.querySelector('.logout-action');
    if(!action||action.dataset.authLogoutBound==='1')return;
    action.dataset.authLogoutBound='1';
    action.addEventListener('click',logout);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindLogout,{once:true});
  else bindLogout();
  root.UMAuthLogin=Object.freeze({render,passwordLogin,logout});
})(globalThis);
```

This module must not read or assign `state`, `state.companyId`, roles, company IDs, or tenant headers.

- [ ] **Step 2: Load the module before `app.js` and remove the duplicate header login**

In `frontend/index.html`, use:
```html
<script src="/config.js"></script>
<script src="/auth-login-v42.js"></script>
<script src="/app.js"></script>
```

Remove this old header element entirely:
```html
<a class="btn ghost login-action" href="/.auth/login/aad">Anmelden</a>
```

Keep the existing `.logout-action`; the shared auth module owns its click behavior.

- [ ] **Step 3: Run syntax and focused module tests**

```bash
node --check frontend/auth-login-v42.js
node --test tests/unified-login-shell-v42.test.js
```

Expected: module/script/header checks pass; app/portal cleanup assertions remain RED until Tasks 3 and 4.

- [ ] **Step 4: Commit the focused module and header cleanup**

```bash
git add frontend/auth-login-v42.js frontend/index.html
git commit -m "feat(rc991): add shared dual-auth login module"
```

### Task 3: Route application authentication failures into the shared shell

**Files:**
- Modify: `frontend/app.js`
- Test: `tests/unified-login-shell-v42.test.js`

**Interfaces:**
- Consumes: `globalThis.UMAuthLogin.render({target,message})`.
- Produces: `renderAuthenticationRequired(message)` that clears prior app state, closes workspace data, and renders exactly one login shell.

- [ ] **Step 1: Replace the Microsoft-only markup inside `renderAuthenticationRequired()`**

```js
function renderAuthenticationRequired(message=''){
  state.apiAvailable=false;
  state.data=null;
  state.statusRows=[];
  state.users=[];
  state.companyId=null;
  setCoreWorkspaceVisible(false);
  const gate=$('companySelectionGate');
  if(gate){
    gate.hidden=false;
    gate.innerHTML='';
    if(globalThis.UMAuthLogin?.render)globalThis.UMAuthLogin.render({target:gate,message});
    else gate.innerHTML='<section class="card auth-pending-card"><h2>Anmeldung erforderlich</h2><p class="muted">Der Loginbereich konnte nicht geladen werden. Bitte Seite neu laden.</p></section>';
  }
  renderUserInfo(false);
  if(typeof updateCompanyShell==='function')updateCompanyShell(null);
}
```

The fallback is a neutral loading/error message only; it must not contain another Microsoft or password login implementation.

- [ ] **Step 2: Preserve role/company routing unchanged**

Keep these semantics in `loadData()`:
```js
state.me = await api('/me');
if(state.me?.companyId) state.companyId = state.me.companyId;
if(requiresCompanySelection()){
  state.companyId = null;
  if(typeof showCompanySelection==='function')await showCompanySelection();
  else renderServiceUnavailable('Firmenauswahl ist noch nicht geladen.');
  return;
}
await loadCompanyData();
```

- [ ] **Step 3: Run focused login/tenant tests**

```bash
node --test tests/unified-login-shell-v42.test.js tests/tenant-isolation-login-v40.test.js tests/system-admin-company-selection.test.js
```

Expected: shared-shell and company-selection contracts pass except portal cleanup assertions that belong to Task 4.

- [ ] **Step 4: Commit app routing**

```bash
git add frontend/app.js tests/unified-login-shell-v42.test.js
git commit -m "fix(rc991): route authentication into shared login shell"
```

### Task 4: Remove duplicate login behavior from the employee portal

**Files:**
- Modify: `frontend/employee-portal-v37.js`
- Test: `tests/employee-portal-contract.test.js`
- Test: `tests/unified-login-shell-v42.test.js`

**Interfaces:**
- Consumes: shared login/logout behavior from `UMAuthLogin` outside the employee portal.
- Produces: employee portal code concerned only with employee/line-manager dashboards and learning actions.

- [ ] **Step 1: Delete these duplicate functions from `employee-portal-v37.js`**

```text
renderUnifiedLogin
portalPasswordLogin
portalLogout
```

- [ ] **Step 2: Delete the MutationObserver/login-box replacement and portal logout binding**

Remove the complete block that watches `main .login-box`, calls `renderUnifiedLogin(...)`, and binds `.logout-action` to `portalLogout`.

- [ ] **Step 3: Remove the deleted login symbols from the portal export**

The export must retain employee-domain functions only:
```js
Object.assign(window,{portalStartInstruction,portalRequestAppointment,portalDownloadProof,portalCloseLearning,portalLearningNext,portalLearningPrev,portalSubmitTraining,portalOpenOriginal,portalZoomLearningImage,portalSaveLearningStep,portalToggleLearningStep,portalSaveDelivery});
```

- [ ] **Step 4: Run employee/login regressions**

```bash
node --check frontend/employee-portal-v37.js
node --test tests/employee-portal-contract.test.js tests/unified-login-shell-v42.test.js tests/password-auth.test.js
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit duplicate removal**

```bash
git add frontend/employee-portal-v37.js tests/employee-portal-contract.test.js tests/unified-login-shell-v42.test.js
git commit -m "refactor(rc991): remove duplicate employee login shell"
```

### Task 5: Verify full RC991 before company-branch synchronization

**Files:**
- Verify all repository tests and workflows; no feature expansion.

**Interfaces:**
- Consumes: green Admin Preview plan plus Tasks 1–4 of this plan.
- Produces: fully verified RC991 suitable for controlled synchronization into Essentra and Kontur branches.

- [ ] **Step 1: Run syntax checks for changed frontend modules**

```bash
node --check frontend/auth-login-v42.js
node --check frontend/auth-shell-v40.js
node --check frontend/app.js
node --check frontend/employee-portal-v37.js
node --check frontend/learning-admin-v38.js
node --check frontend/instruction-type-management-v23.js
```

Expected: every command exits successfully.

- [ ] **Step 2: Run the critical contract set**

```bash
node --test tests/learning-admin-v38.test.js tests/unified-learning-experience.test.cjs tests/unified-login-shell-v42.test.js tests/employee-portal-contract.test.js tests/password-auth.test.js tests/system-admin-company-selection.test.js tests/tenant-isolation-login-v40.test.js tests/company-admin-provisioning.test.js tests/blob-missing-download-v41.test.js
```

Expected: all selected tests pass.

- [ ] **Step 3: Run full repository tests**

```bash
npm test
```

Expected: `pretest`, frontend/static contracts, API tests, and syntax checks all pass.

- [ ] **Step 4: Push the tested RC991 commit and inspect the triggered Azure Static Web Apps workflow**

The workflow in `.github/workflows/azure-static-web-apps.yml` must finish GREEN for the exact RC991 commit. A local green run alone is not deployment verification.

- [ ] **Step 5: Verify `main` is still unchanged**

```bash
git rev-parse main
```

Expected baseline remains `4ee691a80d66dbd6b543ae9b5a59532f2f1569cf` unless the user separately approves production release.

- [ ] **Step 6: Synchronize only the verified shared commits into company branches**

Apply the tested shared changes to:
```text
company/essentra-components
company/kontur-werkzeugstahl
```

Do not merge `main`, seed data, or change tenant-specific records while synchronizing code.

- [ ] **Step 7: Verify both company branches after synchronization**

Inspect their deployment workflows and require GREEN on both before reporting the shared login/preview block complete.
