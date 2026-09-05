# Sichere Passwort-Setup-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen sicheren Erstzugang für den bestehenden Systemadmin ohne Microsoft-Login ermöglichen und denselben einmaligen Setup-Link-Mechanismus anschließend für Benutzer wie Andreas Zohren bereitstellen.

**Architecture:** Die bestehende zentrale Loginseite bleibt der einzige Einstieg. Ein 256-Bit-Roh-Token wird ausschließlich im Browserfragment `#passwordSetup=...` transportiert; serverseitig wird nur SHA-256 gespeichert. Ein anonymer Consume-Endpunkt setzt das Passwort atomar und verbraucht den Token, während ein geschützter Admin-Endpunkt neue Setup-Links für verwaltbare Benutzer erzeugt. Für den allerersten Betreiberzugang wird ein einmaliger Hash-only Seed ausgeführt, dessen Roh-Token außerhalb von GitHub/SQL erzeugt und nur dem Betreiber mitgeteilt wird.

**Tech Stack:** Azure Static Web Apps, Azure Functions v4, Node.js 22, Azure SQL (`mssql`), Web Crypto/Node `crypto`, bestehendes scrypt-Passwortmodul, Vanilla JavaScript Frontend, Node `--test`-Vertragstests.

**Spec:** `docs/superpowers/specs/2026-09-05-password-setup-links-design.md`

## Global Constraints

- Eine einzige zentrale interne Website; keine zweite Firmen-, Admin- oder Mitarbeiter-URL.
- Keine offene Registrierung und kein öffentliches Endpoint, das anhand einer E-Mail einen Setup-Link zurückgibt.
- Roh-Setup-Token nie in SQL, Repository, Logs, Analytics oder Referrer schreiben.
- Setup-Token ausschließlich als URL-Fragment `#passwordSetup=<RAW_TOKEN>` transportieren.
- Token mindestens 256 Bit Entropie, standardmäßig 30 Minuten gültig, einmalig verwendbar.
- Passwörter 10–256 Zeichen, ausschließlich scrypt-Hash speichern.
- Passwortänderung erhöht `sessionVersion`, setzt Sperrzähler zurück und widerruft alle übrigen Setup-Tokens des Benutzers.
- `company_admin` darf niemals einen `system_admin` ändern, sperren, zurücksetzen oder einen Setup-Link für ihn erzeugen.
- Mandanten- und Rollenprüfung ausschließlich serverseitig autoritativ.
- Der bestehende Login-Gate bleibt fail-closed: ohne Authentifizierung/Firmenkontext kein Dashboard und keine Firmendaten.
- Microsoft Graph Mail ist nicht Teil dieses Plans; Setup-Link wird zunächst manuell kopiert.
- `main` erst nach vollständigem GREEN-Lauf und Live-Rollout-Gate verändern.

---

### Task 1: Persistenz und Token-Domainmodul

**Files:**
- Create: `database/migrations/010_password_auth_and_setup_tokens.sql`
- Create: `api/src/lib/passwordSetup.js`
- Create: `tests/password-setup-token-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `hashSetupToken(rawToken: string): string`
- Produces: `createSetupToken(): string`
- Produces: `setupLink(rawToken: string, baseUrl?: string): string`
- Produces: SQL-Tabelle `dbo.PasswordSetupTokens`

- [ ] **Step 1: Write the failing token/schema contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('database/migrations/010_password_auth_and_setup_tokens.sql','utf8');
const helper = readFileSync('api/src/lib/passwordSetup.js','utf8');

test('migration adds password auth columns idempotently', () => {
  for (const name of ['passwordHash','passwordSetAt','failedLoginCount','lockedUntil','sessionVersion']) {
    assert.match(migration, new RegExp(`COL_LENGTH\\('dbo.Users','${name}'\\)`));
  }
});

test('migration creates hash-only setup token table', () => {
  assert.match(migration, /CREATE TABLE dbo\.PasswordSetupTokens/);
  assert.match(migration, /tokenHash NVARCHAR\(128\) NOT NULL/);
  assert.doesNotMatch(migration, /rawToken|plainToken/i);
});

test('helper uses randomBytes and sha256 and fragment links', () => {
  assert.match(helper, /randomBytes\(32\)/);
  assert.match(helper, /createHash\('sha256'\)/);
  assert.match(helper, /#passwordSetup=/);
  assert.doesNotMatch(helper, /\?passwordSetup=/);
});
```

Register `tests/password-setup-token-contract.test.js` in `pretest`.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because migration/helper do not exist.

- [ ] **Step 3: Add the idempotent migration**

