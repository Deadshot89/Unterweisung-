// v0.22: Testfragen je Unterweisung verwalten.

state.testQuestions = state.testQuestions || [];
const testQuestionsRequests = new Map();
let testQuestionsCompany = state.companyId;
let testQuestionsLoadedCompany = null;

function syncTestQuestionCompany(){
  if(testQuestionsCompany === state.companyId) return;
  testQuestionsCompany = state.companyId;
  testQuestionsLoadedCompany = null;
  state.testQuestions = [];
  state.testQuestionsLoadError = false;
}

function canEditTestQuestions(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

async function loadTestQuestions(force=false, afterWrite=false){
  syncTestQuestionCompany();
  const pending = testQuestionsRequests.get(state.companyId);
  // A successful write requires a newer read; ordinary repeated reload clicks can share one.
  if(pending && !afterWrite) return pending.promise;
  if(!force && (testQuestionsLoadedCompany === state.companyId || (testQuestionsLoadedCompany === null && state.testQuestions?.length))) return state.testQuestions;
  if(!state.apiAvailable && !API_BASE_URL){ state.testQuestions = []; return []; }
  const companyId = state.companyId;
  state.testQuestionsLoadError = false;
  const request = {companyId};
  testQuestionsRequests.set(companyId, request);
  request.promise = (async()=>{
    try{
      const rows = await api('/test-questions');
      if(state.companyId === companyId && testQuestionsRequests.get(companyId) === request){
        state.testQuestions = rows;
        testQuestionsLoadedCompany = companyId;
      }
    }catch(err){
      if(state.companyId === companyId && testQuestionsRequests.get(companyId) === request) state.testQuestionsLoadError = true;
      console.warn('Testfragen konnten nicht geladen werden', err);
    }finally{
      if(testQuestionsRequests.get(companyId) === request) testQuestionsRequests.delete(companyId);
    }
    return state.testQuestions;
  })();
  return request.promise;
}

function refreshTestQuestionResults(){
  const target = $('tqResults');
  if(target){
    const fType = $('tqTypeFilter')?.value || '';
    const fLang = $('tqLangFilter')?.value || '';
    const filtered = (state.testQuestions || []).filter(x=>(!fType || x.instructionTypeId===fType) && (!fLang || x.language===fLang));
    target.innerHTML = testQuestionTable(filtered);
    if(typeof applyTableFormPolish === 'function') applyTableFormPolish(target);
  }
  const status = $('tqLoadStatus');
  if(status) status.textContent = state.testQuestionsLoadError ? 'Testfragen konnten nicht geladen werden. Vorhandene Daten bleiben erhalten. Bitte erneut laden.' : '';
  if(typeof refreshInstructionQuestionCounts === 'function') refreshInstructionQuestionCounts();
}

async function reloadTestQuestionResults(force=true){
  const viewContent = $('instructionResults') || $('tqResults');
  const companyId = state.companyId;
  await loadTestQuestions(force);
  if(viewContent && viewContent === ($('instructionResults') || $('tqResults')) && companyId === state.companyId) refreshTestQuestionResults();
}

function langLabel(lang){
  return ({de:'Deutsch',en:'Englisch',pl:'Polnisch'})[lang||'de'] || lang || 'de';
}

const previousRenderInstructionsForQuestions = typeof renderInstructions === 'function' ? renderInstructions : null;

function renderInstructions(){
  syncTestQuestionCompany();
  const editable = canEditTemplates ? canEditTemplates() : canEditTestQuestions();
  const old = $('instructionSearch')?.value || '';
  $('instructions').innerHTML = `<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Unterweisungstypen</h2><p class="muted">Aktuelle Firma: <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. Unterweisung, Unterlage und Testfragen gehören immer zur ausgewählten Firma.</p></div><input id="instructionSearch" placeholder="Suchen" value="${esc(old)}"></div>${instructionTable(old, editable)}</div>
    ${editable ? templateUploadCard() + templateListCard() + testQuestionManagerCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Hochladen, Ändern von Vorlagen oder Bearbeiten von Testfragen.</div></div>'}
  </div>`;
  $('instructionSearch')?.addEventListener('input', renderInstructions);
  if(!state.testQuestions?.length && (state.apiAvailable || API_BASE_URL)){
    reloadTestQuestionResults(false);
  }
}

function testQuestionManagerCard(){
  const fType = $('tqTypeFilter')?.value || '';
  const fLang = $('tqLangFilter')?.value || '';
  const q = state.testQuestions || [];
  const filtered = q.filter(x => (!fType || x.instructionTypeId===fType) && (!fLang || x.language===fLang));
  return `<div class="card span-12"><div class="toolbar"><div><h2>Testfragen</h2><p class="muted">Fragen werden beim externen Test gemischt. Die richtige Antwort bleibt intern über den Antwortindex gespeichert.</p></div><button class="ghost" onclick="reloadTestQuestionResults()">Fragen neu laden</button></div>
    <div class="filters">
      <select id="tqTypeFilter" onchange="refreshTestQuestionResults()"><option value="">Alle Unterweisungen</option>${types().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}" ${fType===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
      <select id="tqLangFilter" onchange="refreshTestQuestionResults()"><option value="">Alle Sprachen</option>${['de','en','pl'].map(l=>`<option value="${l}" ${fLang===l?'selected':''}>${langLabel(l)}</option>`).join('')}</select>
    </div>
    ${testQuestionForm(fType, fLang)}
    <p id="tqLoadStatus" class="muted" role="status"></p><div id="tqResults">${testQuestionTable(filtered)}</div>
  </div>`;
}

function testQuestionForm(selectedType='', selectedLang=''){
  return `<div class="subcard"><h3>Neue Testfrage anlegen</h3>
    <div class="form-grid">
      <div class="field"><label>Unterweisung *</label><select id="tqType"><option value="">Bitte wählen</option>${types().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}" ${selectedType===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Sprache</label><select id="tqLang">${['de','en','pl'].map(l=>`<option value="${l}" ${selectedLang===l?'selected':''}>${langLabel(l)}</option>`).join('')}</select></div>
      <div class="field full"><label>Frage *</label><textarea id="tqQuestion" placeholder="z. B. Was muss vor Beginn der Arbeit geprüft werden?"></textarea></div>
      <div class="field"><label>Antwort A *</label><input id="tqA" placeholder="Antwort A"></div>
      <div class="field"><label>Antwort B *</label><input id="tqB" placeholder="Antwort B"></div>
      <div class="field"><label>Antwort C</label><input id="tqC" placeholder="Antwort C"></div>
      <div class="field"><label>Antwort D</label><input id="tqD" placeholder="Antwort D"></div>
      <div class="field"><label>Richtige Antwort</label><select id="tqCorrect"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div>
      <div class="field"><label>Status</label><select id="tqActive"><option value="1">Aktiv</option><option value="0">Inaktiv</option></select></div>
      <div class="field full"><button class="primary" onclick="saveNewTestQuestion()">Testfrage speichern</button> <button class="ghost" onclick="clearTestQuestionForm()">Leeren</button></div>
      <div id="tqResult" class="field full muted"></div>
    </div>
  </div>`;
}

function testQuestionTable(rows){
  if(!rows.length) return '<p class="muted">Keine Testfragen für die Auswahl vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Unterweisung</th><th>Sprache</th><th>Frage</th><th>Antworten</th><th>Richtig</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(row=>{
    const options = Array.isArray(row.options) ? row.options : [];
    const correct = options[row.correctIndex] || `Index ${row.correctIndex}`;
    return `<tr>
      <td><b>${esc(row.instructionName || type(row.instructionTypeId).name)}</b></td>
      <td>${esc(langLabel(row.language))}</td>
      <td>${esc(row.question)}</td>
      <td>${options.map((o,i)=>`<div><b>${String.fromCharCode(65+i)}:</b> ${esc(o)}</div>`).join('')}</td>
      <td><span class="badge ok">${esc(String.fromCharCode(65+Number(row.correctIndex||0)))}: ${esc(correct)}</span></td>
      <td>${row.active?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
      <td><button class="small" onclick="editTestQuestion('${esc(row.id)}')">Bearbeiten</button> <button class="small" onclick="toggleTestQuestion('${esc(row.id)}', ${row.active?'false':'true'})">${row.active?'Deaktivieren':'Aktivieren'}</button></td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Testfragen angezeigt.</p>`;
}

function clearTestQuestionForm(){
  ['tqQuestion','tqA','tqB','tqC','tqD'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('tqCorrect')) $('tqCorrect').value='0';
  if($('tqActive')) $('tqActive').value='1';
  if($('tqResult')) $('tqResult').innerHTML='';
}

function readQuestionForm(){
  const options = [$('tqA').value.trim(), $('tqB').value.trim(), $('tqC').value.trim(), $('tqD').value.trim()].filter(Boolean);
  return {
    instructionTypeId: $('tqType').value,
    language: $('tqLang').value,
    question: $('tqQuestion').value.trim(),
    options,
    correctIndex: Number($('tqCorrect').value || 0),
    active: $('tqActive').value === '1'
  };
}

async function saveNewTestQuestion(){
  const target = $('tqResult');
  const body = readQuestionForm();
  if(!body.instructionTypeId){ alert('Unterweisung fehlt.'); return; }
  if(!body.question){ alert('Frage fehlt.'); return; }
  if(body.options.length < 2){ alert('Mindestens Antwort A und B sind erforderlich.'); return; }
  if(body.correctIndex >= body.options.length){ alert('Die richtige Antwort darf nicht leer sein.'); return; }
  target.innerHTML = 'Testfrage wird gespeichert ...';
  try{
    await api('/test-questions', { method:'POST', body: JSON.stringify(body) });
    target.innerHTML = '<div class="notice"><b>Testfrage gespeichert.</b></div>';
    clearTestQuestionForm();
    await loadTestQuestions(true, true);
    refreshTestQuestionResults();
  }catch(err){
    target.innerHTML = `<div class="notice dangerbox">Speichern fehlgeschlagen: ${esc(err.message || err)}</div>`;
  }
}

function editTestQuestion(id){
  const row = (state.testQuestions || []).find(x=>x.id===id);
  if(!row) return;
  const options = Array.isArray(row.options) ? row.options : [];
  const text = prompt('Frage bearbeiten:', row.question || '');
  if(text === null) return;
  const optionText = prompt('Antworten mit | trennen. Erste Antwort=A, zweite=B usw.', options.join(' | '));
  if(optionText === null) return;
  const newOptions = optionText.split('|').map(x=>x.trim()).filter(Boolean);
  const correctRaw = prompt('Richtige Antwort als Nummer eingeben: 1=A, 2=B, 3=C, 4=D', String(Number(row.correctIndex||0)+1));
  if(correctRaw === null) return;
  const correctIndex = Math.max(0, Number(correctRaw)-1);
  updateTestQuestion(id, { question:text.trim(), options:newOptions, correctIndex });
}

async function updateTestQuestion(id, body){
  try{
    await api('/test-questions/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(body) });
    await loadTestQuestions(true, true);
    refreshTestQuestionResults();
  }catch(err){
    alert('Testfrage konnte nicht gespeichert werden: ' + String(err.message || err));
  }
}

async function toggleTestQuestion(id, active){
  await updateTestQuestion(id, { active });
}
