# RC991 Admin Instruction Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Admin/HSE “Öffnen” action launch a real learner-style read-only instruction preview without creating or mutating training, test, completion, or proof state.

**Architecture:** Keep `frontend/learning-experience-v38.js` as the pure presentation layer and add the preview orchestration only to `frontend/learning-admin-v38.js`. The preview reads company-scoped learning steps, protected image download URLs, and test questions using existing GET endpoints; it must never call `employee-training` or any write endpoint.

**Tech Stack:** Vanilla browser JavaScript, existing `api()` helper, Azure Static Web Apps frontend, Node `node:test` contract tests.

**Spec:** `docs/superpowers/specs/2026-09-04-rc991-login-and-admin-preview-design.md`

## Global Constraints

- Target branch is `rc991-unified-learning-portal`.
- `main` stays unchanged until a separate production approval.
- Admin preview is available only to `system_admin`, `company_admin`, and `hse`.
- Preview data must remain company-scoped through the existing server-authorized APIs.
- The preview must not create an employee training attempt, update `currentStep`, submit answers, create a completion, create a proof, or mark an instruction complete.
- Images must be resolved through `/api/files/{id}/download`; raw Azure Blob URLs must not be introduced.
- Missing files must use the existing friendly `blob_missing` error behavior.
- No migration, seed, import, or automatic data repair belongs to this block.

---

## File Structure

- Modify `frontend/learning-admin-v38.js`: own the Admin/HSE read-only preview orchestration and modal lifecycle.
- Reuse `frontend/learning-experience-v38.js`: pure renderers `renderLearningStep()` and `renderQuestionList()`; do not add network or mutation logic here.
- Test `tests/learning-admin-v38.test.js`: keep the existing RED contract and strengthen read-only assertions only where necessary.

### Task 1: Confirm the existing RED preview contract

**Files:**
- Test: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: source text from `frontend/learning-admin-v38.js`.
- Produces: a focused failing contract proving the missing function/action before implementation.

- [ ] **Step 1: Run the focused preview test before changing implementation**

Run:
```bash
node --test tests/learning-admin-v38.test.js
```

Expected: the first two tests pass and `admin table Open action launches a read-only learner-style instruction preview` fails because `v38OpenInstructionPreview` is not implemented yet.

- [ ] **Step 2: Preserve the existing contract exactly while adding one explicit no-write guard if needed**

The preview test must continue to contain these checks:
```js
assert.match(ui,/v38OpenInstructionPreview/);
assert.match(ui,/\/learning-steps\?instructionTypeId=/);
assert.match(ui,/\/files\/.*\/download/);
assert.match(ui,/renderer\.renderLearningStep/);
assert.match(ui,/renderer\.renderQuestionList/);

const previewStart=ui.indexOf('async function v38OpenInstructionPreview');
const previewSlice=previewStart>=0?ui.slice(previewStart,previewStart+6500):'';
assert.doesNotMatch(previewSlice,/employee-training|attemptId|currentStep\s*:/);
```

If the implementation introduces helper functions directly adjacent to the preview function, extend the inspected slice rather than weakening the forbidden-pattern checks.

- [ ] **Step 3: Commit only if the test contract itself changed**

```bash
git add tests/learning-admin-v38.test.js
git commit -m "test(rc991): lock read-only admin preview writes"
```

If no test change was required, do not create an empty commit.

### Task 2: Implement company-scoped read-only preview loading

**Files:**
- Modify: `frontend/learning-admin-v38.js`
- Test: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: `api(path, options)`, `currentType(typeId)`, `canEditRichLearning()`, `globalThis.UMLearningExperience`.
- Produces: `v38OpenInstructionPreview(typeId)`, `v38CloseInstructionPreview()`, and read-only DOM content rendered through the shared learning renderer.

- [ ] **Step 1: Add a helper that resolves protected image URLs without mutating data**

Add next to the existing preview helpers:
```js
async function v38PreviewStep(step){
  const view={...step,imageUrl:''};
  if(!step.imageFileId)return view;
  try{
    const file=await api('/files/'+encodeURIComponent(step.imageFileId)+'/download');
    view.imageUrl=file.url||'';
  }catch(error){
    view.imageError=String(error.message||error||'Bild konnte nicht geladen werden.');
  }
  return view;
}
```

This helper must use only GET behavior through `api()` and must not embed a Blob URL directly.

- [ ] **Step 2: Add the real read-only preview function**

Implement the orchestration with this shape:
```js
async function v38OpenInstructionPreview(typeId){
  if(!canEditRichLearning())return;
  const instruction=currentType(typeId);
  const encoded=encodeURIComponent(typeId);
  try{
    const [rawSteps,rawQuestions]=await Promise.all([
      api('/learning-steps?instructionTypeId='+encoded+'&language=de'),
      api('/test-questions?instructionTypeId='+encoded+'&language=de')
    ]);
    const steps=await Promise.all((rawSteps||[]).map(v38PreviewStep));
    const questions=(rawQuestions||[]).filter(q=>q.active!==false);
    const learningHtml=steps.length
      ? steps.map((step,index)=>renderer.renderLearningStep({instruction,step,index,total:steps.length})+
          (step.imageError?`<div class="notice warning">${escV(step.imageError)}</div>`:'')).join('')
      : '<div class="notice warning">Für diese Unterweisung sind noch keine Lernschritte hinterlegt.</div>';
    const testHtml=questions.length
      ? renderer.renderQuestionList({questions,passPercent:Number(instruction.passPercent||80),namePrefix:'v38PreviewQuestion'})
      : '<p class="muted">Für diese Unterweisung sind keine Testfragen hinterlegt.</p>';

    document.getElementById('v38InstructionPreviewBackdrop')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div id="v38InstructionPreviewBackdrop" class="learning-modal-backdrop"><div class="learning-modal" role="dialog" aria-modal="true"><div class="learning-modal-head"><div><span class="portal-badge">Nur Vorschau</span><h2>${escV(instruction.name||'Unterweisung')}</h2><p class="muted">Diese Admin-Vorschau erzeugt keinen Lernfortschritt, keinen Testabschluss und keinen Nachweis.</p></div><button class="ghost" type="button" onclick="v38CloseInstructionPreview()">Schließen</button></div>${learningHtml}${testHtml}</div></div>`);
  }catch(error){
    alert('Unterweisungsvorschau konnte nicht geöffnet werden: '+String(error.message||error));
  }
}

