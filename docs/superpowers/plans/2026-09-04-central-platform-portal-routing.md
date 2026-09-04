# Central Platform Portal Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine einzige zentrale Unterweisungsmanager-Website routet nach gemeinsamer Anmeldung deterministisch in Firmenauswahl, Verwaltungsportal, Führungskräfteportal oder Mitarbeiterportal, ohne getrennte Firmen-/Rollen-Webseiten zu erzeugen.

**Architecture:** Die bestehende `index.html` bleibt die einzige interne Anwendung. Ein neues kleines, DOM-arme Modul `frontend/portal-shell-v43.js` übernimmt ausschließlich Portalmodus-Auflösung und Navigationsdefinition; `app.js` orchestriert Authentifizierung, Firmenkontext und Datenbootstrap. `company-context-v39.js` bleibt für die Systemadmin-Firmenauswahl zuständig, `role-guard-v20.js` bleibt die UI-Zweitbarriere für einzelne Views, und `employee-portal-v37.js` rendert weiterhin die Mitarbeiter-/Führungsinhalte.

**Tech Stack:** Vanilla JavaScript im Browser, Node.js `node:test`, Azure Static Web Apps, Azure Functions, Azure SQL/Blob; vorhandene Rollen-/Tenant-APIs bleiben unverändert.

**Spec:** `docs/superpowers/specs/2026-09-04-central-platform-admin-employee-separation-design.md`

## Global Constraints

- Es gibt genau eine zentrale interne Website und eine gemeinsame Login-Adresse.
- Es wird keine zweite `index.html`, keine separate Admin-URL und keine separate Mitarbeiter-URL eingeführt.
- Microsoft und E-Mail/Passwort bleiben in `frontend/auth-login-v42.js` der einzige interne Login-Stack.
- Rollenpriorität für den Portalmodus ist verbindlich: `system_admin` → `company_admin`/`hse` → `line_manager` → `employee`.
- `system_admin` ohne Firmenkontext lädt keinen Fachbootstrap und bekommt ausschließlich die Firmenauswahl.
- `company_admin` und `hse` öffnen direkt das Verwaltungsportal ihrer serverseitig erlaubten Firma.
- `line_manager` und `employee` öffnen das Mitarbeiter-/Führungsportal und niemals die Adminnavigation.
- Server bleibt Autorität für Rolle, Benutzer, `companyId`, Downloads und direkte Datei-IDs; Frontend-Hiding erweitert keine Rechte.
- Externe persönliche Unterweisungslinks bleiben unabhängig vom internen Portal und ohne internes Konto nutzbar.
- Firmenwechsel bleibt auf derselben Origin und muss alle firmenspezifischen Frontendzustände leeren.
- Keine Datenmigration, kein Seed, kein Datenimport und keine automatische Datenreparatur in diesem Architekturblock.
- Preview-/RC-URLs dienen nur Entwicklung/Abnahme und werden nicht als getrennte Firmen-Webseiten behandelt.
- `main` bleibt bis zur ausdrücklichen Produktionsfreigabe unverändert.

---

## File Structure

- **Create `frontend/portal-shell-v43.js`** — reine Portalmodus-Auflösung, Navigationsdefinitionen und Rendering der einzigen Hauptnavigation.
- **Create `tests/central-portal-routing-v43.test.js`** — Verhaltenstest für Rollenpriorität sowie Vertragsprüfung für eine neutrale zentrale Shell.
- **Modify `frontend/index.html`** — statische Adminbuttons durch einen einzigen leeren `#portalNavigation`-Container ersetzen; `portal-shell-v43.js` vor `app.js` laden.
- **Modify `frontend/app.js`** — `state.portalMode`, zentrale Modus-Auflösung nach `/api/me`, sichere Fehleransicht für unbekannte Rollen und delegierte Navigationsbindung.
- **Modify `frontend/company-context-v39.js`** — Firmenwechsel auf neuen Portalmodus koppeln und alle bekannten Firmen-/Portal-Caches leeren.
- **Modify `frontend/employee-portal-v37.js`** — Mitarbeitererlebnis ausschließlich über `state.portalMode` aktivieren und internen Cache-Reset exportieren.
- **Modify `frontend/employee-learning-v38.js`** — Lernmodal-/Bildcache über eine explizite Reset-Funktion für Firmenwechsel/Logout bereinigbar machen.
- **Modify `frontend/role-guard-v20.js`** — Direktzugriffe zusätzlich gegen den aktiven Portalmodus prüfen; nur die dynamisch erzeugte Hauptnavigation bearbeiten.
- **Modify `tests/company-context-v39.test.js`** — vollständigen Firmenwechsel-Reset und gleichen Browser-Origin absichern.
- **Modify `tests/employee-portal-contract.test.js`** — Portalmodus-Trennung und Mitarbeiter-Reset absichern.
- **Modify `scripts/check-role-guard.js`** — Portalmodus als zusätzliche UI-Grenze verlangen.
- **Modify `package.json`** — neuen zentralen Routing-Test in `pretest` aufnehmen und `portal-shell-v43.js` in Syntaxchecks aufnehmen.

