// v0.24: Unterweisungen planen, Teilnehmer zuweisen und Gruppentermine abschließen.

function canEditPlanning(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse') || roles.includes('line_manager');
}

async function loadPlannedTrainings(force=false){
  if(!force && state.data?.plannedTrainings?.length) return state.data.plannedTrainings;
  if(!state.apiAvailable && !API_BASE_URL) return plannedTrainings();
  try{
    const rows = await api('/planned-trainings');
    state.data = state.data || {};
    state.data.plannedTrainings = rows;
    return rows;
  }catch(err){
    console.warn('Planungen konnten nicht geladen werden', err);
    return plannedTrainings();
  }
}

function fmtDateTime(d){
  return d ? new Date(d).toLocaleString('de-DE', { dateStyle:'short', timeStyle:'short' }) : '—';
}

function dateTimeLocalValue(value){
  if(!value) return '';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

function activeEmployees(){
  return employees().filter(e => e.active !== false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
}

function planningEmployeeCheckboxes(selectedIds=[]){
  const selected = new Set(selectedIds);
  const rows = activeEmployees();
  if(!rows.length) return '<p class="muted">Keine aktiven Mitarbeiter vorhanden.</p>';
  return `<div class="planning-participants">
    <div class="participant-toolbar"><label for="planEmployeeSearch">Teilnehmer suchen<input id="planEmployeeSearch" type="search" placeholder="Name, Bereich oder E-Mail"></label><span id="planEmployeeCount" class="muted" role="status" aria-live="polite"></span></div>
    <div id="planEmployeeList" class="checkbox-grid">${rows.map(e=>`<label class="checkline"><input type="checkbox" class="planEmployee" value="${esc(e.id)}" ${selected.has(e.id)?'checked':''}><span><b>${esc(e.name)}</b><small>${esc(e.department||'—')} · ${esc(e.email||'')}</small></span></label>`).join('')}</div>
    <p id="planEmployeeEmpty" class="muted" hidden>Keine passenden Teilnehmer. Bereits ausgewählte Personen bleiben ausgewählt.</p>
  </div>`;
}

function updatePlanningParticipants(){
  const query = ($('planEmployeeSearch')?.value || '').trim().toLocaleLowerCase('de');
  let visible = 0;
  document.querySelectorAll('#planEmployeeList .checkline').forEach(row=>{
    row.hidden = !!query && !row.textContent.toLocaleLowerCase('de').includes(query);
    if(!row.hidden) visible++;
  });
  if($('planEmployeeCount')) $('planEmployeeCount').textContent = `${selectedPlanEmployeeIds().length} ausgewählt · ${visible} angezeigt`;
  if($('planEmployeeEmpty')) $('planEmployeeEmpty').hidden = visible > 0;
}

function lineManagerSelectOptions(selected=''){
  const rows = activeEmployees().filter(e => String(e.role||'').toLowerCase().includes('manager') || employees().some(x => (x.lineManagerId || x.shiftLeaderId) === e.id));
  const source = rows.length ? rows : activeEmployees();
  return `<option value="">Kein Line Manager</option>${source.map(e=>`<option value="${esc(e.id)}" ${selected===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}`;
}

function planningStatusBadge(status){
  const map = {
    planned: ['soon','Geplant'],
    invited: ['info','Eingeladen'],
    completed: ['ok','Abgeschlossen'],
    cancelled: ['warn','Storniert']
  };
  const m = map[status] || ['info', status || '—'];
  return `<span class="badge ${m[0]}">${m[1]}</span>`;
}

function renderPlanning(){
  const editable = canEditPlanning();
  const rows = plannedTrainings();
  $('planning').innerHTML = `<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Unterweisung planen / zuweisen</h2><p class="muted">Eine geplante Unterweisung enthält Termin, Unterweisung, Teilnehmer, Line Manager und Ort. Beim Abschließen werden für alle Teilnehmer echte Unterweisungseinträge erzeugt.</p></div><button class="ghost" onclick="loadPlannedTrainings(true).then(renderPlanning)">Planungen neu laden</button></div>
      ${editable ? planningFormCard() : '<div class="notice warning">Du hast keine Berechtigung zum Planen von Unterweisungen.</div>'}
    </div>
    <div class="card span-12"><h2>Geplante Unterweisungen</h2>${plannedTrainingTable(rows, editable)}</div>
  </div>`;
  $('planEmployeeSearch')?.addEventListener('input', updatePlanningParticipants);
  $('planEmployeeList')?.addEventListener('change', updatePlanningParticipants);
  updatePlanningParticipants();
  if((state.apiAvailable || API_BASE_URL) && !state.planningLoadedOnce){
    state.planningLoadedOnce = true;
    loadPlannedTrainings(true).then(()=>{
      const view = document.getElementById('planning');
      if(view?.classList.contains('active')) renderPlanning();
    });
  }
}

function planningFormCard(){
  return `<div class="form-grid">
    <input id="planId" type="hidden">
    <div class="field"><label>Unterweisung *</label><select id="planType"><option value="">Bitte wählen</option>${types().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Datum/Zeit *</label><input id="planAt" type="datetime-local"></div>
    <div class="field"><label>Dauer Minuten</label><input id="planDuration" type="number" min="1" max="600" value="30"></div>
    <div class="field"><label>Ort</label><input id="planLocation" value="Schulungsraum / Warehouse"></div>
    <div class="field"><label>Line Manager / Verantwortlich</label><select id="planLineManager">${lineManagerSelectOptions('')}</select></div>
    <div class="field"><label>Status</label><select id="planStatus"><option value="planned">Geplant</option><option value="invited">Eingeladen</option><option value="cancelled">Storniert</option><option value="completed">Abgeschlossen</option></select></div>
    <div class="field full"><label>Teilnehmer *</label>${planningEmployeeCheckboxes([])}</div>
    <div class="field full"><button class="primary" onclick="savePlannedTraining()">Planung speichern</button> <button class="ghost" onclick="clearPlanningForm()">Formular leeren</button></div>
    <div id="planningResult" class="field full muted"></div>
  </div>`;
}

function selectedPlanEmployeeIds(){
  return Array.from(document.querySelectorAll('.planEmployee:checked')).map(x=>x.value);
}

function clearPlanningForm(){
  ['planId','planAt'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('planType')) $('planType').value='';
  if($('planDuration')) $('planDuration').value='30';
  if($('planLocation')) $('planLocation').value='Schulungsraum / Warehouse';
  if($('planLineManager')) $('planLineManager').value='';
  if($('planStatus')) $('planStatus').value='planned';
  document.querySelectorAll('.planEmployee').forEach(cb=>cb.checked=false);
  if($('planEmployeeSearch')) $('planEmployeeSearch').value='';
  updatePlanningParticipants();
  if($('planningResult')) $('planningResult').innerHTML='';
}

function parseParticipantIds(row){
  if(Array.isArray(row.employeeIds)) return row.employeeIds;
  return String(row.participantIds || '').split(',').map(x=>x.trim()).filter(Boolean);
}

function editPlannedTraining(id){
  const row = plannedTrainings().find(p => p.id === id);
  if(!row) return;
  $('planId').value = row.id;
  $('planType').value = row.instructionTypeId || '';
  $('planAt').value = dateTimeLocalValue(row.plannedAt);
  $('planDuration').value = row.durationMinutes || 30;
  $('planLocation').value = row.location || '';
  $('planLineManager').value = row.lineManagerId || '';
  $('planStatus').value = row.status || 'planned';
  const selected = new Set(parseParticipantIds(row));
  document.querySelectorAll('.planEmployee').forEach(cb => cb.checked = selected.has(cb.value));
  if($('planEmployeeSearch')) $('planEmployeeSearch').value='';
  updatePlanningParticipants();
  document.getElementById('planType')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function savePlannedTraining(){
  if(!state.apiAvailable){ alert('Planung speichern braucht die Azure API.'); return; }
  const target = $('planningResult');
  const id = $('planId').value.trim();
  const employeeIds = selectedPlanEmployeeIds();
  const body = {
    instructionTypeId: $('planType').value,
    plannedAt: $('planAt').value,
    durationMinutes: Number($('planDuration').value || 30),
    location: $('planLocation').value.trim(),
    lineManagerId: $('planLineManager').value,
    status: $('planStatus').value,
    employeeIds
  };
  if(!body.instructionTypeId){ alert('Unterweisung fehlt.'); return; }
  if(!body.plannedAt){ alert('Datum/Zeit fehlt.'); return; }
  if(!employeeIds.length){ alert('Bitte mindestens einen Teilnehmer auswählen.'); return; }
  target.innerHTML = 'Planung wird gespeichert ...';
  try{
    if(id){ await api('/planned-trainings/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(body) }); }
    else { await api('/planned-trainings', { method:'POST', body: JSON.stringify(body) }); }
    target.innerHTML = '<div class="notice"><b>Planung gespeichert.</b></div>';
    clearPlanningForm();
    await loadData();
    await loadPlannedTrainings(true);
    setView('planning');
  }catch(err){
    target.innerHTML = `<div class="notice dangerbox">Speichern fehlgeschlagen: ${esc(err.message || err)}</div>`;
  }
}

async function completePlannedTraining(id){
  if(!confirm('Diese geplante Unterweisung für alle Teilnehmer als durchgeführt abschließen?')) return;
  const conductedAt = prompt('Durchführungsdatum/Zeit leer lassen = jetzt. Optional im Format JJJJ-MM-TT oder JJJJ-MM-TT HH:MM:', '') || '';
  const confirmationText = prompt('Kurznotiz / Bestätigungstext:', 'Geplante Gruppenunterweisung abgeschlossen') || 'Geplante Gruppenunterweisung abgeschlossen';
  try{
    const result = await api('/planned-trainings/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ complete:true, conductedAt, confirmationText }) });
    alert(`Unterweisung abgeschlossen. Teilnehmer: ${result.participantCount || 0}. Gültig bis: ${fmtDate(result.validUntil)}.`);
    await loadData();
    await loadPlannedTrainings(true);
    setView('planning');
  }catch(err){
    alert('Abschluss fehlgeschlagen: ' + String(err.message || err));
  }
}

async function cancelPlannedTraining(id){
  if(!confirm('Planung stornieren?')) return;
  try{
    await api('/planned-trainings/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ status:'cancelled' }) });
    await loadData();
    await loadPlannedTrainings(true);
    setView('planning');
  }catch(err){ alert('Storno fehlgeschlagen: ' + String(err.message || err)); }
}

function plannedTrainingTable(rows, editable=false){
  if(!rows.length) return '<p class="muted">Noch keine geplanten Unterweisungen.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Datum/Zeit</th><th>Unterweisung</th><th>Teilnehmer</th><th>Ort</th><th>Verantwortlich</th><th>Dauer</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(p=>{
    const participants = p.participantNames || `${Number(p.participantCount||0)} Teilnehmer`;
    return `<tr>
      <td><b>${fmtDateTime(p.plannedAt)}</b></td>
      <td>${esc(type(p.instructionTypeId).name || p.instructionName)}</td>
      <td>${esc(participants)}</td>
      <td>${esc(p.location || '—')}</td>
      <td>${esc(p.lineManagerName || emp(p.lineManagerId).name || '—')}</td>
      <td>${esc(p.durationMinutes || '—')} Min.</td>
      <td>${planningStatusBadge(p.status)}</td>
      <td>${editable ? `<button class="small" onclick="editPlannedTraining('${esc(p.id)}')">Bearbeiten</button> <button class="small primary" onclick="completePlannedTraining('${esc(p.id)}')">Abschließen</button> <button class="small" onclick="sendPlannedMail('${esc(p.id)}')">Outlook senden</button> <button class="small ghost" onclick="cancelPlannedTraining('${esc(p.id)}')">Stornieren</button>` : '—'}</td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Planungen angezeigt.</p>`;
}
