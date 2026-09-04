import { DEMO_DATA } from './demo-data.js';
import { createDemoStore } from './demo-store.js';
import { buildDemoProofHtml } from './demo-proof.js';

const store = createDemoStore(DEMO_DATA, globalThis.localStorage);
const refs = {};
let currentView = 'dashboard';
let learningSession = null;

const esc = (value='') => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtDate = value => { if(!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); };
const initials = name => String(name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
const employeeById = id => store.getState().employees.find(x=>x.id===id);
const instructionById = id => store.getState().instructionTypes.find(x=>x.id===id);
const assignmentFor = (employeeId,instructionId) => store.getState().assignments.find(x=>x.employeeId===employeeId&&x.instructionId===instructionId);
const statusInfo = status => ({valid:['Gültig','valid'],soon:['Bald fällig','soon'],critical:['Kritisch','critical'],expired:['Überfällig','expired'],missing:['Noch offen','missing'],in_progress:['In Bearbeitung','in_progress'],planned:['Geplant','planned'],practical_pending:['Bestätigung offen','practical_pending'],not_required:['Nicht erforderlich','not_required']}[status]||[status,'']);
const statusBadge = status => { const [label,cls]=statusInfo(status); return `<span class="status ${cls}">${esc(label)}</span>`; };

function init() {
  refs.role = document.getElementById('demoRole');
  refs.person = document.getElementById('demoPerson');
  refs.reset = document.getElementById('demoReset');
  refs.nav = document.getElementById('demoNav');
  refs.content = document.getElementById('demoContent');
  refs.modal = document.getElementById('demoModalRoot');
  refs.role.addEventListener('change', onRoleChange);
  refs.person.addEventListener('change', onPersonChange);
  refs.reset.addEventListener('click', () => {
    if (!globalThis.confirm('Demo zurücksetzen? Alle während der Präsentation simulierten Änderungen werden verworfen.')) return;
    store.reset();
    refs.role.value = 'company_admin';
    currentView = 'dashboard';
    syncPeople();
    renderApp();
    toast('Demo zurückgesetzt');
  });
  syncPeople();
  renderApp();
}

function candidatesForRole(role) {
  const employees = store.getState().employees.filter(x=>x.active!==false);
  if (role === 'company_admin') return employees.filter(x=>x.role==='company_admin');
  if (role === 'line_manager') return employees.filter(x=>x.role==='line_manager');
  return employees.filter(x=>x.role==='employee');
}

function syncPeople(preferredId) {
  const role = refs.role.value;
  const candidates = candidatesForRole(role);
  const chosen = candidates.find(x=>x.id===preferredId) || candidates[0];
  refs.person.innerHTML = candidates.map(x=>`<option value="${esc(x.id)}" ${x.id===chosen?.id?'selected':''}>${esc(x.name)} · ${esc(x.department)}</option>`).join('');
  if (chosen) store.setRole(role, chosen.id);
}

function onRoleChange() {
  currentView = refs.role.value === 'employee' ? 'my-training' : 'dashboard';
  syncPeople();
  renderApp();
}
function onPersonChange() {
  store.setRole(refs.role.value, refs.person.value);
  renderApp();
}

function navItems() {
  const role = store.getSession().role;
  if (role === 'company_admin') return [['dashboard','Dashboard'],['employees','Mitarbeiter'],['instructions','Unterweisungen'],['status','Status'],['planning','Planung'],['proofs','Nachweise']];
  if (role === 'line_manager') return [['dashboard','Team'],['planning','Planung'],['proofs','Nachweise']];
  return [['my-training','Meine Unterweisungen'],['proofs','Meine Nachweise']];
}

function renderNav() {
  const items = navItems();
  if (!items.some(([id])=>id===currentView)) currentView = items[0][0];
  refs.nav.innerHTML = items.map(([id,label])=>`<button type="button" data-view="${id}" class="${id===currentView?'active':''}">${esc(label)}</button>`).join('');
  refs.nav.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{currentView=btn.dataset.view;renderApp();}));
}

