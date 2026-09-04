# RC991 Unified Learning Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the production employee/external learning flows and the isolated company demo onto one professional learning, test, result, manager-mail and external-invitation experience without changing `main` or automatically applying a database migration.

**Architecture:** A pure browser presentation core (`learning-experience-v38.js/.css`) owns learning-step, question and result markup. Production flows keep real API/auth/SQL/Blob/Graph behavior and server-side authorization; the demo consumes an identical copy of the presentation core but remains local-only. Additive schema migration 012 carries professional content metadata while API helpers keep readable fallback behavior before migration and reject only writes that require the new schema.

**Tech Stack:** Vanilla JavaScript, CSS, Azure Static Web Apps, Azure Functions Node 22, Azure SQL via `mssql`, Azure Blob Storage, Microsoft Graph mail/ICS, Node test runner, JSDOM.

**Spec:** `docs/superpowers/specs/2026-09-03-unified-learning-portal-design.md`

## Global Constraints

- Production work branch is `rc991-unified-learning-portal`, based on `feature/v0.36-instruction-ui`.
- Demo work remains on `demo/company-showcase`.
- `main` must remain unchanged during RC991.
- Migration `012_learning_experience_content.sql` is additive and MUST NOT be automatically executed.
- No seed/import/repair workflow is executed.
- Shared presentation files must contain no `fetch(`, `/api/`, `/.auth/`, Graph mail call, SQL access or Blob access.
- The phrase `Das solltest du mitnehmen` must not exist in production, external or demo learning UI.
- Server-side sequential learning progress, tenant scope and test grading remain authoritative.
- Production may send real Graph mail only through existing authenticated server endpoints; demo mail remains simulated and local-only.
- A Line Manager may create a purely external online invitation with `employeeId = null`, but may only read/update/resend such unlinked invitations when `createdBy` matches that Line Manager's authenticated user id.
- Practical instructions cannot be sent as account-free external online instructions.

---

### Task 1: Shared professional learning presentation core

**Files:**
- Create: `frontend/learning-experience-v38.js`
- Create: `frontend/learning-experience-v38.css`
- Modify: `frontend/index.html`
- Modify: `frontend/external/instruction.html`
- Create: `tests/unified-learning-experience.test.cjs`

**Interfaces:**
- Consumes: plain objects with instruction fields `name`, `learningGoal`, `learningIntro`, `keyPoints`; step fields `title`, `body`, `imageUrl`, `imageCaption`, `calloutTitle`, `calloutText`; question fields `id`, `question`, `options`.
- Produces: global `UMLearningExperience` with `escapeHtml(value)`, `renderLearningStep(model)`, `renderQuestionList(model)`, and `renderResult(model)` returning HTML strings.
- CSS contract: `.um-learning-stage`, `.um-learning-visual`, `.um-learning-image`, `.um-learning-context`, `.um-learning-keypoints`, `.um-question-card`, `.um-answer-card`, `.um-result-panel`.

- [ ] **Step 1: Write the failing shared-renderer contract test**

```js
// tests/unified-learning-experience.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer() {
  const source = fs.readFileSync('frontend/learning-experience-v38.js', 'utf8');
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return { api: context.globalThis.UMLearningExperience, source };
}

test('shared learning renderer is pure and uses the approved professional structure', () => {
  const { api, source } = loadRenderer();
  assert.ok(api);
  for (const forbidden of [/fetch\s*\(/, /\/api\//, /\.auth\//, /sendGraphMail/, /blob\.core\.windows\.net/i]) assert.doesNotMatch(source, forbidden);
  const html = api.renderLearningStep({
    instruction: { name:'PSA', learningGoal:'PSA sicher auswählen.', learningIntro:'Vor Arbeitsbeginn prüfen.', keyPoints:['Passende PSA tragen.'] },
    step: { title:'Mängel melden', body:'Beschädigte PSA sofort aussondern.', imageUrl:'/assets/psa.svg', imageCaption:'Defekte PSA nicht weiterverwenden.', calloutTitle:'Praxischeck', calloutText:'Mangel melden und Ersatz beschaffen.' },
    index:1,
    total:3
  });
  assert.match(html, /um-learning-stage/);
  assert.match(html, /Lernziel/);
  assert.match(html, /Praxisbezug/);
  assert.match(html, /Wichtige Merkpunkte/);
  assert.doesNotMatch(html, /Das solltest du mitnehmen/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/unified-learning-experience.test.cjs`
