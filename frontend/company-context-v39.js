// v0.39: Expliziter Firmenkontext fuer Systemadministratoren.
// Fach- und Kundendaten werden erst nach einer bewusst ausgewaehlten Firma geladen.

const COMPANY_CONTEXT_VERSION = 'v0.39';
let systemCompaniesCache = [];

function isSystemAdminContext(){
  return Boolean(state.me?.roles?.includes('system_admin'));
}

function resetCompanyScopedState(){
  state.data = null;
  state.statusRows = [];
  state.users = [];
  state.testQuestions = [];
  state.mailConfig = null;
  state.operations = null;
  state.backups = [];
  state.healthHistory = [];
  state.securityEvents = [];
  state.auditEvents = [];
  state.apiAvailable = false;
  state.source = 'loading';
}

function setCompanyWorkspaceVisible(visible){
  const nav = document.querySelector('.primary-tabs');
  if(nav) nav.hidden = !visible;
  document.querySelectorAll('.view').forEach(view => { view.hidden = !visible; });
}

function selectedCompany(){
  return systemCompaniesCache.find(company => company.id === state.companyId) || null;
}

function updateCompanyShell(company = selectedCompany()){
  const label = document.getElementById('activeCompanyLabel');
  if(label) label.textContent = company?.name || state.me?.companyName || (state.companyId || 'Keine Firma ausgewählt');

  const switchButton = document.getElementById('companySwitchAction');
  if(switchButton) switchButton.hidden = !(isSystemAdminContext() && Boolean(state.companyId));

  if(typeof renderProfessionalUserInfo === 'function') renderProfessionalUserInfo(Boolean(state.me));
  if(typeof scheduleProfessionalSuite === 'function') scheduleProfessionalSuite();
}

async function fetchSystemCompanies(){
  const previousCompanyId = state.companyId;
  state.companyId = null;
  try{
    const companies = await api('/system/companies');
    systemCompaniesCache = (Array.isArray(companies) ? companies : [])
      .filter(company => company && company.active !== false)
      .sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
    return systemCompaniesCache;
  } finally {
    state.companyId = previousCompanyId;
  }
}

function renderCompanyCards(companies){
  if(!companies.length){
    return `<div class="card"><h2>Firma auswählen</h2><div class="notice warning">Es ist aktuell keine aktive Firma freigeschaltet.</div></div>`;
  }
  return `<div class="card span-12 company-selection-card">
    <span class="view-eyebrow">System Administration</span>
    <h2>Firma auswählen</h2>
    <p class="muted">Wähle die Firma, in der du jetzt arbeiten möchtest. Erst danach werden Mitarbeiter, Unterweisungen, Nachweise und Planungen dieses Mandanten geladen.</p>
    <div class="company-selection-grid">
      ${companies.map(company => `<button type="button" class="company-choice" data-company-id="${esc(company.id)}">
        <strong>${esc(company.name || company.id)}</strong>
        <span>${Number(company.memberCount || company.userCount || 0).toLocaleString('de-DE')} Benutzer · ${company.active === false ? 'Inaktiv' : 'Aktiv'}</span>
        <span class="company-choice-action">Firma öffnen</span>
      </button>`).join('')}
    </div>
  </div>`;
}

async function showCompanySelection(){
  if(!isSystemAdminContext()) return false;
  resetCompanyScopedState();
  state.companyId = null;
  setCompanyWorkspaceVisible(false);
  updateCompanyShell(null);

  const gate = document.getElementById('companySelectionGate');
  if(!gate) return false;
  gate.hidden = false;
  gate.innerHTML = `<div class="card"><h2>Firma auswählen</h2><p class="muted">Firmen werden geladen …</p></div>`;

  try{
    const companies = await fetchSystemCompanies();
    gate.innerHTML = renderCompanyCards(companies);
    gate.querySelectorAll('[data-company-id]').forEach(button => {
      button.addEventListener('click', () => openCompanyContext(button.dataset.companyId));
    });
  } catch(err){
    gate.innerHTML = `<div class="card"><h2>Firma auswählen</h2><div class="notice dangerbox">Die Firmenliste konnte nicht geladen werden: ${esc(err.message || err)}</div><button class="primary" type="button" id="retryCompanySelection">Erneut versuchen</button></div>`;
    document.getElementById('retryCompanySelection')?.addEventListener('click', showCompanySelection);
  }
  return true;
}

async function openCompanyContext(companyId){
  if(!isSystemAdminContext()) return false;
  const id = String(companyId || '').trim();
  if(!id) return false;

  let company = systemCompaniesCache.find(item => item.id === id);
  if(!company){
    const list = await fetchSystemCompanies();
    company = list.find(item => item.id === id);
  }
  if(!company) throw new Error('Die ausgewählte Firma ist nicht aktiv oder nicht vorhanden.');

  resetCompanyScopedState();
  state.companyId = company.id;
  const gate = document.getElementById('companySelectionGate');
  if(gate){ gate.hidden = true; gate.innerHTML = ''; }
  setCompanyWorkspaceVisible(true);
  updateCompanyShell(company);

  try{
    await loadCompanyData();
    renderUserInfo(true);
    updateCompanyShell(company);
    setView('dashboard');
    return true;
  } catch(err){
    resetCompanyScopedState();
    state.companyId = null;
    setCompanyWorkspaceVisible(false);
    updateCompanyShell(null);
    if(gate){
      gate.hidden = false;
      gate.innerHTML = `<div class="card"><h2>Firma konnte nicht geöffnet werden</h2><div class="notice dangerbox">${esc(err.message || err)}</div><button class="primary" type="button" id="backToCompanySelection">Zur Firmenauswahl</button></div>`;
      document.getElementById('backToCompanySelection')?.addEventListener('click', showCompanySelection);
    }
    return false;
  }
}

async function leaveCompanyContext(){
  if(!isSystemAdminContext()) return false;
  resetCompanyScopedState();
  state.companyId = null;
  return showCompanySelection();
}

function bindCompanyContextActions(){
  document.getElementById('companySwitchAction')?.addEventListener('click', leaveCompanyContext);
}

document.addEventListener('DOMContentLoaded', bindCompanyContextActions, {once:true});

window.COMPANY_CONTEXT_VERSION = COMPANY_CONTEXT_VERSION;
window.showCompanySelection = showCompanySelection;
window.openCompanyContext = openCompanyContext;
window.leaveCompanyContext = leaveCompanyContext;
window.resetCompanyScopedState = resetCompanyScopedState;
window.updateCompanyShell = updateCompanyShell;
