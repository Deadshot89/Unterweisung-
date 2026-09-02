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
  return `<div class="participant-picker">
    <div class="participant-toolbar"><div class="admin-search"><label for="planEmployeeSearch">Teilnehmer suchen</label><input id="planEmployeeSearch" type="search" placeholder="Name, E-Mail oder Bereich" aria-controls="planEmployeeList"></div><span id="planEmployeeCount" class="muted" role="status">${rows.filter(e=>selected.has(e.id)).length} ausgewählt · ${rows.length} von ${rows.length} angezeigt</span></div>
    <div id="planEmployeeList" class="checkbox-grid" role="group" aria-label="Teilnehmer">${rows.map(e=>`<label class="checkline" data-search="${esc([e.name,e.email,e.department].join(' ').toLowerCase())}"><input type="checkbox" class="planEmployee" value="${esc(e.id)}" ${selected.has(e.id)?'checked':''}><span><b>${esc(e.name)}</b><small>${esc(e.department||'—')}</small><small>${esc(e.email||'')}</small></span></label>`).join('')}</div>
    <p id="planEmployeeEmpty" class="admin-empty" hidden>Keine Teilnehmer für diese Suche gefunden.</p>
  </div>`;
}

function updatePlanningParticipants(){
  const query = String($('planEmployeeSearch')?.value || '').trim().toLowerCase();
  const rows = Array.from(document.querySelectorAll('#planEmployeeList .checkline'));
  let visible = 0;
  let selected = 0;
  rows.forEach(row => {
    row.hidden = !row.dataset.search.includes(query);
    if(!row.hidden) visible++;
    if(row.querySelector('.planEmployee').checked) selected++;
  });
  if($('planEmployeeCount')) $('planEmployeeCount').textContent = `${selected} ausgewählt · ${visible} von ${rows.length} angezeigt`;
  if($('planEmployeeEmpty')) $('planEmployeeEmpty').hidden = visible !== 0;
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
  $('planning').innerHTML = `<div class="grid admin-workspace">
    <div class="card span-12"><div class="toolbar admin-toolbar"><div><h2>Unterweisung planen / zuweisen</h2><p class="muted">Termin festlegen und Teilnehmer auswählen. Beim Abschließen werden die Unterweisungen für alle Teilnehmer dokumentiert.</p></div><button class="ghost" data-planning-action="refresh">Planungen neu laden</button></div>
      ${editable ? planningFormCard() : '<div class="notice warning">Du hast keine Berechtigung zum Planen von Unterweisungen.</div>'}
    </div>
    <div class="card span-12"><h2>Geplante Unterweisungen</h2>${plannedTrainingTable(rows, editable)}</div>
  </div>`;
  $('planning').onclick = handlePlanningWorkspaceClick;
  if($('planEmployeeSearch')) $('planEmployeeSearch').oninput = updatePlanningParticipants;
  if($('planEmployeeList')) $('planEmployeeList').onchange = updatePlanningParticipants;
  if((state.apiAvailable || API_BASE_URL) && !state.planningLoadedOnce){
    state.planningLoadedOnce = true;
    loadPlannedTrainings(true).then(()=>{
      const view = document.getElementById('planning');
      if(view?.classList.contains('active')) renderPlanning();
    });
  }
}

function handlePlanningWorkspaceClick(event){
  const button = event.target.closest('button[data-planning-action]');
  if(!button) return;
  const {planningAction, id} = button.dataset;
  if(planningAction === 'refresh') return loadPlannedTrainings(true).then(renderPlanning);
  if(!canEditPlanning()) return;
  switch(planningAction){
    case 'save': return savePlannedTraining();
    case 'clear': return clearPlanningForm();
    case 'edit': return editPlannedTraining(id);
    case 'complete': return completePlannedTraining(id);
    case 'mail': return sendPlannedMail(id);
    case 'cancel': return cancelPlannedTraining(id);
  }
}

function planningFormCard(){
  return `<div class="form-grid">
    <input id="planId" type="hidden">
    <div class="field"><label for="planType">Unterweisung *</label><select id="planType"><option value="">Bitte wählen</option>${types().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="planAt">Datum/Zeit *</label><input id="planAt" type="datetime-local"></div>
    <div class="field"><label for="planDuration">Dauer Minuten</label><input id="planDuration" type="number" min="1" max="600" value="30"></div>
    <div class="field"><label for="planLocation">Ort</label><input id="planLocation" value="Schulungsraum / Warehouse"></div>
    <div class="field"><label for="planLineManager">Line Manager / Verantwortlich</label><select id="planLineManager">${lineManagerSelectOptions('')}</select></div>
    <div class="field"><label for="planStatus">Status</label><select id="planStatus"><option value="planned">Geplant</option><option value="invited">Eingeladen</option><option value="cancelled">Storniert</option><option value="completed">Abgeschlossen</option></select></div>
    <div class="field full"><h3 class="field-heading">Teilnehmer *</h3>${planningEmployeeCheckboxes([])}</div>
    <div class="field full admin-form-actions"><button class="primary" data-planning-action="save">Planung speichern</button> <button class="ghost" data-planning-action="clear">Formular leeren</button></div>
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
  return `<div class="table-wrap admin-table-wrap"><table class="admin-table planning-table"><thead><tr><th scope="col">Termin / Unterweisung</th><th scope="col">Teilnehmer</th><th scope="col">Ort / Verantwortlich</th><th scope="col">Status</th><th scope="col">Aktionen</th></tr></thead><tbody>${rows.map(p=>{
    const count = Number(p.participantCount || parseParticipantIds(p).length);
    return `<tr>
      <td data-label="Termin / Unterweisung"><div class="admin-cell"><b>${esc(type(p.instructionTypeId).name || p.instructionName)}</b><span>${fmtDateTime(p.plannedAt)}</span><small class="muted">${esc(p.durationMinutes || '—')} Min.</small></div></td>
      <td data-label="Teilnehmer"><div class="admin-cell"><span>${count} Teilnehmer</span>${p.participantNames?`<details class="admin-details"><summary>Namen anzeigen</summary><p>${esc(p.participantNames)}</p></details>`:''}</div></td>
      <td data-label="Ort / Verantwortlich"><div class="admin-cell"><span>${esc(p.location || '—')}</span><span class="muted">${esc(p.lineManagerName || emp(p.lineManagerId).name || '—')}</span></div></td>
      <td data-label="Status">${planningStatusBadge(p.status)}</td>
      <td data-label="Aktionen"><div class="admin-actions">${editable ? `<button class="small" data-planning-action="edit" data-id="${esc(p.id)}">Bearbeiten</button><button class="small primary" data-planning-action="complete" data-id="${esc(p.id)}">Abschließen</button><details class="admin-details"><summary>Weitere Aktionen</summary><div class="admin-actions"><button class="small" data-planning-action="mail" data-id="${esc(p.id)}">Outlook senden</button><button class="small ghost" data-planning-action="cancel" data-id="${esc(p.id)}">Stornieren</button></div></details>` : '—'}</div></td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted admin-count">${rows.length} Planungen angezeigt.</p>`;
}
