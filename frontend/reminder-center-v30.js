// v0.30: Erinnerungs-/Mahncenter fuer Essentra.
// Ziel: Fehlende/faellige Unterweisungen gezielt an Mitarbeiter oder Line Manager verteilen.

const REMINDER_LOG_KEY = 'um_reminder_batches_v30';
let reminderLinkResults = [];

function canManageReminders(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

function reminderRowsSource(){
  return state.statusRows?.length ? state.statusRows : buildLocalStatusRows();
}

function reminderOpenStatuses(){
  return new Set(['missing','expired','critical','soon']);
}

function reminderRows(){
  return reminderRowsSource().filter(r => reminderOpenStatuses().has(r.status) && r.status !== 'not_required');
}

function readReminderLog(){
  try{ return JSON.parse(localStorage.getItem(REMINDER_LOG_KEY) || '[]'); }
  catch{ return []; }
}

function writeReminderLog(rows){
  localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(rows.slice(0, 50)));
}

function lineManagerEmail(row){
  const manager = employees().find(e => e.id === row.lineManagerId || e.name === row.lineManagerName);
  return manager?.email || row.lineManagerEmail || '';
}

function lineManagerName(row){
  const manager = employees().find(e => e.id === row.lineManagerId || e.name === row.lineManagerName);
  return row.lineManagerName || manager?.name || 'Ohne Line Manager';
}

function reminderRecipient(row){
  const target = $('reminderRecipientType')?.value || 'employee';
  if(target === 'manager'){
    return { name: lineManagerName(row), email: lineManagerEmail(row), type:'Line Manager' };
  }
  return { name: row.employeeName || 'Mitarbeiter', email: row.email || '', type:'Mitarbeiter' };
}

function reminderCurrentFilters(){
  return {
    recipientType: $('reminderRecipientType')?.value || 'employee',
    managerId: $('reminderManager')?.value || '',
    typeId: $('reminderType')?.value || '',
    status: $('reminderStatus')?.value || 'open',
    search: $('reminderSearch')?.value || ''
  };
}

function filteredReminderRows(){
  const f = reminderCurrentFilters();
  const q = String(f.search || '').toLowerCase();
  const open = reminderOpenStatuses();
  return reminderRowsSource().filter(r => {
    if(f.status === 'open' && !open.has(r.status)) return false;
    if(f.status && f.status !== 'open' && r.status !== f.status) return false;
    if(f.typeId && r.typeId !== f.typeId) return false;
    if(f.managerId && (r.lineManagerId || r.lineManagerName) !== f.managerId) return false;
    if(q && ![r.employeeName,r.email,r.department,r.role,r.lineManagerName,r.instructionName,r.category,r.status].join(' ').toLowerCase().includes(q)) return false;
    if(r.status === 'valid' || r.status === 'not_required') return false;
    return true;
  });
}

function reminderManagers(){
  const rows = reminderRowsSource();
  const fromRows = rows
    .filter(r => r.lineManagerId || r.lineManagerName)
    .map(r => ({ id:r.lineManagerId || r.lineManagerName, name:lineManagerName(r) }));
  const fromEmployees = employees()
    .filter(e => e.active !== false && rows.some(r => r.lineManagerId === e.id))
    .map(e => ({ id:e.id, name:e.name }));
  return [...new Map([...fromRows, ...fromEmployees].map(x => [x.id || x.name, x])).values()]
    .sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),'de'));
}

function reminderStats(rows){
  return {
    total: rows.length,
    missing: rows.filter(r => r.status === 'missing').length,
    expired: rows.filter(r => r.status === 'expired').length,
    due: rows.filter(r => r.status === 'critical' || r.status === 'soon').length,
    employees: new Set(rows.map(r => r.employeeId).filter(Boolean)).size,
    recipients: new Set(rows.map(r => reminderRecipient(r).email || reminderRecipient(r).name).filter(Boolean)).size
  };
}

