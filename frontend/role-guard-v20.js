// v0.39: Rollenabhängige Oberfläche, ereignisgesteuert statt periodischem Polling.
// API bleibt die echte Sicherheitsgrenze.

const ROLE_VIEW_RULES = {
  dashboard: ['authenticated','employee','line_manager','hse','company_admin','system_admin'],
  system: ['system_admin'],
  companies: ['company_admin','hse','system_admin'],
  employees: ['company_admin','hse','line_manager','system_admin'],
  instructions: ['company_admin','hse','line_manager','system_admin'],
  status: ['company_admin','hse','line_manager','employee','system_admin'],
  reminders: ['company_admin','hse','line_manager','system_admin'],
  proofs: ['company_admin','hse','line_manager','system_admin'],
  managerReport: ['company_admin','hse','line_manager','system_admin'],
  planning: ['company_admin','hse','line_manager','system_admin'],
  external: ['company_admin','hse','line_manager','system_admin'],
  users: ['company_admin','hse','system_admin'],
  operations: ['company_admin','system_admin'],
  security: ['company_admin','hse','system_admin']
};

const ROLE_LABELS = {
  system_admin: 'System Admin / Betreiber',
  company_admin: 'Firmen Admin',
  hse: 'HSE / Sicherheitsverantwortlich',
  line_manager: 'Line Manager',
  employee: 'Mitarbeiter',
  authenticated: 'Angemeldet'
};

function currentRoles(){ return state.me?.roles || []; }
function hasAnyRole(allowed=[]){
  const roles = currentRoles();
  if(roles.includes('system_admin')) return true;
  return allowed.some(r => roles.includes(r));
}
function portalModeAllowsView(view){
  const mode=state.portalMode;
  if(mode==='admin-portal')return true;
  if(mode==='employee-manager-portal')return ['dashboard','planning','external'].includes(view);
  if(mode==='employee-portal')return view==='dashboard';
  return false;
}
function viewAllowed(view){ return portalModeAllowsView(view) && hasAnyRole(ROLE_VIEW_RULES[view] || ['system_admin']); }
function firstAllowedView(){
  const preferred = ['dashboard','status','reminders','proofs','managerReport','employees','external','companies','users','operations','security'];
  return preferred.find(viewAllowed) || 'dashboard';
}
function roleSummary(){
  const roles = currentRoles().filter(r => r !== 'authenticated');
  if(!roles.length) return 'Keine Fachrolle';
  return roles.map(r => ROLE_LABELS[r] || r).join(' · ');
}

function applyRoleVisibility(){
  const tabs = document.querySelectorAll('#portalNavigation button[data-view]');
  tabs.forEach(btn => {
    const view = btn.dataset.view;
    const allowed = viewAllowed(view);
    btn.hidden = !allowed;
    btn.disabled = !allowed;
    btn.title = allowed ? '' : 'Für deine Rolle nicht freigeschaltet';
  });

  const active = document.querySelector('#portalNavigation button.active');
  if(active && (active.hidden || active.disabled)) setView(firstAllowedView());
}

function accessDeniedHtml(view){
  const required = (ROLE_VIEW_RULES[view] || ['system_admin']).map(r => ROLE_LABELS[r] || r).join(', ');
  return `<div class="card span-12"><h2>Zugriff nicht freigegeben</h2>
    <div class="notice dangerbox">Dieser Bereich ist für deine aktuelle Rolle nicht freigeschaltet.</div>
    <p><b>Deine Rolle:</b> ${esc(roleSummary())}</p>
    <p><b>Benötigt:</b> ${esc(required)}</p>
    <button class="primary" onclick="setView('${firstAllowedView()}')">Zur erlaubten Startseite</button>
  </div>`;
}

(function(){
  const originalSetView = typeof setView === 'function' ? setView : null;
  if(originalSetView){
    setView = function(id){
      if(state.me && !viewAllowed(id)){
        document.querySelectorAll('#portalNavigation button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
        document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
        const target = $(id);
        if(target) target.innerHTML = accessDeniedHtml(id);
        applyRoleVisibility();
        return;
      }
      originalSetView(id);
      applyRoleVisibility();
    };
  }

  const originalRenderUserInfo = typeof renderUserInfo === 'function' ? renderUserInfo : null;
  if(originalRenderUserInfo){
    renderUserInfo = function(ok=true){
      originalRenderUserInfo(ok);
      const el = $('userInfo');
      if(el && ok && state.me && !el.querySelector('[data-role-summary]')){
        el.insertAdjacentHTML('beforeend', ` <span class="role-pill" data-role-summary>${esc(roleSummary())}</span>`);
      }
      queueMicrotask(applyRoleVisibility);
    };
  }

  const originalRenderAll = typeof renderAll === 'function' ? renderAll : null;
  if(originalRenderAll){
    renderAll = function(){
      originalRenderAll();
      applyRoleVisibility();
    };
  }

  window.addEventListener('DOMContentLoaded', () => setTimeout(applyRoleVisibility, 0), {once:true});
  window.addEventListener('load', applyRoleVisibility, {once:true});
})();
