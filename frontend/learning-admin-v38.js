// RC991: Rich-Content-Editor für Systemadmin, Firmenadmin und HSE.
(function(){
  const EDIT_ROLES=new Set(['system_admin','company_admin','hse']);
  const adminState={steps:new Map(),editingStepId:null,previewImageUrl:''};
  const renderer=globalThis.UMLearningExperience;

  function canEditRichLearning(){return (state.me?.roles||[]).some(role=>EDIT_ROLES.has(role));}
  function selectedTypeId(){if(typeof instructionWorkspaceState!=='undefined'&&instructionWorkspaceState?.selectedId)return instructionWorkspaceState.selectedId;return window.instructionWorkspaceState?.selectedId||'';}
  function currentType(typeId){return typeof type==='function'?type(typeId):((state.data?.types||[]).find(t=>String(t.id)===String(typeId))||{});}
  function keyPointsFromInput(){return String(document.getElementById('v38KeyPoints')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
  function text(id){return document.getElementById(id)?.value?.trim()||'';}
  function escV(value=''){return renderer?.escapeHtml?renderer.escapeHtml(value):String(value??'');}

  function richLearningPanel(typeId){
    const t=currentType(typeId);const points=Array.isArray(t.keyPoints)?t.keyPoints:[];
    return `<div class="learning-admin v38-learning-admin"><div class="employee-bucket-head"><div><h3>Professionelle Online-Unterweisung</h3><p class="muted">Lernziel, Einleitung, Merkpunkte, Bildhinweise und Praxis-Callouts werden in derselben Darstellung gepflegt, die Mitarbeitende später sehen.</p></div></div>
      <div class="learning-admin-grid">
        <div class="field"><label for="v38DeliveryMode">Durchführung</label><select id="v38DeliveryMode"><option value="practical" ${t.deliveryMode!=='online'?'selected':''}>Praktisch</option><option value="online" ${t.deliveryMode==='online'?'selected':''}>Online</option></select></div>
        <div class="field"><label><input id="v38TestRequired" type="checkbox" ${t.testRequired?'checked':''}> Abschlusstest erforderlich</label></div>
        <div class="field"><label for="v38PassPercent">Bestehen ab %</label><input id="v38PassPercent" type="number" min="1" max="100" value="${Number(t.passPercent||80)}"></div>
        <div class="field full"><label for="v38LearningGoal">Lernziel</label><textarea id="v38LearningGoal" placeholder="Was soll der Mitarbeitende nach der Unterweisung sicher können?">${escV(t.learningGoal||'')}</textarea></div>
        <div class="field full"><label for="v38LearningIntro">Einleitung</label><textarea id="v38LearningIntro" placeholder="Kurze professionelle Einführung in Thema und Relevanz.">${escV(t.learningIntro||'')}</textarea></div>
        <div class="field full"><label for="v38KeyPoints">Wichtige Merkpunkte</label><textarea id="v38KeyPoints" placeholder="Ein Merkpunkt pro Zeile">${escV(points.join('\n'))}</textarea></div>
        <div class="field full admin-form-actions"><button class="primary small" onclick="v38SaveInstructionContent('${escV(typeId)}')">Einstellungen & Inhalte speichern</button></div>
      </div>
      <hr>
      <div class="employee-bucket-head"><div><h3>Lernschritt ${adminState.editingStepId?'bearbeiten':'anlegen'}</h3><p class="muted">Bilder werden als Lernbühne dargestellt; Bildunterschrift und Hinweisfelder erklären den konkreten Praxisbezug.</p></div></div>
      <input type="hidden" id="v38StepId" value="${escV(adminState.editingStepId||'')}">
      <div class="learning-admin-grid">
        <div class="field"><label for="v38StepOrder">Reihenfolge</label><input id="v38StepOrder" type="number" min="0" value="10"></div>
        <div class="field"><label for="v38StepTitle">Titel</label><input id="v38StepTitle" placeholder="z. B. Mängel erkennen und melden"></div>
        <div class="field"><label for="v38StepImage">Bild</label><input id="v38StepImage" type="file" accept="image/jpeg,image/png,image/webp"></div>
        <div class="field full"><label for="v38StepBody">Erklärung</label><textarea id="v38StepBody" placeholder="Klar beschreiben, was zu tun ist und warum."></textarea></div>
        <div class="field full"><label for="v38ImageCaption">Praxisbezug / Bildunterschrift</label><textarea id="v38ImageCaption" placeholder="Was zeigt die Abbildung und worauf ist dabei zu achten?"></textarea></div>
        <div class="field"><label for="v38CalloutTitle">Hinweis-Titel</label><input id="v38CalloutTitle" placeholder="Praxischeck, Merksatz oder Wichtig"></div>
        <div class="field full"><label for="v38CalloutText">Hinweis-Text</label><textarea id="v38CalloutText" placeholder="Kurze hervorgehobene Handlungsregel."></textarea></div>
        <div class="field full admin-form-actions"><button class="ghost small" onclick="v38PreviewLearningStep('${escV(typeId)}')">Vorschau aktualisieren</button><button class="primary small" onclick="v38SaveLearningStep('${escV(typeId)}')">${adminState.editingStepId?'Änderungen speichern':'Als Entwurf speichern'}</button><button class="ghost small" onclick="v38ClearLearningStep('${escV(typeId)}')">Formular leeren</button></div>
      </div>
      <div id="v38LearningPreview" class="learning-admin-preview"><p class="muted">Vorschau: Felder ausfüllen und „Vorschau aktualisieren“ wählen.</p></div>
      <div id="v38LearningStepList" data-type-id="${escV(typeId)}"><p class="muted">Lernschritte werden geladen …</p></div>
    </div>`;
  }

  async function v38SaveInstructionContent(typeId){
    if(!canEditRichLearning())return;
    const body={deliveryMode:document.getElementById('v38DeliveryMode')?.value||'practical',testRequired:!!document.getElementById('v38TestRequired')?.checked,passPercent:Math.max(1,Math.min(100,Number(document.getElementById('v38PassPercent')?.value||80))),learningGoal:text('v38LearningGoal'),learningIntro:text('v38LearningIntro'),keyPoints:keyPointsFromInput()};
    try{await api('/instruction-types/'+encodeURIComponent(typeId),{method:'PATCH',body:JSON.stringify(body)});alert('Unterweisungsinhalte gespeichert.');await loadData();setView('instructions');}
    catch(error){alert('Inhalte konnten nicht gespeichert werden: '+String(error.message||error));}
  }

  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);});}
  function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',').pop());reader.onerror=reject;reader.readAsDataURL(file);});}
  async function v38PreviewLearningStep(typeId){
    const file=document.getElementById('v38StepImage')?.files?.[0];if(file)adminState.previewImageUrl=await fileToDataUrl(file);
    const t={...currentType(typeId),learningGoal:text('v38LearningGoal'),learningIntro:text('v38LearningIntro'),keyPoints:keyPointsFromInput()};
    const step={title:text('v38StepTitle')||'Lernschritt',body:text('v38StepBody'),imageUrl:adminState.previewImageUrl,imageCaption:text('v38ImageCaption'),calloutTitle:text('v38CalloutTitle'),calloutText:text('v38CalloutText')};
    const target=document.getElementById('v38LearningPreview');if(target)target.innerHTML=renderer.renderLearningStep({instruction:t,step,index:0,total:1});
  }

  async function v38SaveLearningStep(typeId){
    if(!canEditRichLearning())return;const title=text('v38StepTitle');if(!title){alert('Titel fehlt.');return;}
    try{
      let imageFileId;const file=document.getElementById('v38StepImage')?.files?.[0];if(file){const upload=await api('/learning-steps/image',{method:'POST',body:JSON.stringify({fileName:file.name,contentType:file.type,base64:await fileToBase64(file)})});imageFileId=upload.id;}
      const body={instructionTypeId:typeId,language:'de',sortOrder:Number(document.getElementById('v38StepOrder')?.value||10),title,body:text('v38StepBody'),imageCaption:text('v38ImageCaption'),calloutTitle:text('v38CalloutTitle'),calloutText:text('v38CalloutText')};if(imageFileId!==undefined)body.imageFileId=imageFileId;
      const stepId=text('v38StepId');if(stepId)await api('/learning-steps/'+encodeURIComponent(stepId),{method:'PATCH',body:JSON.stringify(body)});else await api('/learning-steps',{method:'POST',body:JSON.stringify(body)});
      v38ClearLearningStep(typeId);await v38LoadLearningSteps(typeId,true);
    }catch(error){alert('Lernschritt konnte nicht gespeichert werden: '+String(error.message||error));}
  }

  function v38ClearLearningStep(typeId){adminState.editingStepId=null;adminState.previewImageUrl='';for(const id of ['v38StepId','v38StepTitle','v38StepBody','v38ImageCaption','v38CalloutTitle','v38CalloutText']){const el=document.getElementById(id);if(el)el.value='';}if(document.getElementById('v38StepOrder'))document.getElementById('v38StepOrder').value='10';if(document.getElementById('v38StepImage'))document.getElementById('v38StepImage').value='';const preview=document.getElementById('v38LearningPreview');if(preview)preview.innerHTML='<p class="muted">Vorschau: Felder ausfüllen und „Vorschau aktualisieren“ wählen.</p>';}

  async function v38LoadLearningSteps(typeId,force=false){
    const target=document.getElementById('v38LearningStepList');if(!target||String(target.dataset.typeId)!==String(typeId))return;
    try{let rows=adminState.steps.get(typeId);if(force||!rows){rows=await api('/learning-steps?instructionTypeId='+encodeURIComponent(typeId)+'&language=de');adminState.steps.set(typeId,rows);}target.innerHTML=rows.length?`<div class="learning-admin-list">${rows.map(step=>`<div class="learning-admin-row"><strong>${Number(step.sortOrder||0)}</strong><div><b>${escV(step.title)}</b><small>${escV((step.body||'').slice(0,150))}${(step.body||'').length>150?'…':''}</small><small>${step.imageCaption?`Praxisbezug: ${escV(step.imageCaption)}`:'Kein Praxisbezug hinterlegt'}</small></div><div class="admin-actions"><button class="small" onclick="v38EditLearningStep('${escV(typeId)}','${escV(step.id)}')">Bearbeiten</button><button class="small ${step.status==='published'?'ghost':'primary'}" onclick="v38ToggleLearningStep('${escV(typeId)}','${escV(step.id)}','${step.status==='published'?'draft':'published'}')">${step.status==='published'?'Freigabe zurücknehmen':'Fachlich freigeben'}</button></div></div>`).join('')}</div>`:'<p class="muted">Noch keine Lernschritte angelegt.</p>';}
    catch(error){target.innerHTML=`<div class="notice warning">${escV(error.message||error)}</div>`;}
  }
  function v38EditLearningStep(typeId,id){const row=(adminState.steps.get(typeId)||[]).find(x=>String(x.id)===String(id));if(!row)return;adminState.editingStepId=id;document.getElementById('v38StepId').value=id;document.getElementById('v38StepOrder').value=Number(row.sortOrder||10);document.getElementById('v38StepTitle').value=row.title||'';document.getElementById('v38StepBody').value=row.body||'';document.getElementById('v38ImageCaption').value=row.imageCaption||'';document.getElementById('v38CalloutTitle').value=row.calloutTitle||'';document.getElementById('v38CalloutText').value=row.calloutText||'';v38PreviewLearningStep(typeId);document.getElementById('v38StepTitle')?.scrollIntoView({behavior:'smooth',block:'center'});}
  async function v38ToggleLearningStep(typeId,id,status){try{await api('/learning-steps/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})});adminState.steps.delete(typeId);await v38LoadLearningSteps(typeId,true);}catch(error){alert('Freigabe konnte nicht geändert werden: '+String(error.message||error));}}

  async function v38PreviewStep(step){
    const view={...step,imageUrl:''};
    if(!step.imageFileId)return view;
    try{
      const file=await api('/files/'+encodeURIComponent(step.imageFileId)+'/download');
      view.imageUrl=file.url||'';
    }catch(error){
      view.imageError=String(error.message||error||'Bild konnte nicht geladen werden.');
    }
    return view;
  }

  async function v38OpenPreviewOriginal(templateId){
    if(!templateId)return;
    try{
      const file=await api('/templates/'+encodeURIComponent(templateId)+'/download');
      window.open(file.url,'_blank','noopener');
    }catch(error){
      alert('Originalunterlage konnte nicht geöffnet werden: '+String(error.message||error));
    }
  }

  function v38BindInstructionPreviewActions(){
    const root=document.getElementById('v38InstructionPreviewBackdrop');
    root?.querySelectorAll('[data-v38-preview-action]').forEach(button=>{
      button.onclick=()=>{
        if(button.dataset.v38PreviewAction==='close')return v38CloseInstructionPreview();
        if(button.dataset.v38PreviewAction==='original')return v38OpenPreviewOriginal(button.dataset.templateId);
      };
    });
  }

  async function v38OpenInstructionPreview(typeId){
    if(!canEditRichLearning())return;
    const instruction=currentType(typeId);
    const encoded=encodeURIComponent(typeId);
    try{
      const [rawSteps,rawQuestions]=await Promise.all([
        api('/learning-steps?instructionTypeId='+encoded+'&language=de'),
        api('/test-questions?instructionTypeId='+encoded+'&language=de')
      ]);
      const steps=await Promise.all((rawSteps||[]).map(v38PreviewStep));
      const questions=(rawQuestions||[]).filter(q=>q.active!==false);
      const learningHtml=steps.length
        ? steps.map((step,index)=>renderer.renderLearningStep({instruction,step,index,total:steps.length})+(step.imageError?`<div class="notice warning">${escV(step.imageError)}</div>`:'')).join('')
        : '<div class="notice warning">Für diese Unterweisung sind noch keine Lernschritte hinterlegt.</div>';
      const testHtml=questions.length
        ? renderer.renderQuestionList({questions,passPercent:Number(instruction.passPercent||80),namePrefix:'v38PreviewQuestion'})
        : '<p class="muted">Für diese Unterweisung sind keine Testfragen hinterlegt.</p>';
      const originalHtml=instruction.templateId
        ? `<button class="ghost" type="button" data-v38-preview-action="original" data-template-id="${escV(instruction.templateId)}">Originalunterlage öffnen</button>`
        : '';
      document.getElementById('v38InstructionPreviewBackdrop')?.remove();
      document.body.insertAdjacentHTML('beforeend',`<div id="v38InstructionPreviewBackdrop" class="learning-modal-backdrop"><div class="learning-modal" role="dialog" aria-modal="true"><div class="learning-modal-head"><div><span class="portal-badge">Nur Vorschau</span><h2>${escV(instruction.name||'Unterweisung')}</h2><p class="muted">${escV(instruction.category||'Allgemein')} · ${Number(instruction.intervalMonths||12)} Monate</p><p class="muted">Diese Admin-Vorschau erzeugt keinen Lernfortschritt, keinen Testabschluss und keinen Nachweis.</p></div><button class="ghost" type="button" data-v38-preview-action="close">Schließen</button></div><div class="learning-actions"><div class="learning-actions-group">${originalHtml}</div></div>${learningHtml}${testHtml}</div></div>`);
      v38BindInstructionPreviewActions();
    }catch(error){
      alert('Unterweisungsvorschau konnte nicht geöffnet werden: '+String(error.message||error));
    }
  }

  function v38CloseInstructionPreview(){document.getElementById('v38InstructionPreviewBackdrop')?.remove();}
  function v38OpenInstructionFromTable(typeId){if(typeof selectInstructionWorkspaceItem==='function')selectInstructionWorkspaceItem(typeId);return v38OpenInstructionPreview(typeId);}

  if(typeof instructionDetailPanel==='function'){
    const prior=instructionDetailPanel;
    window.instructionDetailPanel=function(editable=false){let html=prior(editable);const typeId=selectedTypeId();html=html.replace(/<div class="learning-admin">[\s\S]*$/,'');if(!editable||!typeId||!canEditRichLearning())return html;setTimeout(()=>v38LoadLearningSteps(typeId),0);return html+richLearningPanel(typeId);};
  }
  Object.assign(window,{canEditRichLearning,v38SaveInstructionContent,v38PreviewLearningStep,v38SaveLearningStep,v38ClearLearningStep,v38LoadLearningSteps,v38EditLearningStep,v38ToggleLearningStep,v38OpenInstructionPreview,v38CloseInstructionPreview,v38OpenInstructionFromTable,v38OpenPreviewOriginal});
})();