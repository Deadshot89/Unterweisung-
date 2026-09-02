// v0.27: Fehlerprotokoll fuer Essentra-Live-Test.
// Ziel: Beim echten Durchklicken Fehler sauber sammeln, priorisieren und exportieren.

const ESSENTRA_DEFECT_KEY = 'um_essentra_defect_log_v27';

const ESSENTRA_DEFECT_AREAS = [
  'Grundlage / Verbindung',
  'Mitarbeiter',
  'Benutzer/Rechte',
  'Unterweisungen',
  'Vorlagen/Upload',
  'Testfragen',
  'Planung',
  'Unterweisungsstatus',
  'Externe Links',
  'Nachweise',
  'Betrieb/Backup',
  'Sicherheit/Rollen',
  'Sonstiges'
];

function readEssentraDefects(){
  try{ return JSON.parse(localStorage.getItem(ESSENTRA_DEFECT_KEY) || '[]'); }
  catch{ return []; }
}

function writeEssentraDefects(rows){
  localStorage.setItem(ESSENTRA_DEFECT_KEY, JSON.stringify(rows));
}

function defectCheckOptions(selected=''){
  let checks = [];
  try{
    if(typeof ESSENTRA_LIVE_CHECKS !== 'undefined'){
      checks = ESSENTRA_LIVE_CHECKS.flatMap(g => g.items.map(item => ({ group:g.group, id:item[0], label:item[1] })));
    }
  }catch{}
  return `<option value="">Kein Prüfpunkt zugeordnet</option>${checks.map(x=>`<option value="${esc(x.id)}" ${selected===x.id?'selected':''}>${esc(x.group)} · ${esc(x.label)}</option>`).join('')}`;
}

function defectAreaOptions(selected=''){
  return ESSENTRA_DEFECT_AREAS.map(a=>`<option value="${esc(a)}" ${selected===a?'selected':''}>${esc(a)}</option>`).join('');
}

function defectStats(rows){
  const open = rows.filter(r => r.status !== 'done');
  return {
    total: rows.length,
    open: open.length,
    p1: open.filter(r => r.priority === 'P1').length,
    p2: open.filter(r => r.priority === 'P2').length,
    done: rows.filter(r => r.status === 'done').length
  };
}

function defectStatusLabel(status){
  return ({open:'Offen',working:'In Arbeit',done:'Erledigt'})[status] || status || 'Offen';
}

function defectStatusBadge(status){
  const map = { open:['bad','Offen'], working:['soon','In Arbeit'], done:['ok','Erledigt'] };
  const m = map[status] || ['info', status || 'Offen'];
  return `<span class="badge ${m[0]}">${m[1]}</span>`;
}

function defectPriorityBadge(priority){
  const map = { P1:['bad','P1 Blocker'], P2:['warn','P2 Hoch'], P3:['soon','P3 Mittel'], P4:['info','P4 Klein'] };
  const m = map[priority] || ['info', priority || 'P3'];
  return `<span class="badge ${m[0]}">${m[1]}</span>`;
}

function clearDefectForm(){
  ['defectId','defectTitle','defectSteps','defectExpected','defectActual','defectNextAction'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('defectArea')) $('defectArea').value='Grundlage / Verbindung';
  if($('defectPriority')) $('defectPriority').value='P2';
  if($('defectStatus')) $('defectStatus').value='open';
  if($('defectCheck')) $('defectCheck').value='';
  if($('defectResult')) $('defectResult').innerHTML='';
}

function readDefectForm(){
  return {
    id: $('defectId')?.value || '',
    title: ($('defectTitle')?.value || '').trim(),
    area: $('defectArea')?.value || 'Sonstiges',
    priority: $('defectPriority')?.value || 'P3',
    status: $('defectStatus')?.value || 'open',
    checkId: $('defectCheck')?.value || '',
    steps: ($('defectSteps')?.value || '').trim(),
    expected: ($('defectExpected')?.value || '').trim(),
    actual: ($('defectActual')?.value || '').trim(),
    nextAction: ($('defectNextAction')?.value || '').trim()
  };
}