function renderApp() {
  renderNav();
  const role = store.getSession().role;
  if (role === 'company_admin') {
    if (currentView === 'dashboard') return renderAdminDashboard();
    if (currentView === 'employees') return renderEmployees();
    if (currentView === 'instructions') return renderInstructions();
    if (currentView === 'status') return renderStatus();
    if (currentView === 'planning') return renderPlanning();
    return renderProofs();
  }
  if (role === 'line_manager') {
    if (currentView === 'dashboard') return renderManagerDashboard();
    if (currentView === 'planning') return renderPlanning();
    return renderProofs();
  }
  if (currentView === 'proofs') return renderProofs();
  return renderEmployeeDashboard();
}

function counts() {
  const assignments = store.getState().assignments;
  const c = status => assignments.filter(x=>x.status===status).length;
  return {
    employees: store.getState().employees.filter(x=>x.active!==false).length,
    instructions: store.getState().instructionTypes.filter(x=>x.active!==false).length,
    valid:c('valid'), soon:c('soon')+c('critical'), overdue:c('expired'), missing:c('missing'), planned:c('planned'),
    completion: Math.round((store.getState().records.length / Math.max(1,assignments.filter(x=>x.status!=='not_required').length))*100)
  };
}

function kpi(label,value,hint,tone='info') { return `<article class="kpi-card tone-${tone}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="hint">${esc(hint||'')}</div></article>`; }

