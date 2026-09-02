// v0.17: Betreiber-/System-Admin-Konsole + Startpaket für neue Firmen.
// System Admin sieht alle Firmen/Mandanten, kann neue Firmen anlegen und Starterdaten übernehmen.

(function(){
  const originalRender = typeof render === 'function' ? render : null;
  if (originalRender) {
    render = function(id){
      if(id === 'system') return renderSystemAdmin();
      return originalRender(id);
    };
  }

  const originalRenderUserInfo = typeof renderUserInfo === 'function' ? renderUserInfo : null;
  if (originalRenderUserInfo) {
    renderUserInfo = function(ok=true){
      originalRenderUserInfo(ok);
      ensureSystemAdminTab();
    };
  }

  window.addEventListener('DOMContentLoaded', () => setTimeout(ensureSystemAdminTab, 250));
  setTimeout(ensureSystemAdminTab, 800);
})();

function isSystemAdmin(){
  return !!state.me?.roles?.includes('system_admin');
}

function ensureSystemAdminTab(){
  const tabs = document.querySelector('.tabs');
  const main = document.querySelector('main');
  if(!tabs || !main) return;
  let btn = tabs.querySelector('[data-view="system"]');
  let section = document.getElementById('system');

  if(!isSystemAdmin()){
    if(btn) btn.remove();
    if(section) section.remove();
    return;
  }

  if(!btn){
    btn = document.createElement('button');
    btn.dataset.view = 'system';
    btn.textContent = 'System Admin';
    btn.addEventListener('click', () => setView('system'));
    tabs.insertBefore(btn, tabs.firstChild);
  }
  if(!section){
    section = document.createElement('section');
    section.id = 'system';
    section.className = 'view';
    const firstView = main.querySelector('.view');
    main.insertBefore(section, firstView || null);
  }
}

async function loadSystemCompanies(force=false){
  if(state.systemCompanies && !force) return state.systemCompanies;
  state.systemCompanies = await api('/system/companies');
  return state.systemCompanies;
}

function systemStatusBox(){
  const roles = (state.me?.roles || []).join(', ');
  const bypass = state.me?.isLocalDev ? 'Dev-Bypass aktiv' : 'Entra/Login aktiv';
  return `<div class="card span-12">
    <h2>Betreiberstatus</h2>
    <div class="grid">
      <div class="card kpi"><div class="label">Angemeldet als</div><div class="value blue" style="font-size:22px">${esc(state.me?.displayName || state.me?.email || '—')}</div></div>
      <div class="card kpi"><div class="label">Rolle</div><div class="value green" style="font-size:22px">System Admin</div></div>
      <div class="card kpi"><div class="label">Modus</div><div class="value yellow" style="font-size:22px">${esc(bypass)}</div></div>
      <div class="card kpi"><div class="label">Aktuelle Firma</div><div class="value blue" style="font-size:22px">${esc(state.companyId || '—')}</div></div>
    </div>
    <p class="muted">Rollen: ${esc(roles)}. Im späteren Produktivbetrieb wird der Dev-Bypass deaktiviert und System-Admin-Zugriff läuft über freigeschaltete Betreiberkonten.</p>
  </div>`;
}

function starterAction(c){
  const hasStarter = Number(c.instructionTypeCount||0) > 0 || Number(c.testQuestionCount||0) > 0 || Number(c.templateCount||0) > 0;
  if(c.id === (window.UM_DEFAULT_COMPANY_ID || 'company-essentra')) return '<span class="muted">Vorlagefirma</span>';
  if(hasStarter) return '<span class="badge ok">Startpaket vorhanden</span>';
  return `<button class="small" onclick="copyStarterData('${esc(c.id)}')">Starterdaten übernehmen</button>`;
}

