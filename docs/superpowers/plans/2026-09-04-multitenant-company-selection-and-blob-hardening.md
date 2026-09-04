# Mehrmandanten-Auswahl und Blob-Härtung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systemadmins müssen nach Login bewusst einen Firmenkontext wählen; Essentra und Kontur werden zusätzlich in eigenen GitHub-Firmenbranches geführt; fehlende Azure-Blobs werden vor Ausgabe eines Downloadlinks erkannt und im Frontend verständlich als fehlende Datei behandelt.

**Architecture:** Der Server bleibt Autorität für Mandant und Rolle. `getAuthorizedContext` gibt Systemadmins ohne angeforderten `x-company-id` keinen impliziten fachlichen Default mehr; `/api/me` kann deshalb einen Auswahlzustand liefern. Das Frontend erhält einen kleinen, fokussierten Firmenkontext-Controller, der die normale Navigation bis zur Auswahl sperrt, Firmen über `/api/system/companies` lädt, beim Wechsel alle Firmen-Caches leert und erst dann den Bootstrap lädt. Blob-Existenzprüfung wird zentral in `api/src/lib/blob.js` ergänzt und von den Downloadendpunkten verwendet; Template-Metadaten erhalten zusätzlich einen lesbaren Verfügbarkeitsstatus für Admin/HSE.

**Tech Stack:** Vanilla JavaScript, Node.js test runner, Azure Functions, Azure SQL (`mssql`), Azure Blob Storage (`@azure/storage-blob`), GitHub branches/Azure Static Web Apps CI.

**Spec:** `docs/superpowers/specs/2026-09-04-multitenant-company-branches-and-admin-selection-design.md`

## Global Constraints

- `main` bleibt unverändert bis zu einer späteren expliziten Produktionsfreigabe.
- Firmenbranches: `company/essentra-components` und `company/kontur-werkzeugstahl`.
- Beide Firmenbranches starten vom aktuell geprüften RC991-Stand und werden nach dem gemeinsamen GREEN-Block nur fast-forward auf den neuen RC991-Stand bewegt; keine Firmen-Sonderwünsche werden in diesem Block eingebaut.
- Keine Migration, kein Seed, kein Import und keine automatische Reparatur/Löschung bestehender Dateidatensätze.
- Systemadmin: `Login → Firmenauswahl → Firma öffnen → Firmen-Dashboard`.
- Nicht-Systemadmins dürfen keinen fremden `x-company-id`-Kontext erzwingen.
- Fehlende Blobs dürfen keine SAS-URL und keine rohe Azure-XML-Seite mehr erzeugen.
- Bestehende RC991-Lern-, Rollen-, Mandanten- und Sicherheitsprüfungen müssen grün bleiben.

---

### Task 1: Firmenbranches aus RC991 anlegen

**Files:**
- Keine Codeänderung.

**Interfaces:**
- Consumes: aktueller Branch `rc991-unified-learning-portal`.
- Produces: `company/essentra-components`, `company/kontur-werkzeugstahl`.

- [ ] **Step 1: Aktuellen RC991-HEAD erfassen**

Run: GitHub branch lookup for `rc991-unified-learning-portal`.
Expected: ein konkreter Commit-SHA.

- [ ] **Step 2: Beide Firmenbranches vom gleichen SHA anlegen**

Run conceptually:
```bash
git branch company/essentra-components <RC991_SHA>
git branch company/kontur-werkzeugstahl <RC991_SHA>
```
Expected: beide Branches zeigen zunächst exakt auf denselben geprüften RC991-Commit.

- [ ] **Step 3: Branches verifizieren**

Expected:
```text
company/essentra-components      -> <RC991_SHA>
company/kontur-werkzeugstahl     -> <RC991_SHA>
main                             -> 4ee691a80d66dbd6b543ae9b5a59532f2f1569cf
```

### Task 2: Systemadmin ohne implizite Default-Firma