---

### Task 1: Portalmodus und Rollenpriorität als eigenständigen Kern festlegen

**Files:**
- Create: `frontend/portal-shell-v43.js`
- Create: `tests/central-portal-routing-v43.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: Benutzerobjekt `{ roles?: string[], companyId?: string|null, requiresCompanySelection?: boolean }` und expliziten `companyId` aus `state`.
- Produces: `globalThis.UMPortalShell.resolvePortalMode(me, companyId) -> string`.
- Produces: `globalThis.UMPortalShell.navigationForMode(mode) -> Array<{view:string,label:string}>`.
- Produces: `globalThis.UMPortalShell.applyPortalMode(mode, { onNavigate }) -> void`.
- Produces: `globalThis.UMPortalShell.clearPortalShell() -> void`.

- [ ] **Step 1: RED-Test für die Rollenpriorität schreiben**

`tests/central-portal-routing-v43.test.js` beginnt mit einem echten Ausführungstest des neuen Browsermoduls über `vm`:

```js
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
```

- [ ] **Step 2: RED-Test ausführen**

Run:

```bash
node --test tests/central-portal-routing-v43.test.js
```

Expected: FAIL, weil `frontend/portal-shell-v43.js` noch nicht existiert.

- [ ] **Step 3: Minimales Portal-Shell-Modul implementieren**

`frontend/portal-shell-v43.js` erhält exakt diese Moduslogik und Navigationsdefinitionen:

```js
(function(root){
  const MODES=Object.freeze({
    AUTH_REQUIRED:'auth-required',
    COMPANY_SELECTION:'company-selection',
    ADMIN:'admin-portal',
    MANAGER:'employee-manager-portal',
    EMPLOYEE:'employee-portal',
    DENIED:'denied'
  });

  const ADMIN_NAV=Object.freeze([
    ['dashboard','Dashboard'],['companies','Firmen'],['employees','Mitarbeiter'],
    ['instructions','Unterweisungen'],['status','Status'],['reminders','Erinnerungen'],
    ['proofs','Nachweise'],['managerReport','Manager-Report'],['planning','Planung'],
    ['external','Externe Links'],['users','Benutzer'],['operations','Betrieb'],['security','Sicherheit']
  ]);
  const MANAGER_NAV=Object.freeze([
    ['dashboard','Meine Unterweisungen'],['planning','Team einplanen'],['external','Externe Unterweisungen']
  ]);
  const EMPLOYEE_NAV=Object.freeze([
    ['dashboard','Meine Unterweisungen']
  ]);

  function rolesOf(me){return Array.isArray(me?.roles)?me.roles:[];}
  function resolvePortalMode(me,companyId){
    if(!me)return MODES.AUTH_REQUIRED;
    const roles=rolesOf(me);
    if(roles.includes('system_admin'))return companyId?MODES.ADMIN:MODES.COMPANY_SELECTION;
    if(roles.includes('company_admin')||roles.includes('hse'))return MODES.ADMIN;
    if(roles.includes('line_manager'))return MODES.MANAGER;
    if(roles.includes('employee'))return MODES.EMPLOYEE;
    return MODES.DENIED;
  }
  function navigationForMode(mode){
    const source=mode===MODES.ADMIN?ADMIN_NAV:mode===MODES.MANAGER?MANAGER_NAV:mode===MODES.EMPLOYEE?EMPLOYEE_NAV:[];
    return source.map(([view,label])=>({view,label}));
  }
  function clearPortalShell(){
    if(typeof document==='undefined')return;
    const nav=document.getElementById('portalNavigation');
    if(nav){nav.innerHTML='';nav.hidden=true;}
    document.body?.removeAttribute('data-portal-mode');
  }
  function applyPortalMode(mode,{onNavigate}={}){
    if(typeof document==='undefined')return;
    const nav=document.getElementById('portalNavigation');
    if(!nav)return;
    const items=navigationForMode(mode);
    document.body.dataset.portalMode=mode;
    nav.innerHTML=items.map((item,index)=>`<button type="button" data-view="${item.view}"${index===0?' class="active"':''}>${item.label}</button>`).join('');
    nav.hidden=items.length===0;
    nav.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>onNavigate?.(button.dataset.view)));
  }

  root.UMPortalShell=Object.freeze({MODES,resolvePortalMode,navigationForMode,applyPortalMode,clearPortalShell});
})(globalThis);
```

- [ ] **Step 4: GREEN-Test und Syntaxcheck ausführen**

Run:

```bash
node --test tests/central-portal-routing-v43.test.js
node --check frontend/portal-shell-v43.js
```

Expected: beide PASS.

- [ ] **Step 5: Test in die Standardsuite aufnehmen und committen**

`package.json` erweitert `pretest` um `tests/central-portal-routing-v43.test.js` und `test` um `node --check frontend/portal-shell-v43.js`.

Commit:

```bash
git add frontend/portal-shell-v43.js tests/central-portal-routing-v43.test.js package.json
git commit -m "test(rc991): define deterministic central portal modes"
```

---

### Task 2: Statische Adminnavigation aus der einzigen `index.html` entfernen

**Files:**
- Modify: `frontend/index.html`
- Modify: `tests/central-portal-routing-v43.test.js`

**Interfaces:**
- Consumes: `UMPortalShell.applyPortalMode()` aus Task 1.
- Produces: exakt einen DOM-Container `#portalNavigation` für jede interne Hauptnavigation.

