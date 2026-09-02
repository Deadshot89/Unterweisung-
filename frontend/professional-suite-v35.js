// v0.35 Major Design Refresh.
// Ein zusammenhaengender Design-Layer fuer App-Shell, Navigation, Arbeitsflaechen und Versionsstand.
// Keine API-Aenderung, keine Fachlogik-Aenderung.

const PROFESSIONAL_SUITE_VERSION = 'v0.35';

const NAV_GROUPS = [
  { key:'overview', label:'Uebersicht', views:['dashboard'] },
  { key:'work', label:'Arbeitsablauf', views:['status','reminders','proofs','managerReport','planning','external'] },
  { key:'masterdata', label:'Stammdaten', views:['employees','instructions','users','companies'] },
  { key:'admin', label:'Administration', views:['operations','security'] }
];

const NAV_META = {
  dashboard: { icon:'01', label:'Dashboard' },
  status: { icon:'02', label:'Status' },
  reminders: { icon:'03', label:'Erinnerungen' },
  proofs: { icon:'04', label:'Nachweise' },
  managerReport: { icon:'05', label:'Manager-Report' },
  planning: { icon:'06', label:'Planung' },
  external: { icon:'07', label:'Externe Links' },
  employees: { icon:'08', label:'Mitarbeiter' },
  instructions: { icon:'09', label:'Unterweisungen' },
  users: { icon:'10', label:'Benutzer' },
  companies: { icon:'11', label:'Firmen' },
  operations: { icon:'12', label:'Betrieb' },
  security: { icon:'13', label:'Sicherheit' }
};

function setProfessionalVersion(){
  const version = document.getElementById('appVersion');
  if(version) version.textContent = PROFESSIONAL_SUITE_VERSION;
  document.body.dataset.professionalSuite = PROFESSIONAL_SUITE_VERSION;
}

function navButton(viewId){
  return document.querySelector(`.primary-tabs button[data-view="${viewId}"]`);
}

function updateNavigationGroups(){
  const nav = document.querySelector('.primary-tabs');
  if(!nav) return;

  nav.classList.add('pro-navigation');
  nav.querySelectorAll('.nav-group-title').forEach(el => el.remove());

  const orderedButtons = [];
  NAV_GROUPS.forEach(group => {
    const title = document.createElement('span');
    title.className = 'nav-group-title';
    title.dataset.navGroup = group.key;
    title.textContent = group.label;
    nav.appendChild(title);

    group.views.forEach(viewId => {
      const button = navButton(viewId);
      if(!button) return;
      const meta = NAV_META[viewId] || {};
      button.dataset.navGroup = group.key;
      button.dataset.navIcon = meta.icon || '';
      button.textContent = meta.label || button.textContent.trim();
      button.setAttribute('title', meta.label || button.textContent.trim());
      nav.appendChild(button);
      orderedButtons.push(button);
    });
  });

  Array.from(nav.querySelectorAll('button[data-view]')).forEach(button => {
    if(!orderedButtons.includes(button)) nav.appendChild(button);
  });
}

function applyProfessionalShell(){
  document.body.classList.add('app-shell-v35');
  const main = document.querySelector('main');
  if(main) main.classList.add('pro-shell-grid');
  updateNavigationGroups();
  setProfessionalVersion();
}

function ensureProfessionalFooter(){
  const main = document.querySelector('main');
  if(!main || document.getElementById('appFooterV35')) return;
  const footer = document.createElement('footer');
  footer.id = 'appFooterV35';
  footer.className = 'app-footer-v35';
  footer.innerHTML = `<span>Unterweisungsmanager · Essentra Arbeitsstand</span><span class="suite-chip">Betriebsbereit · ${PROFESSIONAL_SUITE_VERSION}</span>`;
  main.appendChild(footer);
}

function markCurrentWorkspace(){
  const active = document.querySelector('.view.active');
  if(!active) return;
  document.body.dataset.currentView = active.id || 'dashboard';
}

function applyProfessionalSuite(){
  applyProfessionalShell();
  ensureProfessionalFooter();
  markCurrentWorkspace();
  if(typeof applyTableFormPolish === 'function') applyTableFormPolish();
  if(typeof applyViewHeaders === 'function') applyViewHeaders();
  if(typeof applyDesignPolish === 'function') applyDesignPolish();
  setProfessionalVersion();
}

if(typeof setView === 'function'){
  const originalSetViewForProfessionalSuite = setView;
  setView = function(id){
    const result = originalSetViewForProfessionalSuite(id);
    window.requestAnimationFrame(() => applyProfessionalSuite());
    return result;
  };
}

if(typeof render === 'function'){
  const originalRenderForProfessionalSuite = render;
  render = function(id){
    const result = originalRenderForProfessionalSuite(id);
    window.requestAnimationFrame(() => applyProfessionalSuite());
    return result;
  };
}

document.addEventListener('click', (event) => {
  if(event.target.closest('.primary-tabs button[data-view]')) {
    window.requestAnimationFrame(() => applyProfessionalSuite());
  }
});

const professionalSuiteObserver = new MutationObserver((mutations) => {
  if(!mutations.some(m => m.addedNodes && m.addedNodes.length)) return;
  window.requestAnimationFrame(() => applyProfessionalSuite());
});

professionalSuiteObserver.observe(document.body, { childList:true, subtree:true });

window.PROFESSIONAL_SUITE_VERSION = PROFESSIONAL_SUITE_VERSION;
window.NAV_GROUPS = NAV_GROUPS;
window.NAV_META = NAV_META;
window.applyProfessionalSuite = applyProfessionalSuite;
window.updateNavigationGroups = updateNavigationGroups;

window.requestAnimationFrame(() => applyProfessionalSuite());