function v38CloseInstructionPreview(){
  document.getElementById('v38InstructionPreviewBackdrop')?.remove();
}
```

Important: do not add `employee-training`, `attemptId`, training progress, answer submission, POST, PATCH, PUT, or DELETE calls to this function path.

- [ ] **Step 3: Export the preview functions**

Extend the existing export without duplicating the module:
```js
Object.assign(window,{
  canEditRichLearning,
  v38SaveInstructionContent,
  v38PreviewLearningStep,
  v38SaveLearningStep,
  v38ClearLearningStep,
  v38LoadLearningSteps,
  v38EditLearningStep,
  v38ToggleLearningStep,
  v38OpenInstructionPreview,
  v38CloseInstructionPreview
});
```

- [ ] **Step 4: Run the focused contract**

Run:
```bash
node --test tests/learning-admin-v38.test.js
```

Expected: all tests in `learning-admin-v38.test.js` pass.

- [ ] **Step 5: Commit the preview implementation**

```bash
git add frontend/learning-admin-v38.js tests/learning-admin-v38.test.js
git commit -m "feat(rc991): add read-only admin instruction preview"
```

### Task 3: Make the existing Admin table “Öffnen” action launch preview instead of only scrolling

**Files:**
- Modify: `frontend/learning-admin-v38.js`
- Test: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: the existing instruction row action / `selectInstructionWorkspaceItem(...)` flow from the instruction workspace and `v38OpenInstructionPreview(typeId)` from Task 2.
- Produces: one user-visible “Öffnen” action that selects the instruction context and then launches the read-only preview.

- [ ] **Step 1: Add a focused wrapper for the row action**

Use one wrapper rather than creating a second competing table action:
```js
function v38OpenInstructionFromTable(typeId){
  if(typeof selectInstructionWorkspaceItem==='function')selectInstructionWorkspaceItem(typeId);
  return v38OpenInstructionPreview(typeId);
}
```

Export `v38OpenInstructionFromTable` with the other `v38` functions.

- [ ] **Step 2: Replace the legacy “Öffnen” handler at the source where `.instruction-row-action` is rendered**

The generated button must call the wrapper, not only the selection/scroll behavior:
```html
<button class="instruction-row-action" type="button" onclick="v38OpenInstructionFromTable('INSTRUCTION_ID')">Öffnen</button>
```

Keep the existing record selection behavior through `selectInstructionWorkspaceItem(typeId)` inside the wrapper so the editor/detail context remains synchronized.

- [ ] **Step 3: Update the static contract to lock the combined behavior**

Require both selection and preview from the same action path:
```js
assert.match(ui,/instruction-row-action[\s\S]{0,260}v38OpenInstructionFromTable/);
assert.match(ui,/v38OpenInstructionFromTable[\s\S]{0,500}selectInstructionWorkspaceItem/);
assert.match(ui,/v38OpenInstructionFromTable[\s\S]{0,500}v38OpenInstructionPreview/);
```

Do not weaken the read-only assertions from Task 1.

- [ ] **Step 4: Run syntax and focused tests**

Run:
```bash
node --check frontend/learning-admin-v38.js
node --test tests/learning-admin-v38.test.js tests/unified-learning-experience.test.cjs
```

Expected: syntax check succeeds and all selected tests pass.

- [ ] **Step 5: Commit the real Open-action wiring**

```bash
git add frontend/learning-admin-v38.js tests/learning-admin-v38.test.js
git commit -m "fix(rc991): make admin open action launch preview"
```

### Task 4: Verify preview regressions before starting login-shell work

**Files:**
- No production file changes expected.
- Verify: `tests/learning-admin-v38.test.js`, `tests/unified-learning-experience.test.cjs`, `tests/blob-missing-download-v41.test.js`, `tests/tenant-isolation-login-v40.test.js`.

**Interfaces:**
- Consumes: completed preview implementation.
- Produces: a green preview checkpoint independent from the login-shell subsystem.

- [ ] **Step 1: Run the preview/security regression set**

```bash
node --test tests/learning-admin-v38.test.js tests/unified-learning-experience.test.cjs tests/blob-missing-download-v41.test.js tests/tenant-isolation-login-v40.test.js
```

Expected: all selected tests pass.

- [ ] **Step 2: Run the repository pretest gate**

```bash
npm run pretest
```

Expected: all pretest contracts pass; the prior 109/110 state is no longer blocked by the Admin preview contract.

- [ ] **Step 3: Do not sync company branches yet**

The preview checkpoint is intentionally held on `rc991-unified-learning-portal`. Essentra/Kontur synchronization happens only after the separate unified-login plan and full workflow are green.
