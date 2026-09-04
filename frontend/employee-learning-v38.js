// RC991: fokussierter Mitarbeiter-Lernablauf auf Basis des gemeinsamen Präsentationskerns.
(function(){
  const portalState={training:null,stepIndex:0,imageUrls:new Map(),result:null};
  const renderer=globalThis.UMLearningExperience;

  function learningEsc(value=''){return renderer?.escapeHtml?renderer.escapeHtml(value):String(value??'');}
  function learningModal(){return document.getElementById('portalLearningBackdrop');}
  function resetEmployeeLearningState(){
    learningModal()?.remove();
    document.querySelectorAll('.learning-image-modal').forEach(node=>node.remove());
    portalState.training=null;
    portalState.stepIndex=0;
    portalState.imageUrls.clear();
    portalState.result=null;
  }
  function progressPercent(){
    const data=portalState.training;if(!data)return 0;
    const total=Math.max(1,(data.steps?.length||0)+1);
    return Math.min(100,Math.round((portalState.stepIndex/total)*100));
  }
  function instructionView(data){
    return {
      learningGoal:data.learningGoal||'',
      learningIntro:data.learningIntro||'',
      keyPoints:Array.isArray(data.keyPoints)?data.keyPoints:[],
      description:data.description||''
    };
  }
  function stepView(step){
    return {
      ...step,
      imageCaption:step.imageCaption||'',
      calloutTitle:step.calloutTitle||'',
      calloutText:step.calloutText||'',
      imageUrl:step.imageFileId&&portalState.imageUrls.has(step.imageFileId)?(portalState.imageUrls.get(step.imageFileId)||''):''
    };
  }
  function modalShell(data,content,actions=''){
    const label=portalState.stepIndex>0?'Fortsetzen':'Starten';
    return `<div id="portalLearningBackdrop" class="learning-modal-backdrop"><div class="learning-modal um-learning-modal" role="dialog" aria-modal="true" aria-label="${learningEsc(data.instructionName)}"><div class="learning-modal-head"><div><span class="portal-badge">${label}</span><h2>${learningEsc(data.instructionName)}</h2><p class="muted">Online-Unterweisung</p></div><button class="ghost" onclick="portalCloseLearning()">Schließen</button></div><div class="learning-progress" aria-label="Fortschritt"><span style="width:${progressPercent()}%"></span></div>${content}${actions}</div></div>`;
  }

  async function portalStartInstruction(typeId){
    try{
      const data=await api('/employee-training/'+encodeURIComponent(typeId)+'?language=de');
      if(data.requiresPlanning){window.portalRequestAppointment?.(typeId);return;}
      portalState.training=data;
      portalState.result=null;
      portalState.stepIndex=Math.max(0,Math.min(Number(data.currentStep||0),data.steps?.length||0));
      portalRenderTraining();
    }catch(error){alert('Unterweisung konnte nicht geöffnet werden: '+(error.message||error));}
  }

  function portalRenderTraining(){
    const data=portalState.training;if(!data||!renderer)return;
    learningModal()?.remove();
    const steps=data.steps||[];
    const index=portalState.stepIndex;
    const step=steps[index];
    if(portalState.result){portalRenderResult(portalState.result);return;}
    let content='';
    let actions='';
    if(step){
      content=renderer.renderLearningStep({instruction:instructionView(data),step:stepView(step),index,total:steps.length});
      if(step.imageFileId&&!portalState.imageUrls.has(step.imageFileId)){
        content+=`<div class="um-learning-image-loading" id="learningImageLoading">Lernabbildung wird geladen …</div>`;
      }
      actions=`<div class="learning-actions"><div class="learning-actions-group">${data.templateId?`<button class="ghost" onclick="portalOpenOriginal('${learningEsc(data.templateId)}')">Originalunterlage herunterladen</button>`:''}</div><div class="learning-actions-group"><button class="ghost" ${index===0?'disabled':''} onclick="portalLearningPrev()">Zurück</button><button class="primary" onclick="portalLearningNext()">${index===steps.length-1?'Zum Abschluss':'Weiter'}</button></div></div>`;
    }else if(data.testRequired){
      content=renderer.renderQuestionList({questions:data.questions||[],passPercent:data.passPercent||80,namePrefix:'portalQuestion'});
      actions=`<div class="learning-actions"><div class="learning-actions-group"><button class="ghost" onclick="portalLearningPrev()">Zurück zu den Lerninhalten</button></div><div class="learning-actions-group"><button class="primary" onclick="portalSubmitTraining()">Test abschließen</button></div></div>`;
    }else{
      content=`<section class="um-test-stage"><header class="um-test-head"><span>Abschluss</span><h3>Unterweisung abschließen</h3><p>Du hast alle Lernschritte durchlaufen. Bestätige jetzt den Abschluss.</p></header></section>`;
      actions=`<div class="learning-actions"><div class="learning-actions-group"><button class="ghost" onclick="portalLearningPrev()">Zurück zu den Lerninhalten</button></div><div class="learning-actions-group"><button class="primary" onclick="portalSubmitTraining()">Unterweisung abschließen</button></div></div>`;
    }
    document.body.insertAdjacentHTML('beforeend',modalShell(data,content,actions));
    document.querySelector('.um-learning-image')?.addEventListener('click',portalZoomLearningImage);
    if(step?.imageFileId&&!portalState.imageUrls.has(step.imageFileId))portalLoadLearningImage(step.imageFileId);
  }

  async function portalLoadLearningImage(fileId){
    try{
      const file=await api('/files/'+encodeURIComponent(fileId)+'/download');
      portalState.imageUrls.set(fileId,file.url||'');
    }catch{
      portalState.imageUrls.set(fileId,null);
    }
    const current=(portalState.training?.steps||[])[portalState.stepIndex];
    if(current?.imageFileId===fileId)portalRenderTraining();
  }

  function portalZoomLearningImage(){
    const src=document.querySelector('#portalLearningBackdrop .um-learning-image')?.src;if(!src)return;
    document.body.insertAdjacentHTML('beforeend',`<div class="learning-image-modal" role="dialog" aria-modal="true" aria-label="Lernabbildung vergrößert" onclick="this.remove()"><img src="${learningEsc(src)}" alt="Vergrößerte Lernabbildung"></div>`);
  }

  async function portalLearningNext(){
    const data=portalState.training;if(!data)return;
    const total=data.steps?.length||0;
    portalState.stepIndex=Math.min(total,portalState.stepIndex+1);
    try{
      await api('/employee-training/'+encodeURIComponent(data.instructionTypeId),{method:'POST',body:JSON.stringify({attemptId:data.attemptId,currentStep:portalState.stepIndex})});
    }catch(error){
      portalState.stepIndex=Math.max(0,portalState.stepIndex-1);
      alert('Lernfortschritt konnte nicht gespeichert werden: '+(error.message||error));
    }
    portalRenderTraining();
  }

  function portalLearningPrev(){
    portalState.stepIndex=Math.max(0,portalState.stepIndex-1);
    portalRenderTraining();
  }

  function collectAnswers(data){
    return (data.questions||[]).map(q=>{
      const chosen=document.querySelector(`input[name="portalQuestion_${CSS.escape(String(q.id))}"]:checked`);
      return {questionId:q.id,answerIndex:chosen?Number(chosen.value):null};
    });
  }

  async function portalSubmitTraining(){
    const data=portalState.training;if(!data)return;
    const answers=collectAnswers(data);
    if(data.testRequired&&answers.some(a=>a.answerIndex===null)){alert('Bitte beantworte alle Fragen.');return;}
    try{
      const result=await api('/employee-training/'+encodeURIComponent(data.instructionTypeId),{method:'POST',body:JSON.stringify({attemptId:data.attemptId,confirmed:true,answers})});
      portalState.result=result;
      portalRenderResult(result);
    }catch(error){alert('Abschluss fehlgeschlagen: '+(error.message||error));}
  }

  function portalRenderResult(result){
    const data=portalState.training;if(!data||!renderer)return;
    learningModal()?.remove();
    const passed=result.passed!==false;
    const certificateAction=result.certificateFileId?`<button class="primary" onclick="portalDownloadProof('${learningEsc(result.certificateFileId)}')">Nachweis öffnen</button>`:'';
    const content=renderer.renderResult({passed,scorePercent:data.testRequired?(result.scorePercent??0):null,passPercent:data.passPercent||80,validUntil:result.validUntil?new Date(result.validUntil).toLocaleDateString('de-DE'):'',certificateActionHtml:certificateAction});
    const actions=passed
      ? `<div class="learning-actions"><div></div><div class="learning-actions-group"><button class="primary" onclick="portalFinishLearning()">Zur Übersicht</button></div></div>`
      : `<div class="learning-actions"><div></div><div class="learning-actions-group"><button class="ghost" onclick="portalRestartLearning()">Lerninhalte erneut ansehen</button><button class="primary" onclick="portalRestartLearning()">Unterweisung wiederholen</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend',modalShell(data,content,actions));
  }

  async function portalRestartLearning(){
    const typeId=portalState.training?.instructionTypeId;
    portalCloseLearning();
    if(typeId)await portalStartInstruction(typeId);
  }

  async function portalFinishLearning(){
    portalCloseLearning();
    try{await loadData();}catch{}
    setView('dashboard');
  }

  function portalCloseLearning(){
    learningModal()?.remove();
    portalState.training=null;
    portalState.result=null;
    portalState.stepIndex=0;
  }

  async function portalOpenOriginal(templateId){
    try{const result=await api('/templates/'+encodeURIComponent(templateId)+'/download');window.open(result.url,'_blank','noopener');}
    catch(error){alert('Originalunterlage konnte nicht geöffnet werden: '+(error.message||error));}
  }

  window.resetEmployeeLearningState=resetEmployeeLearningState;
  Object.assign(window,{portalStartInstruction,portalRenderTraining,portalLearningNext,portalLearningPrev,portalSubmitTraining,portalRenderResult,portalRestartLearning,portalFinishLearning,portalCloseLearning,portalOpenOriginal,portalZoomLearningImage});
})();