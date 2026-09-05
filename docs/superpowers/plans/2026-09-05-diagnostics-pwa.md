# Fehlerdiagnose-PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine installierbare Diagnose-PWA mit mandantensicherem Zugriffsrecht, zentraler Fehlererfassung, JSON-Diagnoseexport sowie kritischer E-Mail- und Web-Push-Eskalation ausschließlich an Systemadmins bauen.

**Architecture:** Die bestehende Azure-Functions-API bleibt die Sicherheitsgrenze. Eine neue Migration ergänzt `UserPermissions`, `DiagnosticEvents` und `PushSubscriptions`; ein fokussiertes Diagnosemodul kapselt Berechtigungen, Ereignisse und Benachrichtigungen. Die separate `/diagnostics.html`-PWA nutzt dieselbe Passwort-/Entra-Sitzung und erhält über `/api/me` das Recht `diagnostics.view`.

**Tech Stack:** JavaScript/Node.js 22, Azure Functions v4, Azure SQL (`mssql`), bestehende Microsoft-Graph-Mailfunktion, Web Push/VAPID mit Node `crypto` + `fetch`, HTML/CSS/Service Worker/PWA Manifest, Node Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-05-diagnostics-pwa.md`

## Global Constraints

- Gesamte sichtbare Oberfläche und Meldungen bleiben Deutsch.
- `system_admin` hat Diagnosezugriff implizit; alle anderen nur mit `diagnostics.view`.
- Nur Systemadmins dürfen `diagnostics.view` vergeben/entziehen.
- Delegierte Diagnosebenutzer sehen ausschließlich ihre eigene Firma.
- Kritisch = HTTP 5xx bzw. explizit kritischer Systemzustand; 4xx bleibt Warnung.
- Kritische Push-/E-Mail-Eskalation geht ausschließlich an aktive Systemadmins.
- Deduplizierung gleicher kritischer Meldungen: 10 Minuten.
- Keine Passwörter, Cookies, Session-/Setup-Tokens, Secrets oder Request-Bodies in Diagnoseereignissen oder Exporten.
- Kein zusätzlicher privater VAPID-Schlüssel im Repository; Schlüsselmaterial wird kontextgetrennt aus `AUTH_SESSION_SECRET` abgeleitet.

---

### Task 1: Datenmodell und Diagnose-Berechtigung

**Files:**
- Create: `database/migrations/011_diagnostics_pwa.sql`
- Create: `api/src/lib/diagnosticAccess.js`
- Modify: `api/src/functions/me.js`
- Modify: `api/src/functions/users.js`
- Create: `api/src/functions/userDiagnosticPermissions.js`
- Test: `tests/diagnostics-permission-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `hasDiagnosticAccess(pool, ctx) -> Promise<boolean>`
- Produces: `assertDiagnosticAccess(pool, ctx) -> Promise<void>`
- Produces: `/api/me.permissions: string[]`
- Produces: `PUT|DELETE /api/users/{id}/permissions/diagnostics`

- [ ] **Step 1: Write the failing permission contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('database/migrations/011_diagnostics_pwa.sql','utf8');
const me = fs.readFileSync('api/src/functions/me.js','utf8');
const permissionApi = fs.readFileSync('api/src/functions/userDiagnosticPermissions.js','utf8');

