(function(root){
  const MODES=Object.freeze({
    AUTH_REQUIRED:'auth-required',
    COMPANY_SELECTION:'company-selection',
    ADMIN:'admin-portal',
    MANAGER:'employee-manager-portal',
    EMPLOYEE:'employee-portal',
    DENIED:'denied'
  });

  const ADMIN_NAV=Object.freeze([
    ['dashboard','Dashboard'],['companies','Firmen'],['employees','Mitarbeiter'],
    ['instructions','Unterweisungen'],['status','Status'],['reminders','Erinnerungen'],
    ['proofs','Nachweise'],['managerReport','Manager-Report'],['planning','Planung'],
    ['external','Externe Links'],['users','Benutzer'],['operations','Betrieb'],['security','Sicherheit']
  ]);
  const MANAGER_NAV=Object.freeze([
    ['dashboard','Meine Unterweisungen'],['planning','Team einplanen'],['external','Externe Unterweisungen']
  ]);
  const EMPLOYEE_NAV=Object.freeze([
    ['dashboard','Meine Unterweisungen']
  ]);

  function rolesOf(me){return Array.isArray(me?.roles)?me.roles:[];}
  function resolvePortalMode(me,companyId){
    if(!me)return MODES.AUTH_REQUIRED;
    const roles=rolesOf(me);
    if(roles.includes('system_admin'))return companyId?MODES.ADMIN:MODES.COMPANY_SELECTION;
    if(roles.includes('company_admin')||roles.includes('hse'))return MODES.ADMIN;
    if(roles.includes('line_manager'))return MODES.MANAGER;
    if(roles.includes('employee'))return MODES.EMPLOYEE;
    return MODES.DENIED;
  }
  function navigationForMode(mode){
    const source=mode===MODES.ADMIN?ADMIN_NAV:mode===MODES.MANAGER?MANAGER_NAV:mode===MODES.EMPLOYEE?EMPLOYEE_NAV:[];
    return source.map(([view,label])=>({view,label}));
  }
  function clearPortalShell(){
    if(typeof document==='undefined')return;
    const nav=document.getElementById('portalNavigation');
    if(nav){nav.innerHTML='';nav.hidden=true;}
    document.body?.removeAttribute('data-portal-mode');
  }
  function applyPortalMode(mode,{onNavigate}={}){
    if(typeof document==='undefined')return;
    const nav=document.getElementById('portalNavigation');
    if(!nav)return;
    const items=navigationForMode(mode);
    document.body.dataset.portalMode=mode;
    nav.innerHTML=items.map((item,index)=>`<button type="button" data-view="${item.view}"${index===0?' class="active"':''}>${item.label}</button>`).join('');
    nav.hidden=items.length===0;
    nav.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>onNavigate?.(button.dataset.view)));
  }

  root.UMPortalShell=Object.freeze({MODES,resolvePortalMode,navigationForMode,applyPortalMode,clearPortalShell});
})(globalThis);