Expected: FAIL because `frontend/learning-experience-v38.js` does not exist.

- [ ] **Step 3: Implement the pure renderer**

```js
// frontend/learning-experience-v38.js
(function(root){
  const escapeHtml = (value='') => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const list = items => Array.isArray(items) && items.length
    ? `<section class="um-learning-keypoints"><h4>Wichtige Merkpunkte</h4><ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
    : '';
  function renderLearningStep({instruction={},step={},index=0,total=1}) {
    return `<article class="um-learning-stage"><header class="um-learning-context"><span class="um-learning-step-count">Schritt ${index+1} von ${total}</span><h3>${escapeHtml(step.title)}</h3><p class="um-learning-goal"><strong>Lernziel</strong>${escapeHtml(instruction.learningGoal||'')}</p>${instruction.learningIntro?`<p>${escapeHtml(instruction.learningIntro)}</p>`:''}</header><figure class="um-learning-visual">${step.imageUrl?`<img class="um-learning-image" src="${escapeHtml(step.imageUrl)}" alt="${escapeHtml(step.imageCaption||step.title)}">`:''}${step.imageCaption?`<figcaption><strong>Praxisbezug</strong>${escapeHtml(step.imageCaption)}</figcaption>`:''}</figure><section class="um-learning-copy"><p>${escapeHtml(step.body||'')}</p>${step.calloutText?`<aside class="um-learning-callout"><strong>${escapeHtml(step.calloutTitle||'Wichtig')}</strong><p>${escapeHtml(step.calloutText)}</p></aside>`:''}${list(instruction.keyPoints)}</section></article>`;
  }
  function renderQuestionList({questions=[],passPercent=80,namePrefix='umQuestion'}) {
    return `<section class="um-test-stage"><header><h3>Abschlusstest</h3><p>Zum Bestehen sind mindestens ${escapeHtml(passPercent)} % erforderlich.</p></header>${questions.map((q,qi)=>`<fieldset class="um-question-card"><legend>${qi+1}. ${escapeHtml(q.question)}</legend>${(q.options||[]).map((opt,oi)=>`<label class="um-answer-card"><input type="radio" name="${escapeHtml(namePrefix)}_${escapeHtml(q.id)}" value="${oi}"><span class="um-answer-letter">${String.fromCharCode(65+oi)}</span><span>${escapeHtml(typeof opt==='object'?(opt.text??''):opt)}</span></label>`).join('')}</fieldset>`).join('')}</section>`;
  }
  function renderResult({passed,scorePercent=null,passPercent=80,validUntil='',certificateActionHtml=''}) {
    return `<section class="um-result-panel ${passed?'is-pass':'is-fail'}"><span class="um-result-kicker">${passed?'Erfolgreich abgeschlossen':'Noch nicht bestanden'}</span><h2>${passed?'Unterweisung abgeschlossen':'Test wiederholen'}</h2>${scorePercent===null?'':`<p class="um-result-score">${escapeHtml(scorePercent)} %</p>`}<p>${passed?`Der Abschluss wurde dokumentiert${validUntil?` · gültig bis ${escapeHtml(validUntil)}`:''}.`:`Erforderlich sind mindestens ${escapeHtml(passPercent)} %. Bitte die Lerninhalte erneut prüfen und den Test wiederholen.`}</p>${certificateActionHtml}</section>`;
  }
  root.UMLearningExperience = Object.freeze({escapeHtml,renderLearningStep,renderQuestionList,renderResult});
})(globalThis);
```

Create `learning-experience-v38.css` with a full-width 16:9 image stage, `object-fit:cover`, 1200px maximum content width, card spacing, selected answer states, pass/fail result panels and responsive rules at 900px and 640px.

Load the CSS in both production HTML pages. Load `/learning-experience-v38.js` before `employee-portal-v37.js` in `frontend/index.html` and before `/external/instruction.js` in `frontend/external/instruction.html`.

- [ ] **Step 4: Run the focused test and syntax checks**

Run: `node --test tests/unified-learning-experience.test.cjs && node --check frontend/learning-experience-v38.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/learning-experience-v38.js frontend/learning-experience-v38.css frontend/index.html frontend/external/instruction.html tests/unified-learning-experience.test.cjs
git commit -m "feat(rc991): add shared professional learning experience"
```

---

### Task 2: Add professional learning content schema and API read/write support

**Files:**
- Create: `database/migrations/012_learning_experience_content.sql`
- Create: `api/src/lib/learningContent.js`
- Modify: `api/src/functions/instructionTypes.js`
- Modify: `api/src/functions/learningSteps.js`
- Modify: `api/src/functions/employeeTraining.js`
- Create: `tests/learning-content-contract.test.js`

**Interfaces:**
- Produces `learningContentSchemaReady(pool): Promise<boolean>`.
- Produces `parseKeyPoints(value): string[]`.
- Produces `loadPublishedLearningContent(pool,{companyId,instructionTypeId,language}): Promise<{learningGoal,learningIntro,keyPoints,steps}>` where each step has `id,sortOrder,title,body,imageFileId,imageCaption,calloutTitle,calloutText`.
- Production read fallback when migration 012 is absent: `learningGoal=''`, `learningIntro=''`, `keyPoints=[]`, step metadata fields empty; existing title/body/image remain usable.

- [ ] **Step 1: Write failing schema/API contract tests**

```js
// tests/learning-content-contract.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('database/migrations/012_learning_experience_content.sql','utf8');
const types = readFileSync('api/src/functions/instructionTypes.js','utf8');
const steps = readFileSync('api/src/functions/learningSteps.js','utf8');
const employee = readFileSync('api/src/functions/employeeTraining.js','utf8');

