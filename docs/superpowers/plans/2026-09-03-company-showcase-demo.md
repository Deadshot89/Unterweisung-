# Unternehmens-Demo / Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine öffentlich präsentierbare, vollständig fiktive Demo des Unterweisungsmanagers mit Admin-, Führungskraft- und Mitarbeiteransicht, interaktiven Online-Unterweisungen, praktischer Einplanung, Demo-Nachweisen und Reset-Funktion erstellen, ohne echte API-, Auth-, SQL-, Blob- oder Mail-Verbindungen.

**Architecture:** Die Demo lebt vollständig unter `frontend/demo/` und lädt ausschließlich statische Demodaten. Rollen-, Status-, Lernfortschritts- und Planungslogik liegen in einem testbaren Browsermodul; `demo-ui.js` rendert nur aus diesem Store. Änderungen während einer Präsentation werden ausschließlich in `localStorage` gespeichert und können auf den unveränderlichen Ausgangsdatensatz zurückgesetzt werden.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Node.js `node --test`, bestehende GitHub Actions/Azure Static Web Apps Preview-Infrastruktur.

**Spec:** `docs/superpowers/specs/2026-09-03-company-showcase-demo-design.md`

## Global Constraints

- Branch bleibt `demo/company-showcase`.
- `main` wird nicht verändert oder gemergt.
- Keine produktiven Migrationen, Secrets oder Datenänderungen.
- Keine Demo-Datei darf `/api/*`, `/.auth/*`, SQL, Blob Storage oder echten Mailversand aufrufen.
- Alle sichtbaren Personen, Firmen, E-Mail-Adressen, Unterweisungen und Nachweise sind fiktiv.
- Fiktive E-Mail-Adressen verwenden ausschließlich `@musterwerk.example`.
- Auf jeder Demo-Ansicht ist sichtbar: `DEMO – ausschließlich Beispieldaten`.
- Demo-Rollen sind Präsentationsrollen und keine echte Authentifizierung.
- Demo-Zustand darf ausschließlich statisch bzw. im Browser-`localStorage` existieren.
- Mindestens drei Unterweisungen sind bildgestützte Online-Unterweisungen.
- Mindestens zwei Unterweisungen sind praktische Unterweisungen.
- Eine Online-Unterweisung darf erst nach allen Lernschritten und bestandenem Test abgeschlossen werden.
- Eine praktische Unterweisung darf in Mitarbeiterrolle nicht selbst bestätigt werden.
- Demo-Nachweise tragen eindeutig `DEMO / MUSTER`.
- Bestehende v0.36.3-Regressionstests müssen grün bleiben.

## File Structure

- Create: `frontend/demo/index.html` — eigenständiger öffentlicher Demo-Einstieg.
- Create: `frontend/demo/demo.css` — Showcase-Layout, responsive Ansichten, Modals und Druckdarstellung.
- Create: `frontend/demo/demo-data.js` — unveränderlicher Ausgangsdatensatz.
- Create: `frontend/demo/demo-store.js` — Rollen-/Status-/Lern-/Planungs-/Reset-Logik.
- Create: `frontend/demo/demo-proof.js` — lokale Muster-Nachweise.
- Create: `frontend/demo/demo-ui.js` — Rendering und Interaktionen.
- Create: `frontend/demo/assets/work-safety.svg` — Arbeitsschutz-Illustration.
- Create: `frontend/demo/assets/fire-safety.svg` — Brandschutz-Illustration.
- Create: `frontend/demo/assets/phishing.svg` — Informationssicherheits-Illustration.
- Create: `frontend/demo/assets/warehouse.svg` — Lager-/Stapler-Illustration.
- Create: `tests/company-showcase-demo.test.js` — Daten-, Scope-, Lern-, Praxis-, Reset- und Nachweistests.
- Create: `scripts/check-company-showcase-demo.js` — statische Sicherheitsprüfung.
- Modify: `.github/workflows/azure-static-web-apps.yml` — Demo-Pretest und Preview-Verifikation.
- Modify: `docs/CHANGELOG.md` — Showcase-Dokumentation.