function renderReminderCenter(){
  const el = $('reminders');
  if(!el) return;
  if(!canManageReminders()){
    el.innerHTML = '<div class="card span-12"><h2>Erinnerungen</h2><div class="notice warning">Fuer deine Rolle nicht freigeschaltet.</div></div>';
    return;
  }
  const f = reminderCurrentFilters();
  const rows = filteredReminderRows();
  const s = reminderStats(rows);
  el.innerHTML = `<div class="grid">
    <div class="card span-12">
      <div class="toolbar">
        <div><h2>Erinnerungs-/Mahncenter</h2><p class="muted">Offene Unterweisungen filtern, Mailtexte erzeugen, Einmal-Links erstellen und CSV exportieren.</p></div>
        <div class="filters"><button class="ghost" onclick="reloadReminderCenter()">Neu laden</button><button class="ghost" onclick="exportReminderCsv()">CSV exportieren</button></div>
      </div>
      <div class="filters status-filterbar">
        <select id="reminderRecipientType"><option value="employee" ${f.recipientType==='employee'?'selected':''}>Mail an Mitarbeiter</option><option value="manager" ${f.recipientType==='manager'?'selected':''}>Mail an Line Manager</option></select>
        <select id="reminderManager"><option value="">Alle Line Manager</option>${reminderManagers().map(m => `<option value="${esc(m.id)}" ${f.managerId===m.id?'selected':''}>${esc(m.name || m.id)}</option>`).join('')}</select>
        <select id="reminderType"><option value="">Alle Unterweisungen</option>${types().map(t => `<option value="${esc(t.id)}" ${f.typeId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
        <select id="reminderStatus"><option value="open" ${f.status==='open'?'selected':''}>Alle offenen</option>${['missing','expired','critical','soon'].map(x => `<option value="${x}" ${f.status===x?'selected':''}>${statusText(x)}</option>`).join('')}</select>
        <input id="reminderSearch" placeholder="Mitarbeiter, Unterweisung, Bereich" value="${esc(f.search)}">
      </div>
      <div class="grid compact-kpis">
        <div class="card kpi mini"><div class="label">Offen</div><div class="value yellow">${s.total}</div></div>
        <div class="card kpi mini"><div class="label">Mitarbeiter</div><div class="value blue">${s.employees}</div></div>
        <div class="card kpi mini"><div class="label">Empfaenger</div><div class="value blue">${s.recipients}</div></div>
        <div class="card kpi mini"><div class="label">Fehlend</div><div class="value yellow">${s.missing}</div></div>
        <div class="card kpi mini"><div class="label">Abgelaufen</div><div class="value red">${s.expired}</div></div>
        <div class="card kpi mini"><div class="label">Faellig bald</div><div class="value yellow">${s.due}</div></div>
      </div>
      <div class="notice worklist-actions"><b>Aktionen:</b>
        <button class="small ghost" onclick="toggleReminderRows(true)">Alle sichtbaren waehlen</button>
        <button class="small ghost" onclick="toggleReminderRows(false)">Auswahl leeren</button>
        <button class="small primary" onclick="copyReminderMailText()">Mailtext fuer Auswahl</button>
        <button class="small" onclick="createReminderLinksForSelection()">Einmal-Links fuer Auswahl</button>
      </div>
      <div id="reminderResult"></div>
      ${reminderTable(rows)}
    </div>
    <div class="card span-12"><h2>Letzte Erinnerungslaeufe</h2><div id="reminderLog">${reminderLogTable()}</div></div>
  </div>`;
  ['reminderRecipientType','reminderManager','reminderType','reminderStatus','reminderSearch'].forEach(id => $(id)?.addEventListener('input', renderReminderCenter));
}

function reminderTable(rows){
  if(!rows.length) return '<p class="muted">Keine offenen Unterweisungen fuer diese Auswahl.</p>';
  return `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" onchange="toggleReminderRows(this.checked)"></th><th>Empfaenger</th><th>Mitarbeiter</th><th>Line Manager</th><th>Unterweisung</th><th>Faellig bis</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,1000).map(r => {
    const rec = reminderRecipient(r);
    return `<tr>
      <td><input class="reminderSelect" type="checkbox" value="${esc(reminderRowKey(r))}"></td>
      <td><b>${esc(rec.name)}</b><br><span class="muted">${esc(rec.email || 'keine E-Mail')}</span><br><span class="muted">${esc(rec.type)}</span></td>
      <td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email || '')}</span></td>
      <td>${esc(lineManagerName(r))}<br><span class="muted">${esc(lineManagerEmail(r) || '')}</span></td>
      <td>${esc(r.instructionName)}<br><span class="muted">${esc(r.category || '')}</span></td>
      <td>${fmtDate(r.validUntil)}</td>
      <td>${badge(r.status)}</td>
      <td><button class="small" onclick="singleReminderMail('${esc(reminderRowKey(r))}')">Mailtext</button> <button class="small primary" onclick="singleReminderLink('${esc(reminderRowKey(r))}')">Link</button></td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Eintraege angezeigt, maximal 1000 sichtbar.</p>`;
}

function reminderRowKey(row){
  return `${row.employeeId || ''}::${row.typeId || ''}`;
}

function selectedReminderRows(){
  const keys = new Set(Array.from(document.querySelectorAll('.reminderSelect:checked')).map(x => x.value));
  return filteredReminderRows().filter(r => keys.has(reminderRowKey(r)));
}

function toggleReminderRows(value){
  document.querySelectorAll('.reminderSelect').forEach(cb => { cb.checked = value; });
}

function reminderGroupedByRecipient(rows){
  const groups = new Map();
  for(const row of rows){
    const recipient = reminderRecipient(row);
    const key = recipient.email || recipient.name || 'ohne-empfaenger';
    if(!groups.has(key)) groups.set(key, { recipient, rows:[] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function reminderMailSubject(group){
  const company = state.company?.name || 'Essentra';
  return `${company}: offene Unterweisungen (${group.rows.length})`;
}

function reminderMailBody(group){
  const lines = [];
  lines.push(`Hallo ${group.recipient.name || ''},`);
  lines.push('');
  lines.push('bitte folgende offene Unterweisungen bearbeiten bzw. im Team nachhalten:');
  lines.push('');
  group.rows.forEach((r, index) => {
    lines.push(`${index + 1}. ${r.employeeName} - ${r.instructionName}`);
    lines.push(`   Status: ${statusText(r.status)} | faellig bis: ${fmtDate(r.validUntil)}`);
    if(r.email) lines.push(`   Mitarbeiter-Mail: ${r.email}`);
  });
  lines.push('');
  lines.push('Bitte Rueckmeldung geben, sobald die Unterweisungen abgeschlossen sind.');
  lines.push('');
  lines.push('Viele Gruesse');
  lines.push(state.me?.name || 'Unterweisungsmanager');
  return lines.join('\n');
}

function buildReminderMailText(rows){
  const groups = reminderGroupedByRecipient(rows);
  if(!groups.length) return '';
  return groups.map(group => `AN: ${group.recipient.email || '(keine E-Mail)'}\nBETREFF: ${reminderMailSubject(group)}\n\n${reminderMailBody(group)}`).join('\n\n---\n\n');
}

async function copyReminderMailText(){
  const rows = selectedReminderRows();
  if(!rows.length){ alert('Bitte mindestens einen Eintrag auswaehlen.'); return; }
  const text = buildReminderMailText(rows);
  try{ await navigator.clipboard.writeText(text); }catch{}
  logReminderBatch('mailtext', rows.length);
  const target = $('reminderResult');
  if(target) target.innerHTML = `<div class="notice"><b>Mailtext erstellt und in die Zwischenablage kopiert.</b><br><textarea readonly>${esc(text)}</textarea></div>`;
}

function singleReminderMail(key){
  toggleReminderRows(false);
  const row = filteredReminderRows().find(r => reminderRowKey(r) === key);
  if(!row) return;
  const cb = Array.from(document.querySelectorAll('.reminderSelect')).find(x => x.value === key);
  if(cb) cb.checked = true;
  copyReminderMailText();
}

async function createReminderLinksForSelection(){
  if(!state.apiAvailable){ alert('Einmal-Links brauchen die Azure API.'); return; }
  const rows = selectedReminderRows().filter(r => r.email);
  if(!rows.length){ alert('Bitte Eintraege mit Mitarbeiter-E-Mail auswaehlen.'); return; }
  const target = $('reminderResult');
  if(target) target.innerHTML = 'Einmal-Links werden erstellt ...';
  const created = [];
  const failed = [];
  for(const row of rows){
    try{
      const result = await createExternalInvitationFromRow(row, false);
      created.push({ row, result });
    }catch(err){
      failed.push(`${row.employeeName}: ${err.message || err}`);
    }
  }
  reminderLinkResults = created;
  const text = created.map(x => `${x.row.employeeName};${x.row.email};${x.row.instructionName};${x.result.url}`).join('\n');
  try{ await navigator.clipboard.writeText(text); }catch{}
  logReminderBatch('links', created.length);
  if(target) target.innerHTML = `<div class="notice"><b>${created.length} Einmal-Links erstellt.</b> ${failed.length ? failed.length + ' Fehler.' : ''}<br><textarea readonly>${esc(text)}</textarea>${failed.length ? `<pre>${esc(failed.join('\n'))}</pre>` : ''}</div>`;
}

function singleReminderLink(key){
  toggleReminderRows(false);
  const cb = Array.from(document.querySelectorAll('.reminderSelect')).find(x => x.value === key);
  if(cb) cb.checked = true;
  createReminderLinksForSelection();
}

function logReminderBatch(kind, count){
  const log = readReminderLog();
  log.unshift({ kind, count, createdAt:new Date().toISOString(), user:state.me?.name || '' });
  writeReminderLog(log);
}

function reminderLogTable(){
  const log = readReminderLog();
  if(!log.length) return '<p class="muted">Noch kein Erinnerungs-/Mahn-Lauf gespeichert.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Art</th><th>Anzahl</th><th>Benutzer</th></tr></thead><tbody>${log.map(row => `<tr><td>${fmtDate(row.createdAt)}</td><td>${esc(row.kind)}</td><td>${esc(row.count)}</td><td>${esc(row.user || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

function exportReminderCsv(){
  const rows = filteredReminderRows();
  const header = ['Empfaenger-Art','Empfaenger','Empfaenger-E-Mail','Mitarbeiter','Mitarbeiter-E-Mail','Line Manager','Line-Manager-E-Mail','Unterweisung','Bereich','Faellig bis','Status'];
  const csvRows = [header, ...rows.map(r => {
    const rec = reminderRecipient(r);
    return [rec.type, rec.name, rec.email, r.employeeName, r.email, lineManagerName(r), lineManagerEmail(r), r.instructionName, r.category, fmtDate(r.validUntil), statusText(r.status)];
  })];
  const csv = csvRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unterweisungs-erinnerungen-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function reloadReminderCenter(){
  if(state.apiAvailable || API_BASE_URL){
    try{ state.statusRows = await api('/instruction-status'); }catch(err){ alert('Status konnte nicht geladen werden: ' + String(err.message || err)); }
  }
  renderReminderCenter();
}

(function(){
  const originalRenderAll = typeof renderAll === 'function' ? renderAll : null;
  if(originalRenderAll){
    renderAll = function(){
      originalRenderAll();
      if(document.getElementById('reminders')?.classList.contains('active')) renderReminderCenter();
    };
  }

  const originalSetView = typeof setView === 'function' ? setView : null;
  if(originalSetView){
    setView = function(id){
      originalSetView(id);
      if(id === 'reminders') renderReminderCenter();
    };
  }
})();

window.renderReminderCenter = renderReminderCenter;
window.reloadReminderCenter = reloadReminderCenter;
window.exportReminderCsv = exportReminderCsv;
window.copyReminderMailText = copyReminderMailText;
window.createReminderLinksForSelection = createReminderLinksForSelection;
window.toggleReminderRows = toggleReminderRows;
window.singleReminderMail = singleReminderMail;
window.singleReminderLink = singleReminderLink;