`database/migrations/010_password_auth_and_setup_tokens.sql` must contain this structure:

```sql
IF COL_LENGTH('dbo.Users','passwordHash') IS NULL
  ALTER TABLE dbo.Users ADD passwordHash NVARCHAR(600) NULL;
GO
IF COL_LENGTH('dbo.Users','passwordSetAt') IS NULL
  ALTER TABLE dbo.Users ADD passwordSetAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','failedLoginCount') IS NULL
  ALTER TABLE dbo.Users ADD failedLoginCount INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0;
GO
IF COL_LENGTH('dbo.Users','lockedUntil') IS NULL
  ALTER TABLE dbo.Users ADD lockedUntil DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','sessionVersion') IS NULL
  ALTER TABLE dbo.Users ADD sessionVersion INT NOT NULL CONSTRAINT DF_Users_SessionVersion DEFAULT 1;
GO

IF OBJECT_ID('dbo.PasswordSetupTokens','U') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordSetupTokens(
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    userId NVARCHAR(120) NOT NULL,
    companyId NVARCHAR(80) NOT NULL,
    tokenHash NVARCHAR(128) NOT NULL,
    purpose NVARCHAR(30) NOT NULL,
    expiresAt DATETIME2 NOT NULL,
    usedAt DATETIME2 NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_PasswordSetupTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_PasswordSetupTokens_TokenHash UNIQUE(tokenHash),
    CONSTRAINT CK_PasswordSetupTokens_Purpose CHECK(purpose IN ('initial_password','password_reset')),
    CONSTRAINT FK_PasswordSetupTokens_User FOREIGN KEY(userId) REFERENCES dbo.Users(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PasswordSetupTokens_User' AND object_id=OBJECT_ID('dbo.PasswordSetupTokens'))
  CREATE INDEX IX_PasswordSetupTokens_User ON dbo.PasswordSetupTokens(companyId,userId,usedAt,expiresAt);
GO
```

- [ ] **Step 4: Add focused token helpers**

`api/src/lib/passwordSetup.js`:

```js
import crypto from 'node:crypto';

export function createSetupToken(){
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSetupToken(rawToken){
  return crypto.createHash('sha256').update(String(rawToken || ''),'utf8').digest('hex');
}

export function setupLink(rawToken, baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL){
  const base = String(baseUrl || '').replace(/\/$/,'');
  if(!base) throw new Error('PUBLIC_BASE_URL oder APP_BASE_URL fehlt.');
  return `${base}/#passwordSetup=${encodeURIComponent(String(rawToken || ''))}`;
}
```

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add database/migrations/010_password_auth_and_setup_tokens.sql api/src/lib/passwordSetup.js tests/password-setup-token-contract.test.js package.json
git commit -m "feat(auth): add password setup token persistence"
```

---

### Task 2: Anonymer Consume-Endpunkt für Passwortsetzung

