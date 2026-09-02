// v0.31: Professioneller Kopfbereich und saubere Benutzeranzeige.
// Entfernt technische Rollen-/Systemtexte aus der sichtbaren Hauptoberflaeche.

const DESIGN_VERSION = 'v0.31';

const FRIENDLY_ROLE_LABELS = {
  system_admin: 'System Admin',
  company_admin: 'Firmen Admin',
  hse: 'HSE',
  line_manager: 'Line Manager',
  employee: 'Mitarbeiter'
};

function designCompanyName(){
  const companiesList = typeof companies === 'function' ? companies() : [];
  const company = companiesList.find(c => c.id === state.companyId) || companiesList[0];
  return company?.name || state.me?.companyName || 'Essentra Components GmbH';
}

function designUserName(){
  return state.me?.displayName || state.me?.name || state.me?.email || 'Benutzer';
}

function designRoles(){
  const roles = (state.me?.roles || []).filter(r => r && r !== 'authenticated');
  const ordered = ['system_admin','company_admin','hse','line_manager','employee'];
  return ordered.filter(r => roles.includes(r));
}

function renderProfessionalUserInfo(ok = true){
  const el = document.getElementById('userInfo');
  if(!el) return;

  const login = document.querySelector('.top-actions a[href="/.auth/login/aad"]');
  const logout = document.querySelector('.top-actions a[href="/.auth/logout"]');

  if(!ok || !state.me){
    el.innerHTML = '<span class="identity-name">Nicht angemeldet</span><span class="identity-subline">Bitte anmelden</span>';
    if(login) login.style.display = '';
    if(logout) logout.style.display = 'none';
    return;
  }

  const roles = designRoles();
  const badges = roles.map(r => `<span class="role-pill">${esc(FRIENDLY_ROLE_LABELS[r] || r)}</span>`).join('');
  el.innerHTML = `
    <span class="identity-main">
      <span class="identity-name">${esc(designUserName())}</span>
      <span class="identity-subline">${esc(designCompanyName())}</span>
    </span>
    <span class="identity-roles">${badges}</span>
  `;

  if(login) login.style.display = 'none';
  if(logout) logout.style.display = '';
}

if(typeof renderUserInfo === 'function'){
  renderUserInfo = renderProfessionalUserInfo;
}

function applyDesignPolish(){
  renderProfessionalUserInfo(Boolean(state.me));
  document.body.dataset.design = DESIGN_VERSION;
  const version = document.getElementById('appVersion');
  if(version) version.textContent = DESIGN_VERSION;
}

window.applyDesignPolish = applyDesignPolish;
window.renderProfessionalUserInfo = renderProfessionalUserInfo;

let designTries = 0;
const designTimer = window.setInterval(() => {
  designTries += 1;
  applyDesignPolish();
  if(state.me || designTries > 20) window.clearInterval(designTimer);
}, 250);
