# v0.40 – Umsetzungsplan Arbeitsportal & Management-Cockpit

> Grundlage: `docs/superpowers/specs/2026-09-06-v040-workportal-management-cockpit-design.md`
>
> Zielbranch: `v040-workportal-management-cockpit`
>
> Ausgangsstand bei Planerstellung: `main` = `f2de6c8263d311057624b4a4dfa26fa494b1299b`

## Ziel

v0.40 ersetzt die heutige flache, von vielen UI-Overrides geprägte Oberfläche durch ein rollenabhängiges Arbeitsportal mit Management-Cockpit. Gleichzeitig werden die serverseitigen Teamgrenzen für Line Manager verbindlich, interne digitale Zuweisungen persistent abgebildet und die bisher getrennten Abläufe Status, Planung, externe Unterweisung, Nachweise, Erinnerungen und Reporting zu klaren Arbeitsprozessen zusammengeführt.

Die vorhandene Mandantenlogik, Anmeldung, Azure-SQL-/Blob-Infrastruktur und bestehende funktionierende Fach-APIs werden weiterverwendet. Produktion wird erst nach vollständigen Tests, Migration und Deployment-Verifikation aktualisiert.

## Verbindliche Architekturentscheidungen

### 1. Sicherheitsgrenze

Die API bleibt die einzige verbindliche Sicherheitsgrenze. UI-Ausblendungen sind nur Komfort. Für jede employee-bezogene Lese- oder Schreiboperation wird ein serverseitiger Employee-Scope berechnet:

- `system_admin`, `company_admin`, `hse`: gesamte aktive Firma im aktuell ausgewählten Firmenkontext.
- `line_manager`: eigener Employee-Datensatz plus aktive Employees mit `lineManagerId = actorEmployeeId`.
- `employee`: nur eigener Employee-Datensatz.
- Zuordnung User -> Employee erfolgt innerhalb `ctx.companyId` über normalisierte E-Mail.
- Fehlt die Zuordnung für eine Rolle, die Self/Team-Scope benötigt, wird fail-closed mit HTTP 403 gearbeitet.
- Clientseitig übermittelte Employee-IDs dürfen den erlaubten Scope niemals erweitern.
- Ein Systemadmin ohne ausgewählte Firma erhält in `/me` noch keinen Employee-Scope; `employeeScope` ist bis zur Firmenauswahl `null`.

Neue Bibliothek:

```js
// api/src/lib/employeeScope.js
export function scopeModeForRoles(roles = []) {}
export async function resolveEmployeeScope(pool, ctx) {}
export function employeeAllowed(scope, employeeId) {}
export function assertEmployeeAllowed(scope, employeeId) {}
export function assertEmployeeIdsAllowed(scope, employeeIds = []) {}
export function filterRowsByEmployeeScope(scope, rows = [], key = 'employeeId') {}
```

Rückgabeformat nach gewähltem Firmenkontext:

```js
{
  mode: 'company' | 'team' | 'self',
  actorEmployeeId: 'emp-...' | null,
  allowedEmployeeIds: Set<string> | null
}
```

### 2. Interne digitale Zuweisungen

Status allein ist keine Zuweisung. v0.40 bekommt deshalb einen persistenten Datensatz `TrainingAssignments`.

API-Vertrag:

```text
GET   /api/assignments
POST  /api/assignments
PATCH /api/assignments/{id}
POST  /api/assignments/{id}/send-reminder
GET   /api/internal/{assignmentId}
POST  /api/internal/{assignmentId}
```

POST `/assignments`:

```json
{
  "instructionTypeId": "type-1",
  "employeeIds": ["emp-1", "emp-2"],
  "dueAt": "2026-09-30T23:59:59",
  "testRequired": true,
  "passPercent": 80
}
```

Statuswerte: `assigned`, `in_progress`, `completed`, `cancelled`.

Interne Erinnerungen verwenden denselben Firmen-Mailmodus wie externe Einladungen: `manual`, `outlook` oder `graph`. Bei Graph-Versand werden `lastReminderAt` und `reminderCount` serverseitig aktualisiert; bei manuell/Outlook erzeugt die UI einen vollständigen Mailtext, ohne einen erfolgreichen Versand vorzutäuschen.

### 3. Strukturierter Unterweisungsinhalt

`InstructionTypes` erhält `contentJson`. Alte Datensätze ohne `contentJson` bleiben kompatibel: `description` wird als einzelner Textblock gerendert.

Schema v1:

```json
{
  "version": 1,
  "objective": "Lernziel",
  "sections": [
    {"id":"sec-1","kind":"text","title":"Titel","body":"Text"},
    {"id":"sec-2","kind":"image","fileId":"file-1","title":"Bildtitel","caption":"Beschreibung","emphasis":false},
    {"id":"sec-3","kind":"notice","tone":"warning","title":"Wichtig","body":"Hinweis"},
    {"id":"sec-4","kind":"summary","title":"Zusammenfassung","body":"Kurzfassung"}
  ]
}
```

Erlaubte `kind`: `text`, `image`, `notice`, `summary`. Erlaubte Notice-Töne: `info`, `warning`. Maximal 80 Blöcke; Textlängen und IDs werden serverseitig begrenzt.

Employee-Nutzer erhalten strukturierten Inhalt nicht über einen frei aufrufbaren Type-Endpunkt, sondern ausschließlich über ihre erlaubte interne Assignment-Ausführung. Managementrollen dürfen den Content-Endpunkt zur Pflege/Vorschau verwenden.

### 4. Neue Frontend-Struktur

Keine weitere Kette `*-v36`, `*-v37`, ... als Monkey-Patches. Neue aktive Module:

- `frontend/portal-v040.css`
- `frontend/portal-shell.js`
- `frontend/portal-dashboard.js`
- `frontend/ui-dialog.js`
- `frontend/work-center.js`
- `frontend/instruction-workflow.js`
- `frontend/instruction-player.js`
- `frontend/instruction-content-editor.js`
- `frontend/planning-calendar.js`
- `frontend/proof-center.js`
- `frontend/report-center.js`
- `frontend/notification-center.js`
- `frontend/admin-center.js`
- `frontend/system-admin.js`
- `frontend/diagnostics-entry.js`

Die Anwendung bleibt für v0.40 bei klassischen Browser-Skripten ohne neue Bundler-/Framework-Migration. Module veröffentlichen gezielte `window.UM...`-Schnittstellen und überschreiben keine globalen Renderer nachträglich.

Primäre View-IDs:

```js
['dashboard', 'work', 'learning', 'planning', 'proofs', 'reports', 'admin']
```

Mobile Primärnavigation:

```js
['dashboard', 'work', 'learning', 'more']
```

Admin-Unterbereiche werden innerhalb `#admin` gerendert und sind keine primären `.view`-Tabs.

### 5. Deep Links / KPI-Navigation