test('migration 012 is additive and defines professional learning metadata',()=>{
  for (const name of ['learningGoal','learningIntro','keyPointsJson','imageCaption','calloutTitle','calloutText']) assert.match(migration,new RegExp(name));
  assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE)\b/i);
});

test('instruction and employee APIs expose professional learning metadata',()=>{
  assert.match(types,/learningGoal/);
  assert.match(steps,/imageCaption/);
  assert.match(employee,/loadPublishedLearningContent/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/learning-content-contract.test.js`
Expected: FAIL because migration 012 and `learningContent.js` do not exist.

- [ ] **Step 3: Create additive migration 012**

```sql
IF COL_LENGTH('dbo.InstructionTypes','learningGoal') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD learningGoal NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.InstructionTypes','learningIntro') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD learningIntro NVARCHAR(4000) NULL;
GO
IF COL_LENGTH('dbo.InstructionTypes','keyPointsJson') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD keyPointsJson NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.InstructionLearningSteps','imageCaption') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD imageCaption NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.InstructionLearningSteps','calloutTitle') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD calloutTitle NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.InstructionLearningSteps','calloutText') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD calloutText NVARCHAR(2000) NULL;
GO
```

Do not alter any migration runner or invoke `db:migrate`.

- [ ] **Step 4: Implement `learningContent.js` and wire API reads/writes**

`parseKeyPoints` must accept JSON text or arrays, trim each item, remove blanks and cap output at 12 points × 500 characters. `learningContentSchemaReady` checks all six columns with `COL_LENGTH`. `loadPublishedLearningContent` uses the extended SELECT when ready and the existing title/body/image SELECT when not ready.

`instructionTypes.js` GET returns the three type-level fields when available and empty defaults otherwise. POST/PATCH accepts them only when schema 012 is ready; if a new content field is explicitly written before migration, return a 503 message `Professionelle Lerninhalte benötigen noch die freizugebende Datenbankmigration 012.`

`learningSteps.js` GET/POST/PATCH adds `imageCaption`, `calloutTitle`, `calloutText` with the same readiness behavior.

`employeeTraining.js` replaces its direct `loadSteps` SELECT with `loadPublishedLearningContent` and returns `learningGoal`, `learningIntro`, `keyPoints`, and rich steps. Sequential progress logic remains unchanged.

- [ ] **Step 5: Run focused tests and API syntax checks**

Run: `node --test tests/learning-content-contract.test.js tests/employee-portal-contract.test.js && npm run api:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/012_learning_experience_content.sql api/src/lib/learningContent.js api/src/functions/instructionTypes.js api/src/functions/learningSteps.js api/src/functions/employeeTraining.js tests/learning-content-contract.test.js
git commit -m "feat(rc991): add professional learning content model"
```

---

### Task 3: Upgrade internal employee learning, test and result UI

**Files:**
- Modify: `frontend/employee-portal-v37.js`
- Modify: `frontend/employee-portal-v37.css`
- Modify: `tests/employee-portal-contract.test.js`
- Modify: `tests/unified-learning-experience.test.cjs`

**Interfaces:**
- Consumes global `UMLearningExperience` from Task 1.
- Consumes rich employee-training response from Task 2.
- Keeps existing `portalStartInstruction`, `portalLearningNext`, `portalLearningPrev`, `portalSubmitTraining`, image download and server progress calls.

- [ ] **Step 1: Add failing portal integration assertions**

Add assertions requiring `employee-portal-v37.js` to reference `UMLearningExperience.renderLearningStep`, `renderQuestionList`, and `renderResult`; require buttons/labels `Starten`, `Fortsetzen`, `Termin anfragen`, `Nachweis herunterladen`; assert the rejected phrase is absent.

- [ ] **Step 2: Run RED**

Run: `node --test tests/employee-portal-contract.test.js tests/unified-learning-experience.test.cjs`
Expected: FAIL because employee portal still renders its legacy learning markup.

- [ ] **Step 3: Replace only the learning/test/result presentation layer**

Build each internal step model as:

```js
const model={
  instruction:{name:data.instructionName,learningGoal:data.learningGoal,learningIntro:data.learningIntro,keyPoints:data.keyPoints||[]},
  step:{...step,imageUrl:portalState.imageUrls?.[step.imageFileId]||'',imageCaption:step.imageCaption,calloutTitle:step.calloutTitle,calloutText:step.calloutText},
  index:portalState.stepIndex,
  total:steps.length
};
```

Use the shared renderer after image SAS resolution. Preserve the existing POST call that advances exactly one server step at a time. Use shared test cards with the existing radio naming contract so answers still post only `{questionId,answerIndex}`. On failed result render the shared fail panel plus a `Lerninhalte erneut ansehen` action that requests a fresh attempt through the existing API path; on success render the shared pass panel and, when returned, a `Nachweis herunterladen` action.

Upgrade employee cards with mode/status chips and progress text without exposing other employees.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/employee-portal-contract.test.js tests/unified-learning-experience.test.cjs && node --check frontend/employee-portal-v37.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/employee-portal-v37.js frontend/employee-portal-v37.css tests/employee-portal-contract.test.js tests/unified-learning-experience.test.cjs
git commit -m "feat(rc991): align employee learning and completion UI"
```

---

### Task 4: Upgrade external learning to rich published-step snapshots

**Files:**
- Modify: `api/src/functions/externalInstruction.js`
- Modify: `frontend/external/instruction.js`
- Modify: `frontend/external/instruction.html`
- Create: `tests/external-learning-v38.test.js`

**Interfaces:**
- Consumes `loadPublishedLearningContent` from Task 2.
- Reuses `ExternalInvitations.testInstructionSnapshotJson` to freeze `learningGoal`, `learningIntro`, `keyPoints`, rich published steps and question selection on first open.
- API response exposes `learningGoal`, `learningIntro`, `keyPoints`, `steps[]`; each image step gets a fresh short-lived `imageUrl` created from the snapshotted `imageBlobPath`/file metadata.

- [ ] **Step 1: Write failing snapshot/UI tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync('api/src/functions/externalInstruction.js','utf8');
const ui=readFileSync('frontend/external/instruction.js','utf8');

test('external sessions snapshot professional learning content',()=>{
  assert.match(api,/learningGoal/);
  assert.match(api,/imageCaption/);
  assert.match(api,/testInstructionSnapshotJson/);
  assert.match(ui,/UMLearningExperience\.renderLearningStep/);
  assert.doesNotMatch(ui,/Das solltest du mitnehmen/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/external-learning-v38.test.js`
Expected: FAIL because external API/UI still use description/PDF as the primary learning presentation.

- [ ] **Step 3: Extend the first-open snapshot**

When no snapshot exists, include:

```js
{
  instructionName,
  description,
  intervalMonths,
  templateTitle,
  templatePath,
  learningGoal,
  learningIntro,
  keyPoints,
  steps: steps.map(s=>({id:s.id,sortOrder:s.sortOrder,title:s.title,body:s.body,imageFileId:s.imageFileId,imageBlobPath:s.imageBlobPath,imageCaption:s.imageCaption,calloutTitle:s.calloutTitle,calloutText:s.calloutText})),
  questions
}
```

Never snapshot expiring SAS URLs. Generate image URLs from the frozen blob path on each GET. Only published steps are loaded before snapshot creation.

- [ ] **Step 4: Replace external reader layout with step navigation**

Use `UMLearningExperience.renderLearningStep` for each step, shared test cards for questions and shared result panels. Keep account-free token access, confirmation requirement, server-side grading and certificate storage unchanged. Keep original PDF as an optional secondary action, not the main reader split-screen.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/external-learning-v38.test.js tests/unified-learning-experience.test.cjs && npm run api:test && node --check frontend/external/instruction.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/functions/externalInstruction.js frontend/external/instruction.js frontend/external/instruction.html tests/external-learning-v38.test.js
git commit -m "feat(rc991): align external instruction learning experience"
```

---

### Task 5: Allow Line Managers to send purely external online instructions safely

**Files:**
- Modify: `api/src/functions/invitations.js`
- Modify: `api/src/functions/mail.js`
- Modify: `frontend/external-fix-v12.js`
- Create: `tests/line-manager-external-invitations.test.js`

**Interfaces:**
- POST `/api/invitations` accepts `employeeId:null` for `line_manager` when target instruction is online.
- Team-linked invitations still use `requireEmployeeTarget`.
- Unlinked external invitations are owned by `createdBy = ctx.userId`.
- Line Manager list scope is `(direct-team employee scope) OR (employeeId IS NULL AND createdBy=@currentUserId)`.

- [ ] **Step 1: Write failing authorization tests**

Assert source contracts for these exact rules:
- no `employeeId` requirement for a Line Manager external address;
- query includes ownership clause for `employeeId IS NULL`;
- PATCH/resend rejects unlinked invitation where `createdBy !== ctx.userId`;
- employee role not included in allowed roles;
- practical `deliveryMode` rejected for account-free external invite.

- [ ] **Step 2: Run RED**

Run: `node --test tests/line-manager-external-invitations.test.js`
Expected: FAIL because current `invitations.js` requires Line Managers to supply an internal `employeeId`.

- [ ] **Step 3: Implement ownership-aware server checks**

For POST, load the instruction type before insert:

```sql
SELECT TOP 1 id,deliveryMode FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId AND active=1
```

If `employeeId` is present for a team-mode Line Manager, call `requireEmployeeTarget`. If absent, require `deliveryMode='online'` and rely on `createdBy=ctx.userId` ownership.

For GET team mode, bind direct-report scope and add `OR (vi.employeeId IS NULL AND vi.createdBy=@currentUserId)`.

For PATCH and `sendExternalInvitationMail`, when `employeeId` is null require `String(invitation.createdBy)===String(ctx.userId)`; otherwise use existing team target checks.

- [ ] **Step 4: Update the production external-invite form**

For Line Managers, allow a mode switch `Team-Mitarbeiter` / `Externe Person`. External mode shows recipient name and arbitrary valid email; team mode retains employee selection. Hide practical types from external mode. POST uses `sendMail:true` only when the user explicitly selects send.

- [ ] **Step 5: Run focused and role regression tests**

Run: `node --test tests/line-manager-external-invitations.test.js tests/access-scope.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/functions/invitations.js api/src/functions/mail.js frontend/external-fix-v12.js tests/line-manager-external-invitations.test.js
git commit -m "feat(rc991): allow owned external invitations for line managers"
```

---

### Task 6: Make production planning mail a first-class manager workflow

**Files:**
- Modify: `frontend/planning-management-v24.js`
- Modify: `api/src/functions/plannedTrainings.js`
- Modify: `api/src/functions/mail.js`
- Modify: `tests/planning-refresh.test.js`
- Create: `tests/planning-mail-v38.test.js`

**Interfaces:**
- Existing `POST /planned-trainings`, `PATCH /planned-trainings/{id}` and `POST /planned-trainings/{id}/send-mail` remain the server interfaces.
- `POST /planned-trainings` continues returning `{id,participantCount}` so `savePlannedTraining({sendMail:true})` can send immediately after creation.
- GET planned rows expose `mailSentCount` and `mailErrorCount` derived from `TrainingParticipants.mailSentAt/mailError`.

- [ ] **Step 1: Write failing planning-mail UX/API tests**

Require UI strings `Planung speichern`, `Planung speichern und Mail senden`, `Termin per Mail senden`, `Erneut senden`; require GET SQL to expose mail counts; preserve existing delegated click handling and draft-preservation tests.

- [ ] **Step 2: Run RED**

Run: `node --test tests/planning-refresh.test.js tests/planning-mail-v38.test.js`
Expected: FAIL because create-and-send and mail status are not first-class UI states.

- [ ] **Step 3: Extend planned GET mail status**

Add aggregate expressions:

```sql
SUM(CASE WHEN tp.mailSentAt IS NOT NULL THEN 1 ELSE 0 END) AS mailSentCount,
SUM(CASE WHEN tp.mailError IS NOT NULL THEN 1 ELSE 0 END) AS mailErrorCount
```

Keep existing team scope. Do not weaken `sendPlannedTrainingMail`'s `lineManagerId === access.selfEmployeeId` check.

- [ ] **Step 4: Add save-and-mail UX without double writes**

Refactor `savePlannedTraining` to accept `{sendMail=false}`. For a new plan, capture returned id; for an edited plan use the existing id. After the successful plan write and before the refresh, call `/planned-trainings/{id}/send-mail` only when `sendMail===true`. Add two form buttons mapped through delegated actions `save` and `save-mail`. Existing rows show `Termin per Mail senden` when no mail was sent and `Erneut senden` after `mailSentCount>0`, plus recipient/error status text.

- [ ] **Step 5: Run focused tests and full planning checks**

Run: `node --test tests/planning-refresh.test.js tests/planning-mail-v38.test.js && node scripts/check-planning-management.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/planning-management-v24.js api/src/functions/plannedTrainings.js api/src/functions/mail.js tests/planning-refresh.test.js tests/planning-mail-v38.test.js
git commit -m "feat(rc991): unify planning and mail workflow"
```

---

### Task 7: Extend the real Admin/HSE editor for rich learning content

**Files:**
- Modify: `frontend/employee-portal-v37.js`
- Modify: `frontend/employee-portal-v37.css`
- Modify: `tests/employee-portal-contract.test.js`
- Modify: `tests/learning-content-contract.test.js`

**Interfaces:**
- Type editor PATCHes `/instruction-types/{id}` with `learningGoal`, `learningIntro`, `keyPoints`.
- Step editor POST/PATCHes `/learning-steps` with `imageCaption`, `calloutTitle`, `calloutText` in addition to existing title/body/image.
- Roles remain `system_admin`, `company_admin`, `hse` only.

- [ ] **Step 1: Add failing editor-contract assertions**

Require visible labels `Lernziel`, `Einleitung`, `Wichtige Merkpunkte`, `Praxisbezug / Bildunterschrift`, `Hinweis-Titel`, `Hinweis-Text`; require the payload property names above and existing `canEditLearning()` role guard.

- [ ] **Step 2: Run RED**

Run: `node --test tests/employee-portal-contract.test.js tests/learning-content-contract.test.js`
Expected: FAIL because the editor only manages title/body/image today.

- [ ] **Step 3: Implement focused content fields and preview**

Use one textarea per type-level text field and one newline-separated key-point editor converted to an array before PATCH. Add step inputs for caption/callout fields. The preview must call the same `UMLearningExperience.renderLearningStep` with unsaved field values so editors see the final learner layout before publishing.

- [ ] **Step 4: Run focused tests and syntax check**

Run: `node --test tests/employee-portal-contract.test.js tests/learning-content-contract.test.js && node --check frontend/employee-portal-v37.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/employee-portal-v37.js frontend/employee-portal-v37.css tests/employee-portal-contract.test.js tests/learning-content-contract.test.js
git commit -m "feat(rc991): add rich learning content editor"
```

---

### Task 8: Bring the public demo onto the exact shared learning standard

**Branch:** switch to `demo/company-showcase` only after Tasks 1–7 are green on `rc991-unified-learning-portal`.

**Files:**
- Create or replace with byte-equivalent copies from RC991: `frontend/learning-experience-v38.js`, `frontend/learning-experience-v38.css`
- Modify: `frontend/demo/index.html`
- Modify: `frontend/demo/demo-mail-learning.js`
- Modify: `frontend/demo/demo-mail-learning.css`
- Modify: `scripts/check-company-showcase-demo.js`
- Create: `tests/company-showcase-shared-learning.test.js`

**Interfaces:**
- Demo loads `../learning-experience-v38.js` and `../learning-experience-v38.css` before demo modules.
- Demo `demo-mail-learning.js` calls `globalThis.UMLearningExperience` for internal and external simulated learning.
- Demo continues to use only `DEMO_DATA`/localStorage and simulated outbox.

- [ ] **Step 1: Write the failing parity test on the demo branch**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('demo consumes the same professional learning core as production',()=>{
  const html=readFileSync('frontend/demo/index.html','utf8');
  const ui=readFileSync('frontend/demo/demo-mail-learning.js','utf8');
  assert.match(html,/\.\.\/learning-experience-v38\.css/);
  assert.match(html,/\.\.\/learning-experience-v38\.js/);
  assert.match(ui,/UMLearningExperience\.renderLearningStep/);
  assert.match(ui,/UMLearningExperience\.renderQuestionList/);
  assert.doesNotMatch(ui,/Das solltest du mitnehmen/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/company-showcase-shared-learning.test.js`
Expected: FAIL because the demo still uses its own duplicated professional-learning markup.

- [ ] **Step 3: Copy the exact shared files and remove duplicate demo markup**

Copy the verified RC991 content of both `learning-experience-v38` files without modification. Replace `decorateLearningModal` and external recipient step rendering with the shared renderer while retaining demo-only wrapper labels and fake data. Remove duplicate `.professional-learning-layout`, `.learning-stage`, `.learning-keypoints`, `.learning-callout` rules when the shared CSS supplies them; keep only demo-specific modal/outbox/safety styles.

- [ ] **Step 4: Extend the isolation scanner to include the shared JS**

In `scripts/check-company-showcase-demo.js`, scan `frontend/learning-experience-v38.js` in addition to `frontend/demo/` and apply the existing forbidden-network patterns. Do not whitelist networking.

- [ ] **Step 5: Run all demo tests and isolation checks**

Run: `node --test tests/company-showcase-*.test.js && node scripts/check-company-showcase-demo.js`
Expected: all showcase tests PASS and isolation check reports no network/real-data connection.

- [ ] **Step 6: Commit on demo branch**

```bash
git add frontend/learning-experience-v38.js frontend/learning-experience-v38.css frontend/demo/index.html frontend/demo/demo-mail-learning.js frontend/demo/demo-mail-learning.css scripts/check-company-showcase-demo.js tests/company-showcase-shared-learning.test.js
git commit -m "feat(demo): align showcase with shared learning experience"
```

---

### Task 9: Full regression, preview deployment and release evidence

**Branches:** `rc991-unified-learning-portal` first, then `demo/company-showcase`.

**Files:**
- Modify: `.github/workflows/azure-static-web-apps.yml` only if required to run the new explicit tests before deploy; do not change production branch triggers.
- Modify: `docs/CHANGELOG.md`
- PR metadata only after the verified code commit.

**Interfaces:**
- RC991 preview uses a Draft PR to `main` strictly as an Azure preview carrier because the existing SWA workflow triggers only for PRs whose base is `main`; it must be marked `DO NOT MERGE`.
- Demo continues using Draft PR #4 and its separate Azure preview.

- [ ] **Step 1: Run RC991 full local/CI-equivalent checks**

Run on `rc991-unified-learning-portal`:

```bash
node --test tests/unified-learning-experience.test.cjs tests/learning-content-contract.test.js tests/external-learning-v38.test.js tests/line-manager-external-invitations.test.js tests/planning-mail-v38.test.js tests/employee-portal-contract.test.js tests/access-scope.test.js tests/planning-refresh.test.js
npm test
```

Expected: all tests PASS; migration 012 remains unapplied.

- [ ] **Step 2: Verify forbidden operations remain absent**

Run source checks confirming no workflow contains `npm run db:migrate`, `db:seed`, `import-startdata`, `repair` or migration 012 execution. Verify `main` SHA is still `4ee691a80d66dbd6b543ae9b5a59532f2f1569cf` unless an unrelated external change occurred; if it changed externally, stop and report instead of overwriting it.

- [ ] **Step 3: Open RC991 Draft Preview PR to `main`**

Title: `RC991 PREVIEW: gemeinsames Lern- und Portal-Design für Hauptseite und Demo`

Body must state:
- `DO NOT MERGE`
- no migration executed
- no seed/import/repair
- production main unchanged
- this PR exists to obtain an isolated Azure preview
- include current head SHA and test counts after CI succeeds

- [ ] **Step 4: Wait for Azure CI and inspect every step**

Required green steps: checkout, Node 22, dependency install, `npm test`, managed API packaging, Azure deploy, deployed stylesheet verification. If a new workflow step is added, require the focused RC991 tests before deploy.

- [ ] **Step 5: Live-check the RC991 preview**

Verify HTTP 200 for `/`, `/learning-experience-v38.css`, `/learning-experience-v38.js`, and `/external/instruction.html`; verify the deployed learning CSS/JS body matches repository content. Do not run migration 012 merely to make the preview render; pre-migration fallback must remain usable.

- [ ] **Step 6: Run demo full regression and confirm PR #4 preview**

Run/CI on `demo/company-showcase`:

```bash
node --test tests/company-showcase-*.test.js
node scripts/check-company-showcase-demo.js
npm test
```

Wait for Draft PR #4 Azure run and require `/demo/` HTTP 200 plus demo markers and shared learning asset HTTP 200.

- [ ] **Step 7: Update changelog and PR descriptions without changing verified code**

Record RC991 scope, migration-not-applied state, workflow run ids, preview URLs and exact test totals. Update PR descriptions only after the code heads are verified.

---

## Plan self-review

- Spec coverage: all twelve spec sections map to Tasks 1–9: shared renderer, rich schema, employee portal, test/result UI, external snapshot flow, Line Manager external invites, planning mail, Admin/HSE editor, demo parity, security tests and preview rules.
- Placeholder scan: no TBD/TODO/`implement later` instructions are present; each implementation task contains concrete interfaces, expected behavior, commands and commit boundaries.
- Type consistency: `UMLearningExperience` names are identical across Tasks 1, 3, 4 and 8; rich content field names exactly match migration/API/editor fields; planning mail keeps the existing server endpoint and returned plan id; external ownership consistently uses `createdBy` against `ctx.userId`.