**Files:**
- Modify: `api/src/lib/auth.js`
- Modify: `api/src/functions/me.js`
- Create: `tests/system-admin-company-selection.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getAuthorizedContext(request)` und vorhandene `allowedCompanies`-Logik.
- Produces: `ctx.companyId === null` für Systemadmin ohne expliziten Firmenheader; `/api/me` liefert `requiresCompanySelection:true` in diesem Zustand.

- [ ] **Step 1: RED-Test schreiben**

Test contract:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../api/src/lib/auth.js', import.meta.url), 'utf8');
const me = readFileSync(new URL('../api/src/functions/me.js', import.meta.url), 'utf8');

test('system admin is not silently assigned the default company', () => {
  assert.match(auth, /isSystemAdmin[^\n]*!selected[\s\S]*companyId\s*:\s*null/);
  assert.doesNotMatch(auth, /isSystemAdmin&&!selected\)selected=\{companyId:defaultCompanyId\(\)/);
});

test('/api/me exposes company-selection state', () => {
  assert.match(me, /requiresCompanySelection/);
  assert.match(me, /ctx\.roles\.includes\(Roles\.SYSTEM_ADMIN\)/);
});
```

- [ ] **Step 2: RED-Test ausführen**

Run:
```bash
node --test tests/system-admin-company-selection.test.js
```
Expected: FAIL, weil Systemadmins aktuell auf `defaultCompanyId()` fallen und `/api/me` noch kein `requiresCompanySelection` liefert.

- [ ] **Step 3: Autorisierung minimal ändern**

Implementationsregel in `getAuthorizedContext`:
```js
if (isSystemAdmin && !requested) {
  selected = null;
}
```
Vor dem allgemeinen `if(!selected)`-Fehler wird für Systemadmin ein Context zurückgegeben, der Identität/Rolle/`allowedCompanies` behält, aber `companyId:null` setzt. Für Nicht-Systemadmins bleibt die bisherige serverseitige Auswahl erhalten. Ein Systemadmin mit explizitem `x-company-id` darf weiterhin einen aktiven/angeforderten Mandanten im Systemkontext öffnen.

- [ ] **Step 4: `/api/me` auswahlfähig machen**

Response enthält:
```js
requiresCompanySelection: ctx.roles.includes(Roles.SYSTEM_ADMIN) && !ctx.companyId
```
`resolveEmployeeAccess` wird nur ausgeführt, wenn `ctx.companyId` vorhanden ist; im Auswahlzustand liefert `/api/me` `employeeId:null`, `accessMode:'system'`, `teamEmployeeIds:[]`.

- [ ] **Step 5: GREEN-Test und bestehende Auth-Tests ausführen**

Run:
```bash
node --test tests/system-admin-company-selection.test.js tests/access-scope.test.js tests/password-auth.test.js
```
Expected: PASS.

### Task 3: Vorgeschaltete Firmenauswahl und sicherer Firmenwechsel

**Files:**
- Create: `frontend/company-context-v39.js`
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`
- Modify: `frontend/professional-suite-v36.css`
- Create: `tests/company-context-v39.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `api(path, options)`, `state.me`, `/api/me`, `/api/system/companies`, `loadData()`.
- Produces: `showCompanySelection()`, `openCompanyContext(companyId)`, `leaveCompanyContext()`, `resetCompanyScopedState()`.

- [ ] **Step 1: RED-Vertrag schreiben**

Test prüft statisch:
```js
assert.match(indexHtml, /company-context-v39\.js/);
assert.match(companyContext, /showCompanySelection/);
assert.match(companyContext, /openCompanyContext/);
assert.match(companyContext, /leaveCompanyContext/);
assert.match(companyContext, /resetCompanyScopedState/);
assert.match(companyContext, /\/system\/companies/);
assert.match(companyContext, /Firma wechseln/);
assert.match(app, /requiresCompanySelection/);
```
Zusätzlich darf `loadData()` im Systemadmin-Auswahlzustand nicht `/bootstrap` aufrufen.

- [ ] **Step 2: RED-Test ausführen**

Run:
```bash
node --test tests/company-context-v39.test.js
```
Expected: FAIL, weil das Modul noch nicht existiert.

- [ ] **Step 3: `loadData()` in Identitäts- und Fachdatenphase teilen**

`app.js` erhält:
```js
async function loadIdentity(){ state.me = await api('/me'); return state.me; }
async function loadCompanyData(){ /* bootstrap/status/mail/users wie bisher */ }
async function loadData(){
  const me = await loadIdentity();
  if (me.requiresCompanySelection) {
    state.companyId = null;
    renderUserInfo();
    window.showCompanySelection?.();
    return;
  }
  state.companyId = me.companyId || state.companyId;
  await loadCompanyData();
  renderAll();
}
```
`api()` sendet `x-company-id` nur, wenn `state.companyId` tatsächlich gesetzt ist.

- [ ] **Step 4: Firmenkontext-Modul implementieren**

`company-context-v39.js`:
```js
function resetCompanyScopedState(){
  state.data=null; state.statusRows=[]; state.users=[]; state.mailConfig=null;
  state.operations=null; state.backups=[]; state.healthHistory=[];
  state.securityEvents=[]; state.auditEvents=[];
  state.companyMailSettings=null; state.systemCompanies=null;
  state.testQuestions=[]; state.instructionAnalyses=[];
}
```
`showCompanySelection()` lädt `/system/companies`, zeigt nur aktive Firmenkarten und versteckt/deaktiviert die normale `.primary-tabs`-Navigation. `openCompanyContext(companyId)` validiert die ID gegen die geladene aktive Liste, setzt `state.companyId`, leert Firmenzustand ohne die geladene Identität zu verlieren, lädt `/api/me` erneut mit `x-company-id` und danach `loadCompanyData()`. `leaveCompanyContext()` leert den Kontext, setzt `state.companyId=null` und zeigt wieder die Auswahl.

- [ ] **Step 5: Header/Systemleiste erweitern**

Nach Firmenauswahl wird der aktive Firmenname sichtbar. Systemadmins erhalten `Firma wechseln`; Nicht-Systemadmins nicht.

- [ ] **Step 6: GREEN-Test ausführen**

Run:
```bash
node --test tests/company-context-v39.test.js tests/system-admin-company-selection.test.js
node --check frontend/company-context-v39.js
```
Expected: PASS.

### Task 4: Blob-Existenz vor SAS-Ausgabe prüfen

**Files:**
- Modify: `api/src/lib/blob.js`
- Modify: `api/src/functions/templateFiles.js`
- Modify: `api/src/functions/files.js`
- Create: `tests/blob-missing.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getContainerClient(options)`.
- Produces: `blobExists(blobPath, options={}) -> Promise<boolean>` und strukturierte Fehler mit `code='blob_missing'`, `status=410`.

- [ ] **Step 1: RED-Test schreiben**

Contract:
```js
assert.match(blobSource, /export async function blobExists/);
assert.match(templateFiles, /blob_missing/);
assert.match(files, /blob_missing/);
assert.ok(templateFiles.indexOf('blobExists') < templateFiles.indexOf('createReadSasUrl'));
```

- [ ] **Step 2: RED ausführen**

Run:
```bash
node --test tests/blob-missing.test.js
```
Expected: FAIL.

- [ ] **Step 3: zentrale Existenzprüfung implementieren**

```js
export async function blobExists(blobPath, options={}){
  if(!blobPath) return false;
  const container=getContainerClient({...options,blobPath});
  return container.getBlobClient(blobPath).exists();
}
```
Kein `ensureContainer()` beim Lesen.

- [ ] **Step 4: beide Downloadpfade härten**

Vor `createReadSasUrl`:
```js
if (!(await blobExists(row.blobPath,{kind:'template'}))) {
  const error=new Error('Unterlage fehlt im Dateispeicher. Bitte Datei neu hochladen oder ersetzen.');
  error.code='blob_missing'; error.status=410; throw error;
}
```
`files.js` nutzt `kind:file.kind` bzw. den gespeicherten Pfad. Es wird niemals eine SAS-URL für einen fehlenden Blob erzeugt.

- [ ] **Step 5: GREEN-Test ausführen**

Run:
```bash
node --test tests/blob-missing.test.js
```
Expected: PASS.

### Task 5: Admin-Unterweisungsverwaltung zeigt fehlende Datei und Ersetzen-Aktion

**Files:**
- Modify: `api/src/functions/templates.js`
- Modify: `frontend/template-management-v21.js`
- Modify: `frontend/instruction-type-management-v23.js`
- Create: `tests/template-availability-v39.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `blobExists()` und Template-Liste aus Bootstrap/`/templates`.
- Produces: Template-Feld `fileAvailable:boolean|null`; UI-Badge `Datei fehlt`; Aktion `Ersetzen`.