test('diagnostics permission is explicit and system-admin managed', () => {
  assert.match(migration, /CREATE TABLE dbo\.UserPermissions/i);
  assert.match(migration, /diagnostics\.view/i);
  assert.match(me, /permissions/);
  assert.match(permissionApi, /Roles\.SYSTEM_ADMIN/);
});
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test tests/diagnostics-permission-contract.test.js`
Expected: FAIL because migration/helper/API do not exist.

- [ ] **Step 3: Add idempotent SQL objects**

Create tables:

```sql
UserPermissions(companyId,userId,permissionKey,grantedBy,grantedAt)
DiagnosticEvents(id,companyId,actorUserId,severity,area,action,errorMessage,errorCode,apiPath,httpMethod,httpStatus,userAgent,appVersion,dedupeKey,detailsJson,createdAt,alertedAt,alertResultJson)
PushSubscriptions(id,userId,endpoint,endpointHash,createdAt,updatedAt,lastSuccessAt,lastErrorAt,lastError)
```

Add indexes on `DiagnosticEvents(createdAt DESC)`, `(companyId,createdAt DESC)`, `(dedupeKey,createdAt DESC)` and unique `PushSubscriptions(endpointHash)`.

- [ ] **Step 4: Implement permission helper and APIs**

```js
export async function hasDiagnosticAccess(pool, ctx) {
  if (ctx.roles?.includes(Roles.SYSTEM_ADMIN)) return true;
  if (!ctx.companyId || !ctx.userId) return false;
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('userId', sql.NVarChar(120), ctx.userId)
    .query("SELECT TOP 1 1 AS allowed FROM UserPermissions WHERE companyId=@companyId AND userId=@userId AND permissionKey='diagnostics.view'");
  return !!result.recordset.length;
}
```

`PUT` inserts/merges the permission; `DELETE` removes it. Both require `Roles.SYSTEM_ADMIN` and validate that the target user belongs to the requested company.

- [ ] **Step 5: Expose permission state**

`/api/me` returns `permissions: ['diagnostics.view']` for systemadmins and for users with the explicit row. `/api/users` returns `diagnosticsView` per row via `EXISTS` against `UserPermissions`.

- [ ] **Step 6: Run permission tests GREEN and commit**

Run: `node --test tests/diagnostics-permission-contract.test.js && npm run api:test`
Expected: PASS.

Commit: `feat: add diagnostics permission model`

---

### Task 2: Diagnoseereignisse, Filter und Export

**Files:**
- Create: `api/src/lib/diagnostics.js`
- Create: `api/src/functions/diagnostics.js`
- Modify: `api/src/functions/operations.js`
- Test: `tests/diagnostics-api-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `recordDiagnosticEvent(pool, ctx, input) -> Promise<DiagnosticEvent>`
- Produces: `GET /api/diagnostics/events`
- Produces: `POST /api/diagnostics/events`
- Produces: `GET /api/diagnostics/export`
- Produces: `GET /api/diagnostics/latest-critical`
- Produces: `GET /api/diagnostics/status`

- [ ] **Step 1: Write failing diagnostics API tests**

```js
test('diagnostics API classifies 5xx as critical and exports sanitized data', () => {
  assert.match(source, /httpStatus\s*>?=\s*500[\s\S]*critical/);
  assert.match(source, /diagnostics\/export/);
  assert.doesNotMatch(source, /requestBody|passwordHash|setupToken/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/diagnostics-api-contract.test.js`
Expected: FAIL because diagnostics API is missing.

- [ ] **Step 3: Implement server-side classification and sanitization**

```js
export function diagnosticSeverity(input) {
  const status = Number(input?.httpStatus || 0);
  if (status >= 500) return 'critical';
  if (status >= 400) return 'warning';
  return 'info';
}

export function safeDiagnosticInput(input={}) {
  return {
    area: clean(input.area, 120),
    action: clean(input.action, 160),
    errorMessage: clean(input.errorMessage, 2000),
    errorCode: clean(input.errorCode, 120),
    apiPath: clean(input.apiPath, 500),
    httpMethod: clean(input.httpMethod, 16),
    httpStatus: Number(input.httpStatus || 0),
    appVersion: clean(input.appVersion, 60)
  };
}
```

No request body or token-like field is accepted.

- [ ] **Step 4: Implement tenant-safe list/export/status**

Systemadmins may omit `companyId` to see all companies; non-systemadmins are forced to `ctx.companyId`. Export returns JSON with metadata + filtered events and `Content-Disposition: attachment`.

- [ ] **Step 5: Integrate critical health failures**

When the existing operations healthcheck returns SQL/Blob/API-critical failure, write one diagnostic event through `recordDiagnosticEvent` without storing secrets.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test tests/diagnostics-api-contract.test.js && npm run api:test`
Expected: PASS.

Commit: `feat: add diagnostic event API and export`

---

### Task 3: Kritische E-Mail- und Web-Push-Eskalation

**Files:**
- Create: `api/src/lib/webPush.js`
- Create: `api/src/lib/diagnosticAlerts.js`
- Modify: `api/src/functions/diagnostics.js`
- Test: `tests/diagnostics-alert-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `getVapidPublicKey() -> string`
- Produces: `sendEmptyWebPush(endpoint, options) -> Promise<{ok,status}>`
- Produces: `notifyCriticalDiagnostic(pool, event) -> Promise<object>`
- Produces: `GET /api/diagnostics/push/config`
- Produces: `POST|DELETE /api/diagnostics/push/subscriptions`

