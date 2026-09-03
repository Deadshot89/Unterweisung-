import { DEMO_DATA } from './demo-data.js';
import { createDemoStore } from './demo-store.js';

const store = createDemoStore(DEMO_DATA, globalThis.localStorage);
const SETUP_NAV_ITEM = ['setup','Einrichtung'];
const MAX_IMAGE_BYTES = 1572864;
const ALLOWED_IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp']);
let setupActive = false;

const esc = (value='') => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const roleLabel = role => ({company_admin:'Firmenadmin',line_manager:'Führungskraft',employee:'Mitarbeiter'}[role] || role);
const modeLabel = mode => mode === 'practical' ? 'Praktisch' : 'Online';

function refs() {
  return {
    role: document.getElementById('demoRole'),
    nav: document.getElementById('demoNav'),
    content: document.getElementById('demoContent'),
    modal: document.getElementById('demoModalRoot')
  };
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  existing?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.append(node);
  globalThis.setTimeout(() => node.remove(), 2600);
}

function showFormError(form, error) {
  let box = form.querySelector('.admin-form-error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'admin-form-error';
    form.prepend(box);
  }
  box.textContent = error?.message || String(error);
}

function updateCompanyHeader() {
  const company = store.getState().company;
  const box = document.querySelector('.demo-company');
  if (!box) return;
  const title = box.querySelector('span');
  const sub = box.querySelector('small');
  if (title) title.textContent = company.name;
  if (sub) sub.textContent = `${company.industry} · ${company.location}`;
}

function setupButton() {
  return document.querySelector('[data-demo-setup-nav]');
}

function syncSetupNavigation() {
  const { role, nav } = refs();
  if (!role || !nav) return;
  const isAdmin = role.value === 'company_admin';
  if (!isAdmin) {
    setupActive = false;
    setupButton()?.remove();
    return;
  }
  if (setupButton()) return;

  const [view,label] = SETUP_NAV_ITEM;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.demoSetupNav = 'true';
  button.dataset.view = view;
  button.textContent = label;
  button.addEventListener('click', event => {
    event.stopPropagation();
    setupActive = true;
    renderSetup();
  });
  nav.append(button);
}

function markSetupActive() {
  const { nav } = refs();
  nav?.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.hasAttribute('data-demo-setup-nav')));
}

