// v0.19: Benutzer/Rechte je Firma sauber verwalten.
// Firmen-Admin sieht nur eigene Firma. System-Admin kann den geöffneten Mandanten verwalten.

function canEditUsers(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin');
}
function canCreateSystemAdmin(){
  return !!state.me?.roles?.includes('system_admin');
}
function canCreatePasswordSetupLink(user){
  if(!user || !canEditUsers() || user.active===false) return false;
  if(user.role === 'system_admin' && !canCreateSystemAdmin()) return false;
  return true;
}
function roleLabel(role){
  return ({
    system_admin: 'System Admin / Betreiber',
    company_admin: 'Firmen Admin',
    hse: 'HSE / Sicherheitsverantwortlich',
    line_manager: 'Line Manager',
    employee: 'Mitarbeiter'
  })[role] || role || '—';
}
function roleBadge(role){
  const cls = role === 'system_admin' ? 'bad' : role === 'company_admin' ? 'ok' : role === 'hse' ? 'soon' : role === 'line_manager' ? 'info' : 'warn';
  return `<span class="badge ${cls}">${esc(roleLabel(role))}</span>`;
}
function passwordBadge(user){
  return user.passwordEnabled
    ? '<span class="badge ok">Passwort aktiv</span>'
    : '<span class="badge warn">Kein Passwort</span>';
}
function userRoleOptions(selected='employee'){
  const options = [
    ['employee','Mitarbeiter'],
    ['line_manager','Line Manager'],
    ['hse','HSE / Sicherheitsverantwortlich'],
    ['company_admin','Firmen Admin']
  ];
  if(canCreateSystemAdmin()) options.push(['system_admin','System Admin / Betreiber']);
  return options.map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');
}

function renderUsers(){
  const rows = state.users || [];
  const editable = canEditUsers();
  const currentCompany = state.companyId || DEFAULT_COMPANY_ID;
  $('users').innerHTML=`<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Benutzer / Rechte</h2><p class="muted">Aktuelle Firma: <b>${esc(currentCompany)}</b>. Microsoft und E-Mail/Passwort verwenden dieselben hinterlegten Rollen und Firmenrechte.</p></div><button class="ghost" onclick="refreshUsers()">Aktualisieren</button></div>
      ${userAccessExplanation()}
      <div id="passwordSetupLinkResult"></div>
      ${userTable(rows, editable)}
    </div>
    ${editable ? userCreateCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Bearbeiten der Benutzer.</div></div>'}
  </div>`;
}

function userAccessExplanation(){
  return `<div class="notice"><b>Zugang:</b> Ein aktiver Benutzer kann sich mit Microsoft anmelden, wenn die Identität passt. Für E-Mail/Passwort kann ein berechtigter Admin einen einmaligen Passwort-Setup-Link erstellen. Externe Unterweisungslinks benötigen kein internes Benutzerkonto.</div>`;
}

function userActionButtons(user, editable=false){
  if(!editable) return '—';
  const normalActions=`<button class="small" onclick="editUser('${esc(user.id)}')">Bearbeiten</button> <button class="small" onclick="toggleUser('${esc(user.id)}',${user.active!==false?'false':'true'})">${user.active!==false?'Sperren':'Freischalten'}</button>`;
  const setupAction=canCreatePasswordSetupLink(user)
    ? ` <button class="small" type="button" data-password-setup-action data-user-id="${esc(user.id)}">Passwort-Setup-Link erstellen</button>`
    : '';
  return normalActions + setupAction;
}