- [ ] **Step 1: Write failing alert contract test**

```js
test('critical alerts target system admins only and deduplicate for ten minutes', () => {
  assert.match(alerts, /role\s*=\s*'system_admin'/i);
  assert.match(alerts, /10\s*\*\s*60/);
  assert.match(alerts, /sendGraphMail/);
  assert.match(alerts, /sendEmptyWebPush/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/diagnostics-alert-contract.test.js`
Expected: FAIL because alert modules are missing.

- [ ] **Step 3: Derive a stable VAPID key with key separation**

Use `AUTH_SESSION_SECRET` only as input to `HMAC-SHA256('unterweisungsmanager:vapid:v1')`, reduce the digest into the P-256 scalar range, derive the public point with `crypto.createECDH('prime256v1')`, and sign VAPID JWTs with ES256. Never write the private scalar to logs or responses.

- [ ] **Step 4: Implement empty-payload Web Push**

POST the subscription endpoint with headers `TTL`, `Urgency`, `Authorization: vapid ...`, and `Crypto-Key: p256ecdsa=...`. Treat 404/410 as expired subscription.

- [ ] **Step 5: Implement systemadmin-only subscriptions and alerts**

Only `Roles.SYSTEM_ADMIN` may read push config or create/delete a subscription. For a critical diagnostic event, query active `Users.role='system_admin'`, send Graph email and push to their stored subscriptions. Query the same `dedupeKey` for `alertedAt >= DATEADD(MINUTE,-10,SYSUTCDATETIME())`; if found, log the new event but skip duplicate alerts.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test tests/diagnostics-alert-contract.test.js && npm run api:test`
Expected: PASS.

Commit: `feat: alert system admins on critical diagnostics`

---

### Task 4: Diagnose-PWA und Android-Push-Aktivierung

**Files:**
- Create: `frontend/diagnostics.html`
- Create: `frontend/diagnostics.css`
- Create: `frontend/diagnostics-app.js`
- Create: `frontend/diagnostics-sw.js`
- Create: `frontend/diagnostics.webmanifest`
- Create: `frontend/diagnostics-icon.svg`
- Test: `tests/diagnostics-pwa-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `/api/me`, `/api/diagnostics/status`, `/api/diagnostics/events`, `/api/diagnostics/export`, `/api/diagnostics/push/config`, `/api/diagnostics/push/subscriptions`
- Produces: installierbare `/diagnostics.html`

- [ ] **Step 1: Write failing PWA contract test**

```js
test('diagnostics page is installable and can activate push', () => {
  assert.match(html, /rel="manifest" href="\/diagnostics\.webmanifest"/);
  assert.match(app, /serviceWorker\.register\('\/diagnostics-sw\.js'\)/);
  assert.match(app, /pushManager\.subscribe/);
  assert.match(sw, /self\.addEventListener\('push'/);
  assert.match(sw, /showNotification/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/diagnostics-pwa-contract.test.js`
Expected: FAIL because PWA files do not exist.

- [ ] **Step 3: Build German diagnostics UI**

Page shows Systemstatus (API, SQL, Blob, Mail, Auth), counters for Kritisch/Warnung/Info, filters (Firma/Schwere/Suche), event table, detail area, `Aktualisieren`, `Diagnosepaket herunterladen`, `Handy-Benachrichtigungen aktivieren` and `Zurück zum Unterweisungsmanager`.

- [ ] **Step 4: Implement push activation**

```js
const registration = await navigator.serviceWorker.register('/diagnostics-sw.js');
const config = await api('/diagnostics/push/config');
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(config.publicKey)
});
await api('/diagnostics/push/subscriptions', {method:'POST', body:JSON.stringify({endpoint:subscription.endpoint})});
```

Request `Notification` permission only after explicit button click.

- [ ] **Step 5: Implement Service Worker notification**

