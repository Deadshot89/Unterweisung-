# Compact administration implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks in the existing isolated preview branch.

**Goal:** Format employees, external invitations and planning consistently at desktop and mobile sizes.

**Architecture:** Update the active renderers and scoped styles in the existing v0.36 stylesheet. Group related table data and use container queries for narrow content areas. Keep participant checkboxes mounted while filtering so selection survives searches.

**Tech Stack:** Existing vanilla JavaScript, CSS, Node test runner, Azure preview.

**Spec:** Extends the approved compact administration design in `docs/superpowers/specs/2026-09-02-v0.36-instruction-workspace-design.md`, with the user's employee, invitation and planning screenshots.

## Global constraints

- Keep all existing employee, invitation and planning actions, fields and role checks.
- No backend, authentication, production or main-branch changes.
- No new rendering observers or dependencies.
- All three views must style correctly when rendered directly after asynchronous loads.

## Tasks

- [x] Add a behavioral regression in `scripts/check-admin-workspace.js`: filtering participants must retain checked IDs, show an empty result and update the selection count; editing/resetting must synchronize the count. Employee search must not reconstruct the edit form.
- [x] Update `frontend/employee-management-v18.js`: five columns combining identity and organizational data, readable company name, search updating only its result region.
- [x] Update `frontend/external-fix-v12.js`: uniform labeled fields, five invitation columns grouping result, dates and proof/mail information; omit duplicate identity/status text.
- [x] Update `frontend/planning-management-v24.js`: searchable bounded checkbox grid, visible/selected count, equal-width fields and compact five-column agenda. `updatePlanningParticipants()` filters existing labels and updates counts without replacing inputs.
- [x] Extend `frontend/professional-suite-v36.css`: scoped grid/field/button styling, width-safe tables without nested vertical scroll, narrow-container labeled row layout and focus styles. Keep other views unchanged.
- [x] Run `node scripts/check-admin-workspace.js` and `npm --offline --no-update-notifier test`. Both passed. Browser visual inspection of the local synthetic fixture is blocked by cloud URL policy; no visual pass is claimed.
- [ ] Review the diff, update the draft PR branch, and confirm Azure deployment, SQL/Blob health and deployed stylesheet content checks.

## Implementation notes

The existing deployed CSP blocks inline event attributes. The three updated views now bind actions through JavaScript event handlers without changing the CSP. Behavior tests cover action dispatch and read-only role restrictions.
