# Company Showcase Admin Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the isolated public showcase with a local-only company onboarding, employee editor, instruction editor, image-backed learning-step editor and employee assignment workflow.

**Architecture:** Keep all mutations inside `createDemoStore` and gate every admin mutation by the active `company_admin` demo session. Add a focused `demo-admin.js` UI module that renders the setup workflow into the existing content container and calls store methods; `demo-ui.js` only adds the new navigation entry and delegates rendering. Image files are converted with `FileReader` and stored as validated data URLs, never uploaded.

**Tech Stack:** Static HTML/CSS, browser ES modules, Node.js built-in test runner, localStorage, FileReader, GitHub Actions, Azure Static Web Apps preview.

**Spec:** `docs/superpowers/specs/2026-09-03-company-showcase-admin-setup-design.md`

## Global Constraints

- Only `company_admin` may execute company, employee, instruction, image or assignment mutations.
- Demo runtime must make no API, auth, SQL, Blob Storage or mail network calls.
- Uploaded demo images: PNG/JPEG/WEBP only, maximum 1.5 MB, stored locally as `data:image/...`.
- New demo email addresses must end with `.example`.
- Existing 15 employees and 10 instruction types remain the reset baseline.
- `Demo zurücksetzen` must remove all local onboarding/editor changes.
- `main` and the productive database remain untouched; Draft PR #4 stays unmerged.

---

### Task 1: RED contract for admin authoring

**Files:**
- Create: `tests/company-showcase-admin-setup.test.js`
- Modify: `.github/workflows/azure-static-web-apps.yml`

**Interfaces:**
- Consumes: `createDemoStore(DEMO_DATA, storage)`.
- Produces: failing contracts for `updateCompanyProfile`, `saveEmployee`, `saveInstruction`, `setLearningStepImage`, `assignInstruction` and the `Einrichtung` UI.

- [ ] **Step 1:** Add tests proving admin-only mutations, `.example` email validation, online learning-step creation, idempotent assignment, image MIME/size validation, reset restoration and UI markers.
- [ ] **Step 2:** Change the showcase CI command to `node --test tests/company-showcase-*.test.js` if not already present.
- [ ] **Step 3:** Run the PR workflow and confirm the new tests fail because the store/UI interfaces do not yet exist.
- [ ] **Step 4:** Commit the RED contract.

### Task 2: GREEN local admin store operations

**Files:**
- Modify: `frontend/demo/demo-store.js`
- Test: `tests/company-showcase-admin-setup.test.js`

**Interfaces:**
- Produces:
  - `updateCompanyProfile(patch) -> company`
  - `saveEmployee(input) -> employee`
  - `saveInstruction(input) -> instruction`
  - `setLearningStepImage(instructionId, stepId, dataUrl, byteSize) -> learningStep`
  - `assignInstruction(instructionId, employeeIds, dueDate) -> assignment[]`

- [ ] **Step 1:** Add `assertAdmin()` using `session.role === 'company_admin'`.
- [ ] **Step 2:** Implement trimmed company validation and local persistence.
- [ ] **Step 3:** Implement employee create/update with deterministic `emp-demo-*` IDs, required fields and `.example` email enforcement.
- [ ] **Step 4:** Implement instruction create/update with deterministic `ins-demo-*` IDs. New online instructions create exactly three learning-step shells; practical instructions set `testRequired=false`.
- [ ] **Step 5:** Implement image validation for `data:image/png`, `data:image/jpeg`, `data:image/webp`; reject byte sizes above `1572864`.
- [ ] **Step 6:** Implement idempotent bulk assignment using existing employee/instruction validation and `missing` status for new assignments.
- [ ] **Step 7:** Run all showcase tests and commit GREEN store logic.

### Task 3: Admin setup UI module

**Files:**
- Create: `frontend/demo/demo-admin.js`
- Create: `frontend/demo/demo-admin.css`
- Modify: `frontend/demo/demo-ui.js`
- Modify: `frontend/demo/index.html`
- Test: `tests/company-showcase-admin-setup.test.js`

**Interfaces:**
- `createDemoAdminView({store, content, modalRoot, escapeHtml, onChanged, showToast})` returns `{ renderSetup(), openEmployeeEditor(id?), openInstructionEditor(id?) }`.
- The module never imports network/auth code.

- [ ] **Step 1:** Add `Einrichtung` to admin navigation only.
- [ ] **Step 2:** Render a four-step onboarding header with cards for Unternehmensprofil, Mitarbeitende, Unterweisung and Zuweisung.
- [ ] **Step 3:** Add company-profile form and persist through `updateCompanyProfile`.
- [ ] **Step 4:** Add employee list with create/edit modal, role and line-manager selection, and validation messages.
- [ ] **Step 5:** Add instruction list with create/edit modal for delivery mode, category, description, interval, test requirement and pass threshold.
- [ ] **Step 6:** Add assignment panel with instruction selector, employee checkboxes and due date; show created/skipped counts.
- [ ] **Step 7:** Add responsive CSS and include it from `index.html`.
- [ ] **Step 8:** Run showcase tests and commit the setup UI.

### Task 4: Local learning-image authoring

**Files:**
- Modify: `frontend/demo/demo-admin.js`
- Modify: `frontend/demo/demo-admin.css`
- Test: `tests/company-showcase-admin-setup.test.js`

**Interfaces:**
- Browser file input accepts `.png,.jpg,.jpeg,.webp`.
- `FileReader.readAsDataURL(file)` feeds `store.setLearningStepImage(...)` after file type/size checks.

- [ ] **Step 1:** Render the three learning steps for online instructions in the editor with title/text fields and image preview.
- [ ] **Step 2:** Add file input for each step and reject files over 1.5 MB before reading.
- [ ] **Step 3:** Save step title/text along with instruction editing via the store; save selected image via `setLearningStepImage`.
- [ ] **Step 4:** Ensure practical instructions hide the learning-step/image editor.
- [ ] **Step 5:** Run the local-only isolation checker and showcase tests; commit.

### Task 5: Full regression and live preview verification

**Files:**
- Modify: `scripts/check-company-showcase-demo.js` only if new demo files need explicit safety markers beyond recursive scanning.
- Modify: Draft PR #4 description after verification.

**Interfaces:**
- CI remains the authoritative complete verification.

- [ ] **Step 1:** Run GitHub Actions for final head.
- [ ] **Step 2:** Verify existing project pretests are 74/74 green.
- [ ] **Step 3:** Verify all showcase/admin tests are green and `check-company-showcase-demo.js` confirms no network/real-data integration.
- [ ] **Step 4:** Verify Azure build/deploy and deployed `/demo/` HTTP check are green.
- [ ] **Step 5:** Confirm PR base SHA remains production `main` and PR remains Draft/unmerged.
- [ ] **Step 6:** Update PR #4 body with final commit, workflow run and new demo capabilities.
