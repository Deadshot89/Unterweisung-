// Compact question management. The existing API remains authoritative for permissions and grading.
state.testQuestions = state.testQuestions || [];
let testQuestionWorkspaceState = newTestQuestionWorkspace();

function newTestQuestionWorkspace(){
  return {companyId:state.companyId,search:'',type:'',language:'',status:'',page:1,pageSize:25,selectedId:'',editor:null,busy:false,loading:false,loadError:'',error:'',message:'',request:null};
}
function questionWorkspace(){
  if(testQuestionWorkspaceState.companyId!==state.companyId){
    testQuestionWorkspaceState=newTestQuestionWorkspace();
    state.testQuestions=[];
  }
  return testQuestionWorkspaceState;
}
function canEditTestQuestions(){
  return (state.me?.roles || []).some(role=>['system_admin','company_admin','hse'].includes(role));
}
function questionRows(){
  questionWorkspace();
  return (state.testQuestions || []).filter(row=>!row.companyId || row.companyId===state.companyId);
}
async function loadTestQuestions(force=false,afterWrite=false){
  const s=questionWorkspace();
  if(s.request && !afterWrite) return s.request;
  if(questionRows().length && !force) return questionRows();
  if(!state.apiAvailable && !API_BASE_URL) return questionRows();
  s.loading=true;renderTestQuestionNotice();
  const request={};s.requestOwner=request;
  const current=()=>s===questionWorkspace() && s.requestOwner===request;
  s.request=(async()=>{
    try{
      const rows=await api('/test-questions');
      if(!Array.isArray(rows)) throw new Error('Ungültige Antwort beim Laden der Testfragen.');
      if(current()){state.testQuestions=rows;s.loadError='';}
    }catch(error){
      if(current()) s.loadError=String(error.message || error);
    }finally{
      if(current()){
        s.loading=false;s.request=null;
        renderTestQuestionResults();renderTestQuestionNotice();
        if(!s.editor || !canEditTestQuestions()) renderTestQuestionDetail();
        if(typeof refreshInstructionQuestionSummary==='function') refreshInstructionQuestionSummary();
      }
    }
    return s===questionWorkspace()?questionRows():[];
  })();
  return s.request;
}
function langLabel(lang){return ({de:'Deutsch',en:'Englisch',pl:'Polnisch'})[lang||'de'] || lang || 'de';}
function questionInstructionName(row){return row.instructionName || type(row.instructionTypeId)?.name || 'Ohne Unterweisung';}
function questionIsActive(row){return row.active!==false && row.active!==0;}
function questionSearchText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de');}
function filteredTestQuestions(){
  const s=questionWorkspace();const search=questionSearchText(s.search.trim());
  return questionRows().filter(row=>(!s.type || row.instructionTypeId===s.type)
    && (!s.language || row.language===s.language)
    && (!s.status || questionIsActive(row)===(s.status==='active'))
    && (!search || questionSearchText([questionInstructionName(row),row.question,...(row.options||[])].join(' ')).includes(search)))
    .sort((a,b)=>questionInstructionName(a).localeCompare(questionInstructionName(b),'de') || String(a.language).localeCompare(String(b.language)) || String(a.question).localeCompare(String(b.question),'de',{numeric:true}) || String(a.id).localeCompare(String(b.id)));
}
function questionTypeOptions(selected,all=false){
  return types().filter(t=>all || t.active!==false || t.id===selected).map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)}${t.active===false?' (inaktiv)':''}</option>`).join('');
}
function testQuestionManagerCard(){
  const s=questionWorkspace();
  return `<section id="testQuestionWorkspace" class="card span-12 admin-workspace question-workspace" aria-labelledby="testQuestionHeading">
    <div class="admin-toolbar"><div><span class="instruction-section-kicker">Fragenverwaltung</span><h2 id="testQuestionHeading">Testfragen</h2><p class="muted">Fragen finden, Antworten prüfen und gezielt bearbeiten.</p></div>
      <div class="question-toolbar-actions"><button type="button" class="ghost" data-question-action="refresh" ${s.loading||s.busy?'disabled':''}>Fragen neu laden</button>${canEditTestQuestions()?`<button type="button" class="primary" data-question-action="new" ${s.busy?'disabled':''}>Neue Testfrage</button>`:''}</div></div>
    <div class="question-filters">
      <div class="field question-search"><label for="tqSearch">Frage oder Antwort suchen</label><input id="tqSearch" type="search" value="${esc(s.search)}" placeholder="Suchbegriff eingeben" data-question-filter="search"></div>
      <div class="field"><label for="tqTypeFilter">Unterweisung</label><select id="tqTypeFilter" data-question-filter="type"><option value="">Alle Unterweisungen</option>${questionTypeOptions(s.type,true)}</select></div>
      <div class="field"><label for="tqLangFilter">Sprache</label><select id="tqLangFilter" data-question-filter="language"><option value="">Alle Sprachen</option>${['de','en','pl'].map(l=>`<option value="${l}" ${s.language===l?'selected':''}>${langLabel(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="tqStatusFilter">Status</label><select id="tqStatusFilter" data-question-filter="status"><option value="">Alle</option><option value="active" ${s.status==='active'?'selected':''}>Aktiv</option><option value="inactive" ${s.status==='inactive'?'selected':''}>Inaktiv</option></select></div>
      <button type="button" class="ghost small" data-question-action="reset">Filter zurücksetzen</button>
    </div>
    <div id="tqNotice" role="status" aria-live="polite">${testQuestionNotice()}</div>
    <div id="tqResults">${testQuestionTable(filteredTestQuestions())}</div>
    <div id="tqDetail">${testQuestionDetail()}</div>
  </section>`;
}
function testQuestionNotice(){
  const s=questionWorkspace();
  return `${s.loading?'<p class="muted">Testfragen werden geladen …</p>':''}${s.busy?'<p class="muted">Änderung wird gespeichert …</p>':''}${s.message?`<p class="notice">${esc(s.message)}</p>`:''}${s.error?`<p class="notice dangerbox">${esc(s.error)}</p>`:''}${s.loadError?`<p class="notice warning">Testfragen konnten nicht neu geladen werden: ${esc(s.loadError)}. Vorhandene Fragen bleiben sichtbar. Bitte erneut laden.</p>`:''}`;
}
function renderTestQuestionNotice(){
  if($('tqNotice')) $('tqNotice').innerHTML=testQuestionNotice();
  const s=questionWorkspace();
  document.querySelectorAll('#testQuestionWorkspace [data-question-action="refresh"]').forEach(button=>button.disabled=s.loading||s.busy);
  document.querySelectorAll('#testQuestionWorkspace [data-question-action="new"]').forEach(button=>button.disabled=s.busy);
  const fields=document.querySelector('#tqEditor fieldset');if(fields) fields.disabled=s.busy;
}
function testQuestionTable(rows){
  const s=questionWorkspace();const pages=Math.max(1,Math.ceil(rows.length/s.pageSize));s.page=Math.max(1,Math.min(s.page,pages));
  const start=(s.page-1)*s.pageSize;const page=rows.slice(start,start+s.pageSize);
  const active=rows.filter(questionIsActive).length;
  const counts=Array(6).fill(0);for(const row of rows) if(Number.isInteger(row.correctIndex)&&row.correctIndex>=0&&row.correctIndex<6) counts[row.correctIndex]++;
  const summary=`<div class="question-summary"><span><b>${rows.length}</b> Treffer · ${active} aktiv · ${rows.length-active} inaktiv</span><span class="question-distribution">Richtige Antworten: ${counts.map((n,i)=>(i<4||n)?`${String.fromCharCode(65+i)}: ${n}`:'').filter(Boolean).join(' · ')}</span></div>`;
  if(!page.length) return summary+'<div class="admin-empty">Keine Testfragen für diese Auswahl. Suche oder Filter anpassen.</div>';
  return summary+`<div class="table-wrap admin-table-wrap question-table-wrap"><table class="admin-table question-table"><thead><tr><th scope="col">Unterweisung</th><th scope="col">Frage</th><th scope="col">Antworten</th><th scope="col">Status</th><th scope="col">Aktion</th></tr></thead><tbody>${page.map(row=>{
    const options=Array.isArray(row.options)?row.options:[];
    const correct=Number.isInteger(row.correctIndex)&&row.correctIndex>=0&&row.correctIndex<options.length?String.fromCharCode(65+row.correctIndex):'—';
    return `<tr class="${s.selectedId===row.id?'is-selected':''}"><td data-label="Unterweisung"><div class="admin-cell"><b>${esc(questionInstructionName(row))}</b><small class="muted">${esc(langLabel(row.language))}</small></div></td>
      <td data-label="Frage"><span class="question-preview">${esc(String(row.question||'').slice(0,220))}${String(row.question||'').length>220?'…':''}</span></td>
      <td data-label="Antworten"><div class="admin-cell"><span>${options.length} Antworten</span><small>Richtig: <b>${correct}</b></small></div></td>
      <td data-label="Status"><span class="badge ${questionIsActive(row)?'ok':'warn'}">${questionIsActive(row)?'Aktiv':'Inaktiv'}</span></td>
      <td data-label="Aktion"><div class="admin-actions"><button type="button" class="ghost small" data-question-action="open" data-id="${esc(row.id)}" ${s.busy?'disabled':''} aria-label="Frage öffnen: ${esc(String(row.question||'').slice(0,80))}">Öffnen</button></div></td></tr>`;
  }).join('')}</tbody></table></div><nav class="question-pagination" aria-label="Seiten der Testfragen"><span>${start+1}–${start+page.length} von ${rows.length} Fragen · Seite ${s.page} von ${pages}</span><div><button type="button" class="ghost small" data-question-action="previous" ${s.page===1?'disabled':''}>Zurück</button><button type="button" class="ghost small" data-question-action="next" ${s.page===pages?'disabled':''}>Weiter</button></div></nav>`;
}
function renderTestQuestionResults(){if($('tqResults')) $('tqResults').innerHTML=testQuestionTable(filteredTestQuestions());}
function testQuestionDetail(){
  const s=questionWorkspace();
  if(s.editor && canEditTestQuestions()) return testQuestionForm();
  const row=questionRows().find(q=>q.id===s.selectedId);
  if(!row) return '<div class="question-detail-empty muted">Öffne eine Frage, um den vollständigen Text und alle Antworten zu sehen.</div>';
  return `<article class="question-detail-panel" aria-labelledby="questionDetailHeading"><div class="admin-toolbar"><div><span class="instruction-section-kicker">Detailansicht</span><h3 id="questionDetailHeading">${esc(questionInstructionName(row))}</h3><p class="muted">${esc(langLabel(row.language))} · ${questionIsActive(row)?'Aktiv':'Inaktiv'}</p></div>${canEditTestQuestions()?`<div class="question-toolbar-actions"><button type="button" class="primary" data-question-action="edit" data-id="${esc(row.id)}" ${s.busy?'disabled':''}>Bearbeiten</button><button type="button" class="ghost" data-question-action="toggle" data-id="${esc(row.id)}" data-active="${questionIsActive(row)?'false':'true'}" ${s.busy?'disabled':''}>${questionIsActive(row)?'Deaktivieren':'Aktivieren'}</button></div>`:''}</div>
    <p class="question-full-text">${esc(row.question)}</p><ol class="question-options">${(row.options||[]).map((option,i)=>`<li class="${i===row.correctIndex?'is-correct':''}"><span class="question-option-letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span>${i===row.correctIndex?'<strong class="question-correct-label">Richtige Antwort</strong>':''}</li>`).join('')}</ol></article>`;
}
function renderTestQuestionDetail(){if($('tqDetail')) $('tqDetail').innerHTML=testQuestionDetail();}
function makeQuestionDraft(row){
  const s=questionWorkspace();
  return {id:row?.id||'',instructionTypeId:row?.instructionTypeId||s.type,language:row?.language||s.language||'de',question:row?.question||'',options:Array.from({length:6},(_,i)=>row?.options?.[i]||''),correctIndex:row?String(row.correctIndex):'',active:row?questionIsActive(row):true,dirty:false};
}
function testQuestionForm(){
  const s=questionWorkspace();const row=s.editor;if(!row || !canEditTestQuestions()) return '';
  return `<form id="tqEditor" class="question-detail-panel question-editor" aria-labelledby="questionEditorHeading"><h3 id="questionEditorHeading">${row.id?'Testfrage bearbeiten':'Neue Testfrage anlegen'}</h3><fieldset ${s.busy?'disabled':''}><legend class="question-sr-only">Frage und Antworten</legend><div class="question-editor-grid">
    <div class="field"><label for="tqType">Unterweisung *</label><select id="tqType" required><option value="">Bitte wählen</option>${questionTypeOptions(row.instructionTypeId)}</select></div>
    <div class="field"><label for="tqLang">Sprache</label><select id="tqLang">${['de','en','pl'].map(l=>`<option value="${l}" ${row.language===l?'selected':''}>${langLabel(l)}</option>`).join('')}</select></div>
    <div class="field full"><label for="tqQuestion">Frage *</label><textarea id="tqQuestion" rows="3" maxlength="2000" required>${esc(row.question)}</textarea></div>
    ${row.options.map((option,i)=>`<div class="field"><label for="tq${String.fromCharCode(65+i)}">Antwort ${String.fromCharCode(65+i)}${i<2?' *':' (optional)'}</label><textarea id="tq${String.fromCharCode(65+i)}" rows="2" maxlength="600" ${i<2?'required':''}>${esc(option)}</textarea></div>`).join('')}
    <div class="field"><label for="tqCorrect">Richtige Antwort *</label><select id="tqCorrect" required><option value="">Bitte auswählen</option>${row.options.map((_,i)=>`<option value="${i}" ${row.correctIndex===String(i)?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></div>
    <div class="field"><label for="tqActive">Status</label><select id="tqActive"><option value="1" ${row.active?'selected':''}>Aktiv</option><option value="0" ${!row.active?'selected':''}>Inaktiv</option></select></div>
    <div class="full question-toolbar-actions"><button type="button" class="primary" data-question-action="save">${row.id?'Änderungen speichern':'Testfrage speichern'}</button><button type="button" class="ghost" data-question-action="cancel">Abbrechen</button></div>
  </div></fieldset></form>`;
}
function captureQuestionDraft(){
  const s=questionWorkspace();const row=s.editor;if(!row || !$('tqQuestion')) return;
  row.instructionTypeId=$('tqType').value;row.language=$('tqLang').value;row.question=$('tqQuestion').value;
  row.options=Array.from({length:6},(_,i)=>$('tq'+String.fromCharCode(65+i)).value);
  row.correctIndex=$('tqCorrect').value;row.active=$('tqActive').value==='1';row.dirty=true;
}
function mayLeaveQuestionDraft(){
  const s=questionWorkspace();return !s.busy && (!s.editor?.dirty || confirm('Nicht gespeicherte Änderungen an der Testfrage verwerfen?'));
}
function openTestQuestion(id){
  const s=questionWorkspace();if(!mayLeaveQuestionDraft() || !questionRows().some(q=>q.id===id)) return;
  s.selectedId=id;s.editor=null;s.error='';renderTestQuestionResults();renderTestQuestionDetail();renderTestQuestionNotice();
  $('tqDetail')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function newTestQuestion(){
  if(!canEditTestQuestions() || !mayLeaveQuestionDraft()) return;
  const s=questionWorkspace();s.editor=makeQuestionDraft();s.error='';s.message='';renderTestQuestionDetail();renderTestQuestionNotice();$('tqQuestion')?.focus();
}
function editTestQuestion(id){
  if(!canEditTestQuestions() || !mayLeaveQuestionDraft()) return;
  const row=questionRows().find(q=>q.id===id);if(!row) return;
  const s=questionWorkspace();s.selectedId=id;s.editor=makeQuestionDraft(row);s.error='';s.message='';renderTestQuestionDetail();renderTestQuestionNotice();$('tqQuestion')?.focus();
}
function clearTestQuestionForm(){
  if(!mayLeaveQuestionDraft()) return;
  const s=questionWorkspace();s.editor=null;s.error='';renderTestQuestionDetail();renderTestQuestionNotice();
}
function readQuestionForm(){
  captureQuestionDraft();const row=questionWorkspace().editor;
  if(!row) throw new Error('Bitte eine Testfrage öffnen.');
  if(!row.instructionTypeId) throw new Error('Unterweisung fehlt.');
  if(!row.question.trim()) throw new Error('Frage fehlt.');
  const options=row.options.map(value=>value.trim());
  if(!options[0] || !options[1]) throw new Error('Antwort A und B sind erforderlich.');
  if(!/^[0-5]$/.test(row.correctIndex)) throw new Error('Bitte die richtige Antwort auswählen.');
  const selected=Number(row.correctIndex);
  if(!options[selected]) throw new Error('Die richtige Antwort darf nicht leer sein.');
  return {instructionTypeId:row.instructionTypeId,language:row.language,question:row.question.trim(),options:options.filter(Boolean),correctIndex:options.slice(0,selected).filter(Boolean).length,active:row.active};
}
async function persistTestQuestion(id,body,closeEditor=false){
  const s=questionWorkspace();if(!canEditTestQuestions() || s.busy) return;
  s.busy=true;s.error='';s.message='';renderTestQuestionNotice();renderTestQuestionResults();
  try{
    // Finish an older read before writing so its snapshot cannot overwrite the saved state.
    if(s.request) await s.request;
    if(s!==questionWorkspace()) return;
    const result=await api('/test-questions'+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(body)});
    // A different instruction action may have started another read during the write.
    // Drain that snapshot before applying the saved result and requesting fresh data.
    if(s.request) await s.request;
    if(s!==questionWorkspace()) return;
    const savedId=id||result.id;const old=questionRows().find(q=>q.id===savedId)||{};
    const saved={...old,...body,id:savedId,companyId:state.companyId};
    if(body.instructionTypeId) saved.instructionName=type(body.instructionTypeId)?.name;
    state.testQuestions=[saved,...questionRows().filter(q=>q.id!==savedId)];
    s.selectedId=savedId;if(closeEditor) s.editor=null;s.message='Testfrage gespeichert.';
    await loadTestQuestions(true);
  }catch(error){if(s===questionWorkspace()) s.error='Speichern fehlgeschlagen: '+String(error.message||error);}
  finally{
    s.busy=false;
    if(s===questionWorkspace()){renderTestQuestionResults();renderTestQuestionDetail();renderTestQuestionNotice();}
  }
}
async function saveNewTestQuestion(){
  const s=questionWorkspace();if(!canEditTestQuestions() || s.busy) return;
  try{const body=readQuestionForm();await persistTestQuestion(s.editor.id,body,true);}
  catch(error){s.error=String(error.message||error);renderTestQuestionNotice();}
}
async function updateTestQuestion(id,body){
  if(!questionRows().some(row=>row.id===id)) return;
  return persistTestQuestion(id,body);
}
async function toggleTestQuestion(id,active){return updateTestQuestion(id,{active});}
async function refreshTestQuestions(){if(questionWorkspace().busy) return;await loadTestQuestions(true);}
function bindTestQuestionWorkspace(){
  const root=$('testQuestionWorkspace');if(!root) return;
  root.oninput=event=>{
    if(event.target.dataset.questionFilter==='search'){
      const s=questionWorkspace();s.search=event.target.value;s.page=1;renderTestQuestionResults();
    }else if(event.target.closest('#tqEditor')) captureQuestionDraft();
  };
  root.onchange=event=>{
    const key=event.target.dataset.questionFilter;
    if(['type','language','status'].includes(key)){const s=questionWorkspace();s[key]=event.target.value;s.page=1;renderTestQuestionResults();}
    else if(event.target.closest('#tqEditor')) captureQuestionDraft();
  };
  root.onsubmit=event=>{event.preventDefault();saveNewTestQuestion();};
  root.onclick=event=>{
    const button=event.target.closest('[data-question-action]');if(!button || !root.contains(button) || button.disabled) return;
    const s=questionWorkspace();const action=button.dataset.questionAction;const id=button.dataset.id;
    if(action==='previous'||action==='next'){s.page+=action==='next'?1:-1;renderTestQuestionResults();return;}
    if(action==='reset'){
      s.search='';s.type='';s.language='';s.status='';s.page=1;
      ['tqSearch','tqTypeFilter','tqLangFilter','tqStatusFilter'].forEach(id=>{$(id).value='';});renderTestQuestionResults();return;
    }
    if(action==='refresh'){refreshTestQuestions();return;}
    if(action==='open'){openTestQuestion(id);return;}
    if(!canEditTestQuestions() || s.busy) return;
    if(action==='new') newTestQuestion();
    else if(action==='edit') editTestQuestion(id);
    else if(action==='cancel') clearTestQuestionForm();
    else if(action==='save') saveNewTestQuestion();
    else if(action==='toggle') toggleTestQuestion(id,button.dataset.active==='true');
  };
}