- [ ] **Step 1: RED-Vertrag für eine neutrale zentrale Shell ergänzen**

Zum Test hinzufügen:

```js
test('index keeps one neutral internal shell instead of a baked-in admin website', () => {
  const html=read('frontend/index.html');
  assert.match(html, /<nav[^>]*id="portalNavigation"[^>]*class="tabs primary-tabs"[^>]*hidden[^>]*><\/nav>/);
  assert.match(html, /auth-login-v42\.js[\s\S]*portal-shell-v43\.js[\s\S]*app\.js/);
  assert.doesNotMatch(html, /<nav[^>]*primary-tabs[^>]*>[\s\S]*data-view="companies"/);
  assert.equal((html.match(/id="portalNavigation"/g)||[]).length,1);
});
```

- [ ] **Step 2: RED-Test ausführen**

Run:

```bash
node --test tests/central-portal-routing-v43.test.js
```

Expected: FAIL, weil `index.html` noch alle Adminbuttons fest enthält und `portal-shell-v43.js` noch nicht lädt.

- [ ] **Step 3: `index.html` auf einen neutralen Navigationscontainer umstellen**

Den bisherigen `<nav class="tabs primary-tabs">…</nav>`-Block vollständig ersetzen durch:

```html
<nav id="portalNavigation" class="tabs primary-tabs" hidden></nav>
```

Die Scriptreihenfolge wird:

```html
<script src="/config.js"></script>
<script src="/auth-login-v42.js"></script>
<script src="/portal-shell-v43.js"></script>
<script src="/app.js"></script>
```

Alle vorhandenen `.view`-Sections bleiben erhalten. Es wird keine zweite HTML-Seite erzeugt.

- [ ] **Step 4: GREEN-Test plus bestehende Loginverträge ausführen**

Run:

```bash
node --test tests/central-portal-routing-v43.test.js tests/unified-login-shell-v42.test.js tests/tenant-isolation-login-v40.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html tests/central-portal-routing-v43.test.js
git commit -m "feat(rc991): make the main shell portal-neutral"
```

---

### Task 3: `app.js` zur zentralen Portal-/Firmenzustandsmaschine machen

**Files:**
- Modify: `frontend/app.js`
- Modify: `tests/central-portal-routing-v43.test.js`
- Modify: `tests/unified-login-shell-v42.test.js`