function userTable(rows, editable=false){
  if(!rows.length) return '<p class="muted">Keine Benutzer geladen oder keine Berechtigung.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Login</th><th>Letzter Zugriff</th><th>Provider</th><th>Aktion</th></tr></thead><tbody>${rows.map(u=>`<tr>
    <td><b>${esc(u.displayName||u.email)}</b><br><span class="muted">${esc(u.id||'')}</span></td>
    <td>${esc(u.email||'—')}</td>
    <td>${roleBadge(u.role)}</td>
    <td>${u.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Gesperrt</span>'}</td>
    <td>${passwordBadge(u)}</td>
    <td>${fmtDate(u.lastSeenAt)}</td>
    <td>${esc(u.provider||'aad')}</td>
    <td>${userActionButtons(u, editable)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function userCreateCard(){
  return `<div class="card span-12"><h2>Benutzer anlegen / bearbeiten</h2>
    <p class="muted">Die E-Mail muss exakt zum Benutzerkonto passen. Ein Passwort wird nicht hier im Klartext vergeben, sondern sicher über einen einmaligen Setup-Link festgelegt.</p>
    <div class="form-grid">
      <input id="userEditId" type="hidden">
      <div class="field"><label>Name</label><input id="userName" placeholder="Vorname Nachname"></div>
      <div class="field"><label>E-Mail *</label><input id="userEmail" placeholder="name@firma.de"></div>
      <div class="field"><label>Rolle</label><select id="userRole">${userRoleOptions('employee')}</select></div>
      <div class="field"><label>Entra Object ID optional</label><input id="userEntraId" placeholder="später optional"></div>
      <div class="field full"><label>Notiz</label><textarea id="userNotes" placeholder="z. B. erster Firmen-Admin, HSE, Standort XY"></textarea></div>
      <div class="field full"><button class="primary" onclick="saveUser()">Benutzer speichern</button> <button class="ghost" onclick="clearUserForm()">Formular leeren</button></div>
    </div>
  </div>`;
}

async function refreshUsers(){
  try{
    state.users = await api('/users');
    renderUsers();
  }catch(err){
    $('users').innerHTML = `<div class="card"><h2>Benutzer / Rechte</h2><div class="notice dangerbox">Benutzer konnten nicht geladen werden: ${esc(err.message || err)}</div></div>`;
  }
}

function clearUserForm(){
  ['userEditId','userName','userEmail','userEntraId','userNotes'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  if($('userRole')) $('userRole').innerHTML = userRoleOptions('employee');
  if($('userEmail')) $('userEmail').disabled = false;
}

function editUser(id){
  const u = (state.users||[]).find(x=>x.id===id);
  if(!u) return;
  $('userEditId').value = u.id || '';
  $('userName').value = u.displayName || '';
  $('userEmail').value = u.email || '';
  $('userEmail').disabled = true;
  $('userRole').innerHTML = userRoleOptions(u.role || 'employee');
  $('userEntraId').value = u.entraObjectId || '';
  $('userNotes').value = u.notes || '';
  window.scrollTo({ top: document.getElementById('userName').getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}

async function createPasswordSetupLink(id){
  const user=(state.users||[]).find(item=>item.id===id);
  const target=$('passwordSetupLinkResult');
  if(!user || !canCreatePasswordSetupLink(user)){
    if(target) target.innerHTML='<div class="notice dangerbox">Für diesen Benutzer darf kein Passwort-Setup-Link erstellt werden.</div>';
    return;
  }
  if(target) target.innerHTML='<div class="notice">Sicherer Setup-Link wird erstellt …</div>';
  try{
    const result=await api('/users/' + encodeURIComponent(id) + '/password-setup-link',{method:'POST',body:JSON.stringify({})});
    if(!result?.url) throw new Error('Der Setup-Link wurde nicht zurückgegeben.');
    if(target) target.innerHTML=`<div class="notice warning">
      <b>Einmaliger Passwort-Setup-Link für ${esc(user.displayName||user.email)}</b><br>
      Dieser Link ist 30 Minuten gültig. Gib ihn nur an die vorgesehene Person weiter. Ein neuer Link macht den vorherigen unbrauchbar.
      <div class="field" style="margin-top:10px"><label>Setup-Link</label><input type="text" readonly value="${esc(result.url)}"></div>
    </div>`;
  }catch(err){
    if(target) target.innerHTML=`<div class="notice dangerbox">Setup-Link konnte nicht erstellt werden: ${esc(String(err.message||err))}</div>`;
  }
}

async function saveUser(){
  const id = $('userEditId').value.trim();
  const email = $('userEmail').value.trim();
  const displayName = $('userName').value.trim() || email;
  const role = $('userRole').value;
  if(!email){ alert('E-Mail fehlt.'); return; }
  const body = {
    email,
    displayName,
    role,
    entraObjectId: $('userEntraId').value.trim(),
    notes: $('userNotes').value.trim(),
    companyId: state.companyId || DEFAULT_COMPANY_ID
  };
  try{
    if(id){ await api('/users/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(body) }); }
    else { await api('/users', { method:'POST', body: JSON.stringify(body) }); }
    clearUserForm();
    await refreshUsers();
    alert('Benutzer gespeichert.');
  }catch(err){
    alert('Benutzer konnte nicht gespeichert werden: ' + String(err.message || err));
  }
}

async function toggleUser(id, active){
  try{
    await api('/users/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ active, companyId: state.companyId || DEFAULT_COMPANY_ID }) });
    await refreshUsers();
  }catch(err){
    alert('Benutzerstatus konnte nicht geändert werden: ' + String(err.message || err));
  }
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-password-setup-action]');
  if(!button) return;
  event.preventDefault();
  createPasswordSetupLink(button.dataset.userId);
});