function saveEssentraDefect(){
  const target = $('defectResult');
  const body = readDefectForm();
  if(!body.title){ alert('Fehlertitel fehlt.'); return; }
  const rows = readEssentraDefects();
  const now = new Date().toISOString();
  if(body.id){
    const idx = rows.findIndex(r => r.id === body.id);
    if(idx >= 0){ rows[idx] = { ...rows[idx], ...body, updatedAt: now }; }
  }else{
    rows.unshift({ ...body, id:`def-${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: now, updatedAt: now, version: document.title || 'Unterweisungsmanager' });
  }
  writeEssentraDefects(rows);
  if(target) target.innerHTML = '<div class="notice"><b>Fehler gespeichert.</b></div>';
  clearDefectForm();
  renderEssentraDefectLog();
}

function editEssentraDefect(id){
  const row = readEssentraDefects().find(r => r.id === id);
  if(!row) return;
  $('defectId').value = row.id;
  $('defectTitle').value = row.title || '';
  $('defectArea').value = row.area || 'Sonstiges';
  $('defectPriority').value = row.priority || 'P3';
  $('defectStatus').value = row.status || 'open';
  $('defectCheck').value = row.checkId || '';
  $('defectSteps').value = row.steps || '';
  $('defectExpected').value = row.expected || '';
  $('defectActual').value = row.actual || '';
  $('defectNextAction').value = row.nextAction || '';
  document.getElementById('defectTitle')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function setEssentraDefectStatus(id, status){
  const rows = readEssentraDefects();
  const row = rows.find(r => r.id === id);
  if(!row) return;
  row.status = status;
  row.updatedAt = new Date().toISOString();
  writeEssentraDefects(rows);
  renderEssentraDefectLog();
}

function deleteEssentraDefect(id){
  if(!confirm('Fehler wirklich löschen?')) return;
  writeEssentraDefects(readEssentraDefects().filter(r => r.id !== id));
  renderEssentraDefectLog();
}

function filteredEssentraDefects(){
  const area = $('defectFilterArea')?.value || '';
  const status = $('defectFilterStatus')?.value || 'active';
  const search = String($('defectFilterSearch')?.value || '').toLowerCase();
  return readEssentraDefects().filter(r => {
    if(area && r.area !== area) return false;
    if(status === 'active' && r.status === 'done') return false;
    if(status && status !== 'active' && r.status !== status) return false;
    if(search && ![r.title,r.area,r.priority,r.status,r.steps,r.expected,r.actual,r.nextAction].join(' ').toLowerCase().includes(search)) return false;
    return true;
  });
}

function defectExportText(onlyOpen=true){
  const rows = readEssentraDefects().filter(r => !onlyOpen || r.status !== 'done');
  const lines = [`Essentra Fehlerprotokoll v0.27`, `Stand: ${new Date().toLocaleString('de-DE')}`, `Export: ${onlyOpen?'nur offene Fehler':'alle Fehler'}`, ''];
  for(const r of rows){
    lines.push(`${r.priority || 'P3'} | ${defectStatusLabel(r.status)} | ${r.area || 'Sonstiges'} | ${r.title}`);
    if(r.checkId) lines.push(`Pruefpunkt: ${r.checkId}`);
    if(r.steps) lines.push(`Schritte: ${r.steps}`);
    if(r.expected) lines.push(`Soll: ${r.expected}`);
    if(r.actual) lines.push(`Ist: ${r.actual}`);
    if(r.nextAction) lines.push(`Naechster Schritt: ${r.nextAction}`);
    lines.push(`Erstellt: ${r.createdAt || ''}`);
    lines.push('---');
  }
  return lines.join('\n');
}

function exportEssentraDefects(onlyOpen=true){
  const text = defectExportText(onlyOpen);
  try{ navigator.clipboard.writeText(text); }catch{}
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `essentra-fehlerprotokoll-${onlyOpen?'offen':'alle'}-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defectTable(rows){
  if(!rows.length) return '<p class="muted">Keine Fehler für die aktuelle Auswahl.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Priorität</th><th>Status</th><th>Bereich</th><th>Fehler</th><th>Ist/Soll</th><th>Nächster Schritt</th><th>Aktion</th></tr></thead><tbody>${rows.map(r=>`<tr>
    <td>${defectPriorityBadge(r.priority)}</td>
    <td>${defectStatusBadge(r.status)}</td>
    <td>${esc(r.area || 'Sonstiges')}</td>
    <td><b>${esc(r.title)}</b><br><span class="muted">${esc(r.checkId || '')} ${r.createdAt ? '· ' + fmtDate(r.createdAt) : ''}</span>${r.steps?`<br><small>${esc(r.steps)}</small>`:''}</td>
    <td><b>Ist:</b> ${esc(r.actual || '—')}<br><b>Soll:</b> ${esc(r.expected || '—')}</td>
    <td>${esc(r.nextAction || '—')}</td>
    <td><button class="small" onclick="editEssentraDefect('${esc(r.id)}')">Bearbeiten</button> <button class="small" onclick="setEssentraDefectStatus('${esc(r.id)}','working')">In Arbeit</button> <button class="small primary" onclick="setEssentraDefectStatus('${esc(r.id)}','done')">Erledigt</button> <button class="small ghost" onclick="deleteEssentraDefect('${esc(r.id)}')">Löschen</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderEssentraDefectLog(){
  const target = document.getElementById('essentraDefectLog');
  if(!target) return;
  const rows = readEssentraDefects();
  const visible = filteredEssentraDefects();
  const s = defectStats(rows);
  target.innerHTML = `<div class="card span-12">
    <div class="toolbar">
      <div><h2>Essentra Fehlerprotokoll</h2><p class="muted">Hier jeden Fehler aus dem Live-Test sofort erfassen. Design kommt erst, wenn hier keine offenen P1/P2-Fehler mehr stehen.</p></div>
      <div class="filters"><button class="ghost" onclick="exportEssentraDefects(true)">Offene Fehler exportieren</button><button class="ghost" onclick="exportEssentraDefects(false)">Alle exportieren</button></div>
    </div>
    <div class="grid compact-kpis">
      <div class="card kpi mini"><div class="label">Offen</div><div class="value yellow">${s.open}</div></div>
      <div class="card kpi mini"><div class="label">P1 offen</div><div class="value red">${s.p1}</div></div>
      <div class="card kpi mini"><div class="label">P2 offen</div><div class="value yellow">${s.p2}</div></div>
      <div class="card kpi mini"><div class="label">Erledigt</div><div class="value green">${s.done}</div></div>
    </div>
    <div class="form-grid defect-form">
      <input id="defectId" type="hidden">
      <div class="field"><label>Priorität</label><select id="defectPriority"><option value="P1">P1 Blocker</option><option value="P2" selected>P2 Hoch</option><option value="P3">P3 Mittel</option><option value="P4">P4 Klein</option></select></div>
      <div class="field"><label>Status</label><select id="defectStatus"><option value="open">Offen</option><option value="working">In Arbeit</option><option value="done">Erledigt</option></select></div>
      <div class="field"><label>Bereich</label><select id="defectArea">${defectAreaOptions('Grundlage / Verbindung')}</select></div>
      <div class="field"><label>Prüfpunkt</label><select id="defectCheck">${defectCheckOptions('')}</select></div>
      <div class="field full"><label>Fehlertitel *</label><input id="defectTitle" placeholder="z. B. Nachweis-Upload bricht mit Fehler ab"></div>
      <div class="field full"><label>Schritte zum Nachstellen</label><textarea id="defectSteps" placeholder="1. Reiter öffnen ... 2. Datei auswählen ... 3. Fehler erscheint ..."></textarea></div>
      <div class="field"><label>Soll</label><textarea id="defectExpected" placeholder="Was hätte passieren müssen?"></textarea></div>
      <div class="field"><label>Ist</label><textarea id="defectActual" placeholder="Was ist wirklich passiert?"></textarea></div>
      <div class="field full"><label>Nächster Schritt / Reparaturhinweis</label><textarea id="defectNextAction" placeholder="Was muss repariert oder geprüft werden?"></textarea></div>
      <div class="field full"><button class="primary" onclick="saveEssentraDefect()">Fehler speichern</button> <button class="ghost" onclick="clearDefectForm()">Formular leeren</button></div>
      <div id="defectResult" class="field full muted"></div>
    </div>
    <div class="filters status-filterbar">
      <input id="defectFilterSearch" placeholder="Fehler suchen" oninput="renderEssentraDefectLog()">
      <select id="defectFilterArea" onchange="renderEssentraDefectLog()"><option value="">Alle Bereiche</option>${ESSENTRA_DEFECT_AREAS.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>
      <select id="defectFilterStatus" onchange="renderEssentraDefectLog()"><option value="active">Nur offene/in Arbeit</option><option value="open">Offen</option><option value="working">In Arbeit</option><option value="done">Erledigt</option><option value="">Alle</option></select>
    </div>
    ${defectTable(visible)}
  </div>`;
}

const originalRenderDashboardV27 = window.renderDashboard;
window.renderDashboard = function renderDashboard(){
  if(typeof originalRenderDashboardV27 === 'function') originalRenderDashboardV27();
  const dashboard = document.getElementById('dashboard');
  if(!dashboard) return;
  let holder = document.getElementById('essentraDefectLog');
  if(!holder){
    holder = document.createElement('div');
    holder.id = 'essentraDefectLog';
    holder.className = 'grid';
    dashboard.appendChild(holder);
  }
  renderEssentraDefectLog();
};

window.saveEssentraDefect = saveEssentraDefect;
window.clearDefectForm = clearDefectForm;
window.editEssentraDefect = editEssentraDefect;
window.setEssentraDefectStatus = setEssentraDefectStatus;
window.deleteEssentraDefect = deleteEssentraDefect;
window.renderEssentraDefectLog = renderEssentraDefectLog;
window.exportEssentraDefects = exportEssentraDefects;

const defectStyle = document.createElement('style');
defectStyle.textContent = `
  .defect-form textarea{min-height:72px}
  #essentraDefectLog .table-wrap small{color:#6b7280}
`;
document.head.appendChild(defectStyle);