function renderSetup() {
  const { role, content } = refs();
  if (!content || role?.value !== 'company_admin' || store.getSession().role !== 'company_admin') return;
  setupActive = true;
  markSetupActive();
  const state = store.getState();
  const company = state.company;
  const managers = state.employees.filter(employee => employee.active !== false && ['company_admin','line_manager'].includes(employee.role));
  const employees = state.employees.filter(employee => employee.active !== false);
  const instructions = state.instructionTypes.filter(instruction => instruction.active !== false);

  content.innerHTML = `<header class="view-header admin-setup-header"><div><div class="eyebrow">Demo-Einrichtung</div><h1>Neue Firma in wenigen Schritten einrichten</h1><p>Alle Änderungen bleiben ausschließlich in diesem Browser und können jederzeit über „Demo zurücksetzen“ verworfen werden.</p></div><span class="status planned">Nur Demo-Admin</span></header>
  <div class="admin-setup-rail" aria-label="Einrichtungsablauf">
    ${setupStep(1,'Unternehmensprofil','Firma, Branche und Standort')}
    ${setupStep(2,'Mitarbeitende','Personen und Rollen pflegen')}
    ${setupStep(3,'Unterweisung','Inhalte und Lernschritte erstellen')}
    ${setupStep(4,'Zuweisung','Unterweisung gezielt verteilen')}
  </div>

  <section class="admin-setup-grid">
    <article class="panel admin-setup-panel" id="setup-company">
      <div class="panel-head"><div><span class="admin-step-tag">Schritt 1</span><h2>Unternehmensprofil</h2><span class="muted">Für die Präsentation lokal anpassbar.</span></div></div>
      <form id="setupCompanyForm" class="admin-form-grid">
        <label class="full">Firmenname<input name="name" required value="${esc(company.name)}"></label>
        <label>Branche<input name="industry" required value="${esc(company.industry)}"></label>
        <label>Standort<input name="location" required value="${esc(company.location)}"></label>
        <div class="full admin-form-actions"><button class="btn primary" type="submit">Unternehmensprofil speichern</button></div>
      </form>
    </article>

    <article class="panel admin-setup-panel" id="setup-employees">
      <div class="panel-head"><div><span class="admin-step-tag">Schritt 2</span><h2>Mitarbeitende</h2><span class="muted">${employees.length} aktive Demo-Personen · ausschließlich .example-Adressen</span></div><button class="btn primary small" type="button" data-add-admin-employee>Demo-Mitarbeiter hinzufügen</button></div>
      <div class="admin-compact-list">${employees.map(employee => employeeRow(employee)).join('')}</div>
    </article>

    <article class="panel admin-setup-panel full-width" id="setup-instructions">
      <div class="panel-head"><div><span class="admin-step-tag">Schritt 3</span><h2>Unterweisung</h2><span class="muted">Online-Inhalte mit Lernschritten und Bildern oder praktische Unterweisungen.</span></div><button class="btn primary small" type="button" data-add-admin-instruction>Unterweisung erstellen</button></div>
      <div class="admin-instruction-grid">${instructions.map(instruction => instructionCard(instruction)).join('')}</div>
    </article>

    <article class="panel admin-setup-panel full-width" id="setup-assignments">
      <div class="panel-head"><div><span class="admin-step-tag">Schritt 4</span><h2>Zuweisung</h2><span class="muted">Eine Unterweisung mehreren Demo-Mitarbeitenden zuordnen.</span></div></div>
      <form id="setupAssignmentForm" class="admin-assignment-form">
        <div class="admin-assignment-controls">
          <label>Unterweisung<select name="instructionId" required><option value="">Bitte auswählen</option>${instructions.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label>
          <label>Fällig am<input name="dueDate" type="date" required value="${esc(state.meta.referenceDate)}"></label>
        </div>
        <div class="admin-employee-picker">${employees.map(employee=>`<label class="admin-check-card"><input type="checkbox" name="employeeId" value="${esc(employee.id)}"><span><b>${esc(employee.name)}</b><small>${esc(employee.department)} · ${esc(employee.jobTitle)}</small></span></label>`).join('')}</div>
        <div class="admin-form-actions"><button type="submit" class="btn primary">Ausgewählte zuweisen</button><span class="muted">Vorhandene Zuordnungen werden nicht doppelt angelegt.</span></div>
      </form>
    </article>
  </section>`;

  bindSetupActions(managers);
}

function setupStep(number,title,text) {
  return `<div class="admin-rail-step"><span>${number}</span><div><b>${esc(title)}</b><small>${esc(text)}</small></div></div>`;
}

function employeeRow(employee) {
  return `<div class="admin-list-row"><div class="avatar">${esc(employee.name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase())}</div><div class="admin-list-main"><b>${esc(employee.name)}</b><span>${esc(employee.department)} · ${esc(employee.jobTitle)}</span></div><span class="pill">${esc(roleLabel(employee.role))}</span><button type="button" class="btn secondary small" data-edit-admin-employee="${esc(employee.id)}">Bearbeiten</button></div>`;
}

function instructionCard(instruction) {
  const stepCount = store.getState().learningSteps.filter(step => step.instructionId === instruction.id).length;
  return `<article class="admin-instruction-card"><div class="admin-instruction-top"><span class="status ${instruction.deliveryMode==='practical'?'planned':'valid'}">${esc(modeLabel(instruction.deliveryMode))}</span><span class="pill">${Number(instruction.intervalMonths || 0)} Monate</span></div><h3>${esc(instruction.name)}</h3><p>${esc(instruction.description || 'Keine Beschreibung hinterlegt.')}</p><div class="admin-instruction-meta"><span>${esc(instruction.category)}</span>${instruction.deliveryMode==='online'?`<span>${stepCount} Lernschritte</span><span>${instruction.testRequired?`Test · ${Number(instruction.passPercent)} %`:'ohne Test'}</span>`:'<span>Praxisbestätigung</span>'}</div><button type="button" class="btn secondary small" data-edit-admin-instruction="${esc(instruction.id)}">Bearbeiten</button></article>`;
}

