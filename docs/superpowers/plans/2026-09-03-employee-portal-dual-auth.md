# Employee Portal + Dual Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add same-role Microsoft/email-password login, strict tenant/team/self API scoping, an employee-first instruction workspace, image learning steps and secure online/practical completion flows.

**Architecture:** Keep Entra as an existing authentication source and add a signed password-session source that feeds the same authorization context. Centralize employee/team scoping in one helper and consume it from all data-bearing APIs. Add additive SQL schema for password credentials, learning steps and internal attempts; keep migration execution outside this change.

**Tech Stack:** Azure Static Web Apps, Azure Functions Node 22, Azure SQL, Azure Blob Storage, vanilla HTML/CSS/JS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-employee-portal-dual-auth-design.md`

## Global Constraints

- Work only on `feature/v0.36-instruction-ui`; do not merge to `main`.
- Do not run migrations, imports, seeds, repair jobs or maintenance calls.
- Do not change paid Azure tiers.
- External personal-link instructions remain login-independent.
- Passwords must never be stored/logged in plaintext.
- All downloads must be authorized server-side before a short-lived SAS URL is issued.

---

### Task 1: RED protection tests

**Files:**
- Create: `tests/password-auth.test.js`
- Create: `tests/access-scope.test.js`
- Create: `tests/employee-portal-contract.test.js`
- Modify: `package.json`

- [ ] Add behavioral tests for password hashing/session signing.
- [ ] Add behavioral tests for self/team/company/system employee scope.
- [ ] Add contract tests for approved employee buckets/actions, learning image/progress UI and API wiring.
- [ ] Add the three tests to `pretest` and push one atomic RED commit.
- [ ] Verify Draft PR CI fails because the new production modules do not exist yet.

### Task 2: Password authentication core and additive schema

**Files:**
- Create: `api/src/lib/passwordAuth.js`
- Create: `api/src/functions/passwordAuth.js`
- Create: `database/migrations/011_employee_portal_dual_auth.sql`
- Modify: `api/src/lib/auth.js`
- Modify: `api/src/functions/me.js`
- Modify: `api/src/functions/users.js`

**Interfaces:**
- Produces: `hashPassword(password)`, `verifyPassword(password, encoded)`, `createSessionToken(payload, secret, options)`, `verifySessionToken(token, secret, options)`.
- Produces: `/api/auth/password/login` and `/api/auth/password/logout`.
- Auth context exposes `authMode: entra|password|dev-bypass` while preserving existing role names.

- [ ] Implement scrypt credential encoding/verification using built-in crypto.
- [ ] Implement HMAC-signed HttpOnly session cookie with expiry and session version.
- [ ] Add password login lockout/reset logic and security-event logging.
- [ ] Extend user create/update to set or clear a password hash without ever returning it.
- [ ] Add additive migration for password fields, learning steps and internal attempts; do not execute it.

### Task 3: Central employee/team scoping

**Files:**
- Create: `api/src/lib/employeeAccess.js`
- Modify: `api/src/functions/employees.js`
- Modify: `api/src/functions/status.js`
- Modify: `api/src/functions/records.js`
- Modify: `api/src/functions/plannedTrainings.js`
- Modify: `api/src/functions/files.js`

**Interfaces:**
- Produces: `accessModeForRoles(roles)`, `employeeIdAllowed(args)`, `resolveEmployeeAccess(pool, ctx)`.
- `resolveEmployeeAccess` returns `{ mode, selfEmployeeId, teamEmployeeIds }` for the selected company.

- [ ] Restrict employee GET lists by resolved scope.
- [ ] Restrict status and records by the same scope.
- [ ] Restrict line-manager participant creation/update to direct reports (plus self where meaningful).
- [ ] Restrict employee downloads to own record/proof or published instruction assets; keep company isolation in every lookup.

### Task 4: Learning steps and internal employee completion API

**Files:**
- Create: `api/src/functions/learningSteps.js`
- Create: `api/src/functions/employeeTraining.js`

**Interfaces:**
- Produces: `GET/POST/PATCH /api/learning-steps/{id?}` for authorized content management.
- Produces: `GET/POST /api/employee-training/{instructionTypeId}` for the signed-in employee.

- [ ] Return only published steps to employees and draft/published steps to authorized reviewers.
- [ ] Support ordered title/body/imageFileId and explicit publish/review action.
- [ ] Start/resume an internal attempt and return safe randomized question options.
- [ ] On passed online test create one official `InstructionRecords` record with source `online_self`.
- [ ] Never create a completion record for failed tests or practical-only instructions.

### Task 5: Employee-first frontend and dual-login UI

**Files:**
- Create: `frontend/employee-portal-v37.js`
- Create: `frontend/employee-portal-v37.css`
- Modify: `frontend/index.html`
- Modify: `frontend/app.js`
- Modify: `frontend/role-guard-v20.js`

- [ ] Add an email/password login card alongside the existing Microsoft action.
- [ ] Send same-origin credentialed login requests and reload the common authorized context on success.
- [ ] Render five approved employee buckets and role-appropriate actions.
- [ ] Add learning player with one image step at a time, zoom modal and progress indicator.
- [ ] Add line-manager team planning entry points without exposing all-company administration.

### Task 6: Version, documentation and GREEN verification

**Files:**
- Modify: `package.json`
- Modify: `frontend/index.html`
- Modify: `docs/CHANGELOG.md`
- Modify: Draft PR #1 body

- [ ] Bump preview to `v0.36.3`.
- [ ] Run PR CI and confirm all legacy plus new tests pass.
- [ ] Confirm Azure PR preview deploy succeeds and `main` is unchanged.
- [ ] Confirm no data-import workflow or migration execution occurred.
- [ ] Record that password/learning DB-backed paths require explicit migration approval before live use.