---

### Task 1: Fiktiven Datensatz und Sicherheitsvertrag erstellen

**Files:**
- Create: `frontend/demo/demo-data.js`
- Create: `tests/company-showcase-demo.test.js`
- Create: `scripts/check-company-showcase-demo.js`

**Interfaces:**
- Produces: `DEMO_DATA` mit `company`, `employees`, `instructionTypes`, `assignments`, `plannedTrainings`, `records`, `learningSteps`, `tests`.
- Browser exportiert `window.UM_DEMO_DATA`; Node exportiert `module.exports`.

- [ ] **Step 1: RED-Test schreiben**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../frontend/demo/demo-data.js');

test('showcase data is fictional and complete', () => {
  assert.equal(data.company.name, 'Musterwerk Solutions GmbH');
  assert.equal(data.employees.length, 15);
  assert.equal(data.instructionTypes.length, 10);
  assert.ok(data.employees.every(e => e.email.endsWith('@musterwerk.example')));
  assert.ok(data.instructionTypes.filter(x => x.deliveryMode === 'online').length >= 3);
  assert.ok(data.instructionTypes.filter(x => x.deliveryMode === 'practical').length >= 2);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL mit fehlendem `frontend/demo/demo-data.js`.

- [ ] **Step 3: Vollständigen Baseline-Datensatz implementieren**

```js
const DEMO_DATA = {
  company: {
    id:'company-musterwerk',
    name:'Musterwerk Solutions GmbH',
    industry:'Produktion & Logistik',
    location:'Nordrhein-Westfalen'
  },
  employees: [
    { id:'emp-lena-hoffmann', name:'Lena Hoffmann', email:'lena.hoffmann@musterwerk.example', department:'Produktion', role:'company_admin', active:true },
    { id:'emp-jonas-keller', name:'Jonas Keller', email:'jonas.keller@musterwerk.example', department:'Produktion', role:'line_manager', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-mila-hartmann', name:'Mila Hartmann', email:'mila.hartmann@musterwerk.example', department:'Produktion', role:'employee', lineManagerId:'emp-jonas-keller', active:true }
  ],
  instructionTypes: [
    { id:'ins-arbeitsschutz', name:'Allgemeine Arbeitsschutzunterweisung', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true },
    { id:'ins-stapler', name:'Flurförderzeuge / Stapler', category:'Lager & Logistik', deliveryMode:'practical', testRequired:false, passPercent:0, intervalMonths:12, active:true }
  ],
  assignments: [],
  plannedTrainings: [],
  records: [],
  learningSteps: [],
  tests: []
};

if (typeof module === 'object' && module.exports) module.exports = DEMO_DATA;
if (typeof window !== 'undefined') window.UM_DEMO_DATA = DEMO_DATA;
```

Die Arrays werden im selben Schritt auf die in der Spec festgelegten 15 Personen, 10 Unterweisungen und einen Statusmix aus gültig, bald fällig, kritisch, überfällig, fehlend, geplant, in Bearbeitung, abgeschlossen, nicht erforderlich und Praxisbestätigung ausstehend vervollständigt.

- [ ] **Step 4: Sicherheitscheck implementieren**

```js
const forbidden = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /\/api\//,
  /\.auth\//,
  /blob\.core\.windows\.net/i,
  /company-essentra/i,
  /essentra/i,
  /@(?:gmail|outlook|hotmail)\./i
];
```

Das Script liest rekursiv ausschließlich `frontend/demo/`, prüft jede Textdatei und beendet sich bei einem Treffer mit Exit-Code 1.

- [ ] **Step 5: GREEN verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

```bash
git add frontend/demo/demo-data.js tests/company-showcase-demo.test.js scripts/check-company-showcase-demo.js
git commit -m "feat(demo): add isolated fictional showcase dataset"
```

---

### Task 2: Demo-Store mit Rollen-Scopes und lokalem Zustand bauen

**Files:**
- Create: `frontend/demo/demo-store.js`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `DEMO_DATA`.
- Produces: `createDemoStore(baseData, storage)`.
- Store-API: `getState()`, `getSession()`, `setRole(role, employeeId)`, `getVisibleEmployees()`, `getEmployeeBuckets(employeeId)`, `advanceLearning(employeeId, instructionId)`, `submitTest(employeeId, instructionId, answers)`, `completeOnline(employeeId, instructionId)`, `schedulePractical(managerId, employeeId, instructionId, date)`, `confirmPractical(managerId, employeeId, instructionId)`, `reset()`.

- [ ] **Step 1: RED-Tests für Rollenabgrenzung schreiben**

```js
test('employee sees self; line manager sees only direct reports', () => {
  const store = createDemoStore(data, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  assert.deepEqual(store.getVisibleEmployees().map(x => x.id), ['emp-mila-hartmann']);
  store.setRole('line_manager', 'emp-jonas-keller');
  assert.ok(store.getVisibleEmployees().every(x => x.lineManagerId === 'emp-jonas-keller'));
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL mit fehlendem `createDemoStore`.

- [ ] **Step 3: Store-Grundstruktur implementieren**

```js
function createDemoStore(baseData, storage) {
  const key = 'um-company-showcase-state-v1';
  let state = loadOrClone(baseData, storage, key);
  let session = { role:'company_admin', employeeId:'emp-lena-hoffmann' };

  function getVisibleEmployees() {
    if (session.role === 'company_admin') return state.employees.filter(x => x.active !== false);
    if (session.role === 'line_manager') return state.employees.filter(x => x.lineManagerId === session.employeeId && x.active !== false);
    return state.employees.filter(x => x.id === session.employeeId && x.active !== false);
  }

  return {
    getState: () => state,
    getSession: () => ({...session}),
    setRole,
    getVisibleEmployees,
    getEmployeeBuckets,
    advanceLearning,
    submitTest,
    completeOnline,
    schedulePractical,
    confirmPractical,
    reset
  };
}
```

`loadOrClone`, `persist` und alle oben benannten Methoden werden in diesem Schritt vollständig definiert; Storage bleibt injizierbar, damit Tests ohne Browser laufen.

- [ ] **Step 4: RED-Tests für Lern- und Praxisregeln ergänzen**

```js
test('online completion requires every step and a passed test', () => {
  const store = createDemoStore(data, memoryStorage());
  const id = 'ins-arbeitsschutz';
  assert.throws(() => store.completeOnline('emp-mila-hartmann', id), /Lernschritte/);
  const n = data.learningSteps.filter(x => x.instructionId === id).length;
  for (let i=0; i<n; i++) store.advanceLearning('emp-mila-hartmann', id);
  assert.throws(() => store.completeOnline('emp-mila-hartmann', id), /Test/);
});

test('employee cannot confirm a practical training', () => {
  const store = createDemoStore(data, memoryStorage());
  store.setRole('employee','emp-mila-hartmann');
  assert.throws(() => store.confirmPractical('emp-mila-hartmann','emp-mila-hartmann','ins-stapler'), /Führungskraft/);
});
```

- [ ] **Step 5: Lern-/Praxislogik und Reset implementieren**

`advanceLearning` erhöht den gespeicherten Fortschritt immer exakt um einen Schritt bis zur Schrittanzahl. `submitTest` berechnet Prozentwert und `passed` aus `correctOption`. `completeOnline` prüft Schrittanzahl und Teststatus. `schedulePractical`/`confirmPractical` erlauben Admin alle Demo-Mitarbeiter, Line Managern ausschließlich direkte Reports und Mitarbeitern keine Bestätigung. Jede Mutation ruft `persist()` auf; `reset()` löscht den Storage-Key und lädt den Baseline-Datensatz neu.

- [ ] **Step 6: GREEN verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: PASS.

```bash
git add frontend/demo/demo-store.js tests/company-showcase-demo.test.js
git commit -m "feat(demo): add role-scoped local showcase state"
```

---

### Task 3: Präsentations-Shell, Dashboard und Rollenumschalter erstellen

**Files:**
- Create: `frontend/demo/index.html`
- Create: `frontend/demo/demo.css`
- Create: `frontend/demo/demo-ui.js`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `window.UM_DEMO_DATA`, `window.UMDemoStore.createDemoStore`.
- Produces DOM-IDs: `demoRole`, `demoPerson`, `demoReset`, `demoNav`, `demoContent`.
- Produces UI-Funktionen: `renderApp`, `renderAdminDashboard`, `renderManagerDashboard`, `renderEmployeeDashboard`.

- [ ] **Step 1: RED-Shell-Test schreiben**

```js
test('demo shell is clearly marked and offers all presentation roles', () => {
  const html = fs.readFileSync('frontend/demo/index.html','utf8');
  assert.match(html, /DEMO – ausschließlich Beispieldaten/);
  assert.match(html, /id="demoRole"/);
  assert.match(html, /System-\/Firmenadmin/);
  assert.match(html, /Führungskraft/);
  assert.match(html, /Mitarbeiter/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, weil `frontend/demo/index.html` fehlt.

- [ ] **Step 3: Eigenständige HTML-Shell und Design implementieren**

`index.html` lädt nur:

```html
<script src="./demo-data.js"></script>
<script src="./demo-store.js"></script>
<script src="./demo-proof.js"></script>
<script src="./demo-ui.js"></script>
```

Es lädt weder `/config.js` noch `/app.js`, Auth-Skripte oder produktive Funktionsmodule. `demo.css` enthält responsives Desktop-/Mobil-Layout, KPI-Karten, Status-Badges, Tabellen/Karten, Sticky-Demo-Banner, Rollensteuerung und Modal-Grundlayout ohne externe Fonts/CDNs.

- [ ] **Step 4: Rollenwechsel und drei Dashboards implementieren**

Admin: Mitarbeiter, Unterweisungen, gültig, bald fällig, überfällig, fehlend, geplant, Abschlussquote, Abteilungen, Handlungsbedarf.

Führungskraft: nur direkte Reports, Teamstatus, offene Aufgaben, Planung und Praxisbestätigung.

Mitarbeiter: `Jetzt erledigen`, `Einplanung erforderlich`, `Geplante Termine`, `Bald fällig`, `Abgeschlossen`.

- [ ] **Step 5: GREEN/Sicherheitscheck verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

```bash
git add frontend/demo/index.html frontend/demo/demo.css frontend/demo/demo-ui.js tests/company-showcase-demo.test.js
git commit -m "feat(demo): add presentation shell and role dashboards"
```

---

### Task 4: Bildgestützte Online-Unterweisungen mit Test und Zoom umsetzen

**Files:**
- Create: `frontend/demo/assets/work-safety.svg`
- Create: `frontend/demo/assets/fire-safety.svg`
- Create: `frontend/demo/assets/phishing.svg`
- Create: `frontend/demo/assets/warehouse.svg`
- Modify: `frontend/demo/demo-data.js`
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/demo.css`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `advanceLearning`, `submitTest`, `completeOnline`.
- Produces: `openLearning(instructionId)`, `renderLearningStep()`, `renderTrainingTest()`, `renderTrainingResult()`.

- [ ] **Step 1: RED-Test für illustrierte Lernstrecken schreiben**

```js
test('three online trainings contain at least three illustrated steps each', () => {
  const online = data.instructionTypes.filter(x => x.deliveryMode === 'online');
  const illustrated = online.filter(t => data.learningSteps.filter(s => s.instructionId === t.id && s.image).length >= 3);
  assert.ok(illustrated.length >= 3);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, bis drei vollständige Lernstrecken hinterlegt sind.

- [ ] **Step 3: Lokale SVGs und Lerninhalte implementieren**

Alle SVGs sind neutrale, selbst erstellte Vektorillustrationen ohne reale Personen, Logos oder Firmenbilder. Mindestens Arbeitsschutz, Brandschutz und Informationssicherheit erhalten je drei Lernschritte mit Bild, Überschrift und Kurztext; Tests enthalten je mindestens drei Single-Choice-Fragen.

- [ ] **Step 4: Lernmodal, Zoom und Testfluss implementieren**

Das Modal zeigt Schritt `x / n`, Fortschrittsbalken, lokales Bild, Kurztext, Vor/Zurück und Bildzoom. `Weiter` ruft genau einmal `advanceLearning` auf. Nach dem letzten Schritt folgt der Test. Nicht bestanden zeigt `Test erneut versuchen`; bestanden erlaubt `completeOnline` und aktualisiert anschließend die Mitarbeiter-Buckets.

- [ ] **Step 5: GREEN/Sicherheitscheck verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

```bash
git add frontend/demo/assets frontend/demo/demo-data.js frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add illustrated online training experience"
```

---

### Task 5: Praktische Unterweisung und Terminplanung in der UI demonstrieren

**Files:**
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/demo.css`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `schedulePractical`, `confirmPractical`.
- Produces: `openScheduleDialog(employeeId, instructionId)`, `openPracticalConfirmation(employeeId, instructionId)`.

- [ ] **Step 1: RED-Test für die UI-Vertragsfunktionen schreiben**

```js
test('demo manager UI exposes local scheduling and practical confirmation flows', () => {
  const source = fs.readFileSync('frontend/demo/demo-ui.js','utf8');
  assert.match(source, /function openScheduleDialog\s*\(/);
  assert.match(source, /function openPracticalConfirmation\s*\(/);
  assert.match(source, /Wird nur lokal in dieser Demo gespeichert/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, bis beide UI-Funktionen existieren.

- [ ] **Step 3: Terminplanung und Praxisbestätigung implementieren**

Terminplanung zeigt Mitarbeiter, Unterweisung, Datum und den lokalen Demo-Hinweis. Nach Speichern erscheint der Termin sofort in Führungskraft- und Mitarbeiteransicht. Praxisbestätigung erzeugt über den Store einen Abschlussrecord mit `confirmedBy`, `completedAt` und `source:'demo-practical'`. Die Mitarbeiteransicht enthält keinen Selbstbestätigungsbutton.

- [ ] **Step 4: GREEN verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: PASS.

```bash
git add frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add practical training planning and confirmation"
```

---

### Task 6: Demo-Nachweise und vollständigen Reset implementieren

**Files:**
- Create: `frontend/demo/demo-proof.js`
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/demo.css`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Produces: `buildDemoProofHtml({ company, employee, instruction, completedAt, confirmedBy })`.
- Produces: `openDemoProof(recordId)`, `downloadDemoProof(recordId)`.

- [ ] **Step 1: RED-Test für Musterkennzeichnung schreiben**

```js
test('demo proof is unmistakably marked as sample', () => {
  const html = buildDemoProofHtml({
    company:data.company,
    employee:data.employees[0],
    instruction:data.instructionTypes[0],
    completedAt:'2026-09-03'
  });
  assert.match(html, /DEMO \/ MUSTER/);
  assert.match(html, /Musterwerk Solutions GmbH/);
  assert.match(html, /keine rechtliche Gültigkeit/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL mit fehlendem `buildDemoProofHtml`.

- [ ] **Step 3: Lokalen Nachweisgenerator implementieren**

Das HTML enthält großes Wasserzeichen `DEMO / MUSTER`, Demo-Firma, Mitarbeiter, Unterweisung, Abschlussdatum, optional bestätigende Führungskraft und exakt den Hinweis `Dieser Nachweis ist ein fiktives Präsentationsmuster und besitzt keine rechtliche Gültigkeit.`. Öffnen und Herunterladen erfolgen ausschließlich über Browser-Blob-URLs; Dateiname: `DEMO_Nachweis_<Name>_<Unterweisung>.html`.

- [ ] **Step 4: Reset-UI implementieren**

`Demo zurücksetzen` fragt einmal nach Bestätigung, ruft `store.reset()` auf, setzt die Präsentationsrolle auf `company_admin` / `emp-lena-hoffmann` und rendert das Admin-Dashboard neu.

- [ ] **Step 5: GREEN/Sicherheitscheck verifizieren und committen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

```bash
git add frontend/demo/demo-proof.js frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add sample proofs and deterministic reset"
```

---

### Task 7: CI, Preview und Vertriebsfreigabe absichern

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml`
- Modify: `scripts/check-company-showcase-demo.js`
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: bestehende Azure Static Web Apps PR-Preview.
- Produces: CI-Schritt `Company showcase demo checks` und eine verifizierte öffentliche `/demo/`-Preview.

- [ ] **Step 1: Demo-Checks in den Workflow aufnehmen**

```yaml
- name: Company showcase demo checks
  run: |
    node --test tests/company-showcase-demo.test.js
    node scripts/check-company-showcase-demo.js
```

Der Schritt läuft vor `Build And Deploy`.

- [ ] **Step 2: Post-Deploy-Verifikation ergänzen**

Die vom Azure-Deploy bereitgestellte Preview-Basis wird mit `/demo/` geprüft. Erwartet werden HTTP 200 sowie die Textmarker `Musterwerk Solutions GmbH` und `DEMO – ausschließlich Beispieldaten`.

- [ ] **Step 3: Changelog ergänzen**

Dokumentieren: separate Showcase-Demo, ausschließlich Fake-Daten, Rollenumschalter, Online-/Praxis-Unterweisungen, lokale Demo-Nachweise, Reset, keine Produktivverbindung. Kein Produktivrelease behaupten.

- [ ] **Step 4: Vollständige Regression ausführen**

```bash
node --test tests/*.test.js
node scripts/check-company-showcase-demo.js
node scripts/check-auth-preview-wiring.js
node scripts/check-professional-suite.js
```

Expected: alle Tests/Checks PASS.

- [ ] **Step 5: CI-/Docs-Commit erstellen**

```bash
git add .github/workflows/azure-static-web-apps.yml scripts/check-company-showcase-demo.js docs/CHANGELOG.md
git commit -m "ci(demo): verify isolated showcase preview"
```

- [ ] **Step 6: Draft-PR öffnen**

Head: `demo/company-showcase`
Base: `feature/v0.36-instruction-ui`
Titel: `Demo: öffentliche Firmen-Showcase-Vorschau mit Beispieldaten`

PR-Body enthält ausdrücklich:

```text
- ausschließlich fiktive Daten
- keine API/Auth/SQL/Blob/Mail-Verbindung
- kein Merge nach main
- keine Migration/Secrets
- Preview-Link erst nach grünem Workflow freigeben
```

- [ ] **Step 7: Workflow und Preview verifizieren**

Erwartet: Build/Deploy `success`, Demo-Pretest und bestehende Regressionen grün. Anschließend Preview-URL mit `/demo/`, finalen Commit-SHA und Workflow-Run-ID im PR dokumentieren.

## Self-Review

- Spec coverage: Sicherheitsisolation, Fake-Firma, 15 Fake-Mitarbeiter, zehn Unterweisungen, Rollen, Statusmix, Admin-/Manager-/Mitarbeiteransichten, Online-Lernstrecken, Test, Zoom, Praxisplanung, Bestätigung, Nachweis, Reset und Preview-Deployment sind konkreten Tasks zugeordnet.
- Placeholder scan: Keine `TBD`, `TODO`, `implement later`, Platzhalter-Kommentare oder unbestimmten Methodenlisten enthalten.
- Type consistency: `DEMO_DATA`, `createDemoStore`, Rollenwerte und Store-Methoden werden in allen Tasks identisch benannt.
- Scope: Keine echte Kundenregistrierung, Lizenzierung, CRM-, Login-, Mail-, SQL- oder Blob-Funktion ist Bestandteil dieses Plans.