Portal-interne Filterzustände werden über einen Hash ohne Token-Geheimnisse transportiert:

```text
#portal=work&status=expired
#portal=work&status=missing
#portal=proofs&filter=missing
#portal=planning&range=week
```

`#passwordSetup=...` bleibt ausschließlich der Login-/Setup-Logik vorbehalten und darf durch Portal-Routing nicht interpretiert oder überschrieben werden, solange ein Setup-Token aktiv ist.

---

# Paket 1 – Sicherheit und Datenmodell

## Task 1: Employee-/Team-Scope als serverseitige Primitive

**Dateien**

- Neu: `api/src/lib/employeeScope.js`
- Neu: `api/test/employeeScope.test.js`
- Ändern: `api/package.json`

### Schritt 1 – RED-Test schreiben

Tests müssen mindestens abdecken:

1. Company Admin erhält `mode='company'` und keine Employee-ID-Liste.
2. Employee wird per E-Mail innerhalb genau seiner Firma aufgelöst und erhält nur sich selbst.
3. Line Manager erhält sich selbst plus direkte Teammitglieder.
4. Employee-Datensatz aus anderer Firma wird nie akzeptiert.
5. Fehlende oder doppelte User/Employee-Zuordnung führt für Self/Team-Scope zu Fehler mit `status=403`.
6. `assertEmployeeIdsAllowed` lehnt eine gemischte erlaubte/nicht erlaubte Liste vollständig ab.
7. Systemadmin ohne `companyId` wird nicht über `resolveEmployeeScope` auf einen beliebigen Employee gemappt.

API-Testskript erweitern:

```json
"test": "node --test test/*.test.js && node --check src/functions/*.js && node --check src/lib/*.js"
```

**RED ausführen**

```bash
cd api && npm test
```

Erwartung: Test scheitert, weil `employeeScope.js` noch fehlt.

### Schritt 2 – Minimalimplementierung

`resolveEmployeeScope(pool, ctx)` darf ausschließlich `ctx.companyId`, `ctx.email` und serverseitige Rollendaten verwenden. Für Team-Scope werden nur aktive Employees des Managers geladen.

### Schritt 3 – GREEN

```bash
cd api && npm test
```

Erwartung: alle Scope-Tests und Syntaxchecks grün.

### Schritt 4 – Commit

```bash
git add api/src/lib/employeeScope.js api/test/employeeScope.test.js api/package.json
git commit -m "security: employee and team scope serverseitig absichern"
```

---

## Task 2: Scope auf bestehende employee-bezogene APIs anwenden

**Dateien**

- Ändern: `api/src/functions/me.js`
- Ändern: `api/src/functions/bootstrap.js`
- Ändern: `api/src/functions/status.js`
- Ändern: `api/src/functions/employees.js`
- Ändern: `api/src/functions/records.js`
- Ändern: `api/src/functions/plannedTrainings.js`
- Ändern: `api/src/functions/invitations.js`
- Ändern: `api/src/functions/exclusions.js`
- Ändern: `api/src/functions/proofFiles.js`
- Ändern: `api/src/functions/files.js`
- Ändern: `api/src/functions/managerReport.js`
- Ändern: `api/src/functions/mail.js`
- Neu: `tests/v040-api-scope-contract.test.js`
- Ändern: `package.json`

### Schritt 1 – RED-Vertragstest

`tests/v040-api-scope-contract.test.js` prüft, dass alle oben genannten employee-bezogenen Endpunkte `resolveEmployeeScope` bzw. `assertEmployee...` verwenden und kein Line-Manager-Schreibpfad lediglich `companyId + vom Client gelieferte employeeId` validiert.

Zusätzlich statisch prüfen:

- `me.js` liefert nach Firmenauswahl `employeeScope: { mode, actorEmployeeId }`, vor Systemadmin-Firmenauswahl `employeeScope:null`.
- `files.js` erlaubt Employee-Downloads nur für eigene Nachweise bzw. Bilder aus einer eigenen aktiven Assignment-Ausführung.
- `mail.js` prüft vor `sendPlannedTrainingMail` alle internen Teilnehmer gegen Team-Scope.
- Externe Einladung ohne `employeeId` bleibt für frei eingegebene externe Empfänger zulässig; sobald `employeeId` gesetzt ist, muss sie im Scope liegen.

**RED**

```bash
node --test tests/v040-api-scope-contract.test.js
```

### Schritt 2 – Lese-Scope implementieren

- `/employees`: Self -> eigener Employee; Team -> Manager + Team; Company -> Firma.
- `/instruction-status`: gleiche Scope-Regel.
- `/records`: gleiche Scope-Regel; optionaler `employeeId` darf Scope nicht überschreiten.
- `/bootstrap`: Employees, Records, Exclusions, PlannedTrainings, Invitations und später Assignments scope-konform zurückgeben.
- `/reports/manager-training-time`: für Line Manager direkt aus `InstructionRecords JOIN Employees` aggregieren und auf erlaubte Employee-IDs begrenzen; nicht die gesamte Firmen-View ungefiltert zurückgeben.
- `/proof-files`: GET nur Dateien zu erlaubten Records/Groups.
- `plannedTrainings.js` GET: ein Line Manager sieht Termine mit mindestens einem erlaubten Teilnehmer, aber Namen/Anzahl werden auf erlaubte Teilnehmer reduziert. Ein gemischter Termin mit Teilnehmern außerhalb des eigenen Teams darf vom Line Manager nicht geändert, versendet oder abgeschlossen werden.

### Schritt 3 – Schreib-Scope implementieren

Vor jeder Mutation die vollständige Zielmenge prüfen:

- `records.js` POST
- `plannedTrainings.js` POST/PATCH/complete
- `invitations.js` POST/PATCH bei intern verknüpften Employees
- `exclusions.js` POST/DELETE
- `proofFiles.js` POST/PATCH
- `mail.js` Einladungs- und Planungsmails

Keine Teilmutation bei gemischter erlaubter/nicht erlaubter Employee-Liste.

### Schritt 4 – Download-Scope

`files.js` lädt zusätzlich `linkedEntityType`, `linkedEntityId` und prüft:

- `instruction_record`: Employee = eigener Record; Line Manager = eigener/Team-Record; Company Rollen = Firma.
- `instruction_group`: alle im Dokument enthaltenen Teilnehmer müssen im erlaubten Scope liegen; für Employee nur, wenn eigener Record zur Gruppe gehört.
- `instruction_type`: Managementrollen dürfen Content-Bilder des aktiven Firmenkontexts lesen. Employee darf ein Content-Bild nur lesen, wenn es zum InstructionType eines eigenen aktiven/completed Assignments gehört.
- Blockierte/quarantined Dateien bleiben immer gesperrt.

### Schritt 5 – GREEN

```bash
node --test tests/v040-api-scope-contract.test.js
npm test
```

### Schritt 6 – Commit