**Interfaces:**
- Consumes: `UMPortalShell.resolvePortalMode(me, companyId)` und `UMPortalShell.applyPortalMode(mode,{onNavigate})`.
- Produces: `state.portalMode: string`.
- Produces: `resolveCurrentPortalMode() -> string`.
- Produces: `applyCurrentPortalMode() -> string`.
- Produces: `renderPortalAccessDenied() -> void`.

- [ ] **Step 1: RED-Vertrag für die zentrale Routing-Reihenfolge ergänzen**

```js
test('application resolves portal mode before company bootstrap and renders one navigation', () => {
  const app=read('frontend/app.js');
  assert.match(app, /portalMode:\s*['"]auth-pending['"]/);
  assert.match(app, /function\s+resolveCurrentPortalMode/);
  assert.match(app, /UMPortalShell\.resolvePortalMode\(state\.me,state\.companyId\)/);
  assert.match(app, /function\s+applyCurrentPortalMode/);
  assert.match(app, /UMPortalShell\.applyPortalMode\(state\.portalMode,\{onNavigate:setView\}\)/);
  assert.match(app, /mode===['"]company-selection['"][\s\S]{0,500}showCompanySelection/);
  assert.match(app, /mode===['"]denied['"][\s\S]{0,300}renderPortalAccessDenied/);
});
```

Zusätzlich den alten `unified-login-shell-v42.test.js` so anpassen, dass er weiterhin `showCompanySelection` und `loadCompanyData` fordert, aber zusätzlich `resolveCurrentPortalMode` erwartet.

- [ ] **Step 2: RED-Test ausführen**

Run:

```bash
node --test tests/central-portal-routing-v43.test.js tests/unified-login-shell-v42.test.js
```

Expected: FAIL an fehlendem `state.portalMode`/Routing.

- [ ] **Step 3: `state` und Routingfunktionen implementieren**

Den State um `portalMode:'auth-pending'` ergänzen und folgende Funktionen hinzufügen:

```js
function resolveCurrentPortalMode(){
  return UMPortalShell.resolvePortalMode(state.me,state.companyId);
}
function applyCurrentPortalMode(){
  state.portalMode=resolveCurrentPortalMode();
  UMPortalShell.applyPortalMode(state.portalMode,{onNavigate:setView});
  return state.portalMode;
}
function renderPortalAccessDenied(){
  setCoreWorkspaceVisible(false);
  UMPortalShell.clearPortalShell();
  const gate=$('companySelectionGate');
  if(gate){
    gate.hidden=false;
    gate.innerHTML='<section class="card"><h2>Zugriff nicht freigegeben</h2><div class="notice dangerbox">Für dieses Benutzerkonto ist keine gültige Portalrolle hinterlegt.</div><a class="btn ghost logout-action" href="/.auth/logout">Abmelden</a></section>';
  }
}
```

`renderAuthenticationRequired()` setzt zusätzlich:

```js
state.portalMode='auth-required';
UMPortalShell.clearPortalShell();
```

`loadData()` wird nach erfolgreichem `/api/me` so strukturiert:

```js
state.me=await api('/me');
state.companyId=state.me?.companyId||null;
renderUserInfo(true);
const mode=applyCurrentPortalMode();
if(mode==='company-selection'){
  state.companyId=null;
  await showCompanySelection();
  return;
}
if(mode==='denied'){
  renderPortalAccessDenied();
  return;
}
await loadCompanyData();
```

`loadCompanyData()` ruft unmittelbar vor dem Sichtbarmachen der Views `applyCurrentPortalMode()` auf. Dadurch wird bei `company_admin`/`hse` Adminnavigation, bei `line_manager` Führungskräftenavigation und bei `employee` Mitarbeiternavigation erzeugt.

- [ ] **Step 4: Alte statische Click-Bindung entfernen**

Diesen bisherigen Code entfernen:

```js
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
```

Die Navigation wird ausschließlich durch `UMPortalShell.applyPortalMode(...,{onNavigate:setView})` gebunden.

- [ ] **Step 5: GREEN-Tests ausführen**

```bash
node --test tests/central-portal-routing-v43.test.js tests/unified-login-shell-v42.test.js tests/system-admin-company-selection.test.js tests/tenant-isolation-login-v40.test.js
node --check frontend/app.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app.js tests/central-portal-routing-v43.test.js tests/unified-login-shell-v42.test.js
git commit -m "feat(rc991): route authenticated users into one central portal"
```

---