- [ ] **Step 1: RED-Test schreiben**

Contract:
```js
assert.match(templatesApi, /fileAvailable/);
assert.match(templateUi, /Datei fehlt/);
assert.match(templateUi, /Ersetzen/);
assert.match(instructionUi, /fileAvailable/);
```

- [ ] **Step 2: RED ausführen**

Run:
```bash
node --test tests/template-availability-v39.test.js
```
Expected: FAIL.

- [ ] **Step 3: Template-Liste um Verfügbarkeit ergänzen**

Für jede zurückgegebene aktive Template-Zeile wird `blobExists(blobPath,{kind:'template'})` geprüft und `fileAvailable` gesetzt. Storage-Konfigurationsfehler werden nicht als `false` maskiert; in diesem Fall bleibt `fileAvailable:null`, damit die UI nicht fälschlich behauptet, die Datei sei gelöscht.

- [ ] **Step 4: UI anpassen**

Wenn `tpl.fileAvailable===false`:
```html
<span class="badge bad">Datei fehlt</span>
<button ... data-template-action="replace">Ersetzen</button>
```
`openTemplate()` fängt `blob_missing`/410 ab und zeigt ausschließlich:
`Unterlage fehlt im Dateispeicher. Bitte Datei neu hochladen oder ersetzen.`
Keine Azure-XML-Inhalte werden angezeigt.

