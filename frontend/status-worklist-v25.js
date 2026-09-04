// v0.25: Unterweisungsstatus als Arbeitsliste für Essentra.
// Fokus: fehlende/fällige Unterweisungen direkt abarbeiten, nicht nur anzeigen.

let statusWorkspaceState = newStatusWorkspace();
function newStatusWorkspace(){
  return {companyId:state.companyId,filters:{search:'',status:'',typeId:'',category:'',lineManagerId:'',onlyOpen:false},page:1,pageSize:25,selected:new Set(),detailKey:'',fresh:true,busy:false,request:null,error:''};
}
function statusWorkspace(){
  if(statusWorkspaceState.companyId!==state.companyId) statusWorkspaceState=newStatusWorkspace();
  return statusWorkspaceState;
}

function canEditStatusWorklist(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

function statusRowsSource(){
  const rows=state.apiAvailable ? (state.statusRows || []) : (state.statusRows?.length ? state.statusRows : buildLocalStatusRows());
  return rows.filter(row=>!row.companyId || row.companyId===state.companyId);
}

function statusWorklistFilters(){
  const s=statusWorkspace();
  if(s.fresh || !$('statusSearch')) return {...s.filters};
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
    if(f.lineManagerId && (r.lineManagerId || r.lineManagerName) !== f.lineManagerId) return false;
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
  const workspace=statusWorkspace();
  const previousResult=workspace.fresh?'':$('statusActionResult')?.innerHTML||'';
  workspace.filters=statusWorklistFilters();
  const editable = canEditStatusWorklist();
  const f = workspace.filters;
  $('status').innerHTML = `<div class="card admin-workspace status-workspace">
      <div class="admin-toolbar"><div><span class="instruction-section-kicker">Fälligkeiten und Durchführung</span><h2>Unterweisungsstatus / Arbeitsliste</h2><p class="muted">Einträge auswählen oder Details mit Nachweisen und Aktionen öffnen. Datenquelle: <b>${state.apiAvailable?'Azure API':'Seed-Fallback'}</b>.</p></div><div class="status-toolbar-actions"><button type="button" class="ghost" data-status-action="reload">Neu laden</button><button type="button" class="ghost" data-status-action="export">CSV exportieren</button></div></div>
      <div id="statusMetrics" class="status-metrics"></div>
      <div class="status-filters">
        <div class="field"><label for="statusSearch">Suche</label><input id="statusSearch" placeholder="Mitarbeiter, Unterweisung, Bereich, Line Manager" value="${esc(f.search)}"></div>
        <div class="field"><label for="statusFilter">Status</label><select id="statusFilter"><option value="">Alle Status</option>${['missing','expired','critical','soon','valid','not_required'].map(x=>`<option value="${x}" ${f.status===x?'selected':''}>${statusText(x)}</option>`).join('')}</select></div>
        <div class="field"><label for="typeFilter">Unterweisung</label><select id="typeFilter"><option value="">Alle Unterweisungen</option>${types().map(t=>`<option value="${esc(t.id)}" ${f.typeId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="categoryFilter">Bereich</label><select id="categoryFilter"><option value="">Alle Bereiche</option>${uniqueCategories().map(c=>`<option value="${esc(c)}" ${f.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="lineManagerFilter">Line Manager</label><select id="lineManagerFilter">${lineManagerFilterOptions(f.lineManagerId)}</select></div>
        <label class="checkline inline"><input id="onlyOpenFilter" type="checkbox" ${f.onlyOpen?'checked':''}> Nur offene</label>
      </div>
      ${editable ? statusBulkActions() : '<div class="notice warning">Du hast keine Berechtigung zum Bearbeiten des Status.</div>'}
      <div id="statusNotice" role="status" aria-live="polite"></div>
      <div id="statusActionResult" aria-live="polite">${previousResult}</div>
      <div id="statusResults"></div>
      <div id="statusDetail"></div>
  </div>`;
  workspace.fresh=false;
  bindStatusWorkspace();renderStatusResults();renderStatusDetail();renderStatusNotice();
}

function statusPageRows(rows=filteredStatusRows()){
  const s=statusWorkspace();s.page=Math.max(1,Math.min(s.page,Math.ceil(rows.length/s.pageSize)||1));
  return rows.slice((s.page-1)*s.pageSize,s.page*s.pageSize);
}
function renderStatusResults(){
  if(!$('statusResults')) return;
  const s=statusWorkspace(),rows=filteredStatusRows(),stats=statusWorklistStats(rows);
  $('statusMetrics').innerHTML=[['Fehlend',stats.missing,'yellow'],['Abgelaufen',stats.expired,'red'],['Kritisch / bald',stats.critical+stats.soon,'yellow'],['Gültig',stats.valid,'green'],['Nicht erforderlich',stats.not_required,'blue']].map(([label,value,color])=>`<div><span>${label}</span><strong class="${color}">${value}</strong></div>`).join('');
  $('statusResults').innerHTML=statusWorklistTable(rows,canEditStatusWorklist());
  renderStatusSelection(rows);renderStatusNotice();
}
function renderStatusSelection(rows=filteredStatusRows()){
  const s=statusWorkspace();
  const selected=selectedStatusRows(),shown=new Set(rows.map(statusRowKey));
  if($('statusSelection')) $('statusSelection').textContent=`${selected.length} ausgewählt · ${selected.filter(r=>!shown.has(statusRowKey(r))).length} durch Filter ausgeblendet. Sammelaktionen gelten für die gesamte Auswahl.`;
  document.querySelectorAll('#status .statusSelect').forEach(el=>{el.checked=s.selected.has(el.value);});
  const page=statusPageRows(rows),all=$('statusSelectPage');
  if(all){all.checked=!!page.length&&page.every(r=>s.selected.has(statusRowKey(r)));all.indeterminate=!all.checked&&page.some(r=>s.selected.has(statusRowKey(r)));}
}
function renderStatusNotice(){
  const s=statusWorkspace();if(!$('statusNotice'))return;
  $('statusNotice').innerHTML=s.error?`<div class="notice dangerbox">${esc(s.error)}</div>`:s.request?'<p class="muted">Status wird geladen …</p>':s.busy?'<p class="muted">Aktion läuft …</p>':'';
  document.querySelectorAll('#status [data-status-write], #status .statusSelect, #statusSelectPage').forEach(el=>{el.disabled=s.busy;});
  const reload=document.querySelector('#status [data-status-action="reload"]');if(reload)reload.disabled=s.busy||!!s.request;
}

function statusText(status){
  return ({valid:'Gültig',soon:'Bald fällig',critical:'Kritisch',expired:'Abgelaufen',missing:'Fehlend',not_required:'Nicht erforderlich'})[status] || status || '—';
}

function statusBulkActions(){
  return `<div class="notice worklist-actions"><b id="statusSelection" aria-live="polite"></b><div class="status-toolbar-actions">
    <button type="button" class="small primary" data-status-write data-status-action="bulk-conduct">Als durchgeführt abschließen</button>
    <button type="button" class="small" data-status-write data-status-action="bulk-links">Einmal-Links erzeugen</button>
    <button type="button" class="small" data-status-write data-status-action="bulk-exclude">Nicht erforderlich</button>
    <button type="button" class="small ghost" data-status-write data-status-action="select-page">Diese Seite wählen</button>
    <button type="button" class="small ghost" data-status-write data-status-action="clear">Auswahl leeren</button></div>
  </div>`;
}

function statusRowKey(r){
  return `${r.employeeId}::${r.typeId}`;
}

function selectedStatusRows(){
  const s=statusWorkspace(),rows=statusRowsSource(),keys=new Set(rows.map(statusRowKey));
  if(!canEditStatusWorklist())s.selected.clear();
  for(const key of s.selected)if(!keys.has(key))s.selected.delete(key);
  return rows.filter(r=>s.selected.has(statusRowKey(r)));
}

function toggleAllStatusRows(value){
  const s=statusWorkspace();if(!canEditStatusWorklist()||s.busy)return;
  statusPageRows().forEach(r=>value?s.selected.add(statusRowKey(r)):s.selected.delete(statusRowKey(r)));
  renderStatusSelection();
}

function statusWorklistTable(rows, editable=false){
  const s=statusWorkspace(),page=statusPageRows(rows),pages=Math.max(1,Math.ceil(rows.length/s.pageSize));
  const table=rows.length?`<div class="table-wrap admin-table-wrap"><table class="admin-table status-table"><thead><tr>${editable?'<th scope="col" class="status-col-select"><input id="statusSelectPage" aria-label="Diese Seite auswählen" type="checkbox"></th>':''}<th scope="col" class="status-col-person">Mitarbeiter</th><th scope="col" class="status-col-instruction">Unterweisung</th><th scope="col" class="status-col-due">Fällig bis</th><th scope="col" class="status-col-state">Status</th><th scope="col" class="status-col-detail">Details</th></tr></thead><tbody>${page.map(r=>`<tr class="status-worklist-row status-${esc(r.status)} ${s.detailKey===statusRowKey(r)?'is-selected':''}">
    ${editable?`<td data-label="Auswahl"><input class="statusSelect" type="checkbox" aria-label="${esc(r.employeeName)}: ${esc(r.instructionName)} auswählen" value="${esc(statusRowKey(r))}" ${s.selected.has(statusRowKey(r))?'checked':''}></td>`:''}
    <td data-label="Mitarbeiter"><b class="status-preview">${esc(r.employeeName)}</b><span class="muted status-preview">${esc(r.department||'—')}</span></td>
    <td data-label="Unterweisung"><span class="status-preview">${esc(r.instructionName)}</span><span class="muted status-preview">${esc(r.category||'—')}</span></td>
    <td data-label="Fällig bis">${fmtDate(r.validUntil)}</td>
    <td data-label="Status">${badge(r.status)}</td>
    <td data-label="Details"><button type="button" class="small ghost" data-status-action="open" data-key="${esc(statusRowKey(r))}" aria-expanded="${s.detailKey===statusRowKey(r)}" aria-controls="statusDetail">Öffnen</button></td>
  </tr>`).join('')}</tbody></table></div>`:'<p class="muted">Keine Einträge für die aktuelle Auswahl.</p>';
  return `${table}<div class="status-pagination"><span>${rows.length?`${(s.page-1)*s.pageSize+1}–${Math.min(s.page*s.pageSize,rows.length)}`:'0'} von ${rows.length} Einträgen · Seite ${s.page} von ${pages}</span><div><button type="button" class="ghost" data-status-action="previous" ${s.page===1?'disabled':''}>Zurück</button><button type="button" class="ghost" data-status-action="next" ${s.page===pages?'disabled':''}>Weiter</button></div></div>`;
}

function statusWorklistActions(r){
  if(!canEditStatusWorklist())return '';
  if(r.status === 'not_required') return '<button type="button" class="small" data-status-write data-status-action="required">Wieder erforderlich</button>';
  return '<button type="button" class="small primary" data-status-write data-status-action="conduct">Durchführen</button><button type="button" class="small" data-status-write data-status-action="link">Einmal-Link erzeugen</button><button type="button" class="small" data-status-write data-status-action="exclude">Nicht erforderlich</button>';
}

function renderStatusDetail(){
  if(!$('statusDetail'))return;
  const s=statusWorkspace(),r=statusRowsSource().find(r=>statusRowKey(r)===s.detailKey);
  if(!r){s.detailKey='';$('statusDetail').innerHTML='<p class="muted status-detail-empty">Öffne einen Eintrag für vollständige Angaben, Nachweise und Aktionen.</p>';return;}
  const fields=[['E-Mail',r.email],['Abteilung / Rolle',[r.department,r.role].filter(Boolean).join(' · ')],['Line Manager',r.lineManagerName],['Bereich',r.category],['Zuletzt durchgeführt',fmtDate(r.conductedAt)],['Fällig bis',fmtDate(r.validUntil)],['Dauer',r.durationMinutes!=null?r.durationMinutes+' Minuten':null],['Nicht erforderlich – Begründung',r.exclusionReason]];
  $('statusDetail').innerHTML=`<article class="status-detail-panel" tabindex="-1"><div class="admin-toolbar"><div><span class="instruction-section-kicker">Detailansicht</span><h3>${esc(r.employeeName)}</h3><p>${esc(r.instructionName)}</p>${badge(r.status)}</div><button type="button" class="ghost" data-status-action="close">Schließen</button></div><dl class="status-detail-fields">${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value||'—')}</dd></div>`).join('')}</dl><section class="status-proof"><h4>Nachweis</h4><p>${esc(r.certificateFileName || (r.recordId?'Noch kein Nachweis hochgeladen.':'Noch keine Durchführung gespeichert.'))}</p>${r.certificateScanStatus?`<p class="muted">Prüfstatus: ${esc(r.certificateScanStatus)}</p>`:''}<div class="status-toolbar-actions">${r.certificateFileId?'<button type="button" class="small" data-status-action="proof">Nachweis öffnen</button>':''}${r.recordId&&canEditStatusWorklist()?'<button type="button" class="small" data-status-write data-status-action="upload">Nachweis hochladen</button>':''}</div></section><div class="status-toolbar-actions">${statusWorklistActions(r)}</div></article>`;
  renderStatusNotice();
}

async function runStatusWorklistAction(action){
  const s=statusWorkspace();if(!canEditStatusWorklist()||s.busy)return;
  s.busy=true;s.error='';renderStatusNotice();
  try{if(s.request)await s.request;if(s!==statusWorkspace()||!canEditStatusWorklist())return;await action();}
  catch(err){if(s===statusWorkspace())s.error='Aktion fehlgeschlagen: '+String(err.message||err);}
  finally{s.busy=false;if(s===statusWorkspace()){renderStatusResults();renderStatusDetail();renderStatusNotice();}}
}

function bindStatusWorkspace(){
  const root=$('status');
  const filterIds=['statusSearch','statusFilter','typeFilter','categoryFilter','lineManagerFilter','onlyOpenFilter'];
  const filter=event=>{if(!filterIds.includes(event.target.id))return;const s=statusWorkspace();s.filters=statusWorklistFilters();s.page=1;renderStatusResults();};
  root.oninput=filter;
  root.onchange=event=>{
    if(filterIds.includes(event.target.id)){filter(event);return;}
    if(!canEditStatusWorklist()||statusWorkspace().busy)return;
    if(event.target.id==='statusSelectPage'){toggleAllStatusRows(event.target.checked);return;}
    if(event.target.classList.contains('statusSelect')){const s=statusWorkspace();event.target.checked?s.selected.add(event.target.value):s.selected.delete(event.target.value);renderStatusSelection();}
  };
  root.onclick=event=>{
    const button=event.target.closest('[data-status-action]');if(!button||!root.contains(button)||button.disabled)return;
    const s=statusWorkspace(),action=button.dataset.statusAction;
    if(action==='previous'||action==='next'){s.page+=action==='next'?1:-1;renderStatusResults();return;}
    if(action==='open'||action==='close'){s.detailKey=action==='open'?button.dataset.key:'';renderStatusResults();renderStatusDetail();if(action==='open')root.querySelector('.status-detail-panel')?.focus();return;}
    if(action==='export'){exportStatusCsv();return;}
    if(action==='reload'){reloadStatusWorklist();return;}
    const row=statusRowsSource().find(r=>statusRowKey(r)===s.detailKey);
    if(action==='proof'&&row?.certificateFileId){Promise.resolve().then(()=>openFile(row.certificateFileId)).catch(err=>{if(s===statusWorkspace()){s.error=String(err.message||err);renderStatusNotice();}});return;}
    if(!canEditStatusWorklist()||s.busy)return;
    if(action==='select-page'){toggleAllStatusRows(true);return;}
    if(action==='clear'){s.selected.clear();renderStatusSelection();return;}
    const bulk={'bulk-conduct':bulkConductSelected,'bulk-links':bulkCreateExternalLinks,'bulk-exclude':bulkMarkNotRequired};
    if(bulk[action]){runStatusWorklistAction(bulk[action]);return;}
    if(!row)return;
    const actions={conduct:()=>conductOne(row.employeeId,row.typeId),link:()=>createExternalLinkForStatus(row.employeeId,row.typeId),exclude:()=>markNotRequired(row.employeeId,row.typeId),required:()=>removeExclusion(row.exclusionId||''),upload:()=>uploadProofForRecord(row.recordId,row.groupId||'')};
    if(actions[action])runStatusWorklistAction(async()=>{
      await actions[action]();
      if(s===statusWorkspace()&&state.apiAvailable&&(action==='conduct'||action==='exclude'||(action==='required'&&row.exclusionId)))s.selected.delete(statusRowKey(row));
    });
  };
}

async function reloadStatusWorklist(){
  const s=statusWorkspace();if(s.request)return s.request;
  if(!state.apiAvailable&&!API_BASE_URL)return;
  s.error='';
  s.request=(async()=>{
    try{const rows=await api('/instruction-status');if(!Array.isArray(rows))throw new Error('Ungültige Statusantwort.');if(s===statusWorkspace())state.statusRows=rows;}
    catch(err){if(s===statusWorkspace())s.error='Status konnte nicht geladen werden: '+String(err.message||err);}
    finally{s.request=null;if(s===statusWorkspace()){renderStatusResults();renderStatusDetail();renderStatusNotice();}}
  })();
  renderStatusNotice();return s.request;
}

async function bulkConductSelected(){
  if(!canEditStatusWorklist())return;
  const workspace=statusWorkspace();
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
      if(workspace!==statusWorkspace()||!canEditStatusWorklist())return;
      done += employeeIds.length;
      employeeIds.forEach(employeeId=>workspace.selected.delete(statusRowKey({employeeId,typeId})));
    }
    target.innerHTML = `<div class="notice"><b>${done} Unterweisungen abgeschlossen.</b></div>`;
    await loadData();
    if(workspace!==statusWorkspace())return;
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
  if(!canEditStatusWorklist())return;
  const workspace=statusWorkspace();
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
    if(workspace!==statusWorkspace()||!canEditStatusWorklist())return;
  }
  const text = created.map(x=>`${x.row.employeeName};${x.row.email};${x.row.instructionName};${x.result.url}`).join('\n');
  try{ await navigator.clipboard.writeText(text); }catch{}
  target.innerHTML = `<div class="notice"><b>${created.length} Einmal-Links erstellt.</b> ${failed.length?failed.length+' Fehler.':''}<br><textarea readonly>${esc(text)}</textarea></div>`;
  await loadData();
}

async function bulkMarkNotRequired(){
  if(!canEditStatusWorklist())return;
  const workspace=statusWorkspace();
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
      workspace.selected.delete(statusRowKey(r));
    }catch(err){ failed.push(`${r.employeeName} / ${r.instructionName}: ${err.message || err}`); }
    if(workspace!==statusWorkspace()||!canEditStatusWorklist())return;
  }
  target.innerHTML = `<div class="notice"><b>${done} Einträge markiert.</b>${failed.length?'<br>Fehler:<br>'+esc(failed.join('\n')):''}</div>`;
  await loadData();
  if(workspace!==statusWorkspace())return;
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