function bindSetupActions() {
  const companyForm = document.getElementById('setupCompanyForm');
  companyForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(companyForm);
    try {
      store.updateCompanyProfile({ name:data.get('name'), industry:data.get('industry'), location:data.get('location') });
      updateCompanyHeader();
      renderSetup();
      showToast('Unternehmensprofil lokal gespeichert');
    } catch (error) { showFormError(companyForm,error); }
  });

  document.querySelector('[data-add-admin-employee]')?.addEventListener('click', () => openEmployeeEditor());
  document.querySelectorAll('[data-edit-admin-employee]').forEach(button => button.addEventListener('click', () => openEmployeeEditor(button.dataset.editAdminEmployee)));
  document.querySelector('[data-add-admin-instruction]')?.addEventListener('click', () => openInstructionEditor());
  document.querySelectorAll('[data-edit-admin-instruction]').forEach(button => button.addEventListener('click', () => openInstructionEditor(button.dataset.editAdminInstruction)));

  const assignmentForm = document.getElementById('setupAssignmentForm');
  assignmentForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(assignmentForm);
    const selected = data.getAll('employeeId').map(String);
    if (!selected.length) return showFormError(assignmentForm,new Error('Bitte mindestens einen Demo-Mitarbeiter auswählen.'));
    try {
      const created = store.assignInstruction(String(data.get('instructionId') || ''), selected, String(data.get('dueDate') || ''));
      const skipped = selected.length - created.length;
      renderSetup();
      showToast(`${created.length} Zuordnung(en) angelegt${skipped ? ` · ${skipped} bereits vorhanden` : ''}`);
    } catch (error) { showFormError(assignmentForm,error); }
  });
}

function openEmployeeEditor(employeeId) {
  const { modal } = refs();
  if (!modal) return;
  const state = store.getState();
  const employee = employeeId ? state.employees.find(item => item.id === employeeId) : null;
  const managers = state.employees.filter(item => item.active !== false && ['company_admin','line_manager'].includes(item.role) && item.id !== employee?.id);
  modal.innerHTML = `<div class="modal-backdrop"><section class="modal admin-editor-modal" role="dialog" aria-modal="true" aria-labelledby="employeeEditorTitle"><div class="modal-head"><h2 id="employeeEditorTitle">${employee?'Demo-Mitarbeiter bearbeiten':'Demo-Mitarbeiter hinzufügen'}</h2><button type="button" class="btn ghost small" data-admin-close>Schließen</button></div><form id="adminEmployeeForm"><div class="modal-body admin-form-grid"><input type="hidden" name="id" value="${esc(employee?.id||'')}"><label class="full">Name<input name="name" required value="${esc(employee?.name||'')}"></label><label class="full">Demo-E-Mail<input name="email" type="email" required placeholder="vorname.nachname@firma.example" value="${esc(employee?.email||'')}"><small>Aus Sicherheitsgründen akzeptiert die Demo nur Adressen mit der Endung .example.</small></label><label>Abteilung<input name="department" required value="${esc(employee?.department||'')}"></label><label>Funktion<input name="jobTitle" required value="${esc(employee?.jobTitle||'')}"></label><label>Rolle<select name="role"><option value="employee" ${employee?.role==='employee'?'selected':''}>Mitarbeiter</option><option value="line_manager" ${employee?.role==='line_manager'?'selected':''}>Führungskraft</option><option value="company_admin" ${employee?.role==='company_admin'?'selected':''}>Firmenadmin</option></select></label><label>Führungskraft<select name="lineManagerId"><option value="">Keine / oberste Ebene</option>${managers.map(item=>`<option value="${esc(item.id)}" ${item.id===employee?.lineManagerId?'selected':''}>${esc(item.name)} · ${esc(item.jobTitle)}</option>`).join('')}</select></label></div><div class="modal-actions"><button type="button" class="btn ghost" data-admin-close>Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form></section></div>`;
  bindCloseModal();
  const form = document.getElementById('adminEmployeeForm');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      store.saveEmployee({ id:String(data.get('id')||'')||undefined, name:data.get('name'), email:data.get('email'), department:data.get('department'), jobTitle:data.get('jobTitle'), role:data.get('role'), lineManagerId:data.get('lineManagerId') });
      closeModal();
      renderSetup();
      showToast(employee ? 'Demo-Mitarbeiter aktualisiert' : 'Demo-Mitarbeiter angelegt');
    } catch (error) { showFormError(form,error); }
  });
}