- [ ] **Step 5: GREEN-Test ausführen**

Run:
```bash
node --test tests/template-availability-v39.test.js tests/blob-missing.test.js
```
Expected: PASS.

### Task 6: Vollständige Regression, Preview und Firmenbranches synchronisieren

**Files:**
- Modify: `docs/CHANGELOG.md`
- No database changes.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: vollständig geprüfter RC991-Commit und beide Firmenbranches auf diesem gemeinsamen GREEN-Stand.

- [ ] **Step 1: Changelog ergänzen**

Dokumentieren: Firmenauswahl, sichere Firmenwechsel, Branch-Struktur, Blob-Härtung; explizit `keine Migration / kein Seed / kein Merge nach main`.

- [ ] **Step 2: vollständige Tests ausführen**

Run:
```bash
npm test
```
Expected: exit 0, keine Regression.

- [ ] **Step 3: Azure Preview-CI abwarten**

Expected: Syntax/API checks, vollständige Tests, Build/Deploy und Stylesheet-/Preview-Prüfung erfolgreich.

- [ ] **Step 4: `main` verifizieren**

Expected:
```text
main = 4ee691a80d66dbd6b543ae9b5a59532f2f1569cf
```

- [ ] **Step 5: Firmenbranches fast-forward auf finalen RC991 GREEN-SHA**

Nur fast-forward, kein Force-Push:
```bash
git branch -f company/essentra-components <FINAL_RC991_GREEN_SHA>
git branch -f company/kontur-werkzeugstahl <FINAL_RC991_GREEN_SHA>
```
Über GitHub-Ref-Update nur, wenn der neue SHA Nachfahre des bisherigen Branch-SHA ist.

- [ ] **Step 6: Endzustand verifizieren**

Expected: beide Firmenbranches zeigen auf denselben finalen gemeinsamen Green-Commit; `main` unverändert; kein Merge, keine Migration, kein Seed/Import.