### Task 4: Firmenwechsel vollständig und ohne Seitenwechsel bereinigen

**Files:**
- Modify: `frontend/company-context-v39.js`
- Modify: `frontend/employee-portal-v37.js`
- Modify: `frontend/employee-learning-v38.js`
- Modify: `tests/company-context-v39.test.js`
- Modify: `tests/employee-portal-contract.test.js`

**Interfaces:**
- Consumes: `applyCurrentPortalMode()` aus Task 3.
- Produces: `window.resetEmployeePortalState() -> void`.
- Produces: `window.resetEmployeeLearningState() -> void`.
- `resetCompanyScopedState()` ruft beide optionalen Resetfunktionen auf.

- [ ] **Step 1: RED-Verträge für vollständigen Cache-Reset ergänzen**

In `tests/company-context-v39.test.js`:

```js
test('company switch clears portal-specific caches and stays inside the same application', () => {
  assert.match(companyContext, /resetEmployeePortalState/);
  assert.match(companyContext, /resetEmployeeLearningState/);
  assert.match(companyContext, /applyCurrentPortalMode/);
  assert.doesNotMatch(companyContext, /location\.(href|assign|replace)|window\.open/);
});
```

In `tests/employee-portal-contract.test.js`:

```js
test('employee portal exposes a cache reset for tenant switches', () => {
  const portal=read('frontend/employee-portal-v37.js');
  const learning=read('frontend/employee-learning-v38.js');
  assert.match(portal,/function\s+resetEmployeePortalState/);
  assert.match(portal,/portalState\.adminCache\.clear\(\)/);
  assert.match(portal,/state\.portalMode/);
  assert.match(learning,/function\s+resetEmployeeLearningState/);
  assert.match(learning,/portalState\.imageUrls\.clear\(\)/);
});
```

- [ ] **Step 2: RED-Tests ausführen**

```bash
node --test tests/company-context-v39.test.js tests/employee-portal-contract.test.js
```

Expected: FAIL an fehlenden Resetfunktionen.

- [ ] **Step 3: Mitarbeiterportal an den Portalmodus koppeln**

In `frontend/employee-portal-v37.js` wird `isEmployeeExperience()` auf den zentralen Zustand umgestellt:

```js
function isEmployeeExperience(){
  return state.portalMode==='employee-portal'||state.portalMode==='employee-manager-portal';
}
```

Die Resetfunktion lautet:

```js
function resetEmployeePortalState(){
  portalState.training=null;
  portalState.stepIndex=0;
  portalState.adminCache.clear();
  document.getElementById('portalLearningBackdrop')?.remove();
  document.querySelector('.learning-image-modal')?.remove();
}
window.resetEmployeePortalState=resetEmployeePortalState;
```

Die bestehende Admin-Lernschrittverwaltung im Modul bleibt für Adminrollen funktionsfähig; nur die Entscheidung, ob das Mitarbeiter-Dashboard die normale Dashboarddarstellung ersetzt, basiert auf `state.portalMode`.

- [ ] **Step 4: Lerncache explizit zurücksetzbar machen**

In `frontend/employee-learning-v38.js`:

```js
function resetEmployeeLearningState(){
  learningModal()?.remove();
  document.querySelector('.learning-image-modal')?.remove();
  portalState.training=null;
  portalState.result=null;
  portalState.stepIndex=0;
  portalState.imageUrls.clear();
}
```

Die Funktion wird in `Object.assign(window,{...})` als `resetEmployeeLearningState` exportiert. `portalCloseLearning()` darf intern `resetEmployeeLearningState()` verwenden.

- [ ] **Step 5: Firmenkontext-Reset erweitern**

Am Ende von `resetCompanyScopedState()` in `company-context-v39.js`:

```js
window.resetEmployeePortalState?.();
window.resetEmployeeLearningState?.();
```

`showCompanySelection()` setzt nach `state.companyId=null` den Modus:

```js
state.portalMode='company-selection';
UMPortalShell.clearPortalShell();
```

`openCompanyContext()` setzt nur `state.companyId`, lädt anschließend mit `loadCompanyData()` und lässt `applyCurrentPortalMode()` dort die Adminnavigation erzeugen. `leaveCompanyContext()` bleibt innerhalb derselben Seite und ruft keine Navigation auf eine andere URL auf.

- [ ] **Step 6: GREEN-Tests ausführen**

