// Document analysis owns only its panel; polling never rebuilds the upload form.
let instructionAnalysesState={companyId:null,rows:[],selected:null,detail:null,loaded:false,loading:false,detailRequest:0,detailLoading:false,busy:false,timer:null,error:''};
function resetInstructionAnalyses(selected=null){
  clearTimeout(instructionAnalysesState.timer);
  instructionAnalysesState={companyId:state.companyId,rows:[],selected,detail:null,loaded:false,loading:false,detailRequest:0,detailLoading:false,busy:false,timer:null,error:''};
}
function isCurrentInstructionAnalysis(s){return s===instructionAnalysesState && s.companyId===state.companyId;}
function analysisStatus(status){return ({queued:'Wartet auf Verarbeitung',starting:'Analyse wird gestartet',processing:'Unterlage wird gelesen',configuration_required:'Analysedienst einrichten',failed:'Analyse fehlgeschlagen',ready:'Entwurf prüfen',published:'Freigegeben'})[status]||status;}
function instructionAnalysisCard(){
  return '<div class="card span-12 admin-workspace analysis-workspace"><div class="toolbar"><div><h2>Unterlage → Unterweisung → Test</h2><p class="muted">Entwürfe, Quellen und Sicherheitsabdeckung prüfen.</p></div><button type="button" data-analysis-action="refresh">Aktualisieren</button></div><div id="instructionAnalysisContent" aria-live="polite"><p class="muted">Analysen werden geladen …</p></div></div>';
}
function analysisEvidence(evidence){return (evidence||[]).map(ref=>`<blockquote><span class="muted">Seite ${esc(ref.page)}</span><br>${esc(ref.quote)}</blockquote>`).join('');}
function renderInstructionAnalyses(){
  const target=$('instructionAnalysisContent');if(!target) return;
  const s=instructionAnalysesState;
  if(!isCurrentInstructionAnalysis(s)) return;
  const list=s.rows.map(row=>`<button type="button" class="analysis-job ${s.selected===row.id?'selected':''}" data-analysis-action="open" data-analysis-id="${esc(row.id)}" aria-pressed="${s.selected===row.id}"><strong>${esc(row.title)}</strong><span>${esc(analysisStatus(row.status))} · ${esc(row.language.toUpperCase())}</span></button>`).join('');
  const row=s.detail;
  let detail=`<div class="analysis-empty">${s.detailLoading?'Dokument wird geladen …':'Unterlage hochladen oder einen Entwurf auswählen.'}</div>`;
  if(row){
    const result=row.result,data=result?.data;
    detail=`<div class="analysis-detail"><div class="toolbar"><div><h3>${esc(row.title)}</h3><p class="muted">${esc(row.fileName)} · ${esc(analysisStatus(row.status))}</p></div><button type="button" data-analysis-action="source" data-template-id="${esc(row.templateId)}">Original öffnen</button></div>`;
    if(row.status==='configuration_required') detail+='<div class="notice warning">Die automatische Dokumentanalyse ist noch nicht eingerichtet. Die Unterlage ist gespeichert. Ein Administrator muss den Analysedienst verbinden; danach kann dieser Auftrag gestartet werden.</div>';
    if(['queued','starting','processing'].includes(row.status)) detail+='<p class="notice">Seiten, Tabellen und Abbildungen werden ausgewertet. Du kannst diesen Bereich verlassen und später wieder öffnen.</p>';
    if(row.errorMessage) detail+=`<p class="notice dangerbox">${esc(row.errorMessage)}</p>`;
    if(['queued','configuration_required','failed'].includes(row.status) && row.pageCount) detail+=`<button type="button" class="primary" data-analysis-action="start" data-analysis-id="${esc(row.id)}" ${s.busy?'disabled':''}>Analyse ${row.status==='failed'?'erneut starten':'starten'}</button>`;
    if(data){
      const c=result.coverage;
      detail+=`<div class="analysis-metrics"><div><strong>${c.pagesRead} / ${c.pageCount}</strong><span>Seiten gelesen</span></div><div><strong>${c.covered} / ${c.aspects}</strong><span>Aspekte belegt</span></div><div><strong>${c.questions}</strong><span>Testfragen</span></div></div><p><b>Thema:</b> ${esc(data.topic)}<br><b>Gerät / Bezug:</b> ${esc(data.device||'Nicht angegeben')}</p>`;
      detail+=result.blockers.length?`<div class="notice warning"><b>Vor der Freigabe ergänzen</b><ul>${result.blockers.map(text=>`<li>${esc(text)}</li>`).join('')}</ul><p>Ergänze die Quelldatei und lade die vollständige Fassung für dieselbe Unterweisung hoch.</p></div>`:'<div class="notice">Alle vom Entwurf als relevant bewerteten Aspekte sind mit Text, Fundstellen und Fragen verknüpft. Bitte auch prüfen, ob weitere Gefahren oder betriebliche Regeln fehlen.</div>';
      detail+=`<details open><summary>Sicherheitsabdeckung und Fundstellen</summary><div class="analysis-aspects">${data.aspects.map(a=>`<article><div><strong>${esc(a.label)}</strong><span class="badge ${a.status==='covered'?'ok':'warn'}">${esc(({covered:'Belegt',missing:'Fehlt',unclear:'Unklar',not_applicable:'Nicht anwendbar'})[a.status])}</span></div><p>${esc(a.explanation)}</p>${analysisEvidence(a.evidence)}</article>`).join('')}</div></details>`;
      detail+=`<details><summary>Umgewandelter Unterweisungstext</summary>${data.sections.map(section=>`<section class="analysis-section"><h4>${esc(section.title)}</h4><p>${esc(section.body)}</p><small>Quelle: Seite ${section.sourcePages.map(esc).join(', ')}</small></section>`).join('')}</details>`;
      detail+=`<details><summary>Test mit ${data.questions.length} Fragen prüfen</summary><ol class="analysis-questions">${data.questions.map(q=>`<li><h4>${esc(q.question)}</h4><ol type="A">${q.options.map((o,i)=>`<li class="${i===q.correctIndex?'correct':''}">${esc(o)}${i===q.correctIndex?' — richtig':''}</li>`).join('')}</ol><p>${esc(q.explanation)}</p>${analysisEvidence(q.evidence)}</li>`).join('')}</ol></details>`;
      if(row.status==='ready') detail+=`<div class="analysis-release"><label><input type="checkbox" id="analysisReviewConfirmed" data-analysis-id="${esc(row.id)}" ${!result.publishable||s.busy?'disabled':''}> Ich habe Original, Gerätebezug, Einsatzbedingungen, nicht anwendbare Aspekte, mögliche weitere Gefahren und Testfragen fachlich geprüft.</label><button type="button" class="primary" data-analysis-action="publish" data-analysis-id="${esc(row.id)}" ${!result.publishable||s.busy?'disabled':''}>Unterweisung und Test freigeben</button><p class="muted">Die Freigabe aktiviert den Entwurf und verknüpft Unterlage, Text und Testfragen.</p></div>`;
    }
    detail+='</div>';
  }
  target.innerHTML=`${s.error?`<p class="notice dangerbox">${esc(s.error)}</p>`:''}<div class="analysis-layout"><nav class="analysis-jobs" aria-label="Analyseaufträge">${list||'<p class="muted">Noch keine Analysen.</p>'}</nav>${detail}</div>`;
  document.querySelectorAll('#instructions [data-analysis-action]').forEach(button=>button.onclick=()=>handleInstructionAnalysisAction(button));
  document.querySelectorAll('#instructions [data-analysis-action="open"], #instructions [data-analysis-action="refresh"]').forEach(button=>button.disabled=s.busy);
}
async function loadInstructionAnalyses(force=false){
  if(instructionAnalysesState.companyId!==state.companyId) resetInstructionAnalyses();
  const s=instructionAnalysesState;
  if(!state.apiAvailable){s.error='Analysen sind mit verbundener API verfügbar.';renderInstructionAnalyses();return;}
  if(s.loading || s.busy) return;
  if(s.loaded&&!force){renderInstructionAnalyses();scheduleInstructionAnalysisPoll();return;}
  s.loading=true;
  try{
    const response=await api('/instruction-analyses');if(!isCurrentInstructionAnalysis(s)) return;
    s.rows=response.analyses;s.loaded=true;s.error='';
    if(s.selected){await openInstructionAnalysis(s.selected);}
    else renderInstructionAnalyses();
  }catch(error){if(isCurrentInstructionAnalysis(s)){s.error=String(error.message||error);renderInstructionAnalyses();}}
  finally{s.loading=false;}
}
function scheduleInstructionAnalysisPoll(){
  const s=instructionAnalysesState;clearTimeout(s.timer);
  if(!isCurrentInstructionAnalysis(s) || s.busy || s.detailLoading || !s.detail || !['starting','processing'].includes(s.detail.status)) return;
  s.timer=setTimeout(()=>{if(isCurrentInstructionAnalysis(s) && $('instructionAnalysisContent') && $('instructions')?.classList.contains('active')) openInstructionAnalysis(s.selected);},6000);
}
async function openInstructionAnalysis(id,autoStart=false){
  const s=instructionAnalysesState;
  if(!isCurrentInstructionAnalysis(s) || s.busy || !id) return;
  clearTimeout(s.timer);
  const request=++s.detailRequest;
  const current=()=>isCurrentInstructionAnalysis(s) && s.selected===id && s.detailRequest===request;
  const previous=s.selected===id?s.detail:null;
  // Never leave a previous document's review confirmation attached to a new selection.
  s.selected=id;s.detail=null;s.detailLoading=true;s.error='';renderInstructionAnalyses();
  try{
    let row=await api('/instruction-analyses/'+encodeURIComponent(id));
    if(!current()) return;
    if((autoStart||row.status==='queued') && ['queued','configuration_required'].includes(row.status)){
      s.busy=true;renderInstructionAnalyses();
      row=await api('/instruction-analyses/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'start'})});
    }
    if(!current()) return;
    s.detail=row;s.rows=[row,...s.rows.filter(x=>x.id!==id)];s.error='';
  }catch(error){
    if(current()){
      s.error=String(error.message||error);
      // Keep retrying a processing job after a transient read failure, without restoring a review.
      if(previous && ['starting','processing'].includes(previous.status)) s.detail=previous;
    }
  }
  finally{
    if(current()){s.detailLoading=false;s.busy=false;renderInstructionAnalyses();scheduleInstructionAnalysisPoll();}
  }
}
async function handleInstructionAnalysisAction(button){
  const s=instructionAnalysesState,action=button.dataset.analysisAction;
  if(!isCurrentInstructionAnalysis(s) || !button.isConnected || button.disabled || s.busy) return;
  if(action==='refresh') {await loadInstructionAnalyses(true);return;}
  if(action==='open') return openInstructionAnalysis(button.dataset.analysisId);
  if(action==='source') return openTemplate(button.dataset.templateId);
  const id=button.dataset.analysisId;
  if(s.detailLoading || !id || s.selected!==id || s.detail?.id!==id || !['publish','start'].includes(action)) return;
  const review=$('analysisReviewConfirmed');
  const reviewConfirmed=review?.dataset.analysisId===id && review.checked===true;
  if(action==='publish' && (s.detail.status!=='ready' || !s.detail.result?.publishable)) return;
  if(action==='publish'&&!reviewConfirmed){s.error='Bitte zuerst die fachliche Prüfung bestätigen.';renderInstructionAnalyses();return;}
  s.busy=true;clearTimeout(s.timer);renderInstructionAnalyses();
  const current=()=>isCurrentInstructionAnalysis(s) && s.selected===id;
  try{
    const row=await api('/instruction-analyses/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action,reviewConfirmed})});
    if(!current()) return;
    s.detail=row;s.rows=[row,...s.rows.filter(x=>x.id!==row.id)];s.error='';
    if(action==='publish') await refreshInstructionWorkspaceData(s.companyId);
  }catch(error){if(current()) s.error=(s.detail?.status==='published'?'Freigegeben, aber die Übersicht konnte nicht aktualisiert werden: ':'')+String(error.message||error);}
  finally{s.busy=false;if(current()){renderInstructionAnalyses();scheduleInstructionAnalysisPoll();}}
}

function bindInstructionManagementActions(){
  const actions={clearInstructionWorkspaceFilters,prepareInstructionTypeEdit,toggleInstructionType,selectInstructionWorkspaceItem,saveInstructionType,clearInstructionTypeForm,
    newInstruction:prepareNewInstructionType};
  document.querySelectorAll('#instructions [data-instruction-action]').forEach(button=>{
    button.onclick=()=>actions[button.dataset.instructionAction]?.(button.dataset.instructionId,button.dataset.active==='true');
  });
}
