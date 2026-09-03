# Unternehmens-Demo / Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine öffentlich präsentierbare, vollständig fiktive Demo des Unterweisungsmanagers mit Admin-, Führungskraft- und Mitarbeiteransicht, interaktiven Online-Unterweisungen, praktischer Einplanung, Demo-Nachweisen und Reset-Funktion erstellen, ohne echte API-, Auth-, SQL-, Blob- oder Mail-Verbindungen.

**Architecture:** Die Demo lebt vollständig unter `frontend/demo/` und lädt ausschließlich statische Demodaten. Reine Zustands- und Rollenlogik wird in testbaren, CommonJS-kompatiblen Browsermodulen gekapselt; die UI verwendet diese Module ohne `/api/*` oder `/.auth/*` aufzurufen. Änderungen während einer Präsentation werden nur im Browser-`localStorage` gespeichert und können jederzeit auf den definierten Ausgangszustand zurückgesetzt werden.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Node.js-Test-Runner (`node --test`), jsdom/VM für DOM- und statische Sicherheitschecks, bestehende GitHub Actions/Azure Static Web Apps Preview-Infrastruktur.

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

---

## File Structure

- Create: `frontend/demo/index.html` — eigenständiger Demo-Einstieg und Seiten-Shell.
- Create: `frontend/demo/demo.css` — vollständiges Showcase-Layout, Responsive Design und Lernmodal.
- Create: `frontend/demo/demo-data.js` — unveränderlicher Ausgangsdatensatz für Musterwerk Solutions GmbH.
- Create: `frontend/demo/demo-store.js` — reine Rollen-, Status-, Lernfortschritts-, Planungs- und Reset-Logik.
- Create: `frontend/demo/demo-proof.js` — rein lokaler HTML-/Blob-Nachweis mit DEMO-Wasserzeichen.
- Create: `frontend/demo/demo-ui.js` — Rendering und Browser-Interaktionen; keine Datenzugriffe außerhalb des Demo-Stores.
- Create: `frontend/demo/assets/work-safety.svg` — neutrale Illustration Arbeitsschutz.
- Create: `frontend/demo/assets/fire-safety.svg` — neutrale Illustration Brandschutz.
- Create: `frontend/demo/assets/phishing.svg` — neutrale Illustration Informationssicherheit.
- Create: `frontend/demo/assets/warehouse.svg` — neutrale Illustration Lager/Stapler.
- Create: `tests/company-showcase-demo.test.js` — reine Logik-, Scope-, Lern- und Nachweisregressionen.
- Create: `scripts/check-company-showcase-demo.js` — statische Sicherheitsprüfung gegen API/Auth/echte Datenreferenzen.
- Modify: `.github/workflows/azure-static-web-apps.yml` — Demo-Checks vor Deployment aufnehmen und `/demo/` nach Deployment prüfen.
- Modify: `docs/CHANGELOG.md` — Showcase-Demo dokumentieren.

---

### Task 1: Fiktiven Ausgangsdatensatz und Sicherheitsvertrag festlegen

**Files:**
- Create: `frontend/demo/demo-data.js`
- Create: `tests/company-showcase-demo.test.js`
- Create: `scripts/check-company-showcase-demo.js`

**Interfaces:**
- Produces: `DEMO_DATA` mit `{ company, employees, instructionTypes, assignments, plannedTrainings, records, learningSteps, tests }`.
- Produces: Node-exportfähiges Objekt via `module.exports = DEMO_DATA` und Browser-Export via `window.UM_DEMO_DATA = DEMO_DATA`.
- Produces: Sicherheitscheck, der alle Dateien unter `frontend/demo/` scannt.

- [ ] **Step 1: RED-Test für Firma, Personen, E-Mail-Domain und Lern-/Praxismix schreiben**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../frontend/demo/demo-data.js');

