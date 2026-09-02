// v0.25: Unterweisungsstatus als Arbeitsliste für Essentra.
// Fokus: fehlende/fällige Unterweisungen direkt abarbeiten, nicht nur anzeigen.

function canEditStatusWorklist(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

function statusRowsSource(){
  return state.statusRows?.length ? state.statusRows : buildLocalStatusRows();
}

function statusWorklistFilters(){
  return {
    search: $('statusSearch')?.value || '',
    status: $('statusFilter')?.value || '',
    typeId: $('typeFilter')?.value || '',
    category: $('categoryFilter')?.value || '',
    lineManagerId: $('lineManagerFilter')?.value || '',
    onlyOpen: $('onlyOpenFilter')?.checked || false
  };
}

function openStatusValues(){
  return new Set(['missing','expired','critical','soon']);
}

function filteredStatusRows(){
  const f = statusWorklistFilters();
  const q = String(f.search || '').toLowerCase();
  const openSet = openStatusValues();
  return statusRowsSource().filter(r => {
    if(f.onlyOpen && !openSet.has(r.status)) return false;
    if(f.status && r.status !== f.status) return false;
    if(f.typeId && r.typeId !== f.typeId) return false;
    if(f.category && r.category !== f.category) return false;
    if(f.lineManagerId && r.lineManagerId !== f.lineManagerId) return false;
    if(q && ![r.employeeName,r.email,r.department,r.role,r.lineManagerName,r.instructionName,r.category,r.status].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function statusWorklistStats(rows){
  return rows.reduce((a,r)=>{ a[r.status]=(a[r.status]||0)+1; return a; }, {missing:0,expired:0,critical:0,soon:0,valid:0,not_required:0});
}

function uniqueCategories(){
  return [...new Set(statusRowsSource().map(r=>r.category).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'de'));
}

function lineManagerFilterOptions(selected=''){
  const rows = [...new Map(statusRowsSource().filter(r=>r.lineManagerId || r.lineManagerName).map(r=>[r.lineManagerId || r.lineManagerName, { id:r.lineManagerId || r.lineManagerName, name:r.lineManagerName || emp(r.lineManagerId).name }])).values()]
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
  return `<option value="">Alle Line Manager</option>${rows.map(x=>`<option value="${esc(x.id)}" ${selected===x.id?'selected':''}>${esc(x.name||x.id)}</option>`).join('')}`;
}

function renderStatus(){
  const editable = canEditStatusWorklist();
  const rows = filteredStatusRows();
  const s = statusWorklistStats(rows);
  const f = statusWorklistFilters();
  $('status').innerHTML = `<div class="grid">
    <div class="card span-12">
      <div class="toolbar"><div><h2>Unterweisungsstatus / Arbeitsliste</h2><p class="muted">Hier arbeitet Essentra fehlende, abgelaufene und bald fällige Unterweisungen direkt ab. Datenquelle: <b>${state.apiAvailable?'Azure API':'Seed-Fallback'}</b>.</p></div><div class="filters"><button class="ghost" onclick="reloadStatusWorklist()">Neu laden</button><button class="ghost" onclick="exportStatusCsv()">CSV exportieren</button></div></div>
      <div class="grid compact-kpis">
        <div class="card kpi mini"><div class="label">Fehlend</div><div class="value yellow">${s.missing||0}</div></div>
        <div class="card kpi mini"><div class="label">Abgelaufen</div><div class="value red">${s.expired||0}</div></div>
        <div class="card kpi mini"><div class="label">Kritisch/Bald</div><div class="value yellow">${(s.critical||0)+(s.soon||0)}</div></div>
        <div class="card kpi mini"><div class="label">Gültig</div><div class="value green">${s.valid||0}</div></div>
        <div class="card kpi mini"><div class="label">Nicht erforderlich</div><div class="value blue">${s.not_required||0}</div></div>
      </div>
      <div class="filters status-filterbar">
        <input id="statusSearch" placeholder="Mitarbeiter, Unterweisung, Bereich, Line Manager" value="${esc(f.search)}">
        <select id="statusFilter"><option value="">Alle Status</option>${['missing','expired','critical','soon','valid','not_required'].map(x=>`<option value="${x}" ${f.status===x?'selected':''}>${statusText(x)}</option>`).join('')}</select>
        <select id="typeFilter"><option value="">Alle Unterweisungen</option>${types().map(t=>`<option value="${esc(t.id)}" ${f.typeId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
        <select id="categoryFilter"><option value="">Alle Bereiche</option>${uniqueCategories().map(c=>`<option value="${esc(c)}" ${f.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
        <select id="lineManagerFilter">${lineManagerFilterOptions(f.lineManagerId)}</select>
        <label class="checkline inline"><input id="onlyOpenFilter" type="checkbox" ${f.onlyOpen?'checked':''}> Nur offene</label>
      </div>
      ${editable ? statusBulkActions() : '<div class="notice warning">Du hast keine Berechtigung zum Bearbeiten des Status.</div>'}
      <div id="statusActionResult"></div>
      ${statusWorklistTable(rows, editable)}
    </div>
  </div>`;
  ['statusSearch','statusFilter','typeFilter','categoryFilter','lineManagerFilter','onlyOpenFilter'].forEach(id=>$(id)?.addEventListener('input', renderStatus));
}

function statusText(status){
  return ({valid:'Gültig',soon:'Bald fällig',critical:'Kritisch',expired:'Abgelaufen',missing:'Fehlend',not_required:'Nicht erforderlich'})[status] || status || '—';
}

function statusBulkActions(){
  return `<div class="notice worklist-actions"><b>Ausgewählte Einträge:</b>
    <button class="small primary" onclick="bulkConductSelected()">Als durchgeführt abschließen</button>
    <button class="small" onclick="bulkCreateExternalLinks()">Einmal-Links erzeugen</button>
    <button class="small" onclick="bulkMarkNotRequired()">Nicht erforderlich</button>
    <button class="small ghost" onclick="toggleAllStatusRows(true)">Alle sichtbaren wählen</button>
    <button class="small ghost" onclick="toggleAllStatusRows(false)">Auswahl leeren</button>
    <span class="muted">Sammelabschluss funktioniert automatisch gruppiert je Unterweisung.</span>
  </div>`;
}

function statusRowKey(r){
  return `${r.employeeId}::${r.typeId}`;
}

function selectedStatusRows(){
  const keys = new Set(Array.from(document.querySelectorAll('.statusSelect:checked')).map(x=>x.value));
  return filteredStatusRows().filter(r=>keys.has(statusRowKey(r)));
}

function toggleAllStatusRows(value){
  document.querySelectorAll('.statusSelect').forEach(cb=>cb.checked = value);
}

function statusWorklistTable(rows, editable=false){
  if(!rows.length) return '<p class="muted">Keine Einträge für die aktuelle Auswahl.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>${editable?'<input type="checkbox" onchange="toggleAllStatusRows(this.checked)">':''}</th><th>Mitarbeiter</th><th>Unterweisung</th><th>Bereich</th><th>Line Manager</th><th>Letztes Datum</th><th>Fällig bis</th><th>Status</th><th>Nachweis</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,1000).map(r=>`<tr class="status-row status-${esc(r.status)}">
    <td>${editable?`<input class="statusSelect" type="checkbox" value="${esc(statusRowKey(r))}">`:''}</td>
    <td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email||'keine E-Mail')}</span></td>
    <td>${esc(r.instructionName)}</td>
    <td>${esc(r.category||'—')}</td>
    <td>${esc(r.lineManagerName||'—')}</td>
    <td>${fmtDate(r.conductedAt)}</td>
    <td>${fmtDate(r.validUntil)}</td>
    <td>${badge(r.status)}</td>
    <td>${proofCell(r)}</td>
    <td>${editable ? statusWorklistActions(r) : '—'}</td>
  </tr>`).join('')}</tbody></table></div><p class="muted">${rows.length} Einträge angezeigt, maximal 1000 sichtbar.</p>`;
}

function statusWorklistActions(r){
  if(r.status === 'not_required') return `<button class="small" onclick="removeExclusion('${esc(r.exclusionId||'')}')">Wieder erforderlich</button>`;
  return `<button class="small primary" onclick="conductOne('${esc(r.employeeId)}','${esc(r.typeId)}')">Durchführen</button>
    <button class="small" onclick="createExternalLinkForStatus('${esc(r.employeeId)}','${esc(r.typeId)}')">Link</button>
    <button class="small" onclick="markNotRequired('${esc(r.employeeId)}','${esc(r.typeId)}')">Nicht erforderlich</button>`;
}

async function reloadStatusWorklist(){
  if(state.apiAvailable || API_BASE_URL){
    try{ state.statusRows = await api('/instruction-status'); }catch(err){ alert('Status konnte nicht geladen werden: ' + String(err.message || err)); }
  }
  renderStatus();
}

async function bulkConductSelected(){
  if(!state.apiAvailable){ alert('Sammelabschluss braucht die Azure API.'); return; }
  const rows = selectedStatusRows().filter(r => r.status !== 'not_required');
  if(!rows.length){ alert('Bitte mindestens einen offenen Eintrag auswählen.'); return; }
  const durationMinutes = Number(prompt('Dauer in Minuten?', '30') || 30);
  const conductedAt = new Date().toISOString();
  const grouped = new Map();
  for(const r of rows){
    if(!grouped.has(r.typeId)) grouped.set(r.typeId, []);
    grouped.get(r.typeId).push(r.employeeId);
  }
  const target = $('statusActionResult');
  target.innerHTML = 'Sammelabschluss läuft ...';
  try{
    let done = 0;
    for(const [typeId, employeeIds] of grouped.entries()){
      await api('/records', { method:'POST', body: JSON.stringify({ typeId, employeeIds, conductedAt, durationMinutes, source:'bulk_status_worklist', confirmationText:'Sammelabschluss über Status-Arbeitsliste' }) });
      done += employeeIds.length;
    }
    target.innerHTML = `<div class="notice"><b>${done} Unterweisungen abgeschlossen.</b></div>`;
    await loadData();
    await reloadStatusWorklist();
  }catch(err){ target.innerHTML = `<div class="notice dangerbox">Sammelabschluss fehlgeschlagen: ${esc(err.message || err)}</div>`; }
}

async function createExternalLinkForStatus(employeeId, typeId){
  const row = statusRowsSource().find(r=>r.employeeId===employeeId && r.typeId===typeId);
  if(!row){ alert('Eintrag nicht gefunden.'); return; }
  if(!row.email){ alert('Der Mitarbeiter hat keine E-Mail-Adresse.'); return; }
  await createExternalInvitationFromRow(row, true);
}

async function createExternalInvitationFromRow(row, showAlert=false){
  const result = await api('/invitations', { method:'POST', body: JSON.stringify({
    email: row.email,
    recipientName: row.employeeName,
    employeeId: row.employeeId,
    instructionTypeId: row.typeId,
    language: 'de',
    validDays: 14,
    passPercent: 80,
    testRequired: true,
    sendMail: false
  }) });
  if(showAlert) alert('Einmal-Link erstellt:\n' + result.url);
  return result;
}

async function bulkCreateExternalLinks(){
  if(!state.apiAvailable){ alert('Einmal-Links brauchen die Azure API.'); return; }
  const rows = selectedStatusRows().filter(r => r.status !== 'valid' && r.status !== 'not_required');
  if(!rows.length){ alert('Bitte fehlende/fällige Einträge auswählen.'); return; }
  const withMail = rows.filter(r=>r.email);
  if(!withMail.length){ alert('Keiner der ausgewählten Mitarbeiter hat eine E-Mail-Adresse.'); return; }
  const target = $('statusActionResult');
  target.innerHTML = 'Einmal-Links werden erstellt ...';
  const created = [];
  const failed = [];
  for(const row of withMail){
    try{ created.push({ row, result: await createExternalInvitationFromRow(row, false) }); }
    catch(err){ failed.push({ row, error:String(err.message || err) }); }
  }
  const text = created.map(x=>`${x.row.employeeName};${x.row.email};${x.row.instructionName};${x.result.url}`).join('\n');
  try{ await navigator.clipboard.writeText(text); }catch{}
  target.innerHTML = `<div class="notice"><b>${created.length} Einmal-Links erstellt.</b> ${failed.length?failed.length+' Fehler.':''}<br><textarea readonly>${esc(text)}</textarea></div>`;
  await loadData();
}

async function bulkMarkNotRequired(){
  if(!state.apiAvailable){ alert('Nicht erforderlich braucht die Azure API.'); return; }
  const rows = selectedStatusRows().filter(r => r.status !== 'not_required');
  if(!rows.length){ alert('Bitte mindestens einen Eintrag auswählen.'); return; }
  if(!confirm(`${rows.length} Einträge als nicht erforderlich markieren?`)) return;
  const target = $('statusActionResult');
  target.innerHTML = 'Einträge werden markiert ...';
  let done = 0;
  const failed = [];
  for(const r of rows){
    try{
      await api('/exclusions',{method:'POST',body:JSON.stringify({employeeId:r.employeeId,instructionTypeId:r.typeId,reason:'Nicht erforderlich über Status-Arbeitsliste'})});
      done++;
    }catch(err){ failed.push(`${r.employeeName} / ${r.instructionName}: ${err.message || err}`); }
  }
  target.innerHTML = `<div class="notice"><b>${done} Einträge markiert.</b>${failed.length?'<br>Fehler:<br>'+esc(failed.join('\n')):''}</div>`;
  await loadData();
  await reloadStatusWorklist();
}

function exportStatusCsv(){
  const rows = filteredStatusRows();
  const header = ['Mitarbeiter','E-Mail','Abteilung','Rolle','Line Manager','Unterweisung','Bereich','Status','Letztes Datum','Fällig bis','Nachweis'];
  const csvRows = [header, ...rows.map(r=>[
    r.employeeName,
    r.email,
    r.department,
    r.role,
    r.lineManagerName,
    r.instructionName,
    r.category,
    statusText(r.status),
    fmtDate(r.conductedAt),
    fmtDate(r.validUntil),
    r.certificateFileName || r.certificateStatus || ''
  ])];
  const csv = csvRows.map(row=>row.map(cell=>`"${String(cell ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unterweisungsstatus-${state.companyId || DEFAULT_COMPANY_ID}-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
