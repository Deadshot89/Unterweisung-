// v0.23: Unterweisungstypen vollständig verwalten.

function canEditInstructionTypes(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

function renderInstructions(){
  const editable = canEditInstructionTypes();
  const old = $('instructionSearch')?.value || '';
  $('instructions').innerHTML = `<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Unterweisungstypen</h2><p class="muted">Aktuelle Firma: <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. Hier werden Unterweisung, Gültigkeit, Unterlage und Testfragen verwaltet.</p></div><input id="instructionSearch" placeholder="Suchen" value="${esc(old)}"></div>${instructionTypeTable(old, editable)}</div>
    ${editable ? instructionTypeFormCard() + templateUploadCard() + templateListCard() + testQuestionManagerCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Ändern von Unterweisungen, Vorlagen oder Testfragen.</div></div>'}
  </div>`;
  $('instructionSearch')?.addEventListener('input', renderInstructions);
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
  return `<div class="table-wrap"><table><thead><tr><th>Unterweisung</th><th>Bereich</th><th>Intervall</th><th>Unterlage/Vorlage</th><th>Testfragen</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(t=>{
    const tpl = templateForType(t);
    const qCount = (state.testQuestions||[]).filter(x=>x.instructionTypeId===t.id && x.active!==false).length;
    return `<tr>
      <td><b>${esc(t.name)}</b><br><span class="muted">${esc(t.description||'')}</span></td>
      <td>${esc(t.category||'—')}</td>
      <td>${esc(t.intervalMonths||12)} Monate</td>
      <td>${tpl ? `<b>${esc(tpl.title)}</b><br><span class="muted">${esc(tpl.fileName||'')}</span>` : '<span class="badge warn">Keine Unterlage</span>'}</td>
      <td>${qCount ? `<span class="badge ok">${qCount} aktiv</span>` : '<span class="badge warn">Keine aktiven Fragen</span>'}</td>
      <td>${t.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
      <td>${tpl?`<button class="small" onclick="openTemplate('${esc(tpl.id)}')">Unterlage öffnen</button>`:''} ${editable?`<button class="small" onclick="prepareInstructionTypeEdit('${esc(t.id)}')">Bearbeiten</button> <button class="small" onclick="prepareTemplateUpload('${esc(t.id)}')">Unterlage hochladen</button> <button class="small" onclick="toggleInstructionType('${esc(t.id)}', ${t.active!==false?'false':'true'})">${t.active!==false?'Deaktivieren':'Aktivieren'}</button>`:'—'}</td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Unterweisungstypen angezeigt.</p>`;
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