```bash
git add api/src/functions api/src/lib tests/v040-api-scope-contract.test.js package.json
git commit -m "security: team scope in fach APIs durchsetzen"
```

---

## Task 3: v0.40 SQL-Migration und persistente interne Assignments

**Dateien**

- Neu: `database/migrations/011_v040_workportal.sql`
- Ändern: `scripts/check-database.js`
- Neu: `api/src/functions/assignments.js`
- Ändern: `api/src/functions/bootstrap.js`
- Neu: `tests/v040-assignment-contract.test.js`
- Ändern: `package.json`

### Schritt 1 – RED

Test fordert:

- Migration enthält additive/idempotente Spalte `InstructionTypes.contentJson`.
- Tabelle `TrainingAssignments` mit Company-, Employee-, InstructionType-Bezug.
- Check-Constraint für Statuswerte.
- `passPercent` liegt zwischen 0 und 100.
- Indizes `(companyId,employeeId,status,dueAt)` und `(companyId,instructionTypeId,status)`.
- `scripts/check-database.js` erwartet `TrainingAssignments`.
- Assignments-API verwendet Employee-Scope.
- Bootstrap liefert `assignments`.

```bash
node --test tests/v040-assignment-contract.test.js
```

### Schritt 2 – Migration implementieren

`011_v040_workportal.sql` ist idempotent über `COL_LENGTH`, `OBJECT_ID` und `sys.indexes`.

Tabellenkern:

```sql
TrainingAssignments(
  id NVARCHAR(80) PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  employeeId NVARCHAR(80) NOT NULL,
  instructionTypeId NVARCHAR(80) NOT NULL,
  assignedByUserId NVARCHAR(120) NULL,
  dueAt DATETIME2 NULL,
  status NVARCHAR(30) NOT NULL,
  testRequired BIT NOT NULL DEFAULT 1,
  passPercent INT NOT NULL DEFAULT 80,
  startedAt DATETIME2 NULL,
  completedAt DATETIME2 NULL,
  linkedRecordId NVARCHAR(80) NULL,
  lastReminderAt DATETIME2 NULL,
  reminderCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)
```

Foreign Keys werden auf Companies, Employees und InstructionTypes gesetzt. `linkedRecordId` referenziert `InstructionRecords`, sofern die bestehende Migrationsreihenfolge dies ohne Zyklus erlaubt; andernfalls wird die referenzielle Existenz beim Schreiben serverseitig geprüft und durch einen Index abgesichert.

### Schritt 3 – Assignments-API

- GET: scoped Liste, optional `status`.
- POST: Rollen Systemadmin/Firmenadmin/HSE/Line Manager; `employeeIds` komplett scope-prüfen; pro Employee genau eine Assignment-Zeile erstellen.
- PATCH: Managementrollen dürfen nur `cancelled`, `dueAt`, `testRequired` und `passPercent` ändern; kein willkürliches Setzen von `completed`.
- POST `/{id}/send-reminder`: Assignment und Employee serverseitig scope-prüfen. Graph-Modus versendet und aktualisiert `lastReminderAt/reminderCount`; manual/outlook liefert nur vorbereiteten Betreff/Text/Empfänger zurück und markiert keinen Versand als erfolgt.
- Audit-Ereignisse `assignment.created`, `assignment.updated`, `assignment.cancelled`, `assignment.reminderSent`.

### Schritt 4 – GREEN

```bash
node --test tests/v040-assignment-contract.test.js
cd api && npm test
cd .. && npm test
```

`npm run db:migrate` wird an diesem Punkt nur ausgeführt, wenn `SQL_CONNECTION_STRING` in der Ausführungsumgebung vorhanden ist. Kein Dummy- oder Produktiv-Connection-String wird erfunden.

### Schritt 5 – Commit

```bash
git add database/migrations/011_v040_workportal.sql scripts/check-database.js api/src/functions/assignments.js api/src/functions/bootstrap.js tests/v040-assignment-contract.test.js package.json
git commit -m "feat: interne Unterweisungszuweisungen persistieren"
```

---

# Paket 2 – Portal-Shell und Rollen-Dashboards

## Task 4: Neue Portal-Shell, Routing und Designsystem

**Dateien**

- Neu: `frontend/portal-v040.css`
- Neu: `frontend/portal-shell.js`
- Neu: `frontend/ui-dialog.js`
- Ändern: `frontend/index.html`
- Ändern: `frontend/app.js`
- Ändern: `frontend/login-gate-v44.css`
- Neu: `tests/v040-portal-shell.test.js`
- Neu: `tests/v040-login-boundary-regression.test.js`
- Ändern: `package.json`

### Schritt 1 – RED

`v040-portal-shell.test.js` verlangt:

- exakt sieben primäre Desktopbereiche.
- Navigation wird anhand Rollenmatrix erzeugt, nicht durch periodisches DOM-Polling.
- `portalNavigate(view, filters)` ist die einzige primäre Navigation.
- `portalRouteFromLocation()` versteht die vereinbarten `#portal=...` Deep Links.
- Systemadmin-Firmenwechsel bleibt erreichbar.
- Diagnostik ist kein normaler Primärtab.

`v040-login-boundary-regression.test.js` verlangt:

- `#authenticatedApp[hidden]` bleibt hart verborgen.
- Vor erfolgreichem Firmen-Bootstrap ist keine Firmenansicht sichtbar.
- Ein alter Request einer vorherigen Firma kann nach Firmenwechsel keinen State setzen.
- `#passwordSetup` wird vom Portal-Router nicht überschrieben.

```bash
node --test tests/v040-portal-shell.test.js tests/v040-login-boundary-regression.test.js
```

### Schritt 2 – HTML-Shell umbauen

`index.html` erhält primär:

```html
<nav id="portalNavigation"></nav>
<section id="dashboard" class="view"></section>
<section id="work" class="view"></section>
<section id="learning" class="view"></section>
<section id="planning" class="view"></section>
<section id="proofs" class="view"></section>
<section id="reports" class="view"></section>
<section id="admin" class="view"></section>
```

Header enthält aktive Firma, Nutzer/Rolle, Benachrichtigungsglocke, Firmenwechsel (nur Systemadmin), Abmelden.

Bereits in diesem Task werden die alten Router-/Design-Wrapper aus `index.html` entfernt, aber ihre Dateien noch nicht gelöscht:

- `role-guard-v20.js`
- `tenant-context-v36.js`
- `design-polish-v31.js`
- `dashboard-design-v32.js`
- `table-form-design-v33.js`
- `view-header-design-v34.js`
- `professional-suite-v35.js`
- `system-admin-v16.js`
- `diagnostics-entry-v37.js`
- `view-header-design-v34.css`
- `professional-suite-v35.css`

So können sie das neue Routing nicht mehr überschreiben; endgültig gelöscht werden sie erst nach Ersatztests in Paket 5.

