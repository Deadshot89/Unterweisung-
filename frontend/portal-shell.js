// v0.40: Eine Portal-Shell, eine Rollenmatrix und ein Router fuer die gesamte interne Anwendung.
const PRIMARY_VIEWS = ['dashboard', 'work', 'learning', 'planning', 'proofs', 'reports', 'admin'];

const ROLE_VIEW_MATRIX = Object.freeze({
  employee: ['dashboard','work','learning','proofs'],
  line_manager: ['dashboard','work','learning','planning','proofs','reports'],
  hse: [...PRIMARY_VIEWS],
  company_admin: [...PRIMARY_VIEWS],
  system_admin: [...PRIMARY_VIEWS],
  authenticated: ['dashboard']
});

const PORTAL_LABELS = Object.freeze({
  dashboard: ['Übersicht','Start und Kennzahlen'],
  work: ['Arbeit','Meine Aufgaben und Status'],
  learning: ['Lernen','Unterweisungen und Inhalte'],
  planning: ['Planung','Termine und Zuweisungen'],
  proofs: ['Nachweise','Dokumente und Belege'],
  reports: ['Auswertung','Team und Entwicklung'],
  admin: ['Admin','Stammdaten und Betrieb']
});

const LEGACY_VIEW_MAP = Object.freeze({
  dashboard: {view:'dashboard'},
  status: {view:'work', tab:'status'},
  reminders: {view:'work', tab:'reminders'},
  instructions: {view:'learning', tab:'instructions'},
  external: {view:'learning', tab:'external'},
  planning: {view:'planning'},
  proofs: {view:'proofs'},
  managerReport: {view:'reports', tab:'managerReport'},
  companies: {view:'admin', tab:'company'},
  employees: {view:'admin', tab:'employees'},
  users: {view:'admin', tab:'users'},
  operations: {view:'admin', tab:'operations'},
  security: {view:'admin', tab:'security'},
  diagnostics: {view:'admin', tab:'diagnostics'},
  system: {view:'admin', tab:'system'}
});

const portalState = {
  view: 'dashboard',
  tab: '',
  filters: Object.create(null),
  range: '',
  companyId: null,
  routeReady: false
};

function portalRoles(){ return Array.isArray(state?.me?.roles) ? state.me.roles : []; }
function portalHasRole(role){ return portalRoles().includes(role); }
function portalCanDiagnose(){ return portalHasRole('system_admin') || (state?.me?.permissions || []).includes('diagnostics.view'); }

function portalViewsForRoles(roles=[]){
  const allowed = new Set();
  for(const role of roles){
    for(const view of ROLE_VIEW_MATRIX[role] || []) allowed.add(view);
  }
  if(!allowed.size && state?.me) allowed.add('dashboard');
  return PRIMARY_VIEWS.filter(view => allowed.has(view));
}