On `push`, try `GET /api/diagnostics/latest-critical` with same-origin credentials and show a German notification. On click, focus/open `/diagnostics.html`.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test tests/diagnostics-pwa-contract.test.js`
Expected: PASS.

Commit: `feat: add installable diagnostics PWA`

---

### Task 5: Einstieg, Rechteverwaltung und automatische Fehlererfassung

**Files:**
- Create: `frontend/diagnostics-entry-v37.js`
- Modify: `frontend/index.html`
- Modify: `frontend/user-management-v19.js`
- Modify: `frontend/app.js`
- Modify: `frontend/role-guard-v20.js`
- Test: `tests/diagnostics-ui-integration.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `state.me.permissions`, `state.users[].diagnosticsView`
- Produces: sichtbarer Diagnose-Einstieg nur bei Recht
- Produces: Systemadmin-Schalter zum Vergeben/Entziehen von `diagnostics.view`
- Produces: automatische POST-Erfassung von fehlgeschlagenen API-Aufrufen ohne Rekursion

- [ ] **Step 1: Write failing UI integration test**

```js
test('main UI exposes diagnostics only with permission and reports API failures safely', () => {
  assert.match(entry, /diagnostics\.view/);
  assert.match(users, /permissions\/diagnostics/);
  assert.match(app, /reportApiDiagnostic/);
  assert.doesNotMatch(app, /body:\s*options\.body/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/diagnostics-ui-integration.test.js`
Expected: FAIL.

- [ ] **Step 3: Add navigation entry and user permission control**

Add hidden `Fehlerdiagnose` button to the main navigation. `diagnostics-entry-v37.js` shows it when `system_admin` or `state.me.permissions.includes('diagnostics.view')`. In user management, only systemadmin sees `Diagnose freigeben/entziehen` action.

- [ ] **Step 4: Instrument the central API helper**

On non-OK API responses, call a raw `fetch('/api/diagnostics/events', ...)` with only path, method, HTTP status, error message/code, area/action and app version. Never include `options.body`, headers, cookies or tokens. Do not report failures whose path already begins with `/diagnostics` to avoid recursion.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test tests/diagnostics-ui-integration.test.js && npm test`
Expected: complete suite PASS.

Commit: `feat: integrate diagnostics into main application`

---

### Task 6: Deployment-Vertrag, Migration und End-to-End-Verifikation

**Files:**
- Modify: `staticwebapp.config.json`
- Test: `tests/diagnostics-deploy-contract.test.js`
- Modify: `package.json`
- Temporary during branch verification only: `.github/workflows/diagnostics-pwa-test.yml` (must be removed before integration)

**Interfaces:**
- Produces: correct PWA manifest MIME type and static-file delivery
- Produces: full branch verification in GitHub Actions

- [ ] **Step 1: Add failing deploy contract test**

```js
test('deployment serves manifest and service worker as static assets', () => {
  assert.equal(config.mimeTypes['.webmanifest'], 'application/manifest+json');
  assert.ok(config.navigationFallback.exclude.includes('*.webmanifest'));
});
```

- [ ] **Step 2: Run RED, then update deployment config**

Add `.webmanifest` MIME type and navigation-fallback exclusion. Existing `.js` exclusion keeps the service worker static.

- [ ] **Step 3: Run complete branch suite in GitHub Actions**

Temporary workflow checks out `feature-diagnostics-pwa`, installs root/API dependencies and executes `npm test`. Verify exact tested SHA and zero failures.

- [ ] **Step 4: Remove temporary workflow and compare final diff**

Final branch must contain no temporary diagnostic/test workflow and only intended application, migration, test and documentation files.

- [ ] **Step 5: Production integration after user approval**

After the user chooses integration, fast-forward/merge to `main`, run the SQL migration `011_diagnostics_pwa.sql` via the guarded migration mechanism, wait for both Static Web Apps and Azure Functions deployments for the exact `main` SHA, then verify `/diagnostics.html`, `/api/diagnostics/status` and push configuration. Do not claim Push is operational on a phone until the user has explicitly granted Android notification permission and a subscription exists.

---

## Self-Review

- Spec coverage: permissions, tenant isolation, structured diagnostics, export, PWA, Graph email, Web Push, systemadmin-only alerts, 10-minute dedupe and redaction are mapped to Tasks 1–5.
- Placeholder scan: no TBD/TODO/future implementation placeholders are used in required tasks.
- Interface consistency: `diagnostics.view`, `/api/diagnostics/*`, `state.me.permissions`, `diagnosticsView`, `getVapidPublicKey` and `sendEmptyWebPush` use the same names throughout.
- Deployment safety: production migration/deploy remains gated until final integration approval; branch work does not touch production data.
