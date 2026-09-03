// v0.23: Unterweisungstypen vollständig verwalten.

function canEditInstructionTypes(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

function renderInstructions(){
  const editable = canEditInstructionTypes();
  const old = $('instructionSearch')?.value || '';
  $('instructions').innerHTML = `<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Unterweisungstypen</h2><p class="muted">Aktuelle Firma: <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. Inhalte und Aktionen über „Details öffnen“ anzeigen.</p></div><input id="instructionSearch" type="search" aria-label="Unterweisungen suchen" placeholder="Suchen" value="${esc(old)}"></div><div id="instructionResults">${instructionTypeTable(old, editable)}</div><section id="instructionDetail" class="instruction-detail" aria-label="Unterweisungsdetails" hidden></section></div>
    ${editable ? instructionTypeFormCard() + templateUploadCard() + templateListCard() + testQuestionManagerCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Ändern von Unterweisungen, Vorlagen oder Testfragen.</div></div>'}
  </div>`;
  $('instructionSearch')?.addEventListener('input', ()=>{
    $('instructionResults').innerHTML = instructionTypeTable($('instructionSearch').value, editable);
    if(typeof scheduleTableFormPolish === 'function') scheduleTableFormPolish();
  });
  $('instructionResults').addEventListener('click', event=>{
    const button = event.target.closest('[data-instruction-details]');
    if(button) openInstructionDetails(button.dataset.instructionDetails);
  });
  $('instructionDetail').addEventListener('click', event=>{
    const button = event.target.closest('[data-instruction-action]');
    if(!button) return;
    const row = types().find(t=>t.id === $('instructionDetail').dataset.instructionId);
    if(!row) return;
    const action = button.dataset.instructionAction;
    if(action === 'close'){
      $('instructionDetail').hidden = true;
      const opener = Array.from(document.querySelectorAll('[data-instruction-details]')).find(x=>x.dataset.instructionDetails===row.id);
      (opener || $('instructionSearch')).focus();
    }else if(action === 'open'){
      const tpl = templateForType(row);
      if(tpl) openTemplate(tpl.id);
    }else if(canEditInstructionTypes()){
      if(action === 'edit') prepareInstructionTypeEdit(row.id);
      if(action === 'upload') prepareTemplateUpload(row.id);
      if(action === 'toggle') toggleInstructionType(row.id, row.active===false);
    }
  });
  if(!state.testQuestions?.length && (state.apiAvailable || API_BASE_URL)){
    loadTestQuestions(true).then(()=>{
      const view = document.getElementById('instructions');
      if(view?.classList.contains('active')) renderInstructions();
    });
  }
}

function instructionTypeTable(search='', editable=false){
  const q = String(search||'').toLowerCase();
  const rows = types().filter(t=>!q || [t.name,t.category,t.description,templateForType(t)?.title,templateForType(t)?.fileName].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'de') || String(a.name||'').localeCompare(String(b.name||''),'de'));
  if(!rows.length) return '<p class="muted">Keine Unterweisungen vorhanden.</p>';
  return `<div class="table-wrap instruction-overview"><table><thead><tr><th>Unterweisung</th><th>Bereich</th><th>Intervall</th><th>Testfragen</th><th>Status</th><th>Details</th></tr></thead><tbody>${rows.map(t=>{
    const tpl = templateForType(t);
    const qCount = (state.testQuestions||[]).filter(x=>x.instructionTypeId===t.id && x.active!==false).length;
    return `<tr>
      <td data-label="Unterweisung"><b>${esc(t.name)}</b><span class="instruction-preview muted">${esc(String(t.description||'').slice(0,120))}${String(t.description||'').length>120?'…':''}</span><small class="muted">${tpl?'Unterlage vorhanden':'Keine Unterlage'}</small></td>
      <td data-label="Bereich">${esc(t.category||'—')}</td>
      <td data-label="Intervall">${esc(t.intervalMonths||12)} Monate</td>
      <td data-label="Testfragen"><span class="badge ${qCount?'ok':'warn'}">${qCount} aktiv</span></td>
      <td data-label="Status">${t.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
      <td data-label="Details"><button class="small" type="button" data-instruction-details="${esc(t.id)}" aria-label="Details öffnen: ${esc(t.name)}">Details öffnen</button></td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Unterweisungstypen angezeigt.</p>`;
}

function openInstructionDetails(id){
  const row = types().find(t=>t.id===id);
  const panel = $('instructionDetail');
  if(!row || !panel) return;
  const tpl = templateForType(row);
  panel.dataset.instructionId = row.id;
  panel.innerHTML = `<div class="toolbar"><h3 tabindex="-1">${esc(row.name)}</h3><button type="button" data-instruction-action="close">Details schließen</button></div>
    <p class="muted">${esc(row.category||'—')} · ${esc(row.intervalMonths||12)} Monate · ${row.active===false?'Inaktiv':'Aktiv'}</p>
    <div class="instruction-full-description">${esc(row.description||'Keine Beschreibung vorhanden.')}</div>
    <p><b>Unterlage:</b> ${tpl?`${esc(tpl.title)} · ${esc(tpl.fileName||'')}`:'Keine Unterlage zugeordnet'}</p>
    <div class="instruction-detail-actions">${tpl?'<button type="button" data-instruction-action="open">Unterlage öffnen</button>':''}
      ${canEditInstructionTypes()?`<button type="button" data-instruction-action="edit">Bearbeiten</button><button type="button" data-instruction-action="upload">Unterlage hochladen</button><button type="button" data-instruction-action="toggle">${row.active===false?'Aktivieren':'Deaktivieren'}</button>`:''}
    </div>`;
  panel.hidden = false;
  if(typeof applyTableFormPolish === 'function') applyTableFormPolish(panel);
  panel.querySelector('h3').focus({preventScroll:true});
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function instructionTypeFormCard(){
  return `<div class="card span-12"><h2>Unterweisung anlegen / bearbeiten</h2>
    <p class="muted">Hier legt eine Firma eigene Unterweisungstypen an. Die Vorlage/PDF und die Testfragen werden danach direkt im selben Reiter gepflegt.</p>
    <div class="form-grid">
      <input id="itId" type="hidden">
      <div class="field"><label>Name *</label><input id="itName" placeholder="z. B. Stapler-Unterweisung"></div>
      <div class="field"><label>Bereich/Kategorie *</label><input id="itCategory" placeholder="z. B. Arbeitssicherheit"></div>
      <div class="field"><label>Intervall in Monaten</label><input id="itInterval" type="number" min="1" max="120" value="12"></div>
      <div class="field"><label>Vorlage</label><select id="itTemplate">${templateOptions('')}</select></div>
      <div class="field"><label>Status</label><select id="itActive"><option value="1">Aktiv</option><option value="0">Inaktiv</option></select></div>
      <div class="field full"><label>Beschreibung / Inhalte</label><textarea id="itDescription" placeholder="Was wird in dieser Unterweisung behandelt?"></textarea></div>
      <div class="field full"><button class="primary" onclick="saveInstructionType()">Unterweisung speichern</button> <button class="ghost" onclick="clearInstructionTypeForm()">Formular leeren</button></div>
      <div id="itResult" class="field full muted"></div>
    </div>
  </div>`;
}

function clearInstructionTypeForm(){
  ['itId','itName','itCategory','itDescription'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('itInterval')) $('itInterval').value='12';
  if($('itTemplate')) $('itTemplate').value='';
  if($('itActive')) $('itActive').value='1';
  if($('itResult')) $('itResult').innerHTML='';
}

function prepareInstructionTypeEdit(id){
  const row = type(id);
  if(!row || !row.id) return;
  $('itId').value = row.id;
  $('itName').value = row.name || '';
  $('itCategory').value = row.category || '';
  $('itInterval').value = row.intervalMonths || 12;
  $('itTemplate').value = row.templateId || '';
  $('itActive').value = row.active===false ? '0' : '1';
  $('itDescription').value = row.description || '';
  document.getElementById('itName')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function readInstructionTypeForm(){
  return {
    id: $('itId').value.trim(),
    name: $('itName').value.trim(),
    category: $('itCategory').value.trim(),
    intervalMonths: Number($('itInterval').value || 12),
    templateId: $('itTemplate').value,
    active: $('itActive').value === '1',
    description: $('itDescription').value.trim()
  };
}

async function saveInstructionType(){
  const target = $('itResult');
  const body = readInstructionTypeForm();
  if(!body.name){ alert('Name fehlt.'); return; }
  if(!body.category){ alert('Bereich/Kategorie fehlt.'); return; }
  target.innerHTML = 'Unterweisung wird gespeichert ...';
  try{
    if(body.id){
      const id = body.id;
      delete body.id;
      await api('/instruction-types/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(body) });
    }else{
      delete body.id;
      await api('/instruction-types', { method:'POST', body: JSON.stringify(body) });
    }
    target.innerHTML = '<div class="notice"><b>Unterweisung gespeichert.</b></div>';
    clearInstructionTypeForm();
    await loadData();
    await loadTestQuestions(true);
    setView('instructions');
  }catch(err){
    target.innerHTML = `<div class="notice dangerbox">Speichern fehlgeschlagen: ${esc(err.message || err)}</div>`;
  }
}

async function toggleInstructionType(id, active){
  if(!confirm(active ? 'Unterweisung wieder aktivieren?' : 'Unterweisung deaktivieren?')) return;
  try{
    await api('/instruction-types/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ active }) });
    await loadData();
    await loadTestQuestions(true);
    setView('instructions');
  }catch(err){
    alert('Unterweisung konnte nicht geändert werden: ' + String(err.message || err));
  }
}