### Schritt 3 – app.js vereinfachen

Behalten:

- `api()`
- Auth-/Firmenkontext
- `setCoreWorkspaceVisible`
- stale-company guard
- Datenhelper

Ersetzen:

- altes `setView`/`render`-Mapping durch Portal-Router.
- `renderAll()` rendert die aktuell aktive Portalansicht, nicht pauschal das alte Dashboard.
- sekundäre Datenloads werden rollenbewusst; `/users` wird nicht mehr unnötig für Employee/Line Manager angefordert.

Keine neuen Render-Wrapper um globale Funktionen.

### Schritt 4 – Designsystem

`portal-v040.css` definiert eigenständige Tokens für Oberfläche, Typografie, Abstände, Navigation, KPI, Tabellen/Karten, Dialoge, Fokus und Responsive-Verhalten. Statusfarben nur für fachliche Statuszustände.

### Schritt 5 – GREEN

```bash
node --test tests/v040-portal-shell.test.js tests/v040-login-boundary-regression.test.js
npm test
```

Alte direkte Check-Skripte dürfen zu diesem Zwischenstand noch grün sein, weil ihre Dateien bis Paket 5 existieren; sie dürfen jedoch nicht mehr von `index.html` geladen werden.

### Schritt 6 – Commit

```bash
git add frontend/index.html frontend/app.js frontend/login-gate-v44.css frontend/portal-v040.css frontend/portal-shell.js frontend/ui-dialog.js tests/v040-portal-shell.test.js tests/v040-login-boundary-regression.test.js package.json
git commit -m "feat: neue v040 Portal Shell einführen"
```

---

## Task 5: Rollenabhängige Startseiten und Management-Cockpit

**Dateien**

- Neu: `frontend/portal-dashboard.js`
- Neu: `tests/v040-role-dashboard.test.js`
- Ändern: `frontend/app.js`
- Ändern: `frontend/index.html`
- Ändern: `package.json`

### Schritt 1 – RED

Tests mit dem bereits vorhandenen `jsdom` und Fixtures für:

- Employee: nur eigene Aufgaben/Termine/Nachweise, CTA „Unterweisung starten“.
- Line Manager: eigener + Teamstatus, Team-CTAs Planen/Extern/Erinnern.
- HSE/Firmenadmin: sechs Management-KPIs.
- Systemadmin ohne Firma: Firmenauswahl statt Firmendashboard.
- KPI-Klick `Überfällig` navigiert zu `work` mit `status=expired`.
- Keine Kennzahl oder Liste verwendet ungescopte Rohdaten außerhalb des bereits serverseitig gelieferten State.

```bash
node --test tests/v040-role-dashboard.test.js
```

### Schritt 2 – Dashboard-Selectoren

Neue pure Funktionen, getrennt vom DOM:

```js
portalDashboardRole(state.me)
portalDashboardModel(state)
employeeDashboardModel(state)
managerDashboardModel(state)
companyDashboardModel(state)
```

KPI-Satz Firmen/HSE maximal:

1. Erfüllungsquote
2. Überfällig
3. Fehlend
4. In 30 Tagen fällig
5. Nachweise fehlen
6. Termine diese Woche

### Schritt 3 – Rendern und Deep Links

Jede KPI-Karte ist Button/Link mit eindeutigem Portal-Filter. Keine verschachtelten klickbaren Karten.

### Schritt 4 – GREEN

```bash
node --test tests/v040-role-dashboard.test.js
npm test
```

### Schritt 5 – Commit

```bash
git add frontend/portal-dashboard.js frontend/app.js frontend/index.html tests/v040-role-dashboard.test.js package.json
git commit -m "feat: rollen Dashboards und Management Cockpit ergänzen"
```

---

# Paket 3 – Arbeitszentrum und Unterweisungsworkflow

## Task 6: Neues Aufgaben-/Team-Arbeitszentrum

**Dateien**

- Neu: `frontend/work-center.js`
- Neu: `tests/v040-work-center.test.js`
- Ändern: `frontend/index.html`
- Ändern: `package.json`

### Schritt 1 – RED

Testet:

- Filter: Suche, Status, Unterweisung, Bereich, Line Manager, nur offen, Fristbereich.
- Employee sieht keine fremden Zeilen in Fixtures.
- Line Manager erhält nur die bereits gescopte Teammenge.
- Einzelaktionen: erinnern, planen, intern zuweisen, extern senden, durchführen, Nachweis, Ausnahme.
- Bulk-Auswahl behält nur aktuell ausgewählte IDs.
- KPI-Deep-Link setzt Filter korrekt.
- Schreibfehler bleiben lokal im Arbeitszentrum; vorhandene Daten bleiben sichtbar.
- Erinnern benötigt keine Funktion aus `reminder-center-v30.js`.

```bash
node --test tests/v040-work-center.test.js
```

### Schritt 2 – Work-Center-Modell

Arbeitszeile:

```js
{
  employeeId,
  employeeName,
  instructionTypeId,
  instructionName,
  dueAt,
  status,
  responsibleName,
  certificateFileId,
  assignmentId,
  lastReminderAt,
  nextActions: []
}
```

Status- und Assignment-Daten werden zu einer fachlichen Sicht zusammengeführt, ohne Datenserver-Scope clientseitig zu erweitern.

### Schritt 3 – Aktionen integrieren

- Planen -> öffnet Planungsdialog mit vorgewählten Personen/Unterweisung.
- Intern zuweisen -> POST `/assignments`.
- Extern -> öffnet Unified-Workflow auf Modus extern.
- Durchführen -> richtiger Dialog, POST `/records`.
- Nachweis -> Proof-Center/Datei.
- Ausnahme -> bestehende Exclusions-API.
- Erinnern bei Assignment -> POST `/assignments/{id}/send-reminder`; bei manual/outlook vollständigen Text/Empfänger in Dialog bzw. Mailclient übergeben; bei Graph tatsächliches Ergebnis anzeigen.
- Erinnern bei externer Einladung -> bestehendes POST `/invitations/{id}/send-mail` mit `reminder:true`.

### Schritt 4 – GREEN

```bash
node --test tests/v040-work-center.test.js
npm test
```

### Schritt 5 – Commit

```bash
git add frontend/work-center.js frontend/index.html tests/v040-work-center.test.js package.json
git commit -m "feat: Aufgaben und Team Arbeitszentrum aufbauen"
```

---

## Task 7: Strukturierter Inhalt, Inhaltseditor, Bildblöcke und professioneller Player

**Dateien**

- Neu: `api/src/lib/instructionContent.js`
- Neu: `api/src/functions/instructionContent.js`
- Ändern: `api/src/functions/instructionTypes.js`
- Ändern: `api/src/functions/files.js`
- Neu: `api/test/instructionContent.test.js`
- Neu: `frontend/instruction-player.js`
- Neu: `frontend/instruction-content-editor.js`
- Neu: `tests/v040-instruction-player.test.js`
- Neu: `tests/v040-instruction-content-editor.test.js`
- Ändern: `frontend/index.html`
- Ändern: `package.json`

