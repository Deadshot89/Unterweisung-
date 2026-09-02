// v0.36.0: Unterweisungstypen als kompakter Verwaltungs-Workspace.

function canEditInstructionTypes(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

const instructionWorkspaceState = {
  selectedId: '',
  search: '',
  category: '',
  status: '',
  template: '',
  questions: ''
};

let instructionQuestionsLoadRequested = false;
let instructionQuestionsCompanyId = state.companyId;

function instructionQuestionCount(t){
  return (state.testQuestions || []).filter(q => q.instructionTypeId === t.id && q.active !== false).length;
}

function filteredInstructionWorkspaceRows(search = instructionWorkspaceState.search){
  const q = String(search || '').toLowerCase().trim();
  return types().filter(t => {
    const tpl = templateForType(t);
    const questions = instructionQuestionCount(t);
    if(q && ![t.name,t.category,t.description,tpl?.title,tpl?.fileName].join(' ').toLowerCase().includes(q)) return false;
    if(instructionWorkspaceState.category && String(t.category || '') !== instructionWorkspaceState.category) return false;
    if(instructionWorkspaceState.status === 'active' && t.active === false) return false;
    if(instructionWorkspaceState.status === 'inactive' && t.active !== false) return false;
    if(instructionWorkspaceState.template === 'assigned' && !tpl) return false;
    if(instructionWorkspaceState.template === 'missing' && tpl) return false;
    if(instructionWorkspaceState.questions === 'available' && questions < 1) return false;
    if(instructionWorkspaceState.questions === 'missing' && questions > 0) return false;
    return true;
  }).sort((a,b) => String(a.category||'').localeCompare(String(b.category||''),'de') || String(a.name||'').localeCompare(String(b.name||''),'de'));
}

function instructionWorkspaceMetrics(rows = filteredInstructionWorkspaceRows()){
  const active = rows.filter(t => t.active !== false).length;
  const missingTemplate = rows.filter(t => !templateForType(t)).length;
  const missingQuestions = rows.filter(t => instructionQuestionCount(t) < 1).length;
  return `<div class="instruction-metrics" aria-label="Unterweisungskennzahlen">
    <div class="instruction-metric"><span class="instruction-metric-label">Angezeigt</span><strong>${rows.length}</strong></div>
    <div class="instruction-metric"><span class="instruction-metric-label">Aktiv</span><strong>${active}</strong></div>
    <div class="instruction-metric"><span class="instruction-metric-label">Ohne Unterlage</span><strong>${missingTemplate}</strong></div>
    <div class="instruction-metric"><span class="instruction-metric-label">Ohne Testfragen</span><strong>${missingQuestions}</strong></div>
  </div>`;
}

function instructionWorkspaceFilters(){
  const categories = [...new Set(types().map(t => String(t.category || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'de'));
  return `<div class="instruction-filters" aria-label="Unterweisungen filtern">
    <div class="field instruction-search-field">
      <label for="instructionSearch">Suche</label>
      <input id="instructionSearch" placeholder="Unterweisung, Inhalt oder Unterlage suchen" value="${esc(instructionWorkspaceState.search)}">
    </div>
    <div class="field">
      <label for="instructionCategoryFilter">Bereich</label>
      <select id="instructionCategoryFilter">
        <option value="">Alle Bereiche</option>
        ${categories.map(category => `<option value="${esc(category)}" ${instructionWorkspaceState.category===category?'selected':''}>${esc(category)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="instructionStatusFilter">Status</label>
      <select id="instructionStatusFilter">
        <option value="" ${instructionWorkspaceState.status===''?'selected':''}>Alle</option>
        <option value="active" ${instructionWorkspaceState.status==='active'?'selected':''}>Aktiv</option>
        <option value="inactive" ${instructionWorkspaceState.status==='inactive'?'selected':''}>Inaktiv</option>
      </select>
    </div>
    <div class="field">
      <label for="instructionTemplateFilter">Unterlage</label>
      <select id="instructionTemplateFilter">
        <option value="" ${instructionWorkspaceState.template===''?'selected':''}>Alle</option>
        <option value="assigned" ${instructionWorkspaceState.template==='assigned'?'selected':''}>Vorhanden</option>
        <option value="missing" ${instructionWorkspaceState.template==='missing'?'selected':''}>Fehlt</option>
      </select>
    </div>
    <div class="field">
      <label for="instructionQuestionFilter">Testfragen</label>
      <select id="instructionQuestionFilter">
        <option value="" ${instructionWorkspaceState.questions===''?'selected':''}>Alle</option>
        <option value="available" ${instructionWorkspaceState.questions==='available'?'selected':''}>Vorhanden</option>
        <option value="missing" ${instructionWorkspaceState.questions==='missing'?'selected':''}>Fehlen</option>
      </select>
    </div>
    <div class="instruction-filter-actions"><button class="ghost small" type="button" data-instruction-action="clearInstructionWorkspaceFilters">Filter zurücksetzen</button></div>
  </div>`;
}

function bindInstructionWorkspaceFilters(){
  const bindings = [
    ['instructionSearch','input','search'],
    ['instructionCategoryFilter','change','category'],
    ['instructionStatusFilter','change','status'],
    ['instructionTemplateFilter','change','template'],
    ['instructionQuestionFilter','change','questions']
  ];
  bindings.forEach(([id,eventName,key]) => {
    $(id)?.addEventListener(eventName, event => {
      instructionWorkspaceState[key] = event.target.value;
      renderInstructions();
      if(key === 'search'){
        const search = $('instructionSearch');
        search?.focus();
        if(search) search.setSelectionRange(search.value.length, search.value.length);
      }
    });
  });
}

function clearInstructionWorkspaceFilters(){
  instructionWorkspaceState.search = '';
  instructionWorkspaceState.category = '';
  instructionWorkspaceState.status = '';
  instructionWorkspaceState.template = '';
  instructionWorkspaceState.questions = '';
  renderInstructions();
}

function selectInstructionWorkspaceItem(id){
  instructionWorkspaceState.selectedId = id || '';
  renderInstructions();
  document.querySelector('.instruction-detail-panel')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function instructionDetailPanel(editable=false){
  const t = type(instructionWorkspaceState.selectedId);
  if(!t || !t.id){
    return `<div class="instruction-detail-panel instruction-detail-empty">
      <div><span class="instruction-section-kicker">Detailansicht</span><h3>Unterweisung auswählen</h3></div>
      <p class="muted">Über „Öffnen“ siehst du den vollständigen Inhalt, die zugeordnete Unterlage, Testfragen und alle verfügbaren Aktionen.</p>
    </div>`;
  }
  const tpl = templateForType(t);
  const qCount = instructionQuestionCount(t);
  const editActions = editable ? `
    <button class="primary" data-instruction-action="prepareInstructionTypeEdit" data-instruction-id="${esc(t.id)}">Bearbeiten</button>
    <button class="ghost" data-template-action="prepare" data-template-id="${esc(t.id)}">Unterlage hochladen</button>
    <button class="ghost" data-instruction-action="toggleInstructionType" data-instruction-id="${esc(t.id)}" data-active="${t.active!==false?'false':'true'}">${t.active!==false?'Deaktivieren':'Aktivieren'}</button>` : '';
  return `<div class="instruction-detail-panel">
    <div class="instruction-detail-head">
      <div><span class="instruction-section-kicker">Detailansicht</span><h3>${esc(t.name)}</h3><p class="muted">${esc(t.category || 'Ohne Bereich')} · ${esc(t.intervalMonths || 12)} Monate</p></div>
      <span class="badge ${t.active!==false?'ok':'warn'}">${t.active!==false?'Aktiv':'Inaktiv'}</span>
    </div>
    <div class="instruction-detail-grid">
      <div class="instruction-detail-item"><span>Bereich</span><strong>${esc(t.category || '—')}</strong></div>
      <div class="instruction-detail-item"><span>Intervall</span><strong>${esc(t.intervalMonths || 12)} Monate</strong></div>
      <div class="instruction-detail-item"><span>Unterlage</span><strong>${tpl ? esc(tpl.title || tpl.fileName || 'Vorhanden') : 'Nicht zugeordnet'}</strong>${tpl?.fileName ? `<small>${esc(tpl.fileName)}</small>` : ''}</div>
      <div class="instruction-detail-item"><span>Testfragen</span><strong>${qCount} aktiv</strong></div>
      <div class="instruction-detail-description"><span>Inhalte / Beschreibung</span><p>${esc(t.description || 'Keine Beschreibung hinterlegt.')}</p></div>
    </div>
    <div class="instruction-detail-actions">
      ${tpl ? `<button class="ghost" data-template-action="open" data-template-id="${esc(tpl.id)}">Unterlage öffnen</button>` : ''}
      ${editActions}
    </div>
  </div>`;
}

function renderInstructions(){
  if(instructionQuestionsCompanyId!==state.companyId){
    instructionQuestionsCompanyId=state.companyId;
    instructionQuestionsLoadRequested=false;
  }
  if(typeof questionWorkspace==='function') questionWorkspace();
  const editable = canEditInstructionTypes();
  const rows = filteredInstructionWorkspaceRows();
  $('instructions').innerHTML = `<div class="grid instruction-workspace">
    <div class="card span-12 instruction-overview-card">
      <div class="instruction-workspace-head">
        <div><span class="instruction-section-kicker">Verwaltung</span><h2>Unterweisungstypen</h2><p class="muted">Aktuelle Firma: <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. Unterweisungen kompakt prüfen, filtern und gezielt bearbeiten.</p></div>
        ${editable ? '<button class="primary" type="button" data-instruction-action="newInstruction">Neue Unterweisung</button>' : ''}
      </div>
      <div id="instructionQuestionMetrics">${instructionWorkspaceMetrics(rows)}</div>
      ${instructionWorkspaceFilters()}
      <div id="instructionQuestionOverview">${instructionTypeTable(instructionWorkspaceState.search, editable, rows)}</div>
      <div id="instructionQuestionDetail">${instructionDetailPanel(editable)}</div>
    </div>
    ${editable ? `<div class="instruction-management-sections span-12">
      <div class="instruction-management-zone">${instructionTypeFormCard()}</div>
      <div class="instruction-management-zone">${templateUploadCard()}</div>
      <div class="instruction-management-zone">${typeof instructionAnalysisCard==='function' ? instructionAnalysisCard() : ''}</div>
      <div class="instruction-management-zone">${templateListCard()}</div>
      <div class="instruction-management-zone">${testQuestionManagerCard()}</div>
    </div>` : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Ändern von Unterweisungen, Vorlagen oder Testfragen.</div></div>'}
  </div>`;
  bindInstructionWorkspaceFilters();
  if(typeof bindInstructionManagementActions==='function') bindInstructionManagementActions();
  if(typeof bindTestQuestionWorkspace==='function') bindTestQuestionWorkspace();
  if(typeof bindTemplateWorkspaceControls==='function') bindTemplateWorkspaceControls();
  if(typeof loadInstructionAnalyses==='function' && editable) loadInstructionAnalyses();
  if(!state.testQuestions?.length && !instructionQuestionsLoadRequested && (state.apiAvailable || API_BASE_URL)){
    instructionQuestionsLoadRequested = true;
    loadTestQuestions(true).catch(()=>{
      instructionQuestionsLoadRequested = false;
    });
  }
}

function refreshInstructionQuestionSummary(){
  const metrics=$('instructionQuestionMetrics'),overview=$('instructionQuestionOverview'),detail=$('instructionQuestionDetail');
  if(!metrics || !overview || !detail) return;
  const editable=canEditInstructionTypes(),rows=filteredInstructionWorkspaceRows();
  metrics.innerHTML=instructionWorkspaceMetrics(rows);
  overview.innerHTML=instructionTypeTable(instructionWorkspaceState.search,editable,rows);
  detail.innerHTML=instructionDetailPanel(editable);
  if(typeof bindInstructionManagementActions==='function') bindInstructionManagementActions();
  if(typeof bindTemplateWorkspaceControls==='function') bindTemplateWorkspaceControls();
}

function instructionTypeTable(search='', editable=false, preparedRows=null){
  const rows = preparedRows || filteredInstructionWorkspaceRows(search);
  if(!rows.length) return '<div class="instruction-empty-state"><b>Keine passenden Unterweisungen.</b><span>Suche oder Filter anpassen.</span></div>';
  return `<div class="table-wrap instruction-table-wrap"><table class="instruction-table"><thead><tr><th>Unterweisung</th><th>Bereich</th><th>Intervall</th><th>Unterlage/Vorlage</th><th>Testfragen</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(t=>{
    const tpl = templateForType(t);
    const qCount = instructionQuestionCount(t);
    const selected = instructionWorkspaceState.selectedId === t.id;
    return `<tr class="instruction-row ${selected?'is-selected':''}">
      <td class="instruction-name-cell">
        <button class="instruction-name-button" data-instruction-action="selectInstructionWorkspaceItem" data-instruction-id="${esc(t.id)}">${esc(t.name)}</button>
        <span class="instruction-description-preview">${esc(t.description || 'Keine Beschreibung hinterlegt.')}</span>
      </td>
      <td>${esc(t.category||'—')}</td>
      <td>${esc(t.intervalMonths||12)} Monate</td>
      <td>${tpl ? `<b>${esc(tpl.title)}</b>${tpl.fileName ? `<br><span class="muted instruction-file-name">${esc(tpl.fileName)}</span>` : ''}` : '<span class="badge warn">Keine Unterlage</span>'}</td>
      <td>${qCount ? `<span class="badge ok">${qCount} aktiv</span>` : '<span class="badge warn">Keine aktiven Fragen</span>'}</td>
      <td>${t.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
      <td class="actions-cell instruction-row-action"><button class="small" data-instruction-action="selectInstructionWorkspaceItem" data-instruction-id="${esc(t.id)}">Öffnen</button></td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted instruction-table-count">${rows.length} Unterweisungstypen angezeigt.</p>`;
}

function instructionTypeFormCard(){
  return `<div class="card span-12 instruction-management-card"><div class="instruction-card-head"><div><span class="instruction-section-kicker">Stammdaten</span><h2>Unterweisung anlegen / bearbeiten</h2></div></div>
    <p class="muted">Eigene Unterweisungstypen anlegen oder die ausgewählte Unterweisung bearbeiten. Unterlage und Testfragen werden in den nächsten Bereichen gepflegt.</p>
    <div class="form-grid">
      <input id="itId" type="hidden">
      <div class="field"><label>Name *</label><input id="itName" placeholder="z. B. Stapler-Unterweisung"></div>
      <div class="field"><label>Bereich/Kategorie *</label><input id="itCategory" placeholder="z. B. Arbeitssicherheit"></div>
      <div class="field"><label>Intervall in Monaten</label><input id="itInterval" type="number" min="1" max="120" value="12"></div>
      <div class="field"><label>Vorlage</label><select id="itTemplate">${templateOptions('')}</select></div>
      <div class="field"><label>Status</label><select id="itActive"><option value="1">Aktiv</option><option value="0">Inaktiv</option></select></div>
      <div class="field full"><label>Beschreibung / Inhalte</label><textarea id="itDescription" placeholder="Was wird in dieser Unterweisung behandelt?"></textarea></div>
      <div class="field full"><button class="primary" data-instruction-action="saveInstructionType">Unterweisung speichern</button> <button class="ghost" data-instruction-action="clearInstructionTypeForm">Formular leeren</button></div>
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
  instructionWorkspaceState.selectedId = id;
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