function openInstructionEditor(instructionId) {
  const { modal } = refs();
  if (!modal) return;
  const state = store.getState();
  const instruction = instructionId ? state.instructionTypes.find(item => item.id === instructionId) : null;
  const steps = instruction?.deliveryMode === 'online' ? state.learningSteps.filter(step => step.instructionId === instruction.id).sort((a,b)=>a.order-b.order) : [];
  modal.innerHTML = `<div class="modal-backdrop"><section class="modal admin-editor-modal admin-instruction-modal" role="dialog" aria-modal="true" aria-labelledby="instructionEditorTitle"><div class="modal-head"><h2 id="instructionEditorTitle">${instruction?'Unterweisung bearbeiten':'Unterweisung erstellen'}</h2><button type="button" class="btn ghost small" data-admin-close>Schließen</button></div><form id="adminInstructionForm"><div class="modal-body"><div class="admin-form-grid"><input type="hidden" name="id" value="${esc(instruction?.id||'')}"><label class="full">Titel<input name="name" required value="${esc(instruction?.name||'')}"></label><label>Kategorie<input name="category" required value="${esc(instruction?.category||'Arbeitsschutz')}"></label><label>Art<select name="deliveryMode" id="adminDeliveryMode"><option value="online" ${instruction?.deliveryMode!=='practical'?'selected':''}>Online-Unterweisung</option><option value="practical" ${instruction?.deliveryMode==='practical'?'selected':''}>Praktische Unterweisung</option></select></label><label class="full">Beschreibung<textarea name="description" rows="3">${esc(instruction?.description||'')}</textarea></label><label>Intervall in Monaten<input name="intervalMonths" type="number" min="1" max="120" value="${Number(instruction?.intervalMonths||12)}"></label><label class="admin-checkbox-line"><input name="testRequired" type="checkbox" ${instruction?.testRequired?'checked':''}><span>Abschlusstest erforderlich</span></label><label>Bestehensgrenze %<input name="passPercent" type="number" min="0" max="100" value="${Number(instruction?.passPercent||80)}"></label></div>${instruction?.deliveryMode==='online'?learningStepEditor(steps):`<div class="admin-practical-note"><b>Praktische Unterweisung</b><span>Lernschritte und Online-Test werden ausgeblendet. Der Abschluss erfolgt durch eine Demo-Führungskraft.</span></div>`}</div><div class="modal-actions"><button type="button" class="btn ghost" data-admin-close>Abbrechen</button><button type="submit" class="btn primary">Unterweisung speichern</button></div></form></section></div>`;
  bindCloseModal();
  bindLearningImages(instruction?.id);
  const form = document.getElementById('adminInstructionForm');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const saved = store.saveInstruction({ id:String(data.get('id')||'')||undefined, name:data.get('name'), category:data.get('category'), description:data.get('description'), deliveryMode:data.get('deliveryMode'), intervalMonths:data.get('intervalMonths'), testRequired:data.get('testRequired')==='on', passPercent:data.get('passPercent') });
      if (saved.deliveryMode === 'online') {
        form.querySelectorAll('.admin-learning-step[data-step-id]').forEach(card => {
          const stepId = card.dataset.stepId;
          const title = card.querySelector('[data-step-title]')?.value;
          const text = card.querySelector('[data-step-text]')?.value;
          if (stepId && title && text) store.saveLearningStep(saved.id, stepId, { title, text });
        });
      }
      closeModal();
      renderSetup();
      showToast(instruction ? 'Unterweisung aktualisiert' : 'Unterweisung angelegt · drei Lernschritte vorbereitet');
      if (!instruction && saved.deliveryMode === 'online') openInstructionEditor(saved.id);
    } catch (error) { showFormError(form,error); }
  });
}