### Schritt 1 – RED Backend

Testet Parser/Validator:

- gültiges Schema v1.
- ungültige Kinds/Tones werden abgelehnt.
- maximal 80 Blöcke.
- File-ID nur einfache ID, kein URL-Injection-Feld.
- Fallback aus `description`.
- Image-Upload akzeptiert JPG/PNG/WEBP, lehnt PDF im Image-Endpunkt ab.
- Employee darf den Management-Content-Endpunkt nicht als Ersatz für ein Assignment verwenden.

```bash
cd api && npm test
```

### Schritt 2 – Content-API

Routen:

```text
GET   /api/instruction-content/{typeId}
PATCH /api/instruction-content/{typeId}
POST  /api/instruction-content/{typeId}/images
```

GET/PATCH/POST: `system_admin`, `company_admin`, `hse`; GET zusätzlich `line_manager` für Vorschau, sofern der InstructionType in der eigenen Firma aktiv ist. Employee erhält Inhalt nur über `/internal/{assignmentId}`.

Image-Dateien:

```text
kind = instruction_image
linkedEntityType = instruction_type
linkedEntityId = {typeId}
```

### Schritt 3 – RED Frontend Player

`v040-instruction-player.test.js` prüft:

- Lernziel.
- Kapitel/Textblöcke.
- Bild mit Titel + Caption.
- Notice/Warning.
- Summary.
- Fortschrittsanzeige.
- Vollbilddialog für Bilder.
- kein ungefiltertes `innerHTML` aus Content-Texten.
- Fallback für alte `description`.

### Schritt 4 – RED Inhaltseditor

`v040-instruction-content-editor.test.js` prüft:

- Text-, Bild-, Hinweis- und Summary-Block hinzufügen.
- Reihenfolge per Auf/Ab-Aktion ändern; kein Drag-and-drop-Zwang auf Smartphone.
- Bild hochladen und resultierende `fileId` speichern.
- Bildtitel, Caption, `emphasis` editieren.
- Block löschen mit Dialogbestätigung.
- Speichern per PATCH behält Entwurf bei Serverfehler.
- Nur Managementrollen sehen Bearbeitungsaktionen.

### Schritt 5 – Player und Editor implementieren

`instruction-player.js` bekommt reine Render-Funktionen für Content-Blöcke und einen Zustand für Fortschritt/aktiven Abschnitt. Keine externen URLs aus `contentJson`; Bild-URL kommt ausschließlich aus API-resolvierter File-ID.

`instruction-content-editor.js` wird über den Bereich Unterweisungen/Verwaltung geöffnet und speichert ausschließlich validiertes Schema v1.

### Schritt 6 – GREEN

```bash
cd api && npm test
cd .. && node --test tests/v040-instruction-player.test.js tests/v040-instruction-content-editor.test.js
npm test
```

### Schritt 7 – Commit

```bash
git add api/src/lib/instructionContent.js api/src/functions/instructionContent.js api/src/functions/instructionTypes.js api/src/functions/files.js api/test/instructionContent.test.js frontend/instruction-player.js frontend/instruction-content-editor.js frontend/index.html tests/v040-instruction-player.test.js tests/v040-instruction-content-editor.test.js package.json
git commit -m "feat: strukturierte Unterweisungsinhalte mit Editor und Bild Player ergänzen"
```

---

## Task 8: Interne Ausführung und einheitlicher Unterweisungsworkflow

**Dateien**

- Neu: `api/src/lib/instructionExecution.js`
- Neu: `api/src/functions/internalInstruction.js`
- Ändern: `api/src/functions/externalInstruction.js`
- Ändern: `api/src/functions/invitations.js`
- Neu: `api/test/instructionExecution.test.js`
- Neu: `frontend/instruction-workflow.js`
- Ändern: `frontend/external/instruction.html`
- Neu: `tests/v040-instruction-workflow.test.js`
- Ändern: `scripts/check-external-flow.js`
- Ändern: `package.json`

### Schritt 1 – RED für gemeinsame Prüfungslogik

Aus `externalInstruction.js` werden nur wiederverwendbare, fachlich neutrale Testfunktionen extrahiert:

```js
safeQuestion(question)
normaliseAnswers(input)
evaluateAnswers(questions, answers, passPercent)
```

Tests sichern den bestehenden externen Vertrag: ursprünglicher Answer-Index bleibt korrekt, Ergebnis enthält `correctCount`, `wrongCount`, `questionCount`, Score und passed.

```bash
cd api && npm test
```

### Schritt 2 – Interne Ausführungs-API

GET `/internal/{assignmentId}`:

- Assignment laden.
- Employee-Scope prüfen; der ausführende Benutzer muss dem Assignment-Employee entsprechen.
- `assigned -> in_progress` setzen.
- Content + Template + sichere, zufällig angeordnete Testfragen liefern.
- Nur die zum Content referenzierten Bilddateien als kurzlebige, berechtigte URLs auflösen.

POST `/internal/{assignmentId}`:

```json
{
  "confirmed": true,
  "answers": [{"questionId":"q-1","answerIndex":2}]
}
```

- `testRequired=false`: Bestätigung genügt.
- `testRequired=true`: Test mit gespeichertem `passPercent` aus Assignment auswerten.
- Bei Nichtbestehen bleibt Assignment `in_progress`.
- Bei Bestehen genau einen `InstructionRecord` mit `source='internal_assignment'` erzeugen.
- Assignment `completed`, `completedAt`, `linkedRecordId` setzen.
- Wiederholter POST nach erfolgreichem Abschluss ist idempotent und erzeugt keinen zweiten Record.
- Audit für Start, fehlgeschlagene Prüfung, Abschluss.

### Schritt 3 – Unified Workflow UI

Wizard-Schritte:

1. Unterweisung
2. Zielgruppe
3. Durchführungsart (`internal`, `planned`, `external`)
4. Termin/Frist
5. Versand/Bestätigung
6. Ergebnis

Modus-spezifisch:

- internal -> `/assignments`, inklusive Test erforderlich/Bestehensgrenze.
- planned -> `/planned-trainings`.
- external -> `/invitations`, Mailmodus `manual|outlook|graph` bleibt erhalten; Default bleibt Firmenkonfiguration/`manual`.

Der externe Workflow enthält außerdem die bisherige externe Einladungs-/Abschlusshistorie mit Status, Testergebnis, Ablauf, Abschluss und Nachweis, damit `external-fix-v12.js` später vollständig entfallen kann.

Keine Browser-`prompt()`-Dialoge.

### Schritt 4 – Externe Leseseite modernisieren