```bash
node --test tests/company-context-v39.test.js tests/employee-portal-contract.test.js tests/central-portal-routing-v43.test.js
node --check frontend/company-context-v39.js
node --check frontend/employee-portal-v37.js
node --check frontend/employee-learning-v38.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/company-context-v39.js frontend/employee-portal-v37.js frontend/employee-learning-v38.js tests/company-context-v39.test.js tests/employee-portal-contract.test.js
git commit -m "fix(rc991): clear portal state on system-admin company switches"
```

---

### Task 5: Direktzugriffe zusätzlich gegen den Portalmodus sperren

**Files:**
- Modify: `frontend/role-guard-v20.js`
- Modify: `scripts/check-role-guard.js`
- Modify: `tests/central-portal-routing-v43.test.js`

**Interfaces:**
- Consumes: `state.portalMode` aus Task 3.
- Produces: `portalModeAllowsView(view) -> boolean`.
- `viewAllowed(view)` bleibt die gemeinsame UI-Prüfung und kombiniert Portalmodus + Rollenmatrix.

- [ ] **Step 1: RED-Vertrag für Portalmodus-Grenzen schreiben**

In `tests/central-portal-routing-v43.test.js`:

```js
test('role guard prevents direct admin views from employee portal modes', () => {
  const guard=read('frontend/role-guard-v20.js');
  assert.match(guard,/function\s+portalModeAllowsView/);
  assert.match(guard,/employee-portal/);
  assert.match(guard,/employee-manager-portal/);
  assert.match(guard,/admin-portal/);
  assert.match(guard,/portalModeAllowsView\(view\).*hasAnyRole/s);
  assert.match(guard,/#portalNavigation|portalNavigation/);
});
```

`scripts/check-role-guard.js` ergänzt:

```js
assert.match(roleGuard,/portalModeAllowsView/,'Portalmodus muss Direktzugriffe zusätzlich zur Rollenmatrix einschränken.');
assert.match(roleGuard,/state\.portalMode/,'Rollen-Guard muss den zentralen Portalmodus berücksichtigen.');
```

- [ ] **Step 2: RED-Checks ausführen**

```bash
node --test tests/central-portal-routing-v43.test.js
node scripts/check-role-guard.js
```

Expected: FAIL.

- [ ] **Step 3: Portalmodus-Grenze implementieren**

In `role-guard-v20.js`:

```js
function portalModeAllowsView(view){
  const mode=state.portalMode;
  if(mode==='admin-portal')return true;
  if(mode==='employee-manager-portal')return ['dashboard','planning','external'].includes(view);
  if(mode==='employee-portal')return view==='dashboard';
  return false;
}
function viewAllowed(view){
  return portalModeAllowsView(view)&&hasAnyRole(ROLE_VIEW_RULES[view]||['system_admin']);
}
```

`applyRoleVisibility()` und der `setView`-Wrapper verwenden nur noch Buttons innerhalb `#portalNavigation`:

```js
const tabs=document.querySelectorAll('#portalNavigation button[data-view]');
```

Damit kann ein Mitarbeiter auch über einen internen Funktionsaufruf nicht in `users`, `companies`, `operations` oder andere Adminviews springen; die API-Rechte bleiben zusätzlich unverändert bestehen.

- [ ] **Step 4: GREEN-Checks ausführen**

```bash
node --test tests/central-portal-routing-v43.test.js tests/tenant-isolation-login-v40.test.js tests/access-scope.test.js
node scripts/check-role-guard.js
node --check frontend/role-guard-v20.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/role-guard-v20.js scripts/check-role-guard.js tests/central-portal-routing-v43.test.js
git commit -m "fix(rc991): enforce admin and employee portal boundaries"
```

---

### Task 6: Gesamtabnahme der zentralen Plattform durchführen

**Files:**
- No product files unless a regression reveals a concrete defect.
- Verify: `package.json`, `frontend/index.html`, all files from Tasks 1–5.

**Interfaces:**
- Produces no new interface; this task proves the full architecture against the complete RC991 suite.

- [ ] **Step 1: Fokussierten Routing-/Auth-/Tenant-Satz frisch ausführen**

```bash
node --test \
  tests/central-portal-routing-v43.test.js \
  tests/unified-login-shell-v42.test.js \
  tests/system-admin-company-selection.test.js \
  tests/company-context-v39.test.js \
  tests/employee-portal-contract.test.js \
  tests/tenant-isolation-login-v40.test.js \
  tests/access-scope.test.js \
  tests/blob-missing-download-v41.test.js
```