test('showcase data is entirely fictional and presentation-complete', () => {
  assert.equal(data.company.name, 'Musterwerk Solutions GmbH');
  assert.equal(data.employees.length, 15);
  assert.ok(data.employees.every(e => e.email.endsWith('@musterwerk.example')));
  assert.ok(data.instructionTypes.filter(x => x.deliveryMode === 'online').length >= 3);
  assert.ok(data.instructionTypes.filter(x => x.deliveryMode === 'practical').length >= 2);
});
```

- [ ] **Step 2: Test ausführen und erwartetes RED bestätigen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, weil `frontend/demo/demo-data.js` noch fehlt.

- [ ] **Step 3: Demodaten als vollständig fiktiven Baseline-Datensatz implementieren**

Der Datensatz enthält exakt die 15 in der Spec benannten Personen. IDs sind rein intern, z. B. `emp-lena-hoffmann`. Rollenwerte: `company_admin`, `line_manager`, `employee`. Direkte Reports werden über `lineManagerId` modelliert. Unterweisungen verwenden `deliveryMode: 'online' | 'practical'`, `testRequired`, `passPercent`, `intervalMonths`.

Beispielstruktur:

```js
const DEMO_DATA = {
  company: { id: 'company-musterwerk', name: 'Musterwerk Solutions GmbH', industry: 'Produktion & Logistik', location: 'Nordrhein-Westfalen' },
  employees: [
    { id:'emp-lena-hoffmann', name:'Lena Hoffmann', email:'lena.hoffmann@musterwerk.example', department:'Produktion', role:'company_admin', active:true },
    { id:'emp-jonas-keller', name:'Jonas Keller', email:'jonas.keller@musterwerk.example', department:'Produktion', role:'line_manager', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-mila-hartmann', name:'Mila Hartmann', email:'mila.hartmann@musterwerk.example', department:'Produktion', role:'employee', lineManagerId:'emp-jonas-keller', active:true }
  ],
  instructionTypes: [
    { id:'ins-arbeitsschutz', name:'Allgemeine Arbeitsschutzunterweisung', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true },
    { id:'ins-stapler', name:'Flurförderzeuge / Stapler', category:'Lager & Logistik', deliveryMode:'practical', testRequired:false, passPercent:0, intervalMonths:12, active:true }
  ]
};

if (typeof module === 'object' && module.exports) module.exports = DEMO_DATA;
if (typeof window !== 'undefined') window.UM_DEMO_DATA = DEMO_DATA;
```

Die weiteren Personen, Unterweisungen und Zustände werden vollständig analog, aber mit bewusst gemischten Statusfällen angelegt.

- [ ] **Step 4: Statischen Sicherheitscheck implementieren**

`check-company-showcase-demo.js` liest rekursiv `frontend/demo/` und schlägt fehl bei:

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

Ausnahme: Der sichtbare Satz `keine API-Verbindung` darf nicht durch die `/api/`-Regel verletzt werden; deshalb keine verbotenen URL-Fragmente in Copy verwenden.

- [ ] **Step 5: Tests ausführen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/demo/demo-data.js tests/company-showcase-demo.test.js scripts/check-company-showcase-demo.js
git commit -m "feat(demo): add isolated fictional showcase dataset"
```

---

### Task 2: Testbaren Demo-Store mit Rollen-Scopes und lokalem Zustand bauen

**Files:**
- Create: `frontend/demo/demo-store.js`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `DEMO_DATA`.
- Produces: `createDemoStore(baseData, storage)`.
- Store methods: `getState()`, `setRole(role, employeeId)`, `getVisibleEmployees()`, `getEmployeeBuckets(employeeId)`, `advanceLearning(employeeId, instructionId)`, `submitTest(employeeId, instructionId, answers)`, `completeOnline(employeeId, instructionId)`, `schedulePractical(managerId, employeeId, instructionId, date)`, `confirmPractical(managerId, employeeId, instructionId)`, `reset()`.

- [ ] **Step 1: RED-Tests für Rollenabgrenzung schreiben**

```js
test('employee only sees self and line manager only direct reports', () => {
  const store = createDemoStore(data, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  assert.deepEqual(store.getVisibleEmployees().map(x => x.id), ['emp-mila-hartmann']);
  store.setRole('line_manager', 'emp-jonas-keller');
  assert.ok(store.getVisibleEmployees().every(x => x.lineManagerId === 'emp-jonas-keller'));
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, `createDemoStore` fehlt.

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

  return { getState:()=>state, setRole, getVisibleEmployees, reset, /* weitere Methoden */ };
}
```

`loadOrClone` verwendet JSON-Deep-Clone und akzeptiert eine Storage-Abstraktion, damit Tests ohne Browser laufen.

- [ ] **Step 4: RED-Tests für sequenziellen Lernfortschritt schreiben**

```js
test('online training cannot skip learning steps or finish before passing test', () => {
  const store = createDemoStore(data, memoryStorage());
  const id = 'ins-arbeitsschutz';
  assert.throws(() => store.completeOnline('emp-mila-hartmann', id), /Lernschritte/);
  const stepCount = data.learningSteps.filter(x => x.instructionId === id).length;
  for (let i = 0; i < stepCount; i++) store.advanceLearning('emp-mila-hartmann', id);
  assert.throws(() => store.completeOnline('emp-mila-hartmann', id), /Test/);
});
```

- [ ] **Step 5: Lernfortschritt/Test/Abschluss minimal implementieren**

`advanceLearning` erhöht immer exakt um einen Schritt bis `stepCount`. `submitTest` wertet die hinterlegten Fragen anhand `correctOption` aus und speichert `score`, `passed`, `completedAt`. `completeOnline` prüft `progress >= stepCount` und bei `testRequired === true` zusätzlich `passed === true`.

- [ ] **Step 6: RED-Tests für praktische Rollenregel und Reset schreiben**

```js
test('employee cannot confirm practical training and reset restores baseline', () => {
  const store = createDemoStore(data, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  assert.throws(() => store.confirmPractical('emp-mila-hartmann','emp-mila-hartmann','ins-stapler'), /Führungskraft/);
  store.reset();
  assert.equal(store.getState().company.name, 'Musterwerk Solutions GmbH');
});
```

- [ ] **Step 7: Planung, praktische Bestätigung, Persistenz und Reset implementieren**

Nur `line_manager` oder `company_admin` dürfen `schedulePractical` und `confirmPractical` ausführen. Line Manager dürfen nur direkte Reports verändern. Jede mutierende Methode ruft `persist()` auf; `reset()` löscht den Storage-Key und lädt `baseData` neu.

- [ ] **Step 8: Gesamttest ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

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
- Produces: DOM-Container `#demoApp`, `#demoRole`, `#demoPerson`, `#demoReset`, `#demoNav`, `#demoContent`.
- Produces: `renderApp()`, `renderAdminDashboard()`, `renderManagerDashboard()`, `renderEmployeeDashboard()`.

- [ ] **Step 1: RED-DOM-Test für Demo-Hinweis und Rollensteuerung schreiben**

```js
test('demo shell visibly identifies itself and exposes presentation roles', () => {
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
Expected: FAIL, weil `index.html` fehlt.

- [ ] **Step 3: HTML-Shell implementieren**

`index.html` enthält ausschließlich relative Demo-Skripte:

```html
<script src="./demo-data.js"></script>
<script src="./demo-store.js"></script>
<script src="./demo-proof.js"></script>
<script src="./demo-ui.js"></script>
```

Kein `config.js`, kein `app.js`, kein Auth-Link und kein produktives Script wird geladen.

- [ ] **Step 4: Präsentationsdesign implementieren**

CSS enthält Desktop- und Mobile-Layout, KPI-Karten, Status-Badges, Tabellen/Karten, Sticky Demo-Banner, Rollenumschalter, Lernmodal und klare Aktionsbuttons. Keine externen Fonts oder CDN-Abhängigkeiten.

- [ ] **Step 5: Rollenwechsel und Admin-Dashboard implementieren**

Admin-Ansicht zeigt mindestens Mitarbeiter gesamt, aktive Unterweisungen, gültig, bald fällig, überfällig, fehlend, geplant, Abschlussquote, Abteilungsübersicht und Handlungsbedarf.

- [ ] **Step 6: Führungskraft- und Mitarbeiterdashboard implementieren**

Führungskraft zeigt nur direkte Reports. Mitarbeiteransicht gruppiert in `Jetzt erledigen`, `Einplanung erforderlich`, `Geplante Termine`, `Bald fällig`, `Abgeschlossen`.

- [ ] **Step 7: Tests und Sicherheitscheck ausführen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/demo/index.html frontend/demo/demo.css frontend/demo/demo-ui.js tests/company-showcase-demo.test.js
git commit -m "feat(demo): add presentation shell and role dashboards"
```

---

### Task 4: Bildgestützte Online-Unterweisung mit Test und Zoom umsetzen

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
- Consumes: `store.advanceLearning`, `store.submitTest`, `store.completeOnline`.
- Produces: `openLearning(instructionId)`, `renderLearningStep()`, `renderTrainingTest()`, `renderTrainingResult()`.

- [ ] **Step 1: RED-Test für mindestens drei vollständige Lernstrecken schreiben**

```js
test('at least three online trainings have multiple illustrated learning steps', () => {
  const online = data.instructionTypes.filter(x => x.deliveryMode === 'online');
  const illustrated = online.filter(t => data.learningSteps.filter(s => s.instructionId === t.id && s.image).length >= 3);
  assert.ok(illustrated.length >= 3);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, bis die Lernschritte vollständig hinterlegt sind.

- [ ] **Step 3: Neutrale lokale SVG-Illustrationen erstellen und Demodaten vervollständigen**

SVGs zeigen abstrakte, nicht markenbezogene Arbeitssituationen mit Formen/Icons; keine realen Personen, Logos oder Firmenfotos. Lernschritte erhalten relative Bildpfade wie `./assets/work-safety.svg`.

- [ ] **Step 4: Lernmodal implementieren**

Modal zeigt Titel, Schritt `x / n`, Fortschrittsbalken, Bild, Kurztext, `Zurück`, `Weiter`, `Bild vergrößern`. `Weiter` ruft genau einmal `advanceLearning` auf. Abschlussbutton erscheint erst nach letztem Schritt.

- [ ] **Step 5: Testansicht implementieren**

Fragen sind Single-Choice. `Test auswerten` übergibt Antwort-Indizes an `submitTest`. Bei Nichtbestehen bleibt die Unterweisung offen und bietet `Test erneut versuchen`; bei Bestehen wird `completeOnline` angeboten.

- [ ] **Step 6: Bildzoom implementieren**

Zoom nutzt dasselbe lokale Asset in einem zweiten Modal/Overlay, Escape und Klick auf Schließen beenden den Zoom.

- [ ] **Step 7: Tests/Sicherheitscheck ausführen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/demo/assets frontend/demo/demo-data.js frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add illustrated online training experience"
```

---

### Task 5: Praktische Unterweisung, Planung und Führungskräfte-Bestätigung demonstrierbar machen

**Files:**
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/demo-css`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Consumes: `store.schedulePractical`, `store.confirmPractical`.
- Produces: `openScheduleDialog(employeeId, instructionId)`, `openPracticalConfirmation(employeeId, instructionId)`.

- [ ] **Step 1: RED-Test für Direct-Report-Grenze schreiben**

```js
test('line manager cannot schedule or confirm training outside direct team', () => {
  const store = createDemoStore(data, memoryStorage());
  store.setRole('line_manager','emp-jonas-keller');
  assert.throws(() => store.schedulePractical('emp-jonas-keller','emp-nora-weiss','ins-stapler','2026-09-10'), /Team/);
});
```

- [ ] **Step 2: RED ausführen und Grenzfall bestätigen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, falls Scope noch nicht vollständig erzwungen wird.

- [ ] **Step 3: Manager-UI für Terminplanung implementieren**

Dialog enthält Demo-Mitarbeiter, Unterweisung, Datum und Hinweis `Wird nur lokal in dieser Demo gespeichert`. Nach Speichern erscheint der Termin sofort in Manager- und Mitarbeiteransicht.

- [ ] **Step 4: Praktische Bestätigung implementieren**

Bestätigung erzeugt lokal einen Abschlussrecord mit `confirmedBy`, `completedAt`, `source:'demo-practical'`. Mitarbeiteransicht enthält keinen Bestätigungsbutton.

- [ ] **Step 5: Tests ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add practical training planning and confirmation"
```

---

### Task 6: Demo-Nachweis und vollständigen Reset implementieren

**Files:**
- Create: `frontend/demo/demo-proof.js`
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/demo.css`
- Modify: `tests/company-showcase-demo.test.js`

**Interfaces:**
- Produces: `buildDemoProofHtml({ company, employee, instruction, completedAt, confirmedBy })`.
- Produces: `openDemoProof(recordId)` und `downloadDemoProof(recordId)`.

- [ ] **Step 1: RED-Test für Nachweiskennzeichnung schreiben**

```js
test('demo proof is unmistakably marked as sample', () => {
  const html = buildDemoProofHtml({ company:data.company, employee:data.employees[0], instruction:data.instructionTypes[0], completedAt:'2026-09-03' });
  assert.match(html, /DEMO \/ MUSTER/);
  assert.match(html, /Musterwerk Solutions GmbH/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test tests/company-showcase-demo.test.js`
Expected: FAIL, `buildDemoProofHtml` fehlt.

- [ ] **Step 3: Nachweisgenerator implementieren**

Generator liefert ein vollständiges druckbares HTML-Dokument mit großem Wasserzeichen `DEMO / MUSTER`, Demo-Firma, Mitarbeiter, Unterweisung, Abschlussdatum, optional bestätigender Führungskraft und Hinweis `Dieser Nachweis ist ein fiktives Präsentationsmuster und besitzt keine rechtliche Gültigkeit.`

- [ ] **Step 4: Öffnen und Download lokal implementieren**

`openDemoProof` öffnet einen Blob-URL in neuem Fenster. `downloadDemoProof` erzeugt eine `.html`-Datei mit Dateiname `DEMO_Nachweis_<Name>_<Unterweisung>.html`. Kein Serverzugriff.

- [ ] **Step 5: Reset-Bestätigung und Präsentations-Reset implementieren**

`Demo zurücksetzen` fragt einmal nach Bestätigung, ruft `store.reset()` auf, setzt Rolle auf Admin/Lena Hoffmann und rendert Dashboard neu.

- [ ] **Step 6: Tests und Sicherheitscheck ausführen**

Run: `node --test tests/company-showcase-demo.test.js && node scripts/check-company-showcase-demo.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/demo/demo-proof.js frontend/demo/demo-ui.js frontend/demo/demo.css tests/company-showcase-demo.test.js
git commit -m "feat(demo): add sample proofs and deterministic reset"
```

---

### Task 7: Deployment-Vertrag, Regression und öffentliche Preview absichern

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml`
- Modify: `scripts/check-company-showcase-demo.js`
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: bestehende Azure Static Web Apps PR-Preview.
- Produces: CI-Schritt `Company showcase demo checks` und Post-Deploy-Prüfung auf `/demo/`.

- [ ] **Step 1: Workflow um Demo-Pretest erweitern**

Vor `Build And Deploy` ausführen:

```yaml
- name: Company showcase demo checks
  run: |
    node --test tests/company-showcase-demo.test.js
    node scripts/check-company-showcase-demo.js
```

- [ ] **Step 2: Post-Deploy-Prüfung ergänzen**

Die bereits vom Azure-Schritt bereitgestellte Preview-URL wird um `/demo/` ergänzt. Prüfung verlangt HTTP 200 und im Body sowohl `Musterwerk Solutions GmbH` als auch `DEMO – ausschließlich Beispieldaten`.

- [ ] **Step 3: Changelog aktualisieren**

Eintrag beschreibt separate öffentliche Showcase-Demo, Fake-Daten, Rollenumschalter, Online-/Praxis-Unterweisungen, Demo-Nachweise und vollständige Datenisolation. Kein Produktivrelease behaupten.

- [ ] **Step 4: Lokale Vollprüfung ausführen**

Run:

```bash
node --test tests/*.test.js
node scripts/check-company-showcase-demo.js
node scripts/check-auth-preview-wiring.js
node scripts/check-professional-suite.js
```

Expected: alle Tests/Checks PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/azure-static-web-apps.yml scripts/check-company-showcase-demo.js docs/CHANGELOG.md
git commit -m "ci(demo): verify isolated showcase preview"
```

- [ ] **Step 6: Draft-PR von `demo/company-showcase` gegen `feature/v0.36-instruction-ui` öffnen**

PR-Titel: `Demo: öffentliche Firmen-Showcase-Vorschau mit Beispieldaten`

PR-Body dokumentiert ausdrücklich:

```text
- ausschließlich fiktive Daten
- keine API/Auth/SQL/Blob/Mail-Verbindung
- kein Merge nach main
- keine Migration/Secrets
- Preview-Link erst nach grünem Workflow freigeben
```

- [ ] **Step 7: GitHub Actions abwarten und jeden fehlgeschlagenen Schritt prüfen**

Erwartet: Build/Deploy `success`; Demo-Pretest und alle bestehenden Regressionen grün.

- [ ] **Step 8: Preview-Verifikation dokumentieren**

Öffentlichen Azure-Preview-Link mit `/demo/` als Präsentationslink festhalten. Zusätzlich PR-Status, Commit-SHA und Workflow-Run-ID dokumentieren.

---

## Self-Review

- Spec coverage: Sicherheitsisolation, Fake-Firma, 15 Fake-Mitarbeiter, Rollen, 10 Unterweisungen, Online-/Praxis-Modus, Statusmix, Admin-/Manager-/Mitarbeiteransichten, Lernstrecke, Test, Zoom, lokale Interaktionen, Reset, Demo-Nachweis, Präsentationsablauf, Tests und Preview-Deployment sind jeweils konkreten Tasks zugeordnet.
- Placeholder scan: Keine `TBD`, `TODO`, `implement later` oder unbestimmten Fehlerbehandlungsanweisungen enthalten.
- Type consistency: `DEMO_DATA`, `createDemoStore`, Rollenwerte, Mitarbeiter-/Unterweisungs-IDs und Store-Methoden werden einmal definiert und in Folgetasks identisch verwendet.
- Scope: Keine echte Kundenregistrierung, Lizenzierung, CRM-, Login-, Mail-, SQL- oder Blob-Funktion wird in diesen Showcase-Plan aufgenommen.
