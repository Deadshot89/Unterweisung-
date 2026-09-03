// v0.35.5: Ladehinweise bleiben bis zur erfolgreichen Aktualisierung sichtbar.
// Performance-Hotfix: keine dauerhafte Body-Beobachtung mehr, keine Render-Schleife.
// Keine API-Aenderung, keine Fachlogik-Aenderung.

const PROFESSIONAL_SUITE_VERSION = 'v0.35.5';

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

let professionalSuiteScheduled = false;
let professionalSuiteApplying = false;

function setProfessionalVersion(){
  const version = document.getElementById('appVersion');
  if(version && version.textContent !== PROFESSIONAL_SUITE_VERSION) {
    version.textContent = PROFESSIONAL_SUITE_VERSION;
  }
  if(document.body.dataset.professionalSuite !== PROFESSIONAL_SUITE_VERSION) {
    document.body.dataset.professionalSuite = PROFESSIONAL_SUITE_VERSION;
  }
}

function navButton(viewId){
  return document.querySelector(`.primary-tabs button[data-view="${viewId}"]`);
}

function applyNavigationMeta(){
  Object.entries(NAV_META).forEach(([viewId, meta]) => {
    const button = navButton(viewId);
    if(!button) return;
    if(button.dataset.navIcon !== (meta.icon || '')) button.dataset.navIcon = meta.icon || '';
    const label = meta.label || button.textContent.trim();
    if(button.textContent !== label) button.textContent = label;
    if(button.getAttribute('title') !== label) button.setAttribute('title', label);
  });
}

function updateNavigationGroups(){
  const nav = document.querySelector('.primary-tabs');
  if(!nav) return;

  nav.classList.add('pro-navigation');
  applyNavigationMeta();

  if(nav.dataset.groupedVersion === PROFESSIONAL_SUITE_VERSION) return;

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
      if(button.dataset.navGroup !== group.key) button.dataset.navGroup = group.key;
      nav.appendChild(button);
      orderedButtons.push(button);
    });
  });

  Array.from(nav.querySelectorAll('button[data-view]')).forEach(button => {
    if(!orderedButtons.includes(button)) nav.appendChild(button);
  });

  nav.dataset.groupedVersion = PROFESSIONAL_SUITE_VERSION;
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
  if(!main) return;
  let footer = document.getElementById('appFooterV35');
  const footerHtml = `<span>Unterweisungsmanager · Essentra Arbeitsstand</span><span class="suite-chip">Betriebsbereit · ${PROFESSIONAL_SUITE_VERSION}</span>`;
  if(!footer){
    footer = document.createElement('footer');
    footer.id = 'appFooterV35';
    footer.className = 'app-footer-v35';
    main.appendChild(footer);
  }
  if(footer.innerHTML !== footerHtml) footer.innerHTML = footerHtml;
}

function markCurrentWorkspace(){
  const active = document.querySelector('.view.active');
  if(!active) return;
  const current = active.id || 'dashboard';
  if(document.body.dataset.currentView !== current) document.body.dataset.currentView = current;
}

function applyProfessionalSuite(){
  if(professionalSuiteApplying) return;
  professionalSuiteApplying = true;
  try{
    applyProfessionalShell();
    ensureProfessionalFooter();
    markCurrentWorkspace();
    if(typeof applyTableFormPolish === 'function') applyTableFormPolish();
    if(typeof applyViewHeaders === 'function') applyViewHeaders();
    if(typeof applyDesignPolish === 'function') applyDesignPolish();
    setProfessionalVersion();
  } finally {
    professionalSuiteApplying = false;
  }
}

function scheduleProfessionalSuite(){
  if(professionalSuiteScheduled) return;
  professionalSuiteScheduled = true;
  window.requestAnimationFrame(() => {
    professionalSuiteScheduled = false;
    applyProfessionalSuite();
  });
}

if(typeof setView === 'function'){
  const originalSetViewForProfessionalSuite = setView;
  setView = function(id){
    const result = originalSetViewForProfessionalSuite(id);
    scheduleProfessionalSuite();
    return result;
  };
}

if(typeof render === 'function'){
  const originalRenderForProfessionalSuite = render;
  render = function(id){
    const result = originalRenderForProfessionalSuite(id);
    scheduleProfessionalSuite();
    return result;
  };
}

document.addEventListener('click', (event) => {
  if(event.target.closest('.primary-tabs button[data-view]')) scheduleProfessionalSuite();
});

document.addEventListener('DOMContentLoaded', scheduleProfessionalSuite);
window.addEventListener('load', scheduleProfessionalSuite);

window.PROFESSIONAL_SUITE_VERSION = PROFESSIONAL_SUITE_VERSION;
window.NAV_GROUPS = NAV_GROUPS;
window.NAV_META = NAV_META;
window.applyProfessionalSuite = applyProfessionalSuite;
window.scheduleProfessionalSuite = scheduleProfessionalSuite;
window.updateNavigationGroups = updateNavigationGroups;

scheduleProfessionalSuite();
