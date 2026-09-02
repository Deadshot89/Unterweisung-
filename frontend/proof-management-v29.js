// v0.29: Nachweisverwaltung fuer Essentra.
// Ziel: Nachweise nicht nur hochladen, sondern im Arbeitsablauf prüfen, öffnen und nachverfolgen.

let proofFileCache = [];

function canManageProofs(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

function proofRowsSource(){
  return state.statusRows?.length ? state.statusRows : buildLocalStatusRows();
}

function proofRequiredRows(){
  return proofRowsSource().filter(r => r.recordId && r.status !== 'not_required');
}

function proofMissingRows(){
  return proofRequiredRows().filter(r => !r.certificateFileId);
}

function proofPresentRows(){
  return proofRequiredRows().filter(r => r.certificateFileId);
}

function currentProofFilters(){
  return {
    search: $('proofSearch')?.value || '',
    state: $('proofState')?.value || 'missing',
    scan: $('proofScan')?.value || '',
    typeId: $('proofType')?.value || '',
    groupId: $('proofGroup')?.value || ''
  };
}

function filteredProofStatusRows(){
  const f = currentProofFilters();
  const q = String(f.search || '').toLowerCase();
  return proofRequiredRows().filter(r => {
    if(f.state === 'missing' && r.certificateFileId) return false;
    if(f.state === 'present' && !r.certificateFileId) return false;
    if(f.scan && String(r.certificateScanStatus || '').toLowerCase() !== f.scan) return false;
    if(f.typeId && r.typeId !== f.typeId) return false;
    if(f.groupId && String(r.groupId || '') !== f.groupId) return false;
    if(q && ![r.employeeName,r.email,r.department,r.role,r.lineManagerName,r.instructionName,r.category,r.certificateFileName,r.groupId].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

function uniqueProofGroups(){
  return [...new Set(proofRequiredRows().map(r => r.groupId).filter(Boolean))].sort();
}

function proofStats(){
  const all = proofRequiredRows();
  const missing = proofMissingRows();
  const present = proofPresentRows();
  return {
    total: all.length,
    missing: missing.length,
    present: present.length,
    pending: present.filter(r => String(r.certificateScanStatus || '').toLowerCase() === 'pending').length,
    blocked: present.filter(r => ['blocked','quarantined'].includes(String(r.certificateScanStatus || '').toLowerCase())).length
  };
}

function proofScanBadge(scan){
  const value = String(scan || 'pending').toLowerCase();
  const map = {
    clean:['ok','Geprüft'],
    pending:['soon','Prüfung offen'],
    not_configured:['info','Scanner aus'],
    quarantined:['bad','Quarantäne'],
    blocked:['bad','Gesperrt']
  };
  const m = map[value] || ['info', value];
  return `<span class="badge ${m[0]}">${m[1]}</span>`;
}

function proofFileSelectOptions(){
  const rows = filteredProofStatusRows();
  if(!rows.length) return '<option value="">Kein passender Unterweisungseintrag</option>';
  return rows.map(r => `<option value="${esc(r.recordId)}" data-group="${esc(r.groupId || '')}">${esc(r.employeeName)} · ${esc(r.instructionName)} · ${fmtDate(r.conductedAt)}</option>`).join('');
}

function renderProofs(){
  const el = $('proofs');
  if(!el) return;
  if(!canManageProofs()){
    el.innerHTML = '<div class="card span-12"><h2>Nachweise</h2><div class="notice warning">Für deine Rolle nicht freigeschaltet.</div></div>';
    return;
  }
  const f = currentProofFilters();
  const rows = filteredProofStatusRows();
  const s = proofStats();
  el.innerHTML = `<div class="grid">
    <div class="card span-12">
      <div class="toolbar"><div><h2>Nachweise verwalten</h2><p class="muted">Nachweise hochladen, öffnen und Prüfstatus setzen. Wichtig für Essentra vor dem Design-Test.</p></div><div class="filters"><button class="ghost" onclick="reloadProofs()">Neu laden</button><button class="ghost" onclick="exportProofCsv()">CSV exportieren</button></div></div>
      <div class="grid compact-kpis">
        <div class="card kpi mini"><div class="label">Einträge</div><div class="value blue">${s.total}</div></div>
        <div class="card kpi mini"><div class="label">Nachweis fehlt</div><div class="value yellow">${s.missing}</div></div>
        <div class="card kpi mini"><div class="label">Nachweis vorhanden</div><div class="value green">${s.present}</div></div>
        <div class="card kpi mini"><div class="label">Prüfung offen</div><div class="value yellow">${s.pending}</div></div>
        <div class="card kpi mini"><div class="label">Gesperrt</div><div class="value red">${s.blocked}</div></div>
      </div>
      ${proofUploadCard()}
      <div class="filters status-filterbar">
        <input id="proofSearch" placeholder="Mitarbeiter, Unterweisung, Gruppe, Datei" value="${esc(f.search)}">
        <select id="proofState"><option value="missing" ${f.state==='missing'?'selected':''}>Nachweis fehlt</option><option value="present" ${f.state==='present'?'selected':''}>Nachweis vorhanden</option><option value="all" ${f.state==='all'?'selected':''}>Alle</option></select>
        <select id="proofScan"><option value="">Alle Prüfstatus</option>${['pending','clean','not_configured','quarantined','blocked'].map(x=>`<option value="${x}" ${f.scan===x?'selected':''}>${esc(x)}</option>`).join('')}</select>
        <select id="proofType"><option value="">Alle Unterweisungen</option>${types().map(t=>`<option value="${esc(t.id)}" ${f.typeId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
        <select id="proofGroup"><option value="">Alle Gruppen</option>${uniqueProofGroups().map(g=>`<option value="${esc(g)}" ${f.groupId===g?'selected':''}>${esc(g)}</option>`).join('')}</select>
      </div>
      <div id="proofResult"></div>
      ${proofWorkTable(rows)}
    </div>
    <div class="card span-12"><h2>Hochgeladene Nachweisdateien</h2><p class="muted">Liste aus Azure Blob/SQL. Über „Datei öffnen“ wird ein kurzer Download-Link erzeugt.</p><div id="proofFileList">${proofFileTable(proofFileCache)}</div></div>
  </div>`;
  ['proofSearch','proofState','proofScan','proofType','proofGroup'].forEach(id=>$(id)?.addEventListener('input', renderProofs));
  if((state.apiAvailable || API_BASE_URL) && !state.proofsLoadedOnce){
    state.proofsLoadedOnce = true;
    loadProofFiles().then(()=>{
      const view = document.getElementById('proofs');
      if(view?.classList.contains('active')) renderProofs();
    });
  }
}

function proofUploadCard(){
  return `<div class="notice proof-upload-box">
    <b>Nachweis hochladen</b>
    <div class="form-grid">
      <div class="field"><label>Unterweisungseintrag</label><select id="proofRecordId" onchange="syncProofGroupHint()">${proofFileSelectOptions()}</select></div>
      <div class="field"><label>Auf ganze Gruppe anwenden?</label><select id="proofApplyGroup"><option value="no">Nein, nur diese Person</option><option value="yes">Ja, gleiche Gruppenunterweisung</option></select></div>
      <div class="field"><label>Datei *</label><input id="proofFileInput" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div>
      <div class="field"><label>Gruppen-ID</label><input id="proofGroupHint" readonly placeholder="wird automatisch aus Auswahl übernommen"></div>
      <div class="field full"><button class="primary" onclick="uploadProofFile()">Nachweis hochladen</button> <button class="ghost" onclick="loadProofFiles().then(renderProofs)">Dateiliste laden</button></div>
    </div>
  </div>`;
}

function syncProofGroupHint(){
  const opt = $('proofRecordId')?.selectedOptions?.[0];
  if($('proofGroupHint')) $('proofGroupHint').value = opt?.dataset?.group || '';
}

function proofWorkTable(rows){
  if(!rows.length) return '<p class="muted">Keine Nachweis-Einträge für die aktuelle Auswahl.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Unterweisung</th><th>Gruppe</th><th>Datum</th><th>Gültig bis</th><th>Status</th><th>Nachweis</th><th>Prüfung</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,1000).map(r=>`<tr>
    <td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email || '')}</span></td>
    <td>${esc(r.instructionName)}<br><span class="muted">${esc(r.category || '')}</span></td>
    <td>${esc(r.groupId || '—')}</td>
    <td>${fmtDate(r.conductedAt)}</td>
    <td>${fmtDate(r.validUntil)}</td>
    <td>${badge(r.status)}</td>
    <td>${r.certificateFileId ? `<b>${esc(r.certificateFileName || r.certificateFileId)}</b>` : '<span class="badge warn">Fehlt</span>'}</td>
    <td>${proofScanBadge(r.certificateScanStatus)}</td>
    <td>${proofActionButtons(r)}</td>
  </tr>`).join('')}</tbody></table></div><p class="muted">${rows.length} Nachweis-Einträge angezeigt, maximal 1000 sichtbar.</p>`;
}

function proofActionButtons(r){
  const openBtn = r.certificateFileId ? `<button class="small" onclick="openFileById('${esc(r.certificateFileId)}')">Datei öffnen</button>` : '';
  const cleanBtn = r.certificateFileId ? `<button class="small primary" onclick="setProofScanStatus('${esc(r.certificateFileId)}','clean')">Geprüft</button>` : '';
  const blockBtn = r.certificateFileId ? `<button class="small ghost" onclick="setProofScanStatus('${esc(r.certificateFileId)}','blocked')">Sperren</button>` : '';
  return `${openBtn} ${cleanBtn} ${blockBtn}` || '—';
}

function proofFileTable(files){
  if(!files.length) return '<p class="muted">Dateiliste noch nicht geladen oder keine Nachweise vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Datei</th><th>Größe</th><th>Prüfung</th><th>Verknüpfung</th><th>Datum</th><th>Aktion</th></tr></thead><tbody>${files.map(f=>`<tr>
    <td><b>${esc(f.originalFileName || f.fileName)}</b><br><span class="muted">${esc(f.id)}</span></td>
    <td>${formatBytes(f.sizeBytes)}</td>
    <td>${proofScanBadge(f.scanStatus)}</td>
    <td>${esc(f.linkedEntityType || '')}<br><span class="muted">${esc(f.linkedEntityId || '')}</span></td>
    <td>${fmtDate(f.createdAt)}</td>
    <td><button class="small" onclick="openFileById('${esc(f.id)}')">Öffnen</button> <button class="small primary" onclick="setProofScanStatus('${esc(f.id)}','clean')">Geprüft</button> <button class="small ghost" onclick="setProofScanStatus('${esc(f.id)}','blocked')">Sperren</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function formatBytes(value){
  const n = Number(value || 0);
  if(!n) return '0 B';
  if(n < 1024) return `${n} B`;
  if(n < 1024*1024) return `${(n/1024).toLocaleString('de-DE',{maximumFractionDigits:1})} KB`;
  return `${(n/1024/1024).toLocaleString('de-DE',{maximumFractionDigits:1})} MB`;
}

async function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

async function uploadProofFile(){
  if(!state.apiAvailable){ alert('Nachweis-Upload braucht die Azure API.'); return; }
  const recordId = $('proofRecordId')?.value || '';
  const file = $('proofFileInput')?.files?.[0];
  if(!recordId){ alert('Bitte Unterweisungseintrag auswählen.'); return; }
  if(!file){ alert('Bitte Datei auswählen.'); return; }
  const opt = $('proofRecordId')?.selectedOptions?.[0];
  const groupId = $('proofApplyGroup')?.value === 'yes' ? (opt?.dataset?.group || '') : '';
  const target = $('proofResult');
  if(target) target.innerHTML = 'Nachweis wird hochgeladen ...';
  try{
    const dataBase64 = await fileToDataUrl(file);
    const body = { fileName:file.name, contentType:file.type, dataBase64 };
    if(groupId) body.groupId = groupId;
    else body.recordId = recordId;
    const result = await api('/proof-files', { method:'POST', body: JSON.stringify(body) });
    if(target) target.innerHTML = `<div class="notice"><b>Nachweis hochgeladen.</b> Datei: ${esc(result.fileName)} · aktualisierte Einträge: ${esc(result.recordsUpdated || 1)} · Prüfung: ${esc(result.scanStatus || '')}</div>`;
    await loadData();
    await reloadProofs();
  }catch(err){
    if(target) target.innerHTML = `<div class="notice dangerbox">Upload fehlgeschlagen: ${esc(err.message || err)}</div>`;
  }
}

async function loadProofFiles(){
  if(!state.apiAvailable && !API_BASE_URL) return [];
  try{
    proofFileCache = await api('/proof-files');
    const list = $('proofFileList');
    if(list) list.innerHTML = proofFileTable(proofFileCache);
    return proofFileCache;
  }catch(err){
    const list = $('proofFileList');
    if(list) list.innerHTML = `<div class="notice dangerbox">Dateiliste konnte nicht geladen werden: ${esc(err.message || err)}</div>`;
    return [];
  }
}

async function reloadProofs(){
  if(state.apiAvailable || API_BASE_URL){
    try{ state.statusRows = await api('/instruction-status'); }catch(err){ alert('Status konnte nicht geladen werden: ' + String(err.message || err)); }
    await loadProofFiles();
  }
  renderProofs();
}

async function openFileById(fileId){
  if(!fileId){ alert('Datei-ID fehlt.'); return; }
  try{
    const result = await api('/files/' + encodeURIComponent(fileId) + '/download');
    if(result?.url) window.open(result.url, '_blank', 'noopener');
    else alert('Kein Download-Link erhalten.');
  }catch(err){ alert('Datei konnte nicht geöffnet werden: ' + String(err.message || err)); }
}

async function setProofScanStatus(fileId, scanStatus){
  if(!fileId){ alert('Datei-ID fehlt.'); return; }
  if(scanStatus === 'blocked' && !confirm('Nachweis wirklich sperren? Danach ist der Download blockiert.')) return;
  try{
    await api('/proof-files/' + encodeURIComponent(fileId), { method:'PATCH', body: JSON.stringify({ scanStatus }) });
    await reloadProofs();
  }catch(err){ alert('Prüfstatus konnte nicht gesetzt werden: ' + String(err.message || err)); }
}

function exportProofCsv(){
  const rows = filteredProofStatusRows();
  const header = ['Mitarbeiter','E-Mail','Unterweisung','Bereich','Gruppe','Datum','Gültig bis','Status','Nachweisdatei','Datei-ID','Prüfstatus'];
  const csvRows = [header, ...rows.map(r=>[
    r.employeeName,
    r.email,
    r.instructionName,
    r.category,
    r.groupId,
    fmtDate(r.conductedAt),
    fmtDate(r.validUntil),
    statusText(r.status),
    r.certificateFileName,
    r.certificateFileId,
    r.certificateScanStatus
  ])];
  const csv = csvRows.map(row=>row.map(cell=>`"${String(cell ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unterweisungsnachweise-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

(function(){
  const originalRenderAll = typeof renderAll === 'function' ? renderAll : null;
  if(originalRenderAll){
    renderAll = function(){
      originalRenderAll();
      if(document.getElementById('proofs')?.classList.contains('active')) renderProofs();
    };
  }

  const originalSetView = typeof setView === 'function' ? setView : null;
  if(originalSetView){
    setView = function(id){
      originalSetView(id);
      if(id === 'proofs') renderProofs();
    };
  }
})();

window.renderProofs = renderProofs;
window.uploadProofFile = uploadProofFile;
window.loadProofFiles = loadProofFiles;
window.reloadProofs = reloadProofs;
window.openFileById = openFileById;
window.setProofScanStatus = setProofScanStatus;
window.exportProofCsv = exportProofCsv;
window.syncProofGroupHint = syncProofGroupHint;

const proofStyle = document.createElement('style');
proofStyle.textContent = `
  .proof-upload-box{margin:12px 0}
`;
document.head.appendChild(proofStyle);