function systemCompaniesTable(rows){
  if(!rows?.length) return '<p class="muted">Noch keine Firmen vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Firma</th><th>ID</th><th>Benutzer</th><th>Mitarbeiter</th><th>Startpaket</th><th>Mail</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(c=>`<tr>
    <td><b>${esc(c.name)}</b><br><span class="muted">${esc(c.legalName || '')}</span></td>
    <td><code>${esc(c.id)}</code></td>
    <td>${Number(c.userCount||0)} Benutzer<br><span class="muted">${Number(c.companyAdminCount||0)} Firmen-Admin</span></td>
    <td>${Number(c.employeeCount||0)}</td>
    <td>${Number(c.instructionTypeCount||0)} Unterweisungen<br><span class="muted">${Number(c.templateCount||0)} Vorlagen · ${Number(c.testQuestionCount||0)} Fragen</span><br>${starterAction(c)}</td>
    <td>${esc(mailModeLabel(c.mailMode || 'manual'))}<br><span class="muted">${esc(c.mailFromEmail || c.replyToEmail || 'keine Adresse')}</span></td>
    <td>${c.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
    <td><button class="small" onclick="switchSystemCompany('${esc(c.id)}')">Als Firma öffnen</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderSystemAdmin(){
  ensureSystemAdminTab();
  const el = $('system');
  if(!el) return;
  if(!isSystemAdmin()){
    el.innerHTML = '<div class="card"><h2>System Admin</h2><div class="notice dangerbox">Keine System-Admin-Berechtigung.</div></div>';
    return;
  }
  el.innerHTML = `<div class="grid">
    ${systemStatusBox()}
    <div class="card span-12"><div class="toolbar"><div><h2>Firmen / Mandanten verwalten</h2><p class="muted">Hier legst du später Firma A, Firma B usw. an. Jede Firma bekommt eigene Benutzer, Unterweisungen, Mail-Einstellungen und Daten.</p></div><button class="ghost" onclick="refreshSystemCompanies()">Aktualisieren</button></div><div id="systemCompaniesTable"><p class="muted">Firmen werden geladen ...</p></div></div>
    <div class="card span-12"><h2>Neue Firma anlegen</h2><p class="muted">Damit entsteht ein neuer Mandant. Optional wird direkt der erste Firmen-Admin angelegt. Das Startpaket kopiert nur Unterweisungstypen, Vorlagen-Verweise und Testfragen — keine Mitarbeiterdaten.</p>
      <div class="form-grid">
        <div class="field"><label>Firmenname *</label><input id="sysCompanyName" placeholder="z. B. Firma A GmbH"></div>
        <div class="field"><label>Mandanten-ID optional</label><input id="sysCompanyId" placeholder="z. B. company-firma-a"></div>
        <div class="field"><label>Sprache</label><select id="sysCompanyLang"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
        <div class="field full"><label>Adresse</label><input id="sysCompanyAddress" placeholder="Straße, PLZ Ort, Land"></div>
        <div class="field"><label>Erster Firmen-Admin E-Mail</label><input id="sysAdminEmail" placeholder="admin@firma-a.de"></div>
        <div class="field"><label>Erster Firmen-Admin Name</label><input id="sysAdminName" placeholder="Vorname Nachname"></div>
        <div class="field"><label>Startpaket</label><select id="sysCopyStarter"><option value="1" selected>Ja, Standard-Unterweisungen kopieren</option><option value="0">Nein, leer starten</option></select></div>
        <div class="field"><label>Vorlagefirma</label><input id="sysSourceCompanyId" value="${esc(window.UM_DEFAULT_COMPANY_ID || 'company-essentra')}" placeholder="company-essentra"></div>
        <div class="field full"><button class="primary" onclick="createSystemCompany()">Firma anlegen</button></div>
      </div>
    </div>
    <div class="card span-12"><h2>Späterer Produktivablauf</h2>
      <ol>
        <li>Du legst die Firma hier an.</li>
        <li>Du legst den ersten Firmen-Admin an.</li>
        <li>Du übernimmst das Startpaket oder startest leer.</li>
        <li>Der Firmen-Admin meldet sich per Microsoft/Entra an.</li>
        <li>Die API ordnet ihn anhand seiner E-Mail genau dieser Firma zu.</li>
        <li>Er sieht nur seine Firma, seine Mitarbeiter und seine Unterweisungen.</li>
      </ol>
    </div>
  </div>`;
  refreshSystemCompanies();
}

async function refreshSystemCompanies(){
  const target = $('systemCompaniesTable');
  if(target) target.innerHTML = '<p class="muted">Firmen werden geladen ...</p>';
  try{
    const rows = await loadSystemCompanies(true);
    if(target) target.innerHTML = systemCompaniesTable(rows);
  }catch(err){
    if(target) target.innerHTML = `<div class="notice dangerbox">Firmen konnten nicht geladen werden: ${esc(err.message || err)}</div>`;
  }
}

async function createSystemCompany(){
  const name = $('sysCompanyName').value.trim();
  if(!name){ alert('Firmenname fehlt.'); return; }
  const body = {
    name,
    companyId: $('sysCompanyId').value.trim(),
    legalName: name,
    addressLine: $('sysCompanyAddress').value.trim(),
    defaultLanguage: $('sysCompanyLang').value,
    adminEmail: $('sysAdminEmail').value.trim(),
    adminName: $('sysAdminName').value.trim(),
    copyStarterData: $('sysCopyStarter').value === '1',
    sourceCompanyId: $('sysSourceCompanyId').value.trim() || (window.UM_DEFAULT_COMPANY_ID || 'company-essentra')
  };
  try{
    const result = await api('/system/companies', { method:'POST', body: JSON.stringify(body) });
    const starter = result.starterData ? `\nStartpaket: ${result.starterData.instructionTypeCount} Unterweisungen, ${result.starterData.templateCount} Vorlagen, ${result.starterData.questionCount} Fragen` : '';
    alert(`Firma angelegt: ${result.companyId}${result.adminUser ? '\nFirmen-Admin: ' + result.adminUser.email : ''}${starter}`);
    $('sysCompanyName').value=''; $('sysCompanyId').value=''; $('sysCompanyAddress').value=''; $('sysAdminEmail').value=''; $('sysAdminName').value='';
    await refreshSystemCompanies();
  }catch(err){
    alert('Firma konnte nicht angelegt werden: ' + String(err.message || err));
  }
}

async function copyStarterData(companyId){
  if(!confirm(`Starterdaten für ${companyId} übernehmen?\n\nEs werden Unterweisungstypen, Vorlagen-Verweise und Testfragen kopiert. Mitarbeiter werden nicht kopiert.`)) return;
  try{
    const sourceCompanyId = prompt('Vorlagefirma:', window.UM_DEFAULT_COMPANY_ID || 'company-essentra') || (window.UM_DEFAULT_COMPANY_ID || 'company-essentra');
    const result = await api('/system/companies/' + encodeURIComponent(companyId), {
      method:'PATCH',
      body: JSON.stringify({ action:'copyStarterData', sourceCompanyId })
    });
    alert(`Startpaket übernommen:\n${result.instructionTypeCount} Unterweisungen\n${result.templateCount} Vorlagen\n${result.questionCount} Fragen`);
    await refreshSystemCompanies();
  }catch(err){
    alert('Starterdaten konnten nicht übernommen werden: ' + String(err.message || err));
  }
}

async function switchSystemCompany(companyId){
  state.companyId = companyId;
  state.data = null;
  state.statusRows = [];
  state.users = [];
  state.companyMailSettings = null;
  await loadData();
  setView('dashboard');
}