export function renderAdminDashboard() {
  const c = counts();
  const urgent = store.getState().assignments.filter(x=>['expired','critical','missing','practical_pending'].includes(x.status)).slice(0,7);
  const deptCounts = new Map();
  store.getState().employees.forEach(e=>deptCounts.set(e.department,(deptCounts.get(e.department)||0)+1));
  const max = Math.max(...deptCounts.values());
  refs.content.innerHTML = `<header class="view-header"><div><div class="eyebrow">Unternehmensübersicht</div><h1>Unterweisungen im Blick</h1><p>${esc(store.getState().company.name)} · aktueller Demo-Stand</p></div><span class="status valid">System bereit</span></header>
  <div class="kpi-grid">${kpi('Mitarbeitende',c.employees,'4 Abteilungen','info')}${kpi('Unterweisungen',c.instructions,'Online & praktisch','info')}${kpi('Gültig',c.valid,'aktuell nachgewiesen','good')}${kpi('Bald fällig',c.soon,'nächste Fristen','warn')}${kpi('Überfällig',c.overdue,'sofort prüfen','bad')}${kpi('Fehlend',c.missing,'noch nie abgeschlossen','warn')}${kpi('Geplant',c.planned,'Termine vorbereitet','info')}${kpi('Abschlussquote',`${c.completion}%`,'über Demo-Zuordnungen','good')}</div>
  <div class="grid-2"><section class="panel"><div class="panel-head"><div><h2>Handlungsbedarf</h2><span class="muted">Priorisierte Beispielvorgänge für die Präsentation</span></div></div><div class="action-list">${urgent.map(item=>actionRow(item)).join('')}</div></section>
  <section class="panel"><div class="panel-head"><div><h2>Abteilungen</h2><span class="muted">Aktive Demo-Mitarbeitende</span></div></div><div class="department-bars">${[...deptCounts.entries()].map(([dept,n])=>`<div class="department-row"><span>${esc(dept)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div><b>${n}</b></div>`).join('')}</div></section></div>`;
  bindContentActions();
}

function actionRow(item) {
  const e=employeeById(item.employeeId), t=instructionById(item.instructionId);
  return `<div class="action-item"><div class="action-icon">!</div><div><strong>${esc(e?.name)}</strong><span>${esc(t?.name)} · ${fmtDate(item.dueDate)}</span></div>${statusBadge(item.status)}</div>`;
}

export function renderManagerDashboard() {
  const manager = employeeById(store.getSession().employeeId);
  const team = store.getVisibleEmployees();
  refs.content.innerHTML = `<header class="view-header"><div><div class="eyebrow">Führungskraft</div><h1>Team von ${esc(manager?.name)}</h1><p>Nur direkte Demo-Mitarbeitende sind in dieser Ansicht sichtbar.</p></div><span class="status planned">${team.length} Teammitglieder</span></header>
  <div class="team-grid">${team.map(teamCard).join('')}</div>`;
  bindContentActions();
}

function teamCard(employee) {
  const items=store.getState().assignments.filter(x=>x.employeeId===employee.id);
  const open=items.filter(x=>['missing','critical','expired','in_progress','practical_pending'].includes(x.status)).length;
  const planned=store.getState().plannedTrainings.filter(x=>x.employeeId===employee.id&&x.status==='planned').length;
  const valid=items.filter(x=>x.status==='valid').length;
  const practical=items.find(x=>x.status==='practical_pending'&&instructionById(x.instructionId)?.deliveryMode==='practical');
  return `<article class="team-card"><div class="person"><div class="avatar">${initials(employee.name)}</div><div class="person-meta"><strong>${esc(employee.name)}</strong><span>${esc(employee.jobTitle)}</span></div></div><div class="mini-stats"><div class="mini-stat"><b>${open}</b><span>offen</span></div><div class="mini-stat"><b>${planned}</b><span>geplant</span></div><div class="mini-stat"><b>${valid}</b><span>gültig</span></div></div><div class="training-actions" style="margin-top:12px"><button class="btn secondary small" data-schedule="${employee.id}">Termin planen</button>${practical?`<button class="btn success small" data-confirm="${employee.id}|${practical.instructionId}">Praxis bestätigen</button>`:''}</div></article>`;
}

export function renderEmployeeDashboard() {
  const employee=employeeById(store.getSession().employeeId);
  const buckets=store.getEmployeeBuckets(employee.id);
  refs.content.innerHTML = `<div class="employee-hero"><div><div class="eyebrow" style="color:#93c5fd">Meine Unterweisungen</div><h1 style="margin:3px 0 0">Hallo ${esc(employee.name.split(' ')[0])}</h1><p>${esc(employee.jobTitle)} · ${esc(employee.department)}</p></div><div class="avatar">${initials(employee.name)}</div></div><div class="bucket-stack">${bucket('Jetzt erledigen',buckets.now,'Direkt online starten oder fortsetzen',employee.id,'now')}${bucket('Einplanung erforderlich',buckets.scheduling,'Praktische Unterweisungen benötigen eine Führungskraft',employee.id,'schedule')}${plannedBucket(buckets.planned)}${bucket('Bald fällig',buckets.soon,'Noch gültig, aber demnächst erneut erforderlich',employee.id,'soon')}${completedBucket(buckets.completed)}</div>`;
  bindContentActions();
}

function bucket(title,items,hint,employeeId,kind){
  return `<section class="employee-bucket"><div class="bucket-title"><div><h2>${esc(title)}</h2><span>${esc(hint)}</span></div><span class="pill">${items.length}</span></div>${items.length?`<div class="training-list">${items.map(item=>trainingCard(item,employeeId,kind)).join('')}</div>`:`<div class="empty">Aktuell keine Einträge in diesem Bereich.</div>`}</section>`;
}
function trainingCard(item,employeeId,kind){
  const instruction=item.instruction||instructionById(item.instructionId);
  let action='';
  if(kind==='now') action=`<button class="btn primary small" data-learn="${instruction.id}">${item.status==='in_progress'?'Fortsetzen':'Starten'}</button>`;
  if(kind==='schedule') action=`<button class="btn secondary small" data-request="${instruction.id}">Termin anfragen</button>`;
  return `<article class="training-card"><h3>${esc(instruction?.name)}</h3><p>${esc(instruction?.description)}</p><div class="training-meta">${statusBadge(item.status)}<span class="pill">Fällig ${fmtDate(item.dueDate)}</span><span class="pill">${instruction?.deliveryMode==='practical'?'Praktisch':'Online'}</span></div><div class="training-actions">${action}</div></article>`;
}
function plannedBucket(items){return `<section class="employee-bucket"><div class="bucket-title"><div><h2>Geplante Termine</h2><span>Bereits mit einer Demo-Führungskraft eingeplant</span></div><span class="pill">${items.length}</span></div>${items.length?`<div class="training-list">${items.map(item=>{const responsible=employeeById(item.responsibleId);return `<article class="training-card"><h3>${esc(item.instruction?.name)}</h3><p>${fmtDate(item.date)} · Verantwortlich: ${esc(responsible?.name||'—')}</p><div class="training-meta"><span class="status planned">Geplant</span></div></article>`}).join('')}</div>`:`<div class="empty">Noch keine Termine eingeplant.</div>`}</section>`}
function completedBucket(items){return `<section class="employee-bucket"><div class="bucket-title"><div><h2>Abgeschlossen</h2><span>Historie und Demo-Nachweise</span></div><span class="pill">${items.length}</span></div>${items.length?`<div class="training-list">${items.slice().reverse().map(item=>`<article class="training-card"><h3>${esc(item.instruction?.name)}</h3><p>Abgeschlossen am ${fmtDate(item.completedAt)}</p><div class="training-actions"><button class="btn secondary small" data-proof="${item.id}">Nachweis öffnen</button><button class="btn ghost small" data-download-proof="${item.id}">Nachweis herunterladen</button></div></article>`).join('')}</div>`:`<div class="empty">Noch keine abgeschlossenen Demo-Unterweisungen.</div>`}</section>`}

function renderEmployees(){const rows=store.getState().employees;refs.content.innerHTML=`<header class="view-header"><div><div class="eyebrow">Stammdaten</div><h1>Mitarbeiter</h1><p>Vollständig fiktiver Demo-Personalbestand.</p></div><button class="btn primary" data-add-employee>Demo-Mitarbeiter hinzufügen</button></header><section class="panel"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Abteilung</th><th>Funktion</th><th>Demo-E-Mail</th><th>Rolle</th></tr></thead><tbody>${rows.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.department)}</td><td>${esc(e.jobTitle)}</td><td>${esc(e.email)}</td><td>${esc(e.role)}</td></tr>`).join('')}</tbody></table></div></section>`;bindContentActions();}
function renderInstructions(){const rows=store.getState().instructionTypes;refs.content.innerHTML=`<header class="view-header"><div><div class="eyebrow">Katalog</div><h1>Unterweisungen</h1><p>Online-Lernstrecken und praktische Unterweisungen in einer Übersicht.</p></div></header><section class="panel"><div class="table-wrap"><table><thead><tr><th>Unterweisung</th><th>Kategorie</th><th>Durchführung</th><th>Test</th><th>Intervall</th></tr></thead><tbody>${rows.map(t=>`<tr><td><b>${esc(t.name)}</b><br><span class="muted">${esc(t.description)}</span></td><td>${esc(t.category)}</td><td><span class="pill">${t.deliveryMode==='online'?'Online':'Praktisch'}</span></td><td>${t.testRequired?`${t.passPercent}% erforderlich`:'ohne Test'}</td><td>${t.intervalMonths} Monate</td></tr>`).join('')}</tbody></table></div></section>`;}
function renderStatus(){const rows=store.getState().assignments;refs.content.innerHTML=`<header class="view-header"><div><div class="eyebrow">Statusmatrix</div><h1>Unterweisungsstatus</h1><p>Gemischte Beispielzustände für eine realistische Präsentation.</p></div></header><section class="panel"><div class="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Unterweisung</th><th>Fällig</th><th>Status</th></tr></thead><tbody>${rows.map(a=>`<tr><td><b>${esc(employeeById(a.employeeId)?.name)}</b></td><td>${esc(instructionById(a.instructionId)?.name)}</td><td>${fmtDate(a.dueDate)}</td><td>${statusBadge(a.status)}</td></tr>`).join('')}</tbody></table></div></section>`;}
function renderPlanning(){const session=store.getSession();const plans=store.getState().plannedTrainings.filter(p=>p.status==='planned'&&(session.role==='company_admin'||p.responsibleId===session.employeeId||p.employeeId===session.employeeId));refs.content.innerHTML=`<header class="view-header"><div><div class="eyebrow">Planung</div><h1>Geplante Unterweisungen</h1><p>Alle Änderungen bleiben ausschließlich in dieser Browser-Demo.</p></div>${session.role!=='employee'?'<button class="btn primary" data-plan-generic>Termin simulieren</button>':''}</header><section class="panel">${plans.length?`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Mitarbeiter</th><th>Unterweisung</th><th>Verantwortlich</th><th>Aktion</th></tr></thead><tbody>${plans.map(p=>`<tr><td>${fmtDate(p.date)}</td><td>${esc(employeeById(p.employeeId)?.name)}</td><td>${esc(instructionById(p.instructionId)?.name)}</td><td>${esc(employeeById(p.responsibleId)?.name)}</td><td>${session.role!=='employee'?`<button class="btn success small" data-confirm="${p.employeeId}|${p.instructionId}">Durchführung bestätigen</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Keine geplanten Demo-Termine.</div>'}</section>`;bindContentActions();}
function renderProofs(){const session=store.getSession();const visibleIds=new Set(store.getVisibleEmployees().map(x=>x.id));const records=store.getState().records.filter(r=>session.role==='company_admin'||visibleIds.has(r.employeeId));refs.content.innerHTML=`<header class="view-header"><div><div class="eyebrow">Nachweise</div><h1>${session.role==='employee'?'Meine Nachweise':'Unterweisungsnachweise'}</h1><p>Alle Dokumente sind klar als DEMO / MUSTER gekennzeichnet.</p></div></header><section class="panel">${records.length?`<div class="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Unterweisung</th><th>Abschluss</th><th>Quelle</th><th>Nachweis</th></tr></thead><tbody>${records.map(r=>`<tr><td>${esc(employeeById(r.employeeId)?.name)}</td><td>${esc(instructionById(r.instructionId)?.name)}</td><td>${fmtDate(r.completedAt)}</td><td>${r.source==='demo-practical'?'Praktisch':'Online'}</td><td><button class="btn secondary small" data-proof="${r.id}">Öffnen</button> <button class="btn ghost small" data-download-proof="${r.id}">Download</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Keine Demo-Nachweise vorhanden.</div>'}</section>`;bindContentActions();}

export function openLearning(instructionId){const employeeId=store.getSession().employeeId;const instruction=instructionById(instructionId);const steps=store.getState().learningSteps.filter(x=>x.instructionId===instructionId).sort((a,b)=>a.order-b.order);const assignment=assignmentFor(employeeId,instructionId);learningSession={employeeId,instructionId,steps,index:Math.min(Number(assignment?.progress||0),Math.max(0,steps.length-1))};renderLearningStep();}
function renderLearningStep(){const s=learningSession;if(!s)return;const step=s.steps[s.index];const assignment=assignmentFor(s.employeeId,s.instructionId);const progress=Math.min(100,Math.round((Number(assignment?.progress||0)/Math.max(1,s.steps.length))*100));refs.modal.innerHTML=`<div class="modal-backdrop"><section class="modal learning-modal"><div class="modal-head"><div><span class="eyebrow">Online-Unterweisung</span><h2>${esc(instructionById(s.instructionId)?.name)}</h2></div><button class="btn ghost small" data-close-modal>Schließen</button></div><div class="modal-body"><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div><div class="learning-layout"><div class="learning-visual"><img src="${esc(step.image)}" alt="${esc(step.title)}"><button class="btn secondary small zoom-trigger" data-zoom="${esc(step.image)}">Bild vergrößern</button></div><div class="learning-copy"><div class="eyebrow">Schritt ${s.index+1} von ${s.steps.length}</div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p><div class="training-meta"><span class="pill">Fortschritt ${progress}%</span><span class="pill">Demo-Lerninhalt</span></div></div></div></div><div class="modal-actions"><button class="btn ghost" data-learning-back ${s.index===0?'disabled':''}>Zurück</button><button class="btn primary" data-learning-next>${s.index===s.steps.length-1?(instructionById(s.instructionId)?.testRequired?'Zum Test':'Unterweisung abschließen'):'Weiter'}</button></div></section></div>`;bindModalActions();}
export function renderTrainingTest(){const s=learningSession;const def=store.getState().tests.find(x=>x.instructionId===s.instructionId);refs.modal.innerHTML=`<div class="modal-backdrop"><section class="modal learning-modal"><div class="modal-head"><div><span class="eyebrow">Abschlusstest</span><h2>${esc(instructionById(s.instructionId)?.name)}</h2></div><button class="btn ghost small" data-close-modal>Schließen</button></div><form id="demoTrainingTest"><div class="modal-body">${(def?.questions||[]).map((q,idx)=>`<div class="question"><strong>${idx+1}. ${esc(q.text)}</strong>${q.options.map((o,i)=>`<label><input type="radio" name="${esc(q.id)}" value="${i}" required><span>${esc(o)}</span></label>`).join('')}</div>`).join('')}</div><div class="modal-actions"><button class="btn ghost" type="button" data-learning-return>Zurück zum Inhalt</button><button class="btn primary" type="submit">Test auswerten</button></div></form></section></div>`;bindModalActions();document.getElementById('demoTrainingTest')?.addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(event.currentTarget);const answers={};for(const q of def.questions)answers[q.id]=Number(fd.get(q.id));const result=store.submitTest(s.employeeId,s.instructionId,answers);renderTrainingResult(result);});}
function renderTrainingResult(result){const passed=result.passed;refs.modal.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>Testergebnis</h2><button class="btn ghost small" data-close-modal>Schließen</button></div><div class="modal-body"><div class="result-box ${passed?'pass':'fail'}"><div style="font-size:42px;font-weight:900">${result.score}%</div><h3>${passed?'Bestanden':'Noch nicht bestanden'}</h3><p>${passed?'Die Demo-Unterweisung kann jetzt abgeschlossen werden.':'Versuche den Test erneut. Der Lernfortschritt bleibt erhalten.'}</p></div></div><div class="modal-actions">${passed?'<button class="btn success" data-complete-online>Unterweisung abschließen</button>':'<button class="btn primary" data-retry-test>Test erneut versuchen</button>'}</div></section></div>`;bindModalActions();}

export function openScheduleDialog(employeeId, instructionId){const state=store.getState();const visible=store.getVisibleEmployees();const practical=state.instructionTypes.filter(x=>x.deliveryMode==='practical');refs.modal.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="modal-head"><div><span class="eyebrow">Demo-Planung</span><h2>Praktische Unterweisung einplanen</h2></div><button class="btn ghost small" data-close-modal>Schließen</button></div><form id="demoScheduleForm"><div class="modal-body"><p class="muted">Wird nur lokal in dieser Demo gespeichert.</p><div class="form-grid"><label>Mitarbeiter<select name="employeeId" required>${visible.map(e=>`<option value="${e.id}" ${e.id===employeeId?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label><label>Unterweisung<select name="instructionId" required>${practical.map(t=>`<option value="${t.id}" ${t.id===instructionId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label class="full">Termin<input type="datetime-local" name="date" value="2026-09-10T10:00" required></label></div></div><div class="modal-actions"><button type="button" class="btn ghost" data-close-modal>Abbrechen</button><button type="submit" class="btn primary">Termin speichern</button></div></form></section></div>`;bindModalActions();document.getElementById('demoScheduleForm')?.addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(event.currentTarget);store.schedulePractical(store.getSession().employeeId,String(fd.get('employeeId')),String(fd.get('instructionId')),String(fd.get('date')));closeModal();renderApp();toast('Demo-Termin gespeichert');});}
export function openPracticalConfirmation(employeeId,instructionId){const e=employeeById(employeeId),t=instructionById(instructionId);refs.modal.innerHTML=`<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>Praktische Durchführung bestätigen</h2><button class="btn ghost small" data-close-modal>Schließen</button></div><div class="modal-body"><p><strong>${esc(e?.name)}</strong></p><p>${esc(t?.name)}</p><p class="muted">Die Bestätigung wird nur im lokalen Demo-Zustand gespeichert.</p></div><div class="modal-actions"><button class="btn ghost" data-close-modal>Abbrechen</button><button class="btn success" data-confirm-practical="${employeeId}|${instructionId}">Durchführung bestätigen</button></div></section></div>`;bindModalActions();}
export function openDemoProof(recordId,download=false){const record=store.getState().records.find(x=>x.id===recordId);if(!record)return toast('Demo-Nachweis nicht gefunden');const html=buildDemoProofHtml({company:store.getState().company,employee:employeeById(record.employeeId),instruction:instructionById(record.instructionId),completedAt:record.completedAt,confirmedBy:record.confirmedBy?employeeById(record.confirmedBy)?.name:null});const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);if(download){const a=document.createElement('a');a.href=url;a.download=`DEMO_Nachweis_${employeeById(record.employeeId)?.name.replace(/\s+/g,'_')}_${instructionById(record.instructionId)?.name.replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g,'_')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}else{globalThis.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),30000);}}

function bindContentActions(){refs.content.querySelectorAll('[data-learn]').forEach(x=>x.addEventListener('click',()=>openLearning(x.dataset.learn)));refs.content.querySelectorAll('[data-proof]').forEach(x=>x.addEventListener('click',()=>openDemoProof(x.dataset.proof)));refs.content.querySelectorAll('[data-download-proof]').forEach(x=>x.addEventListener('click',()=>openDemoProof(x.dataset.downloadProof,true)));refs.content.querySelectorAll('[data-schedule]').forEach(x=>x.addEventListener('click',()=>openScheduleDialog(x.dataset.schedule)));refs.content.querySelectorAll('[data-plan-generic]').forEach(x=>x.addEventListener('click',()=>openScheduleDialog(store.getVisibleEmployees()[0]?.id)));refs.content.querySelectorAll('[data-confirm]').forEach(x=>x.addEventListener('click',()=>{const [e,t]=x.dataset.confirm.split('|');openPracticalConfirmation(e,t);}));refs.content.querySelectorAll('[data-request]').forEach(x=>x.addEventListener('click',()=>toast('Demo-Anfrage erstellt – die Führungskraft würde jetzt informiert.')));refs.content.querySelectorAll('[data-add-employee]').forEach(x=>x.addEventListener('click',()=>toast('Demo-Funktion: Stammdaten können in der Kundenumgebung verwaltet werden.')));}
function bindModalActions(){refs.modal.querySelectorAll('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));refs.modal.querySelectorAll('[data-learning-back]').forEach(x=>x.addEventListener('click',()=>{learningSession.index=Math.max(0,learningSession.index-1);renderLearningStep();}));refs.modal.querySelectorAll('[data-learning-return]').forEach(x=>x.addEventListener('click',renderLearningStep));refs.modal.querySelectorAll('[data-learning-next]').forEach(x=>x.addEventListener('click',()=>{const assignment=assignmentFor(learningSession.employeeId,learningSession.instructionId);if(Number(assignment?.progress||0)<=learningSession.index)store.advanceLearning(learningSession.employeeId,learningSession.instructionId);if(learningSession.index<learningSession.steps.length-1){learningSession.index++;renderLearningStep();return;}const ins=instructionById(learningSession.instructionId);if(ins.testRequired)renderTrainingTest();else{store.submitTest(learningSession.employeeId,learningSession.instructionId,{});store.completeOnline(learningSession.employeeId,learningSession.instructionId);closeModal();renderApp();toast('Demo-Unterweisung abgeschlossen');}}));refs.modal.querySelectorAll('[data-retry-test]').forEach(x=>x.addEventListener('click',renderTrainingTest));refs.modal.querySelectorAll('[data-complete-online]').forEach(x=>x.addEventListener('click',()=>{store.completeOnline(learningSession.employeeId,learningSession.instructionId);closeModal();renderApp();toast('Demo-Unterweisung erfolgreich abgeschlossen');}));refs.modal.querySelectorAll('[data-confirm-practical]').forEach(x=>x.addEventListener('click',()=>{const [e,t]=x.dataset.confirmPractical.split('|');store.confirmPractical(store.getSession().employeeId,e,t);closeModal();renderApp();toast('Praktische Demo-Unterweisung bestätigt');}));refs.modal.querySelectorAll('[data-zoom]').forEach(x=>x.addEventListener('click',()=>openZoom(x.dataset.zoom)));}
function openZoom(src){const overlay=document.createElement('div');overlay.className='zoom-overlay';overlay.innerHTML=`<button class="btn ghost zoom-close">Schließen</button><img src="${esc(src)}" alt="Vergrößerte Demo-Illustration">`;overlay.querySelector('button').addEventListener('click',()=>overlay.remove());overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});document.body.appendChild(overlay);const escHandler=event=>{if(event.key==='Escape'){overlay.remove();document.removeEventListener('keydown',escHandler);}};document.addEventListener('keydown',escHandler);}
function closeModal(){refs.modal.innerHTML='';learningSession=null;}
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600);}

if (typeof document !== 'undefined') init();
