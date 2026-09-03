# Employee Portal + Dual Authentication Design

**Date:** 2026-09-03
**Target branch:** `feature/v0.36-instruction-ui`
**Status:** approved by user in chat; implementation remains isolated from `main`.

## Goal

Extend the Unterweisungsmanager so internal users can authenticate either with Microsoft Entra or with email/password and receive the same permissions for the same stored user role. Add an employee-first workspace for own tasks, planning needs, appointments, due items and proofs, plus image-supported learning steps and a clear distinction between online-test completion and practical manager confirmation.

## Non-goals / safety boundary

- Do not merge to `main` as part of this change.
- Do not run database migrations, imports, seeds, repair jobs or maintenance jobs.
- Do not change paid Azure tiers or provision paid services.
- External instruction links remain independent of internal login.
- Passwords are never stored or logged in plaintext.

## Authentication

The existing Entra path remains unchanged. A second API login accepts email/password and issues a signed, HttpOnly, SameSite=Lax session cookie. Password credentials use Node `crypto.scrypt` with a unique random salt. The signing secret comes from `AUTH_SESSION_SECRET`; the preview must fail closed when the secret is missing outside local/test mode.

The Users table receives password credential fields, lockout counters and `sessionVersion`. Any active user may use Entra by matching the same company/email; password login is available only after a password hash exists. Both methods resolve through the same `getAuthorizedContext()` and therefore the same company and role.

Failed password attempts increment a counter and lock the account temporarily after repeated failures. Successful login resets the failure state. Logout clears the cookie. Password changes increment `sessionVersion` so older signed sessions stop authorizing after the database user is resolved.

## Tenant and role boundaries

The API is the security boundary. UI hiding is only secondary.

- `system_admin`: may select/see all companies.
- `company_admin` and `hse`: company-wide access within the selected company.
- `line_manager`: own employee identity plus direct reports whose `Employees.lineManagerId` equals the manager employee id.
- `employee`: own employee identity only.

The employee identity is resolved inside the current company by normalized email. The same scope is applied to employee lists, instruction status, records, planning participants and download authorization.

## Employee workspace

The dashboard presents five work buckets:

1. **Jetzt erledigen** — online instructions that are missing, expired or explicitly assigned and can be started now.
2. **Einplanung erforderlich** — practical instructions that need a responsible person/date instead of self-completion.
3. **Geplante Termine** — planned trainings where the employee is a participant.
4. **Bald fällig** — valid instructions entering the existing due window.
5. **Abgeschlossen** — the employee's completed records and available proofs.

Primary actions are `Starten`, `Fortsetzen`, `Termin anfragen` and `Nachweis herunterladen`. Line managers additionally receive a team-planning view but never employees outside their direct team.

## Image-supported learning steps

`InstructionLearningSteps` stores ordered, language-specific learning steps for an instruction type. Each step has a title, short body, optional image file id and draft/published state. Images are normal protected Files records and are never exposed as public permanent URLs.

The learning player shows one step at a time, progress, previous/next navigation, enlarged image modal and an original-document download. Draft steps are never returned to employees. Publishing requires an authorized HSE/company administrator and records reviewer/timestamp. The existing source-document/analysis approval remains intact; the learning content does not claim to replace professional review.

## Completion

For online instructions, the internal training endpoint provides active reviewed questions and records a passed attempt. On pass it creates an `InstructionRecords` row using source `online_self` and links it to the attempt. Failed attempts do not create a completion record.

For practical instructions, self-completion is disabled. A responsible user with planning permission must complete the planned training using the existing planned-training flow, which creates the official records for participants.

## Downloads and direct links

Short-lived SAS URLs are issued only after API authorization. Employees may receive links only for their own certificate/proof or for a published learning/template asset belonging to an instruction they are allowed to consume. Line managers may additionally receive records for their direct team. Cross-company ids always return no authorization even if the caller knows the raw file id.

## Data changes

Migration `011_employee_portal_dual_auth.sql` is additive only and is committed for review. It is **not applied** by this implementation. Preview endpoints that depend on the new tables must surface a clear setup message until the migration is explicitly approved and applied.

## Release isolation and verification

All work stays in Draft PR #1 on `feature/v0.36-instruction-ui`. The PR workflow runs the full existing suite plus new auth/access/portal tests and deploys only the PR preview. No data-import request file is created. Production remains on the current `main` commit until a separate explicit release approval.