`frontend/external/instruction.html` verwendet denselben fachlichen Content-Block-Stil wie der interne Player, behält aber Token-Vertrag und eigenen öffentlichen Ablauf. `externalInstruction.js` liefert nur Bild-SAS-URLs für Content-Image-Files, die zum eingeladenen InstructionType gehören.

### Schritt 5 – GREEN

```bash
cd api && npm test
cd .. && node --test tests/v040-instruction-workflow.test.js
node scripts/check-external-flow.js
npm test
```

### Schritt 6 – Commit

```bash
git add api/src/lib/instructionExecution.js api/src/functions/internalInstruction.js api/src/functions/externalInstruction.js api/src/functions/invitations.js api/test/instructionExecution.test.js frontend/instruction-workflow.js frontend/external/instruction.html tests/v040-instruction-workflow.test.js scripts/check-external-flow.js package.json
git commit -m "feat: internen und externen Unterweisungsworkflow vereinheitlichen"
```

---

# Paket 4 – Planung, Nachweise, Auswertungen und Benachrichtigungen

## Task 9: Kalenderplanung und echte Abschlussdialoge

**Dateien**

- Neu: `frontend/planning-calendar.js`
- Ändern: `api/src/functions/plannedTrainings.js`
- Ändern: `api/src/functions/mail.js`
- Neu: `tests/v040-planning-dialog.test.js`
- Ändern: `frontend/index.html`
- Ändern: `package.json`

### Schritt 1 – RED

Testet:

- Monats- und Wochenansicht benutzen denselben Planungsdatensatz.
- Kalenderkarte zeigt Unterweisung, Zeit, Teilnehmerzahl, Verantwortlichen, Status.
- Liste und Kalender können denselben Termin öffnen.
- Bearbeiten, Teilnehmer ergänzen, Mail senden, Abschließen, Stornieren.
- Abschluss nutzt `<dialog>`/Portal-Dialog mit Datum, Dauer, Notiz; kein `prompt(` in neuem Planungsmodul.
- Line Manager kann nur Teamteilnehmer speichern/senden/abschließen.
- Gemischte HSE-Planung mit fremden Teilnehmern darf Line Manager zwar mit auf sein Team reduzierter Anzeige sehen, aber nicht ändern, versenden oder komplett abschließen.
- Mail-Endpunkt versendet keine Einladung an außerhalb des Scopes manipulierte Teilnehmer.

```bash
node --test tests/v040-planning-dialog.test.js
```

### Schritt 2 – Kalender-/Listenmodell implementieren

Pure Helpers:

```js
planningRowsForMonth(rows, year, month)
planningRowsForWeek(rows, anchorDate)
planningCalendarModel(rows, mode, anchorDate)
```

### Schritt 3 – Dialoge implementieren

- Edit-Dialog.
- Complete-Dialog.
- Cancel-Bestätigung als eigener Dialog.
- Fehler innerhalb des Dialogs; Eingaben bleiben bei Fehler erhalten.

### Schritt 4 – GREEN

```bash
node --test tests/v040-planning-dialog.test.js
npm test
```

### Schritt 5 – Commit

```bash
git add frontend/planning-calendar.js api/src/functions/plannedTrainings.js api/src/functions/mail.js tests/v040-planning-dialog.test.js frontend/index.html package.json
git commit -m "feat: Planung als Kalender und Dialogworkflow umsetzen"
```

---

## Task 10: Nachweiszentrum, Auswertungen und Benachrichtigungsglocke

**Dateien**

- Neu: `frontend/proof-center.js`
- Neu: `frontend/report-center.js`
- Neu: `frontend/notification-center.js`
- Ändern: `api/src/functions/managerReport.js`
- Ändern: `frontend/index.html`
- Neu: `tests/v040-proof-report-notifications.test.js`
- Ändern: `package.json`

### Schritt 1 – RED

Proof-Center:

- Zeilen: Mitarbeiter, Unterweisung, Abschluss, Gültigkeit, Nachweisstatus, Datei, Aktion.
- Employee nur eigene Daten.
- Line Manager nur Team.
- Uploadfehler löscht keinen gewählten Kontext.

Reports:

- Erfüllungsquote gesamt.
- Status nach Unterweisung.
- Status nach Bereich.
- Status nach Führungskraft.
- Fälligkeiten/Überfällig.
- fehlende Nachweise.
- abgeschlossene Unterweisungen.
- CSV-Export aus aktuell gefiltertem, gescoptem Modell.

Notifications:

- überfällig.
- bald fällig.
- Nachweis fehlt.
- Gruppenunterweisung steht bevor.
- Assignment-Frist steht bevor.
- externer Link läuft bald ab (nur Rollen, die Einladungen sehen dürfen).
- Diagnosehinweis nur bei `system_admin` oder `diagnostics.view`.
- Klick führt zum korrekten Deep Link.

```bash
node --test tests/v040-proof-report-notifications.test.js
```

### Schritt 2 – Proof-/Report-Module implementieren

Kein eigener unsicherer Datenfetch: Module verwenden scoped Bootstrap/Status bzw. die serverseitig gescopten Report-/Proof-Endpunkte.

`managerReport.js` wird für Team-Scope nicht über eine ungefilterte Firmenaggregation beantwortet; der Teilnehmer-/Employee-Scope ist Bestandteil der Query.

### Schritt 3 – Notification-Modell

```js
buildPortalNotifications({ me, statusRows, assignments, plannedTrainings, invitations, diagnostics })
```

Domainmeldungen werden clientseitig aus bereits gescopten Daten abgeleitet. Diagnose wird nur bei Berechtigung über vorhandene `/diagnostics/latest-critical` API nachgeladen.

### Schritt 4 – GREEN

```bash
node --test tests/v040-proof-report-notifications.test.js
npm test
```

### Schritt 5 – Commit

```bash
git add frontend/proof-center.js frontend/report-center.js frontend/notification-center.js api/src/functions/managerReport.js frontend/index.html tests/v040-proof-report-notifications.test.js package.json
git commit -m "feat: Nachweise Auswertungen und Benachrichtigungen bündeln"
```

---

# Paket 5 – Verwaltung, Smartphone, Altcode-Bereinigung und Release

## Task 11: Verwaltung in einem Bereich bündeln

**Dateien**

- Neu: `frontend/admin-center.js`
- Neu: `frontend/system-admin.js`
- Neu: `frontend/diagnostics-entry.js`
- Ändern: `frontend/index.html`
- Neu: `tests/v040-admin-center.test.js`
- Ändern: `package.json`

Unverändert weiterverwendete Fachrenderer, die keine primäre Navigation injizieren:

- `frontend/employee-management-v18.js`
- `frontend/instruction-type-management-v23.js`
- `frontend/user-management-v19.js`
- `frontend/company-settings-v15.js`

`admin-center.js` stellt für diese Renderer eindeutige Mount-Container mit den bestehenden IDs `employees`, `instructions`, `users` und `companies` bereit. Betrieb/Sicherheit werden ebenfalls als Admin-Unterbereiche gemountet. Es gibt keine doppelten IDs außerhalb des aktiven Admin-Bereichs.