function portalPasswordSetupActive(){
  const hash = String(window.location.hash || '');
  return /(?:^|[#&])passwordSetup=/.test(hash) || Boolean(window.UMAuthLogin?.hasPasswordSetupToken?.());
}

function portalWorkspaceReady(){
  const workspace = document.getElementById('authenticatedApp');
  if(portalPasswordSetupActive()) return false;
  if(!state?.me || !state.companyId || state.me.requiresCompanySelection) return false;
  if(!workspace || workspace.hidden) return false;
  return true;
}

function portalFirstAllowedView(){ return portalViewsForRoles(portalRoles())[0] || 'dashboard'; }

function portalRouteFromLocation(){
  if(portalPasswordSetupActive()) return null;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('portal') || 'dashboard';
  const legacy = LEGACY_VIEW_MAP[requested] || null;
  return {
    view: legacy?.view || (PRIMARY_VIEWS.includes(requested) ? requested : 'dashboard'),
    tab: params.get('tab') || legacy?.tab || '',
    status: params.get('status') || '',
    filter: params.get('filter') || '',
    range: params.get('range') || ''
  };
}

function portalWriteRoute({replace=false}={}){
  if(portalPasswordSetupActive()) return;
  const url = new URL(window.location.href);
  url.searchParams.set('portal', portalState.view);
  if(portalState.tab) url.searchParams.set('tab', portalState.tab); else url.searchParams.delete('tab');
  const status = portalState.filters.status || '';
  const filter = portalState.filters.filter || '';
  if(status) url.searchParams.set('status', status); else url.searchParams.delete('status');
  if(filter) url.searchParams.set('filter', filter); else url.searchParams.delete('filter');
  if(portalState.range) url.searchParams.set('range', portalState.range); else url.searchParams.delete('range');
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({portal:portalState.view,tab:portalState.tab}, '', url);
}

function portalResetFilters(){
  portalState.filters = Object.create(null);
  portalState.range = '';
  portalState.tab = '';
}

function portalResetForCompanySwitch(){
  portalResetFilters();
  portalState.view = 'dashboard';
  portalState.companyId = null;
  if(portalPasswordSetupActive()) return;
  const url = new URL(window.location.href);
  for(const key of ['portal','tab','status','filter','range']) url.searchParams.delete(key);
  window.history.replaceState({}, '', url);
}

function portalRoleLabel(){
  const labels = {
    system_admin:'Systemadmin', company_admin:'Firmenadmin', hse:'HSE', line_manager:'Führungskraft', employee:'Mitarbeiter'
  };
  return portalRoles().filter(r => r !== 'authenticated').map(r => labels[r] || r).join(' · ') || 'Angemeldet';
}

function portalCompanyName(){
  const selected = (state?.data?.companies || []).find(company => company?.id === state.companyId);
  return selected?.name || state?.me?.companyName || state?.companyId || 'Keine Firma ausgewählt';
}

function renderPortalUserCard(){
  const card = document.getElementById('portalUserCard');
  if(!card) return;
  if(!state?.me){ card.innerHTML = '<span class="portal-user-name">Nicht angemeldet</span>'; return; }
  const name = state.me.displayName || state.me.email || 'Benutzer';
  card.innerHTML = `<span class="portal-user-avatar" aria-hidden="true">${esc(String(name).slice(0,1).toUpperCase())}</span><span class="portal-user-copy"><strong>${esc(name)}</strong><small>${esc(portalRoleLabel())}</small><small>${esc(portalCompanyName())}</small></span>`;
}

function renderPortalNavigation(){
  const nav = document.getElementById('portalNavigation');
  if(!nav) return;
  const allowed = portalViewsForRoles(portalRoles());
  nav.innerHTML = allowed.map(view => {
    const [label,hint] = PORTAL_LABELS[view];
    return `<button type="button" data-portal-view="${view}" class="portal-nav-item ${portalState.view===view?'active':''}" aria-current="${portalState.view===view?'page':'false'}"><span>${label}</span><small>${hint}</small></button>`;
  }).join('');
  nav.querySelectorAll('[data-portal-view]').forEach(button => button.addEventListener('click', () => portalNavigate(button.dataset.portalView)));
  renderPortalUserCard();
}

function portalHeader(view){
  const [label,hint] = PORTAL_LABELS[view] || [view,''];
  return `<header class="portal-view-header"><div><span class="portal-eyebrow">Unterweisungsmanager</span><h2>${esc(label)}</h2><p>${esc(hint)}</p></div><div class="portal-view-context"><span>${esc(portalCompanyName())}</span></div></header>`;
}

function portalOpenAssignments(){
  return (state?.data?.assignments || []).filter(a => ['assigned','in_progress'].includes(a.status));
}

function assignmentStatusLabel(status){ return status === 'in_progress' ? 'Begonnen' : status === 'completed' ? 'Abgeschlossen' : status === 'cancelled' ? 'Storniert' : 'Zugewiesen'; }
function assignmentUrgencyClass(row){
  if(!row.dueAt) return 'neutral';
  const due = new Date(row.dueAt).getTime();
  const now = Date.now();
  if(due < now) return 'danger';
  if(due <= now + 7*86400000) return 'warning';
  return 'ok';
}

function renderAssignmentOverview(){
  const rows = portalOpenAssignments();
  if(!rows.length) return `<div class="portal-empty"><strong>Keine offenen Unterweisungsaufgaben</strong><span>Aktuell ist nichts offen oder überfällig.</span></div>`;
  return `<div class="portal-task-grid">${rows.map(row => `<article class="portal-task ${assignmentUrgencyClass(row)}"><div><span class="portal-task-kicker">${esc(row.category || 'Unterweisung')}</span><h3>${esc(row.instructionName || row.instructionTypeId)}</h3><p>${portalHasRole('employee') && !portalHasRole('line_manager') ? '' : `<strong>${esc(row.employeeName || '')}</strong>${row.employeeName?' · ':''}`}${row.dueAt ? `Fällig ${fmtDate(row.dueAt)}` : 'Keine feste Frist'}</p></div><div class="portal-task-meta"><span class="badge info">${assignmentStatusLabel(row.status)}</span>${row.testRequired?`<span>${Number(row.passPercent||80)} % Testgrenze</span>`:'<span>Kein Test</span>'}</div></article>`).join('')}</div>`;
}

function portalWorkTabs(){
  const tabs = [{id:'tasks',label:'Aufgaben'},{id:'status',label:'Status'}];
  if(portalRoles().some(r => ['line_manager','hse','company_admin','system_admin'].includes(r))) tabs.push({id:'reminders',label:'Erinnerungen'});
  return tabs;
}

function renderWorkPortal(){
  const target = document.getElementById('work');
  if(!target) return;
  const tabs = portalWorkTabs();
  const active = tabs.some(t => t.id === portalState.tab) ? portalState.tab : 'tasks';
  portalState.tab = active;
  target.innerHTML = `${portalHeader('work')}<div class="portal-subnav">${tabs.map(t=>`<button type="button" data-portal-tab="${t.id}" class="${active===t.id?'active':''}">${t.label}</button>`).join('')}</div><div id="workTasks" class="portal-subview" ${active==='tasks'?'':'hidden'}>${active==='tasks'?renderAssignmentOverview():''}</div><div id="status" class="portal-subview" ${active==='status'?'':'hidden'}></div><div id="reminders" class="portal-subview" ${active==='reminders'?'':'hidden'}></div>`;
  target.querySelectorAll('[data-portal-tab]').forEach(button => button.addEventListener('click',()=>portalSubNavigate('work',button.dataset.portalTab)));
  if(active === 'status' && typeof renderStatus === 'function') renderStatus();
  if(active === 'reminders' && typeof renderReminders === 'function') renderReminders();
}

function portalLearningTabs(){
  const tabs = [{id:'instructions',label:'Unterweisungen'}];
  if(portalRoles().some(r => ['line_manager','hse','company_admin','system_admin'].includes(r))) tabs.push({id:'external',label:'Externe Unterweisungen'});
  return tabs;
}

function renderLearningPortal(){
  const target = document.getElementById('learning');
  if(!target) return;
  const tabs = portalLearningTabs();
  const active = tabs.some(t => t.id === portalState.tab) ? portalState.tab : 'instructions';
  portalState.tab = active;
  target.innerHTML = `${portalHeader('learning')}<div class="portal-subnav">${tabs.map(t=>`<button type="button" data-portal-tab="${t.id}" class="${active===t.id?'active':''}">${t.label}</button>`).join('')}</div><div id="instructions" class="portal-subview" ${active==='instructions'?'':'hidden'}></div><div id="external" class="portal-subview" ${active==='external'?'':'hidden'}></div>`;
  target.querySelectorAll('[data-portal-tab]').forEach(button => button.addEventListener('click',()=>portalSubNavigate('learning',button.dataset.portalTab)));
  if(active === 'instructions' && typeof renderInstructions === 'function') renderInstructions();
  if(active === 'external' && typeof renderExternal === 'function') renderExternal();
}

function renderReportsPortal(){
  const target = document.getElementById('reports');
  if(!target) return;
  portalState.tab = 'managerReport';
  target.innerHTML = `${portalHeader('reports')}<div id="managerReport" class="portal-subview"></div>`;
  if(typeof renderManagerReport === 'function') renderManagerReport();
}

function portalAdminTabs(){
  const roles = portalRoles();
  const rows = [];
  if(roles.some(r => ['hse','company_admin','system_admin'].includes(r))) rows.push(['company','Firma'],['employees','Mitarbeiter'],['users','Benutzer']);
  if(roles.some(r => ['company_admin','system_admin'].includes(r))) rows.push(['operations','Betrieb']);
  if(roles.some(r => ['hse','company_admin','system_admin'].includes(r))) rows.push(['security','Sicherheit']);
  if(portalCanDiagnose()) rows.push(['diagnostics','Fehlerdiagnose']);
  if(portalHasRole('system_admin')) rows.unshift(['system','Systemverwaltung']);
  return rows;
}

function renderDiagnosticsPortal(){
  const target = document.getElementById('diagnostics');
  if(!target) return;
  if(!portalCanDiagnose()){
    target.innerHTML = '<div class="notice dangerbox">Fehlerdiagnose ist für dieses Konto nicht freigegeben.</div>';
    return;
  }
  target.innerHTML = `<div class="card"><div class="toolbar"><div><h2>Fehlerdiagnose</h2><p class="muted">Systemstatus, Fehlerereignisse, Diagnoseexport und kritische Alarme.</p></div><a class="btn primary" href="/diagnostics.html">Diagnose-App öffnen</a></div><div class="notice"><b>Zugriff aktiv.</b> Die Diagnose-App verwendet dieselbe Anmeldung und Firmenbegrenzung.</div></div>`;
}

let portalSystemCompaniesCache = null;
async function portalLoadSystemCompanies(force=false){
  if(portalSystemCompaniesCache && !force) return portalSystemCompaniesCache;
  portalSystemCompaniesCache = await api('/system/companies');
  return portalSystemCompaniesCache;
}

function portalSystemCompanyRows(rows){
  if(!rows?.length) return '<div class="portal-empty"><strong>Keine Firmen vorhanden</strong></div>';
  return `<div class="table-wrap"><table><thead><tr><th>Firma</th><th>Benutzer</th><th>Mitarbeiter</th><th>Unterweisungen</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${esc(c.name||c.id)}</b><br><code>${esc(c.id)}</code></td><td>${Number(c.userCount||0)}</td><td>${Number(c.employeeCount||0)}</td><td>${Number(c.instructionTypeCount||0)}</td><td>${c.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td><td><button class="small" type="button" onclick="portalSwitchSystemCompany('${esc(c.id)}')">Öffnen</button> <button class="small ghost" type="button" onclick="portalCopyStarterData('${esc(c.id)}')">Startpaket</button></td></tr>`).join('')}</tbody></table></div>`;
}

function renderSystemAdminPortal(){
  const target = document.getElementById('system');
  if(!target) return;
  if(!portalHasRole('system_admin')){ target.innerHTML = '<div class="notice dangerbox">Keine Systemadmin-Berechtigung.</div>'; return; }
  target.innerHTML = `<div class="grid"><div class="card span-12"><div class="toolbar"><div><h2>Systemverwaltung</h2><p class="muted">Firmen verwalten und einen Mandanten gezielt öffnen.</p></div><button class="ghost" type="button" onclick="portalRefreshSystemCompanies()">Aktualisieren</button></div><div id="portalSystemCompanies"><p class="muted">Firmen werden geladen …</p></div></div><div class="card span-12"><h2>Neue Firma</h2><div class="form-grid"><div class="field"><label>Firmenname *</label><input id="portalCompanyName"></div><div class="field"><label>Mandanten-ID</label><input id="portalCompanyId"></div><div class="field"><label>Sprache</label><select id="portalCompanyLanguage"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div><div class="field"><label>Erster Firmenadmin E-Mail</label><input id="portalCompanyAdminEmail" type="email"></div><div class="field"><label>Erster Firmenadmin Name</label><input id="portalCompanyAdminName"></div><div class="field full"><label>Adresse</label><input id="portalCompanyAddress"></div><div class="field full"><button class="primary" type="button" onclick="portalCreateSystemCompany()">Firma anlegen</button></div></div><div id="portalSystemResult"></div></div></div>`;
  portalRefreshSystemCompanies();
}

async function portalRefreshSystemCompanies(){
  const target = document.getElementById('portalSystemCompanies');
  try{
    const rows = await portalLoadSystemCompanies(true);
    if(target) target.innerHTML = portalSystemCompanyRows(rows);
  }catch(err){ if(target) target.innerHTML = `<div class="notice dangerbox">Firmen konnten nicht geladen werden: ${esc(err.message||err)}</div>`; }
}

async function portalCreateSystemCompany(){
  const name = document.getElementById('portalCompanyName')?.value.trim();
  const resultBox = document.getElementById('portalSystemResult');
  if(!name){ if(resultBox) resultBox.innerHTML='<div class="notice warning">Firmenname fehlt.</div>'; return; }
  try{
    const result = await api('/system/companies',{method:'POST',body:JSON.stringify({
      name,
      companyId:document.getElementById('portalCompanyId')?.value.trim(),
      legalName:name,
      addressLine:document.getElementById('portalCompanyAddress')?.value.trim(),
      defaultLanguage:document.getElementById('portalCompanyLanguage')?.value || 'de',
      adminEmail:document.getElementById('portalCompanyAdminEmail')?.value.trim(),
      adminName:document.getElementById('portalCompanyAdminName')?.value.trim(),
      copyStarterData:true,
      sourceCompanyId:window.UM_DEFAULT_COMPANY_ID || 'company-essentra'
    })});
    portalSystemCompaniesCache = null;
    if(resultBox) resultBox.innerHTML = `<div class="notice"><b>Firma angelegt:</b> ${esc(result.companyId)}</div>`;
    await portalRefreshSystemCompanies();
  }catch(err){ if(resultBox) resultBox.innerHTML = `<div class="notice dangerbox">Firma konnte nicht angelegt werden: ${esc(err.message||err)}</div>`; }
}

async function portalCopyStarterData(companyId){
  const accepted = window.UMDialog ? await UMDialog.confirm(`Startpaket für ${companyId} übernehmen?`,'Startpaket') : window.confirm(`Startpaket für ${companyId} übernehmen?`);
  if(!accepted) return;
  try{
    await api('/system/companies/' + encodeURIComponent(companyId), {method:'PATCH',body:JSON.stringify({action:'copyStarterData',sourceCompanyId:window.UM_DEFAULT_COMPANY_ID || 'company-essentra'})});
    portalSystemCompaniesCache = null;
    await portalRefreshSystemCompanies();
  }catch(err){ if(window.UMDialog) UMDialog.alert(String(err.message||err),'Startpaket fehlgeschlagen'); else window.alert(String(err.message||err)); }
}

async function portalSwitchSystemCompany(companyId){
  if(!portalHasRole('system_admin')) return false;
  portalResetForCompanySwitch();
  if(typeof resetCompanyData === 'function') resetCompanyData();
  state.companyId = companyId;
  if(typeof updateCompanyLabel === 'function') updateCompanyLabel(companyId);
  try{
    await loadCompanyData();
    portalState.companyId = companyId;
    return portalNavigate('dashboard',{replace:true});
  }catch(err){
    state.companyId = null;
    if(typeof showCompanySelection === 'function') await showCompanySelection();
    return false;
  }
}

function renderAdminPortal(){
  const target = document.getElementById('admin');
  if(!target) return;
  const tabs = portalAdminTabs();
  if(!tabs.length){ target.innerHTML = `${portalHeader('admin')}<div class="notice dangerbox">Keine Admin-Berechtigung.</div>`; return; }
  const active = tabs.some(([id]) => id === portalState.tab) ? portalState.tab : tabs[0][0];
  portalState.tab = active;
  const mounts = ['system','company','employees','users','operations','security','diagnostics'].map(id => {
    const actualId = id === 'company' ? 'companies' : id;
    return `<div id="${actualId}" class="portal-subview" ${active===id?'':'hidden'}></div>`;
  }).join('');
  target.innerHTML = `${portalHeader('admin')}<div class="portal-subnav portal-subnav-wrap">${tabs.map(([id,label])=>`<button type="button" data-portal-tab="${id}" class="${active===id?'active':''}">${label}</button>`).join('')}</div>${mounts}`;
  target.querySelectorAll('[data-portal-tab]').forEach(button => button.addEventListener('click',()=>portalSubNavigate('admin',button.dataset.portalTab)));
  if(active === 'system') renderSystemAdminPortal();
  if(active === 'company' && typeof renderCompanies === 'function') renderCompanies();
  if(active === 'employees' && typeof renderEmployees === 'function') renderEmployees();
  if(active === 'users' && typeof renderUsers === 'function') renderUsers();
  if(active === 'operations' && typeof renderOperations === 'function') renderOperations();
  if(active === 'security' && typeof renderSecurity === 'function') renderSecurity();
  if(active === 'diagnostics') renderDiagnosticsPortal();
}

function renderPortalView(view){
  if(view === 'dashboard') { if(typeof renderDashboard === 'function') renderDashboard(); return; }
  if(view === 'work') { renderWorkPortal(); return; }
  if(view === 'learning') { renderLearningPortal(); return; }
  if(view === 'planning') { if(typeof renderPlanning === 'function') renderPlanning(); return; }
  if(view === 'proofs') { if(typeof renderProofs === 'function') renderProofs(); return; }
  if(view === 'reports') { renderReportsPortal(); return; }
  if(view === 'admin') { renderAdminPortal(); }
}

function portalSubNavigate(view, tab){ return portalNavigate(view,{tab}); }

function portalNavigate(requestedView, options={}){
  if(!portalWorkspaceReady()) return false;
  const legacy = LEGACY_VIEW_MAP[requestedView] || null;
  let view = legacy?.view || requestedView || 'dashboard';
  const allowed = portalViewsForRoles(portalRoles());
  if(!PRIMARY_VIEWS.includes(view) || !allowed.includes(view)) view = portalFirstAllowedView();

  if(portalState.companyId && portalState.companyId !== state.companyId) portalResetFilters();
  portalState.companyId = state.companyId;
  portalState.view = view;
  if(options.tab !== undefined) portalState.tab = options.tab || '';
  else if(legacy?.tab) portalState.tab = legacy.tab;
  else if(view !== portalState.view) portalState.tab = '';
  if(options.status !== undefined) portalState.filters.status = options.status || '';
  if(options.filter !== undefined) portalState.filters.filter = options.filter || '';
  if(options.range !== undefined) portalState.range = options.range || '';

  document.querySelectorAll('#portalWorkspace > .view').forEach(section => {
    const active = section.id === view;
    section.hidden = !active;
    section.classList.toggle('active', active);
  });
  renderPortalView(view);
  renderPortalNavigation();
  renderPortalUserCard();
  if(!options.skipHistory) portalWriteRoute({replace:!!options.replace});
  return true;
}

function portalApplyLocation({replace=true}={}){
  if(!portalWorkspaceReady()) return false;
  const route = portalRouteFromLocation();
  if(!route) return false;
  portalState.filters.status = route.status;
  portalState.filters.filter = route.filter;
  portalState.range = route.range;
  return portalNavigate(route.view,{tab:route.tab,status:route.status,filter:route.filter,range:route.range,replace,skipHistory:false});
}

function portalInstallCompatibility(){
  if(typeof setView === 'function'){
    const previousSetView = setView;
    setView = function(id){
      if(PRIMARY_VIEWS.includes(id) || LEGACY_VIEW_MAP[id]) return portalNavigate(id);
      return previousSetView(id);
    };
  }
  if(typeof renderAll === 'function'){
    const previousRenderAll = renderAll;
    renderAll = function(){
      if(portalWorkspaceReady()){
        if(!portalState.routeReady){
          const route = portalRouteFromLocation();
          portalState.routeReady = true;
          if(route){
            portalState.filters.status = route.status;
            portalState.filters.filter = route.filter;
            portalState.range = route.range;
            return portalNavigate(route.view,{tab:route.tab,replace:true});
          }
        }
        return portalNavigate(portalState.view || 'dashboard',{replace:true});
      }
      return previousRenderAll();
    };
  }
  if(typeof renderUserInfo === 'function'){
    const previousRenderUserInfo = renderUserInfo;
    renderUserInfo = function(ok=true){ const result = previousRenderUserInfo(ok); renderPortalUserCard(); return result; };
  }
}

function portalInitialize(){
  portalInstallCompatibility();
  document.getElementById('companySwitchAction')?.addEventListener('click', portalResetForCompanySwitch);
  window.addEventListener('popstate', () => portalApplyLocation({replace:true}));
  renderPortalNavigation();
  renderPortalUserCard();
  if(portalWorkspaceReady()) portalApplyLocation({replace:true});
}

window.UMPortal = {
  PRIMARY_VIEWS,
  ROLE_VIEW_MATRIX,
  portalViewsForRoles,
  portalRouteFromLocation,
  portalNavigate,
  portalSubNavigate,
  portalResetFilters,
  portalResetForCompanySwitch,
  renderPortalNavigation
};
window.portalNavigate = portalNavigate;
window.portalSubNavigate = portalSubNavigate;
window.portalRefreshSystemCompanies = portalRefreshSystemCompanies;
window.portalCreateSystemCompany = portalCreateSystemCompany;
window.portalCopyStarterData = portalCopyStarterData;
window.portalSwitchSystemCompany = portalSwitchSystemCompany;

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', portalInitialize, {once:true});
else portalInitialize();