**Files:**
- Create: `api/src/functions/passwordSetup.js`
- Create: `tests/password-setup-api-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `hashSetupToken(rawToken)` from Task 1
- Consumes: `hashPassword(password)` from `api/src/lib/passwordAuth.js`
- Produces: `POST /api/auth/password/setup`

- [ ] **Step 1: Write the failing API contract**

The test must assert that `passwordSetup.js` contains:

```js
app.http('passwordSetupConsume', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/password/setup'
```

and SQL predicates equivalent to:

```sql
WHERE t.tokenHash=@tokenHash
  AND t.usedAt IS NULL
  AND t.expiresAt>SYSUTCDATETIME()
  AND u.active=1
```

It must also assert presence of `hashPassword`, `sessionVersion=sessionVersion+1`, `failedLoginCount=0`, `lockedUntil=NULL`, `passwordSetAt=SYSUTCDATETIME()`, token `usedAt`, and a transaction.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because endpoint file does not exist.

- [ ] **Step 3: Implement request validation and generic failure response**

Use:

```js
const body = await request.json().catch(() => ({}));
const token = String(body.token || '');
const password = String(body.password || '');
const passwordConfirm = String(body.passwordConfirm || '');
if(!token || token.length < 32) return badRequest('Setup-Link ist ungültig oder abgelaufen.');
if(password !== passwordConfirm) return badRequest('Die Passwörter stimmen nicht überein.');
```

Do not accept an email, user id or company id from the anonymous client.

- [ ] **Step 4: Load exactly one valid token/user row by hash**

Query only by `@tokenHash`; join `Users` through `t.userId` and `t.companyId`. Return the same `400` text `Setup-Link ist ungültig oder abgelaufen.` for missing, expired, used, inactive, or invalid-initial-state tokens.

For `purpose='initial_password'`, reject if `u.passwordHash IS NOT NULL` or `u.passwordSetAt IS NOT NULL`.

- [ ] **Step 5: Update password atomically**

Begin a SQL transaction, then:

```sql
UPDATE dbo.Users
SET passwordHash=@passwordHash,
    passwordSetAt=SYSUTCDATETIME(),
    failedLoginCount=0,
    lockedUntil=NULL,
    sessionVersion=sessionVersion+1,
    provider=CASE WHEN provider='aad' THEN 'dual' WHEN provider IS NULL THEN 'password' ELSE provider END,
    updatedAt=SYSUTCDATETIME()
WHERE id=@userId AND companyId=@companyId;

UPDATE dbo.PasswordSetupTokens
SET usedAt=SYSUTCDATETIME()
WHERE companyId=@companyId AND userId=@userId AND usedAt IS NULL;
```

Commit only if both operations succeed; rollback on error.

- [ ] **Step 6: Write security event without raw token/password**

Use `writeSecurityEvent` with event `auth.password.setupSucceeded`, including only `userId`, `companyId`, `purpose`. Never include `token`, `tokenHash`, `password`, `passwordHash`.

- [ ] **Step 7: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add api/src/functions/passwordSetup.js tests/password-setup-api-contract.test.js package.json
git commit -m "feat(auth): consume one-time password setup links"
```

---

### Task 3: Loginseite erkennt sicheren Fragment-Setup-Link

**Files:**
- Modify: `frontend/auth-login-v42.js`
- Create: `tests/password-setup-ui-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `POST /api/auth/password/setup`
- Consumes: fragment `#passwordSetup=<RAW_TOKEN>`
- Produces: focused setup form and return to normal login after success

- [ ] **Step 1: Write the failing UI contract**

The test must require:

```js
new URLSearchParams(location.hash.replace(/^#/,''))
```

fields with `autocomplete="new-password"`, labels `Neues Passwort` and `Passwort bestätigen`, request payload containing `token`, `password`, `passwordConfirm`, and cleanup with `history.replaceState(null,'',location.pathname + location.search)`.

The test must reject any `?passwordSetup=` implementation.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because current login module only renders Microsoft/password login.

- [ ] **Step 3: Add fragment parser with no logging**

```js
function passwordSetupToken(){
  const params = new URLSearchParams(String(location.hash || '').replace(/^#/,''));
  return params.get('passwordSetup') || '';
}
```

Do not add `console.log`, analytics calls, or token interpolation into error text.

- [ ] **Step 4: Render setup form when token exists**

The setup view must contain only:

- title `Passwort festlegen`
- two password fields
- note `10 bis 256 Zeichen`
- submit button `Passwort speichern`
- generic result area

Do not display the raw token anywhere in innerHTML.

- [ ] **Step 5: Submit and remove fragment after success**

POST JSON `{token,password,passwordConfirm}` to `/api/auth/password/setup`. On success:

```js
history.replaceState(null,'',location.pathname + location.search);
render({ target, message: 'Passwort wurde festgelegt. Du kannst dich jetzt anmelden.' });
```

The normal login must then be visible without a reload carrying the fragment.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add frontend/auth-login-v42.js tests/password-setup-ui-contract.test.js package.json
git commit -m "feat(auth): add password setup view to central login"
```

---

### Task 4: Geschützter Admin-Endpunkt zum Erzeugen weiterer Setup-Links

**Files:**
- Modify: `api/src/functions/passwordSetup.js`
- Modify: `api/src/functions/users.js`
- Create: `tests/password-setup-admin-authorization.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createSetupToken()`, `hashSetupToken()`, `setupLink()`
- Produces: `POST /api/users/{id}/password-setup-link`
- Produces: `passwordEnabled: boolean` on `GET /api/users`

- [ ] **Step 1: Write RED authorization tests**

Require that the endpoint calls `getAuthorizedContext`, allows only `system_admin` or `company_admin`, loads the target user server-side, and contains an explicit rejection equivalent to:

```js
if(target.role === Roles.SYSTEM_ADMIN && !ctx.roles.includes(Roles.SYSTEM_ADMIN)) {
  const err = new Error('Systemadmin-Konten dürfen nur durch Systemadmins verwaltet werden.');
  err.status = 403;
  throw err;
}
```

Also require company filter `target.companyId=ctx.companyId` for non-system-admin callers.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because admin setup-link endpoint and target-role hardening do not exist.

- [ ] **Step 3: Implement setup-link generation**

Server flow:

1. Resolve caller with `getAuthorizedContext`.
2. Assert caller role `system_admin` or `company_admin`.
3. Load target user by id; if caller is not systemadmin, include `companyId=@ctxCompanyId` in query.
4. Reject inactive targets.
5. Reject `system_admin` target unless caller is `system_admin`.
6. Generate raw token with `createSetupToken()`.
7. Store only `hashSetupToken(rawToken)`, purpose `password_reset`, expiration `DATEADD(MINUTE,30,SYSUTCDATETIME())`.
8. Mark prior unused tokens for target as used before inserting the new one.
9. Return `{ ok:true, expiresAt, url: setupLink(rawToken) }` exactly once.

- [ ] **Step 4: Harden existing `users.js` target-role mutations**

Before PATCHing a target, load `id,companyId,role` from SQL using the caller's allowed company scope. If target role is `system_admin` and caller is not `system_admin`, return 403 before updating `active`, role, name, Entra id or notes.

This closes the existing gap where a company admin could PATCH a systemadmin row if it shared the same company.

- [ ] **Step 5: Expose password status without exposing hashes**

Change user GET projection to include:

```sql
CASE WHEN passwordHash IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END AS passwordEnabled
```

Never select or return `passwordHash` itself.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add api/src/functions/passwordSetup.js api/src/functions/users.js tests/password-setup-admin-authorization.test.js package.json
git commit -m "feat(auth): let admins issue secure password setup links"
```

---

### Task 5: Benutzerverwaltung zeigt Setup-Link-Aktion für Andreas und andere Benutzer

**Files:**
- Modify: `frontend/user-management-v19.js`
- Create: `tests/password-setup-user-management.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `POST /api/users/{id}/password-setup-link`
- Consumes: `user.passwordEnabled`
- Produces: admin action `Passwort-Setup-Link erstellen`

- [ ] **Step 1: Write RED UI contract**

Require button label `Passwort-Setup-Link erstellen`, API path `/users/` + id + `/password-setup-link`, and a result container that renders the returned URL only after successful authenticated admin action.

Also require display labels:

- `Passwort aktiv` when `passwordEnabled===true`
- `Kein Passwort` otherwise

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because user management has no setup-link action.

- [ ] **Step 3: Add action button with role-aware visibility**

For editable users add the setup-link button. For a `system_admin` row, render it only when the current caller is also `system_admin`.

Do not put any token into table HTML before the API response.

- [ ] **Step 4: Implement `createPasswordSetupLink(id)`**

```js
async function createPasswordSetupLink(id){
  try{
    const result = await api('/users/' + encodeURIComponent(id) + '/password-setup-link', {
      method:'POST',
      body: JSON.stringify({})
    });
    // render result.url in a dedicated readonly field/dialog with an explicit copy button
  }catch(err){
    alert('Setup-Link konnte nicht erstellt werden: ' + String(err.message || err));
  }
}
```

Use DOM event binding or the project's approved CSP-safe pattern; do not add a new inline-script exception.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add frontend/user-management-v19.js tests/password-setup-user-management.test.js package.json
git commit -m "feat(auth): expose password setup links in user management"
```

---

### Task 6: Sicherer einmaliger Betreiber-Seed ohne Roh-Token im Repository

**Files:**
- Create: `scripts/seed-initial-password-setup-token.js`
- Create: `tests/initial-password-seed-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes environment: `SQL_CONNECTION_STRING`, `PASSWORD_SETUP_TOKEN_HASH`
- Produces: exactly one `initial_password` row for the unique active systemadmin without password
- Does NOT consume or print the raw token

- [ ] **Step 1: Write RED seed safety contract**

Require script to read `PASSWORD_SETUP_TOKEN_HASH`, require exactly 64 lowercase hex characters, and explicitly reject any environment variable named `PASSWORD_SETUP_TOKEN`, `RAW_TOKEN`, or plaintext password input.

Require SQL guards:

```sql
role='system_admin' AND active=1 AND passwordHash IS NULL
```

and a count assertion that exactly one candidate exists.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because seed script does not exist.

- [ ] **Step 3: Implement hash-only seed**

The script must:

1. Validate `PASSWORD_SETUP_TOKEN_HASH` with `/^[a-f0-9]{64}$/`.
2. Query active systemadmins with `passwordHash IS NULL`.
3. Abort unless recordset length is exactly `1`.
4. In a transaction mark existing unused `initial_password` rows for that user as used.
5. Insert a fresh row with `expiresAt=DATEADD(MINUTE,30,SYSUTCDATETIME())` and `createdBy='operator-bootstrap'`.
6. Print only `Initial password setup token hash seeded for one system admin.` and never print email, user id, token hash, or raw token.

- [ ] **Step 4: Add npm command**

```json
"auth:seed-initial-setup": "node scripts/seed-initial-password-setup-token.js"
```

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add scripts/seed-initial-password-setup-token.js tests/initial-password-seed-contract.test.js package.json
git commit -m "feat(auth): add hash-only initial admin setup seed"
```

---

### Task 7: Vollständige Regression, Migration und Produktions-Rollout

**Files:**
- Modify only if test findings require source fixes from Tasks 1–6
- Temporary operational workflow may be created on the feature branch and deleted before final branch completion

**Interfaces:**
- Consumes all prior tasks
- Produces: live initial setup link for the one existing systemadmin and verified password login

- [ ] **Step 1: Run full fresh verification**

Run:

```bash
npm test
node --check api/src/functions/*.js
node --check api/src/lib/*.js
```

Expected: all tests and syntax checks PASS.

- [ ] **Step 2: Review diff for secret/token leakage**

Search tracked files for prohibited material:

```bash
git grep -nE 'passwordSetup=[A-Za-z0-9_-]{20,}|PASSWORD_SETUP_TOKEN=|rawToken\s*=' -- . ':!docs/superpowers/*'
```

Expected: no real token literals or plaintext password values.

- [ ] **Step 3: Deploy application code only after GREEN**

Use the normal Azure Static Web Apps production pipeline after PR review/merge. Verify `/api/health`, anonymous `/api/me` rejection, and that the central login page still contains Microsoft plus E-Mail/Passwort.

- [ ] **Step 4: Apply migration 010 once**

Run the repository migration tool with the production `SQL_CONNECTION_STRING`:

```bash
npm run db:migrate
```

Expected output includes `010_password_auth_and_setup_tokens.sql` as applied or already applied. Verify `PasswordSetupTokens` exists and password columns exist.

- [ ] **Step 5: Generate the operator token outside GitHub**

Generate 32 random bytes in the assistant's private runtime, keep the raw Base64URL token only in private session state, and compute its SHA-256 hex digest. Only the digest may be passed to the seed operation.

Equivalent local generation logic:

```js
const raw = crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(raw).digest('hex');
```

Do not commit either value. Do not print the raw value to GitHub Actions logs.

- [ ] **Step 6: Seed only the hash through a one-time controlled job**

Invoke:

```bash
PASSWORD_SETUP_TOKEN_HASH='<64-hex-digest>' npm run auth:seed-initial-setup
```

through a temporary controlled execution path that has `SQL_CONNECTION_STRING`. The temporary workflow/script invocation must contain only the hash, never the raw token. Delete the temporary workflow after successful seed.

- [ ] **Step 7: Hand the raw setup URL only to the operator**

Construct locally, not in GitHub:

```text
https://delightful-sky-05dbf7603.7.azurestaticapps.net/#passwordSetup=<RAW_TOKEN>
```

Send that URL only in the user conversation. It expires 30 minutes after the DB seed.

- [ ] **Step 8: Verify operator password setup and normal login**

User opens the setup URL, chooses a 10–256 character password, confirms it, and receives success. Then verify:

1. fragment removed from URL after setup,
2. setup token reuse fails,
3. normal E-Mail/Passwort login succeeds,
4. `/api/me` returns `system_admin`,
5. systemadmin sees company selection, not an automatic Essentra dashboard.

- [ ] **Step 9: Verify Andreas flow**

After operator login:

1. open `Benutzer / Rechte`,
2. locate Andreas Zohren,
3. click `Passwort-Setup-Link erstellen`,
4. copy returned 30-minute link,
5. Andreas sets his own password,
6. verify Andreas can only access his assigned company/role.

- [ ] **Step 10: Final security review and commit any necessary test-only adjustments**

Re-run `npm test` after operational changes. Confirm no one-time workflow remains in the repository and no raw token is present in commit history introduced by this feature.

---

## Self-Review Results

- Spec coverage: all ten spec sections map to Tasks 1–7.
- Bootstrap without Microsoft and without Graph mail: covered by Task 6 + Task 7.
- Fragment-only raw token transport: covered by Tasks 1 and 3.
- Company-admin/system-admin target isolation: covered by Task 4.
- Existing user setup flow for Andreas: covered by Task 5 and Task 7.
- Clean-install schema gap in current `main`: explicitly fixed by migration 010 in Task 1.
- No placeholders or deferred implementation items remain.
- Function names and API routes are consistent across tasks.