Expected: alle Tests PASS.

- [ ] **Step 2: Vollständige lokale Vertrags-/Syntaxsuite ausführen**

```bash
npm test
```

Expected: Exit Code 0; bestehende Auth-, Learning-, Planning-, Preview-, Tenant-, Download- und API-Verträge bleiben grün.

- [ ] **Step 3: Prüfen, dass keine zweite interne Website eingeführt wurde**

```bash
find frontend -maxdepth 2 -name 'index.html' -print
```

Expected: zentrale interne `frontend/index.html`; vorhandene explizite externe Lernseiten dürfen separat existieren, aber keine neue Firmen-/Admin-/Mitarbeiter-`index.html` aus diesem Block.

Zusätzlich:

```bash
grep -R "azurestaticapps.net" frontend --exclude='*.map' || true
```

Expected: keine hart codierte Firmen-/Portalweiterleitung auf eine zweite Azure-Webadresse.

- [ ] **Step 4: RC991-Workflow auf dem finalen Commit vollständig abwarten**

Verifizieren:
- vollständiger Frontend-/API-Testschritt GREEN,
- Runtime-Packaging GREEN,
- Azure-Preview-Deploy GREEN,
- Stylesheet-Verifikation GREEN.

Erst danach darf der Stand als abgeschlossen bezeichnet werden.

- [ ] **Step 5: `main`-Isolation prüfen**

```bash
git rev-parse main
```

Expected: weiterhin der vor diesem Block freigegebene Produktionscommit `4ee691a80d66dbd6b543ae9b5a59532f2f1569cf`, sofern der Benutzer zwischenzeitlich keine separate Produktionsfreigabe gegeben hat.

- [ ] **Step 6: Firmenbranches nicht als eigene Live-Portale veröffentlichen**

Keine automatische Übernahme nach `main` und kein Firmenbranch-Deploy als neue reguläre Login-URL. Falls Essentra/Kontur später den gemeinsamen Code synchronisiert bekommen, darf das nur als Integrationsstand erfolgen; das Release-Ziel bleibt eine einzige zentrale Plattform.

---

## Self-Review

### Spec coverage

- Eine zentrale Loginseite: Tasks 1–3, bestehender `auth-login-v42.js` bleibt unverändert.
- Systemadmin-Firmenauswahl vor Fachbootstrap: Tasks 3–4.
- Admin-/HSE-Direkteinstieg in eigene Firma: Task 3.
- Mitarbeiter-/Führungskräfteportal mit eigener Navigation: Tasks 1–3.
- Keine gleichzeitig sichtbare Admin-/Mitarbeiternavigation: Tasks 1–2.
- Rollenpriorität bei Mehrfachrollen: Task 1.
- Unbekannte Rollen sicher blockieren: Task 3.
- Kein fremder Tenant/Download: Task 5 plus bestehende Tenant-/Access-Tests in Task 6.
- Vollständiger Firmenwechsel-Reset: Task 4.
- Externe Links unverändert: Global Constraint + vollständige Regression in Task 6.
- Keine zweite produktive Firmen-/Rollenwebsite: Tasks 2 und 6.
- `main` bleibt unangetastet: Global Constraint + Task 6.

### Placeholder scan

Keine `TBD`, `TODO`, „implement later“, unbestimmten Error-Handling-Schritte oder nicht definierten Nachbarschnittstellen im Plan.

### Type/signature consistency

- `resolvePortalMode(me, companyId)` wird in Tasks 1 und 3 identisch verwendet.
- `applyPortalMode(mode,{onNavigate})` wird in Tasks 1 und 3 identisch verwendet.
- `state.portalMode` verwendet ausschließlich die Strings `auth-pending`, `auth-required`, `company-selection`, `admin-portal`, `employee-manager-portal`, `employee-portal`, `denied`.
- `resetEmployeePortalState()` und `resetEmployeeLearningState()` werden in Task 4 definiert, exportiert und erst danach von `resetCompanyScopedState()` konsumiert.
- `portalModeAllowsView(view)` wird in Task 5 definiert und ausschließlich über `viewAllowed(view)` in die bestehende Rollenprüfung eingebunden.