### Schritt 1 – RED

Testet Rollenmatrix für Admin-Unterbereiche:

- Employee: keine Verwaltung.
- Line Manager: keine Benutzer-/Firmen-/Sicherheitsverwaltung; fachliche Planung bleibt außerhalb Admin.
- HSE/Firmenadmin: erlaubte Firmenstammdaten gemäß bestehender Rollenregeln.
- Systemadmin: Firma, Benutzer/Rollen, Betrieb, Sicherheit, Diagnose.
- Diagnostics-Unterbereich nur mit `system_admin` oder `diagnostics.view`.
- Kein Skript injiziert dynamisch einen zusätzlichen primären Tab.
- Bestehende Fachrenderer finden genau einen vorgesehenen Mount-Container.

```bash
node --test tests/v040-admin-center.test.js
```

### Schritt 2 – Legacy-Funktionen ohne Router-Hooks mounten

`admin-center.js` rendert Untermenüs und ruft bestehende Renderer gezielt auf. `system-admin.js` übernimmt die funktionalen Teile aus `system-admin-v16.js`, aber ohne globale `render`-/`renderUserInfo`-Wrapper, Timeouts oder Tab-Injektion. `diagnostics-entry.js` rendert ausschließlich den berechtigten Einstieg in die separate PWA.

### Schritt 3 – GREEN

```bash
node --test tests/v040-admin-center.test.js
npm test
```

### Schritt 4 – Commit

```bash
git add frontend/admin-center.js frontend/system-admin.js frontend/diagnostics-entry.js frontend/index.html tests/v040-admin-center.test.js package.json
git commit -m "feat: Verwaltung in v040 Admin Center bündeln"
```

---

## Task 12: Smartphone, Legacy-Overrides entfernen und Testkette umstellen

**Dateien**

- Ändern: `frontend/portal-v040.css`
- Ändern: `frontend/index.html`
- Ändern: `scripts/check-main-layout.js`
- Ändern: `scripts/check-system-admin.js`
- Löschen nach Ersatz:
  - `frontend/role-guard-v20.js`
  - `frontend/tenant-context-v36.js`
  - `frontend/status-worklist-v25.js`
  - `frontend/planning-management-v24.js`
  - `frontend/manager-report-v28.js`
  - `frontend/proof-management-v29.js`
  - `frontend/reminder-center-v30.js`
  - `frontend/design-polish-v31.js`
  - `frontend/dashboard-design-v32.js`
  - `frontend/table-form-design-v33.js`
  - `frontend/view-header-design-v34.js`
  - `frontend/professional-suite-v35.js`
  - `frontend/diagnostics-entry-v37.js`
  - `frontend/system-admin-v16.js`
  - `frontend/external-fix-v12.js`
  - `frontend/view-header-design-v34.css`
  - `frontend/professional-suite-v35.css`
- Löschen/ersetzen alte Check-Skripte, sobald neue Tests dieselben Verträge abdecken:
  - `scripts/check-role-guard.js`
  - `scripts/check-planning-management.js`
  - `scripts/check-status-worklist.js`
  - `scripts/check-manager-report.js`
  - `scripts/check-proof-management.js`
  - `scripts/check-reminder-center.js`
  - `scripts/check-design-polish.js`
  - `scripts/check-dashboard-design.js`
  - `scripts/check-table-form-design.js`
  - `scripts/check-view-header-design.js`
  - `scripts/check-professional-suite.js`
- Neu: `tests/v040-responsive-migration.test.js`
- Ändern: `package.json`

### Schritt 1 – RED Responsive/Migrationsvertrag

Test fordert:

- Desktop: sieben primäre Views, feste/klare Seitenleiste ohne Clipping.
- <= 760 px: primär `Start`, `Aufgaben`, `Unterweisungen`, `Mehr`.
- Tabellen des Work-/Proof-Centers werden zu bedienbaren Karten oder haben explizit kontrolliertes Scrolling ohne Viewport-Überlauf.
- Touch-Ziele mindestens ca. 44 px bei primären Aktionen.
- Planungsdialog und Inhaltseditor sind auf Smartphone vollständig bedienbar.
- Externe Unterweisungsseite rendert strukturierte Bild-/Textblöcke responsiv.
- kein alter Override-Skriptname mehr in `index.html`.
- keine `setInterval(applyRoleVisibility...)`, `render = function`-Monkey-Patches oder v35-Suite-Aktivierung mehr im aktiven Frontend.
- Login-Gate bleibt unangetastet sicher.

```bash
node --test tests/v040-responsive-migration.test.js
```

### Schritt 2 – Mobile CSS/Navigation finalisieren

- Bottom-/Top-Mobilnavigation für vier Primärpunkte.
- `Mehr` öffnet erlaubte zusätzliche Bereiche/Verwaltung.
- Formulare einspaltig.
- Dialoge als nahezu Vollbild auf Smartphone.
- Kalender wechselt auf kompakte Wochen-/Agenda-Darstellung.
- Inhaltseditor verwendet explizite Auf/Ab-Buttons statt Touch-Drag-Zwang.
- Keine horizontale Seitenverschiebung.

### Schritt 3 – Altcode nur nach grüner Ersatzabdeckung löschen

Vor jeder Löschgruppe:

```bash
npm test
```

Nach der Löschgruppe erneut:

```bash
npm test
```

Wenn ein alter Check noch einen echten Fachvertrag schützt, wird der Vertrag in einen v0.40-Test übertragen, bevor das Check-Skript entfernt wird. `scripts/check-main-layout.js` und `scripts/check-system-admin.js` werden auf v0.40-Shell/Admin-Verträge umgeschrieben und bleiben Teil der Testkette.

### Schritt 4 – package.json bereinigen

- `pretest`: alle neuen v0.40-Tests verbindlich aufnehmen.
- `test`: entfernte alte Check-Skripte aus der Kette nehmen.
- `version`: auf `0.40.0` setzen.
- `frontend/index.html` sichtbare Version auf `v0.40.0`.

### Schritt 5 – GREEN

```bash
node --test tests/v040-responsive-migration.test.js
npm test
```

### Schritt 6 – Commit

```bash
git add -A
git commit -m "refactor: alte UI Overrides durch v040 Portal ersetzen"
```

---

## Task 13: Deployment-Verifikation und Release-Gate

**Dateien**

- Ändern: `.github/workflows/azure-static-web-apps.yml`
- Neu: `tests/v040-deploy-contract.test.js`
- Ändern: `package.json`

### Schritt 1 – RED Deployment-Vertrag

Test verlangt, dass Workflow zusätzlich zu bestehender Diagnostics-Prüfung folgende deployte Assets bytegenau bzw. mit korrektem MIME prüft:

- `/index.html`
- `/portal-v040.css`
- `/portal-shell.js`
- `/portal-dashboard.js`
- `/work-center.js`
- `/instruction-workflow.js`
- `/instruction-player.js`
- `/instruction-content-editor.js`
- `/planning-calendar.js`

```bash
node --test tests/v040-deploy-contract.test.js
```

### Schritt 2 – Workflow erweitern

Nach `Build And Deploy` neue Prüfung `Verify v0.40 portal assets`. Bestehende Diagnostics-PWA-Prüfung bleibt erhalten.

Für Main-Push bleibt Reihenfolge:

1. Dependencies
2. `npm test`
3. `npm run db:migrate`
4. Azure-Konfiguration
5. Deploy
6. Diagnostics-Verifikation
7. v0.40-Asset-Verifikation

### Schritt 3 – Gesamtverifikation lokal/CI-Vorbereitung

```bash
npm test
```

Erwartung: vollständige Testkette grün. Kein Produktionsclaim nur aufgrund lokaler Tests.

### Schritt 4 – PR erstellen

PR von `v040-workportal-management-cockpit` nach `main` mit Zusammenfassung:

- Rollen-/Team-Sicherheit
- neue Portalstruktur
- interne Assignments und Erinnerungen
- strukturierte Inhalte/Bilder + Editor
- interne/geplante/externe Abläufe
- Planung/Nachweise/Reports/Notifications
- entfernte Override-Schichten
- Migration 011
- Testanzahl und Ergebnis

### Schritt 5 – PR-CI auswerten

PR muss `npm test` vollständig grün haben. Azure Static Web Apps Preview wird verifiziert, sofern ein Preview-Slot verfügbar ist.

Bekannte Infrastrukturbedingung: Azure SWA kann wegen ausgeschöpfter Staging-/Preview-Umgebungen mit „maximum number of staging environments reached“ scheitern. Dieser Fehler darf nur dann als Infrastrukturblocker klassifiziert werden, wenn alle Code-/Testschritte davor grün sind und der Azure-Fehler exakt die Preview-Quota betrifft. Keine zufälligen Preview-Umgebungen löschen und die Demo-PR nicht beschädigen.

### Schritt 6 – Vor Merge Main neu prüfen

Unmittelbar vor Merge:

```text
main-HEAD erneut laden und mit Branch-Basis vergleichen.
```

Falls `main` seit `f2de6c...` weitergelaufen ist, aktuelle Main-Änderungen zuerst in v0.40 integrieren und danach `npm test` erneut vollständig ausführen. Insbesondere Login-Hard-Boundary und ggf. inzwischen gemergte Login-/SQL-Warmup-Optimierung dürfen nicht überschrieben werden.

### Schritt 7 – Merge und Produktion

Nach Merge auf `main` muss der Main-Workflow frisch vollständig grün sein:

- Tests grün.
- Migration `011_v040_workportal.sql` erfolgreich.
- Azure Deploy erfolgreich.
- Diagnostics-PWA erfolgreich geprüft.
- v0.40 Portal-Assets erfolgreich geprüft.

Erst danach gilt v0.40 als produktiv bereitgestellt.

### Schritt 8 – Smoke-Checks nach Deployment

Mit echten Rollen/Firmenkontexten prüfen:

1. Systemadmin -> Firmenauswahl, keine Firmendaten vor Auswahl.
2. Firmenadmin -> nur eigene Firma, Management-Cockpit.
3. Line Manager -> nur eigenes Team, manipulierte Employee-ID wird serverseitig 403.
4. Employee -> nur eigene Aufgaben/Nachweise.
5. Interne Zuweisung -> starten -> Test -> Abschluss -> Record/Nachweis.
6. Interne Erinnerung -> Mailmodus korrekt, Zähler nur bei bestätigtem Graph-Versand.
7. Gruppenplanung -> Mail -> Abschluss ohne Browser-Prompt.
8. Externer Link -> ohne normales Konto -> Inhalt/Bilder -> Test -> Abschluss.
9. Inhaltseditor -> Text/Bild/Hinweis speichern und wieder öffnen.
10. KPI -> korrekte gefilterte Arbeitsliste.
11. Smartphone -> vier Primärpunkte und touchfähige Abläufe.
12. Firmenwechsel Systemadmin -> kein alter Firmeninhalt blitzt auf.

### Schritt 9 – Finaler Commit vor PR, falls Workflow-Vertrag separat geändert wurde

```bash
git add .github/workflows/azure-static-web-apps.yml tests/v040-deploy-contract.test.js package.json
git commit -m "ci: v040 Portal Deployment verbindlich verifizieren"
```

---

# Testmatrix für v0.40

| Bereich | Employee | Line Manager | HSE/Firmenadmin | Systemadmin |
|---|---|---|---|---|
| Firmenkontext | eigene Firma | eigene Firma | eigene Firma | ausgewählte Firma |
| Employee-Daten | nur selbst | selbst + direktes Team | Firma | ausgewählte Firma |
| Dashboard | persönliche Arbeit | eigene + Teamarbeit | Management | Firmenauswahl/Management |
| Intern zuweisen | nein | Team | Firma | ausgewählte Firma |
| Interne Ausführung | eigene Assignments | eigene Assignments | eigene Assignments falls Employee-Zuordnung | eigene Assignments nach Firmenauswahl falls Employee-Zuordnung |
| Planen | nein | Team | Firma | ausgewählte Firma |
| Extern versenden | nein | Team/verknüpft + freie externe Mail | Firma | ausgewählte Firma |
| Nachweise | eigene | Team | Firma | ausgewählte Firma |
| Reports | eigene Historie im persönlichen Bereich | Team | Firma | ausgewählte Firma |
| Verwaltung | nein | nein | gemäß Fachrolle | vollständig |
| Diagnostics | nur explizit, falls freigegeben | nur explizit, falls freigegeben | nur explizit, falls freigegeben | ja |

# Nicht verändern

- Azure-SQL-Tarif / Auto-Pause-Konfiguration.
- Grundlegende Tenant-Struktur.
- Sichere Tokenlogik externer Unterweisungen.
- Quarantäne-/Scan-Sperren für Dateien.
- Login-Hard-Boundary.
- Demo-/andere Preview-PRs nur zur Freigabe eines Azure-Slots.

# Abschlusskriterium

v0.40 ist abgeschlossen, wenn sämtliche neuen und bestehenden Tests grün sind, die serverseitige Self-/Team-/Company-Abgrenzung nachweislich greift, die alten UI-Override-Schichten aus der aktiven Anwendung entfernt sind, interne/geplante/externe Unterweisungen über die neue Oberfläche vollständig funktionieren, professionelle Inhalte inklusive Bildblöcken über den Editor gepflegt werden können und ein frischer Produktionsworkflow inklusive SQL-Migration und Asset-Verifikation erfolgreich abgeschlossen wurde.
