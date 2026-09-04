# RC991 Admin Instruction Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Admin/HSE “Öffnen” action launch a real learner-style read-only instruction preview without creating or mutating training, test, completion, or proof state.

**Architecture:** Keep `frontend/learning-experience-v38.js` as the pure presentation layer, add preview orchestration to `frontend/learning-admin-v38.js`, and change the actual “Öffnen” button at its source in `frontend/instruction-type-management-v23.js`. The preview reads company-scoped learning steps, protected image download URLs, and test questions using existing GET endpoints; it must never call `employee-training` or any write endpoint.

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

- Modify `frontend/learning-admin-v38.js`: own Admin/HSE preview loading, protected image resolution, rendering, and modal lifecycle.
- Modify `frontend/instruction-type-management-v23.js`: replace the legacy selection-only “Öffnen” action with the preview wrapper at the actual table-render source.
- Reuse `frontend/learning-experience-v38.js`: pure renderers `renderLearningStep()` and `renderQuestionList()`; no network or mutation logic is added here.
- Modify/test `tests/learning-admin-v38.test.js`: inspect both the preview module and the table-render source so the contract matches the real file boundary.

### Task 1: Confirm and correct the existing RED preview contract

**Files:**
- Modify: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: source text from `frontend/learning-admin-v38.js` and `frontend/instruction-type-management-v23.js`.
- Produces: one focused failing contract proving the missing preview function and selection-only table action before implementation.

- [ ] **Step 1: Run the focused preview test before changing implementation**

```bash
node --test tests/learning-admin-v38.test.js
```

Expected: the first two tests pass and `admin table Open action launches a read-only learner-style instruction preview` fails because `v38OpenInstructionPreview` is not implemented.

- [ ] **Step 2: Correct the test so it checks the real table-render file instead of forcing table markup into the preview module**

Use these source variables in the preview test:
```js
const ui=read('frontend/learning-admin-v38.js');
const workspace=read('frontend/instruction-type-management-v23.js');
```

Keep the preview requirements on `ui`:
```js
assert.match(ui,/v38OpenInstructionPreview/,'Eine echte Admin-Unterweisungsvorschau fehlt.');
assert.match(ui,/\/learning-steps\?instructionTypeId=/);
assert.match(ui,/\/files\/.*\/download/);
assert.match(ui,/renderer\.renderLearningStep/);
assert.match(ui,/renderer\.renderQuestionList/);
assert.match(ui,/Nur Vorschau|Vorschau.*kein.*Abschluss|keinen.*Lernfortschritt/is);
const previewStart=ui.indexOf('async function v38OpenInstructionPreview');
const previewSlice=previewStart>=0?ui.slice(previewStart,previewStart+8000):'';
assert.doesNotMatch(previewSlice,/employee-training|attemptId|currentStep\s*:|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
```

Check the actual table source separately:
```js
assert.match(workspace,/instruction-row-action[\s\S]{0,320}v38OpenInstructionFromTable/,
  'Der Tabellenknopf Öffnen muss die echte Vorschau starten.');
```

- [ ] **Step 3: Re-run the focused contract and confirm it remains RED for the intended missing implementation**

```bash
node --test tests/learning-admin-v38.test.js
```

Expected: RED because neither `v38OpenInstructionPreview` nor the new table wrapper wiring exists yet.

- [ ] **Step 4: Commit the corrected RED contract**

```bash
git add tests/learning-admin-v38.test.js
git commit -m "test(rc991): align admin preview contract with real table source"
```

### Task 2: Implement company-scoped read-only preview loading

**Files:**
- Modify: `frontend/learning-admin-v38.js`
- Test: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: `api(path, options)`, `currentType(typeId)`, `canEditRichLearning()`, `globalThis.UMLearningExperience`.
- Produces: `v38OpenInstructionPreview(typeId)`, `v38CloseInstructionPreview()`, `v38OpenInstructionFromTable(typeId)`.

- [ ] **Step 1: Add a protected-image resolver that performs only GET behavior**

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

- [ ] **Step 2: Add the read-only preview orchestration**

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

function v38OpenInstructionFromTable(typeId){
  if(typeof selectInstructionWorkspaceItem==='function')selectInstructionWorkspaceItem(typeId);
  return v38OpenInstructionPreview(typeId);
}
```

The preview path must contain no training write calls and no write method options.

- [ ] **Step 3: Export only the new focused functions alongside the existing exports**

Extend the existing `Object.assign(window,{...})` with:
```js
v38OpenInstructionPreview,
v38CloseInstructionPreview,
v38OpenInstructionFromTable
```

Do not create a second module or override `instructionTypeTable()` from `learning-admin-v38.js`.

- [ ] **Step 4: Run syntax and the focused preview test**

```bash
node --check frontend/learning-admin-v38.js
node --test tests/learning-admin-v38.test.js
```

Expected: preview-specific assertions pass; the table-action assertion remains RED until Task 3.

- [ ] **Step 5: Commit the preview implementation**

```bash
git add frontend/learning-admin-v38.js tests/learning-admin-v38.test.js
git commit -m "feat(rc991): add read-only admin instruction preview"
```

### Task 3: Change the actual Admin table “Öffnen” action at its source

**Files:**
- Modify: `frontend/instruction-type-management-v23.js`
- Test: `tests/learning-admin-v38.test.js`

**Interfaces:**
- Consumes: global `v38OpenInstructionFromTable(typeId)` from Task 2.
- Produces: one “Öffnen” button that preserves selection/detail synchronization and launches the preview.

- [ ] **Step 1: Replace only the existing action-cell button inside `instructionTypeTable()`**

Change this existing source:
```js
<td class="actions-cell instruction-row-action"><button class="small" data-instruction-action="selectInstructionWorkspaceItem" data-instruction-id="${esc(t.id)}">Öffnen</button></td>
```

to:
```js
<td class="actions-cell instruction-row-action"><button class="small" type="button" onclick="v38OpenInstructionFromTable('${esc(t.id)}')">Öffnen</button></td>
```

The separate instruction-name button may keep its existing `selectInstructionWorkspaceItem` behavior; only the explicit “Öffnen” action changes semantics.

- [ ] **Step 2: Re-run the focused contract**

```bash
node --check frontend/instruction-type-management-v23.js
node --test tests/learning-admin-v38.test.js tests/unified-learning-experience.test.cjs
```

Expected: all selected tests pass.

- [ ] **Step 3: Commit the real Open-action wiring**

```bash
git add frontend/instruction-type-management-v23.js tests/learning-admin-v38.test.js
git commit -m "fix(rc991): make admin open action launch preview"
```

### Task 4: Verify preview regressions before starting login-shell work

**Files:**
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

Expected: all pretest contracts pass; the previous Admin-preview failure is gone.

- [ ] **Step 3: Hold synchronization until the login plan is also green**

Keep the checkpoint only on `rc991-unified-learning-portal`. Do not update `company/essentra-components`, `company/kontur-werkzeugstahl`, or `main` yet.