function learningStepEditor(steps) {
  return `<section class="admin-learning-editor"><div class="admin-learning-head"><div><span class="admin-step-tag">Bildgestützte Inhalte</span><h3>Lernschritte</h3></div><span>PNG, JPEG oder WEBP · max. 1,5 MB</span></div><div class="admin-learning-grid">${steps.map(step=>`<article class="admin-learning-step" data-step-id="${esc(step.id)}"><div class="admin-learning-preview">${step.image?`<img src="${esc(step.image)}" alt="Vorschau ${esc(step.title)}">`:'<div class="admin-image-placeholder">Kein Bild</div>'}</div><label>Titel<input data-step-title value="${esc(step.title)}"></label><label>Erklärung<textarea data-step-text rows="4">${esc(step.text)}</textarea></label><label class="admin-file-label">Eigenes Demo-Bild<input type="file" data-step-image accept=".png,.jpg,.jpeg,.webp"><small>Das Bild bleibt nur lokal in diesem Browser.</small></label></article>`).join('')}</div></section>`;
}

function bindLearningImages(instructionId) {
  if (!instructionId) return;
  document.querySelectorAll('[data-step-image]').forEach(input => input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const card = input.closest('.admin-learning-step');
    const form = input.closest('form');
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return showFormError(form,new Error('Bildformat nicht erlaubt. Bitte PNG, JPEG oder WEBP verwenden.'));
    if (file.size > MAX_IMAGE_BYTES) return showFormError(form,new Error('Bild darf maximal 1,5 MB groß sein.'));
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const saved = store.setLearningStepImage(instructionId, card.dataset.stepId, String(reader.result || ''), file.size);
        const preview = card.querySelector('.admin-learning-preview');
        if (preview) preview.innerHTML = `<img src="${esc(saved.image)}" alt="Lokale Demo-Bildvorschau">`;
        showToast('Demo-Bild lokal gespeichert');
      } catch (error) { showFormError(form,error); }
    };
    reader.onerror = () => showFormError(form,new Error('Das Demo-Bild konnte lokal nicht gelesen werden.'));
    reader.readAsDataURL(file);
  }));
}

function bindCloseModal() {
  document.querySelectorAll('[data-admin-close]').forEach(button => button.addEventListener('click', closeModal));
  document.querySelector('.modal-backdrop')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeModal(); });
}

function closeModal() {
  const { modal } = refs();
  if (modal) modal.innerHTML = '';
}

function initAdminSetup() {
  const { role, nav } = refs();
  if (!role || !nav) return;
  nav.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && !button.hasAttribute('data-demo-setup-nav')) setupActive = false;
  }, true);
  role.addEventListener('change', () => {
    setupActive = false;
    queueMicrotask(syncSetupNavigation);
  });
  const observer = new MutationObserver(() => {
    syncSetupNavigation();
    if (setupActive && role.value === 'company_admin') markSetupActive();
  });
  observer.observe(nav, { childList:true });
  syncSetupNavigation();
  updateCompanyHeader();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAdminSetup, { once:true });
  else initAdminSetup();
}

export { renderSetup, openEmployeeEditor, openInstructionEditor };
