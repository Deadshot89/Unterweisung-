// v0.28: Line-Manager-Arbeitsansicht / Manager-Report fuer Essentra.
// Ziel: Verantwortliche sehen offene Unterweisungen, Monatsaufwand und koennen direkt handeln.

let managerReportCache = [];

function canViewManagerReport(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

function managerRowsSource(){
  return state.statusRows?.length ? state.statusRows : buildLocalStatusRows();
}

function allLineManagersForReport(){
  const fromStatus = managerRowsSource()
    .filter(r => r.lineManagerId || r.lineManagerName)
    .map(r => ({ id:r.lineManagerId || r.lineManagerName, name:r.lineManagerName || emp(r.lineManagerId).name || r.lineManagerId }));
  const fromEmployees = employees()
    .filter(e => e.active !== false && (String(e.role||'').toLowerCase().includes('manager') || managerRowsSource().some(r => r.lineManagerId === e.id)))
    .map(e => ({ id:e.id, name:e.name }));
  return [...new Map([...fromStatus, ...fromEmployees].filter(x=>x.id || x.name).map(x=>[x.id || x.name, x])).values()]
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
}

function currentManagerReportFilters(){
  return {
    managerId: $('managerReportManager')?.value || '',
    status: $('managerReportStatus')?.value || 'open',
    search: $('managerReportSearch')?.value || '',
    from: $('managerReportFrom')?.value || `${new Date().getFullYear()}-01-01`,
    to: $('managerReportTo')?.value || todayIso()
  };
}

function managerReportOpenStatuses(){
  return new Set(['missing','expired','critical','soon']);
}

function filteredManagerStatusRows(){
  const f = currentManagerReportFilters();
  const q = String(f.search || '').toLowerCase();
  const open = managerReportOpenStatuses();
  return managerRowsSource().filter(r => {
    if(f.managerId && (r.lineManagerId || r.lineManagerName) !== f.managerId) return false;
    if(f.status === 'open' && !open.has(r.status)) return false;
    if(f.status && f.status !== 'open' && r.status !== f.status) return false;
    if(q && ![r.employeeName,r.email,r.department,r.role,r.lineManagerName,r.instructionName,r.category,r.status].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function managerReportStats(rows){
  const affectedEmployees = new Set(rows.map(r=>r.employeeId).filter(Boolean)).size;
  return {
    total: rows.length,
    affectedEmployees,
    missing: rows.filter(r=>r.status==='missing').length,
    expired: rows.filter(r=>r.status==='expired').length,
    dueSoon: rows.filter(r=>r.status==='critical' || r.status==='soon').length,
    valid: rows.filter(r=>r.status==='valid').length
  };
}

function managerReportManagerOptions(selected=''){
  const managers = allLineManagersForReport();
  return `<option value="">Alle Line Manager</option>${managers.map(m=>`<option value="${esc(m.id)}" ${selected===m.id?'selected':''}>${esc(m.name || m.id)}</option>`).join('')}`;
}

function renderManagerReport(){
  const el = $('managerReport');
  if(!el) return;
  if(!canViewManagerReport()){
    el.innerHTML = '<div class="card span-12"><h2>Manager-Report</h2><div class="notice warning">Für deine Rolle nicht freigeschaltet.</div></div>';
    return;
  }
  const f = currentManagerReportFilters();
  const rows = filteredManagerStatusRows();
  const s = managerReportStats(rows);
  el.innerHTML = `<div class="grid">
    <div class="card span-12">
      <div class="toolbar"><div><h2>Manager-Report / Line-Manager-Arbeitsansicht</h2><p class="muted">Für Essentra: offene Unterweisungen je Verantwortlichem sehen, CSV exportieren, Links erzeugen oder direkt abschließen.</p></div><div class="filters"><button class="primary" onclick="loadManagerTimeReport()">Zeitreport laden</button><button class="ghost" onclick="reloadManagerReport()">Neu laden</button><button class="ghost" onclick="exportManagerReportCsv()">CSV exportieren</button></div></div>
      <div class="filters status-filterbar">
        <select id="managerReportManager">${managerReportManagerOptions(f.managerId)}</select>
        <select id="managerReportStatus">
          <option value="open" ${f.status==='open'?'selected':''}>Nur offene</option>
          ${['missing','expired','critical','soon','valid','not_required'].map(x=>`<option value="${x}" ${f.status===x?'selected':''}>${statusText(x)}</option>`).join('')}
          <option value="" ${f.status===''?'selected':''}>Alle Status</option>
        </select>
        <input id="managerReportSearch" placeholder="Mitarbeiter, Bereich, Unterweisung" value="${esc(f.search)}">
        <input id="managerReportFrom" type="date" value="${esc(f.from)}">
        <input id="managerReportTo" type="date" value="${esc(f.to)}">
      </div>
      <div class="grid compact-kpis">
        <div class="card kpi mini"><div class="label">Offene Einträge</div><div class="value yellow">${s.total}</div></div>
        <div class="card kpi mini"><div class="label">Betroffene MA</div><div class="value blue">${s.affectedEmployees}</div></div>
        <div class="card kpi mini"><div class="label">Fehlend</div><div class="value yellow">${s.missing}</div></div>
        <div class="card kpi mini"><div class="label">Abgelaufen</div><div class="value red">${s.expired}</div></div>
        <div class="card kpi mini"><div class="label">Kritisch/Bald</div><div class="value yellow">${s.dueSoon}</div></div>
      </div>
      <div id="managerReportResult"></div>
      ${managerActionBar(rows)}
      ${managerStatusTable(rows)}
    </div>
    <div class="card span-12"><h2>Monats-Zeitreport</h2><p class="muted">Auswertung der durchgeführten Unterweisungen nach Verantwortlichem, Monat und Unterweisung.</p><div id="managerTimeReport">Noch nicht geladen.</div></div>
  </div>`;
  ['managerReportManager','managerReportStatus','managerReportSearch','managerReportFrom','managerReportTo'].forEach(id=>$(id)?.addEventListener('input', renderManagerReport));
  if(managerReportCache.length) renderManagerTimeReport(managerReportCache);
}

function managerActionBar(rows){
  if(!rows.length) return '';
  return `<div class="notice worklist-actions"><b>Manager-Aktionen:</b>
    <button class="small primary" onclick="managerBulkComplete()">Ausgewählte abschließen</button>
    <button class="small" onclick="managerBulkCreateLinks()">Einmal-Links für Auswahl</button>
    <button class="small ghost" onclick="toggleManagerRows(true)">Alle sichtbaren wählen</button>
    <button class="small ghost" onclick="toggleManagerRows(false)">Auswahl leeren</button>
  </div>`;
}

function managerRowKey(r){ return `${r.employeeId}::${r.typeId}`; }
function selectedManagerRows(){
  const keys = new Set(Array.from(document.querySelectorAll('.managerSelect:checked')).map(x=>x.value));
  return filteredManagerStatusRows().filter(r=>keys.has(managerRowKey(r)));
}
function toggleManagerRows(value){ document.querySelectorAll('.managerSelect').forEach(cb=>cb.checked=value); }

function managerStatusTable(rows){
  if(!rows.length) return '<p class="muted">Keine Einträge für diese Auswahl.</p>';
  return `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" onchange="toggleManagerRows(this.checked)"></th><th>Line Manager</th><th>Mitarbeiter</th><th>Unterweisung</th><th>Bereich</th><th>Fällig bis</th><th>Status</th><th>Nachweis</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,1000).map(r=>`<tr>
    <td><input class="managerSelect" type="checkbox" value="${esc(managerRowKey(r))}"></td>
    <td>${esc(r.lineManagerName || '—')}</td>
    <td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email || 'keine E-Mail')}</span></td>
    <td>${esc(r.instructionName)}</td>
    <td>${esc(r.category || '—')}</td>
    <td>${fmtDate(r.validUntil)}</td>
    <td>${badge(r.status)}</td>
    <td>${proofCell(r)}</td>
    <td><button class="small primary" onclick="conductOne('${esc(r.employeeId)}','${esc(r.typeId)}')">Durchführen</button> <button class="small" onclick="managerCreateLink('${esc(r.employeeId)}','${esc(r.typeId)}')">Link</button> <button class="small ghost" onclick="jumpToStatusWorklist('${esc(r.employeeId)}','${esc(r.typeId)}')">Status öffnen</button></td>
  </tr>`).join('')}</tbody></table></div><p class="muted">${rows.length} Einträge angezeigt, maximal 1000 sichtbar.</p>`;
}

async function reloadManagerReport(){
  if(state.apiAvailable || API_BASE_URL){
    try{ state.statusRows = await api('/instruction-status'); }catch(err){ alert('Status konnte nicht geladen werden: ' + String(err.message || err)); }
  }
  renderManagerReport();
}

async function managerCreateLink(employeeId, typeId){
  const row = managerRowsSource().find(r=>r.employeeId===employeeId && r.typeId===typeId);
  if(!row){ alert('Eintrag nicht gefunden.'); return; }
  if(!row.email){ alert('Mitarbeiter hat keine E-Mail-Adresse.'); return; }
  try{
    const result = await createExternalInvitationFromRow(row, false);
    const target = $('managerReportResult');
    if(target) target.innerHTML = `<div class="notice"><b>Einmal-Link erstellt:</b><br><textarea readonly>${esc(`${row.employeeName};${row.email};${row.instructionName};${result.url}`)}</textarea></div>`;
  }catch(err){ alert('Link konnte nicht erstellt werden: ' + String(err.message || err)); }
}

async function managerBulkCreateLinks(){
  if(!state.apiAvailable){ alert('Einmal-Links brauchen die Azure API.'); return; }
  const rows = selectedManagerRows().filter(r => r.email && r.status !== 'valid' && r.status !== 'not_required');
  if(!rows.length){ alert('Bitte offene Einträge mit E-Mail auswählen.'); return; }
  const target = $('managerReportResult');
  target.innerHTML = 'Einmal-Links werden erstellt ...';
  const created = [];
  const failed = [];
  for(const row of rows){
    try{ created.push({ row, result: await createExternalInvitationFromRow(row, false) }); }
    catch(err){ failed.push(`${row.employeeName}: ${err.message || err}`); }
  }
  const text = created.map(x=>`${x.row.lineManagerName||''};${x.row.employeeName};${x.row.email};${x.row.instructionName};${x.result.url}`).join('\n');
  try{ await navigator.clipboard.writeText(text); }catch{}
  target.innerHTML = `<div class="notice"><b>${created.length} Links erstellt.</b> ${failed.length?failed.length+' Fehler.':''}<br><textarea readonly>${esc(text)}</textarea>${failed.length?`<pre>${esc(failed.join('\n'))}</pre>`:''}</div>`;
}

async function managerBulkComplete(){
  if(!state.apiAvailable){ alert('Abschluss braucht die Azure API.'); return; }
  const rows = selectedManagerRows().filter(r => r.status !== 'not_required');
  if(!rows.length){ alert('Bitte mindestens einen Eintrag auswählen.'); return; }
  const durationMinutes = Number(prompt('Dauer in Minuten?', '30') || 30);
  const conductedAt = new Date().toISOString();
  const grouped = new Map();
  for(const r of rows){
    if(!grouped.has(r.typeId)) grouped.set(r.typeId, []);
    grouped.get(r.typeId).push(r.employeeId);
  }
  const target = $('managerReportResult');
  target.innerHTML = 'Abschluss läuft ...';
  try{
    let done = 0;
    for(const [typeId, employeeIds] of grouped.entries()){
      await api('/records', { method:'POST', body: JSON.stringify({ typeId, employeeIds, conductedAt, durationMinutes, source:'manager_report', confirmationText:'Abschluss über Manager-Report' }) });
      done += employeeIds.length;
    }
    target.innerHTML = `<div class="notice"><b>${done} Unterweisungen abgeschlossen.</b></div>`;
    await loadData();
    await reloadManagerReport();
  }catch(err){ target.innerHTML = `<div class="notice dangerbox">Abschluss fehlgeschlagen: ${esc(err.message || err)}</div>`; }
}

function jumpToStatusWorklist(employeeId, typeId){
  setView('status');
  setTimeout(()=>{
    if($('statusSearch')) $('statusSearch').value = emp(employeeId).name || '';
    if($('typeFilter')) $('typeFilter').value = typeId;
    if(typeof renderStatus === 'function') renderStatus();
  }, 50);
}

async function loadManagerTimeReport(){
  if(!state.apiAvailable){ alert('Zeitreport braucht die Azure API.'); return; }
  const f = currentManagerReportFilters();
  const target = $('managerTimeReport');
  if(target) target.innerHTML = 'Zeitreport wird geladen ...';
  try{
    managerReportCache = await api(`/reports/manager-training-time?from=${encodeURIComponent(f.from)}&to=${encodeURIComponent(f.to)}`);
    renderManagerTimeReport(managerReportCache);
  }catch(err){
    if(target) target.innerHTML = `<div class="notice dangerbox">Zeitreport konnte nicht geladen werden: ${esc(err.message || err)}</div>`;
  }
}

function renderManagerTimeReport(rows){
  const target = $('managerTimeReport');
  if(!target) return;
  const f = currentManagerReportFilters();
  const filtered = rows.filter(r => !f.managerId || r.responsibleId === f.managerId || r.responsibleName === f.managerId);
  if(!filtered.length){ target.innerHTML = '<p class="muted">Keine Zeitdaten für den Zeitraum vorhanden.</p>'; return; }
  const totalMinutes = filtered.reduce((sum,r)=>sum + Number(r.participantMinutes||0), 0);
  const totalEvents = filtered.reduce((sum,r)=>sum + Number(r.trainingEvents||0), 0);
  const totalParticipants = filtered.reduce((sum,r)=>sum + Number(r.participantRecords||0), 0);
  target.innerHTML = `<div class="grid compact-kpis">
    <div class="card kpi mini"><div class="label">Teilnehmer-Minuten</div><div class="value blue">${totalMinutes.toLocaleString('de-DE')}</div></div>
    <div class="card kpi mini"><div class="label">Stunden</div><div class="value blue">${(totalMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})}</div></div>
    <div class="card kpi mini"><div class="label">Termine</div><div class="value green">${totalEvents}</div></div>
    <div class="card kpi mini"><div class="label">Teilnahmen</div><div class="value green">${totalParticipants}</div></div>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Monat</th><th>Verantwortlich</th><th>Unterweisung</th><th>Termine</th><th>Teilnahmen</th><th>Minuten</th><th>Stunden</th></tr></thead><tbody>${filtered.map(r=>`<tr><td>${esc(r.monthKey)}</td><td>${esc(r.responsibleName || '—')}</td><td>${esc(r.instructionName || '—')}</td><td>${Number(r.trainingEvents||0)}</td><td>${Number(r.participantRecords||0)}</td><td>${Number(r.participantMinutes||0).toLocaleString('de-DE')}</td><td>${(Number(r.participantMinutes||0)/60).toLocaleString('de-DE',{maximumFractionDigits:1})}</td></tr>`).join('')}</tbody></table></div>`;
}

function exportManagerReportCsv(){
  const rows = filteredManagerStatusRows();
  const header = ['Line Manager','Mitarbeiter','E-Mail','Abteilung','Unterweisung','Bereich','Status','Letztes Datum','Faellig bis'];
  const csvRows = [header, ...rows.map(r=>[r.lineManagerName,r.employeeName,r.email,r.department,r.instructionName,r.category,statusText(r.status),fmtDate(r.conductedAt),fmtDate(r.validUntil)])];
  const csv = csvRows.map(row=>row.map(cell=>`"${String(cell ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manager-report-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

(function(){
  try{ ROLE_VIEW_RULES.managerReport = ['company_admin','hse','line_manager','system_admin']; }catch{}
  const originalRender = typeof render === 'function' ? render : null;
  if(originalRender){
    render = function(id){
      if(id === 'managerReport') return renderManagerReport();
      return originalRender(id);
    };
  }
})();

window.renderManagerReport = renderManagerReport;
window.loadManagerTimeReport = loadManagerTimeReport;
window.reloadManagerReport = reloadManagerReport;
window.exportManagerReportCsv = exportManagerReportCsv;
window.managerBulkComplete = managerBulkComplete;
window.managerBulkCreateLinks = managerBulkCreateLinks;
window.managerCreateLink = managerCreateLink;
window.toggleManagerRows = toggleManagerRows;
window.jumpToStatusWorklist = jumpToStatusWorklist;
