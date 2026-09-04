// v0.36.3 Mitarbeiterportal und bildgestützte Lernschritte.
(function(){
  const portalState={training:null,stepIndex:0,adminCache:new Map()};
  const ADMIN_ROLES=new Set(['system_admin','company_admin','hse']);

  function portalRoles(){return state.me?.roles||[];}
  function isEmployeeExperience(){const roles=portalRoles();return (roles.includes('employee')||roles.includes('line_manager'))&&!roles.some(r=>ADMIN_ROLES.has(r));}
  function isLineManager(){return portalRoles().includes('line_manager');}
  function canEditLearning(){return portalRoles().some(r=>ADMIN_ROLES.has(r));}
  function ownStatusRows(){
    const rows=state.statusRows||[];const employeeId=state.me?.employeeId;
    if(employeeId)return rows.filter(r=>String(r.employeeId)===String(employeeId));
    const email=String(state.me?.email||'').toLowerCase();return rows.filter(r=>String(r.email||'').toLowerCase()===email);
  }
  function rowType(row){return typeof type==='function'?type(row.typeId):((state.data?.types||[]).find(t=>t.id===row.typeId)||{});}
  function isOnlineRow(row){return String(rowType(row).deliveryMode||'practical')==='online';}
  function dateText(value){return value?fmtDate(value):'—';}
  function taskMeta(row){return `${esc(row.category||'Allgemein')} · ${row.validUntil?'fällig '+dateText(row.validUntil):'noch kein gültiger Abschluss'}`;}

  function employeeTaskCard(row,kind){
    let action='';
    if(kind==='now')action=`<button class="primary small" onclick="portalStartInstruction('${esc(row.typeId)}')">Starten</button>`;
    if(kind==='planning')action=`<button class="primary small" onclick="portalRequestAppointment('${esc(row.typeId)}')">Termin anfragen</button>`;
    if(kind==='done'&&row.certificateFileId)action=`<button class="small" onclick="portalDownloadProof('${esc(row.certificateFileId)}')">Nachweis herunterladen</button>`;
    return `<div class="employee-task"><div><h4>${esc(row.instructionName)}</h4><p class="muted">${taskMeta(row)}</p></div><div class="employee-task-actions">${action}</div></div>`;
  }
  function emptyBucket(text){return `<div class="employee-empty">${esc(text)}</div>`;}
  function bucket(title,rows,kind,empty,span=false){return `<section class="card employee-bucket ${span?'span-2':''}"><div class="employee-bucket-head"><h3>${title}</h3><span class="employee-bucket-count">${rows.length}</span></div><div class="employee-task-list">${rows.length?rows.map(r=>employeeTaskCard(r,kind)).join(''):emptyBucket(empty)}</div></section>`;}
  function plannedCards(){
    const plans=(state.data?.plannedTrainings||[]).filter(p=>p.status!=='completed'&&p.status!=='cancelled');
    if(!plans.length)return emptyBucket('Aktuell ist kein Termin eingeplant.');
    return `<div class="employee-task-list">${plans.slice(0,12).map(p=>`<div class="employee-task"><div><h4>${esc(rowType({typeId:p.instructionTypeId}).name||'Unterweisung')}</h4><p class="muted">${dateText(p.plannedAt)}${p.location?' · '+esc(p.location):''}</p></div><span class="portal-badge">Geplant</span></div>`).join('')}</div>`;
  }
  function teamSummary(){
    if(!isLineManager())return '';
    const teamIds=new Set(state.me?.teamEmployeeIds||[]);const rows=(state.statusRows||[]).filter(r=>teamIds.has(String(r.employeeId)));
    const urgent=rows.filter(r=>['missing','expired'].includes(r.status)).length;const due=rows.filter(r=>['soon','critical'].includes(r.status)).length;
    return `<section class="card"><div class="employee-bucket-head"><div><h3>Mein Team</h3><p class="muted">Nur direkt zugewiesene Mitarbeiter.</p></div><button class="primary small" onclick="setView('planning')">Team einplanen</button></div><div class="employee-team-strip"><div class="employee-team-stat"><span>Mitarbeiter</span><strong>${teamIds.size}</strong></div><div class="employee-team-stat"><span>Offen/abgelaufen</span><strong>${urgent}</strong></div><div class="employee-team-stat"><span>Bald fällig</span><strong>${due}</strong></div></div></section>`;
  }

  function renderEmployeeDashboard(){
    const target=document.getElementById('dashboard');if(!target)return;const rows=ownStatusRows();
    const now=rows.filter(r=>['missing','expired'].includes(r.status)&&isOnlineRow(r));
    const planning=rows.filter(r=>['missing','expired'].includes(r.status)&&!isOnlineRow(r));
    const soon=rows.filter(r=>['soon','critical'].includes(r.status));
    const done=rows.filter(r=>r.status==='valid'&&r.recordId).sort((a,b)=>String(b.conductedAt||'').localeCompare(String(a.conductedAt||''))).slice(0,12);
    const firstName=String(state.me?.displayName||'').split(/\s+/)[0]||'Willkommen';
    target.innerHTML=`<div class="employee-dashboard"><section class="card employee-hero"><div><span class="portal-badge">Meine Unterweisungen</span><h2>${esc(firstName)}, das steht für dich an</h2><p class="muted">Du siehst ausschließlich deine Firma sowie Aufgaben und Nachweise innerhalb deiner Rolle.</p></div><div class="employee-hero-meta"><span class="portal-badge">${esc(state.me?.authMode==='password'?'E-Mail/Passwort':'Microsoft')}</span><span class="portal-badge">${esc(state.me?.companyId||'')}</span></div></section>
      <div class="employee-bucket-grid">${bucket('Jetzt erledigen',now,'now','Keine Online-Unterweisung ist sofort offen.')} ${bucket('Einplanung erforderlich',planning,'planning','Keine praktische Unterweisung muss eingeplant werden.')}
      <section class="card employee-bucket"><div class="employee-bucket-head"><h3>Geplante Termine</h3><span class="employee-bucket-count">${(state.data?.plannedTrainings||[]).filter(p=>p.status!=='completed'&&p.status!=='cancelled').length}</span></div>${plannedCards()}</section>
      ${bucket('Bald fällig',soon,'soon','Aktuell ist nichts bald fällig.')} ${bucket('Abgeschlossen',done,'done','Noch keine abgeschlossenen Nachweise verfügbar.',true)}</div>${teamSummary()}</div>`;
  }

  async function portalDownloadProof(fileId){try{const file=await api('/files/'+encodeURIComponent(fileId)+'/download');window.open(file.url,'_blank','noopener');}catch(error){alert('Nachweis konnte nicht geöffnet werden: '+(error.message||error));}}
  function portalRequestAppointment(typeId){
    const row=(state.statusRows||[]).find(r=>String(r.typeId)===String(typeId)&&(!state.me?.employeeId||String(r.employeeId)===String(state.me.employeeId)));
    if(isLineManager()){setView('planning');return;}
    if(!row?.lineManagerEmail){alert('Für diese Unterweisung ist noch kein Verantwortlicher mit E-Mail hinterlegt.');return;}
    const subject=encodeURIComponent(`Termin für Unterweisung: ${row.instructionName}`);const body=encodeURIComponent(`Hallo ${row.lineManagerName||''},\n\nich benötige einen Termin für die Unterweisung „${row.instructionName}“.\n\nVielen Dank.`);
    location.href=`mailto:${encodeURIComponent(row.lineManagerEmail)}?subject=${subject}&body=${body}`;
  }

  async function portalStartInstruction(typeId){
    try{
      const data=await api('/employee-training/'+encodeURIComponent(typeId)+'?language=de');
      if(data.requiresPlanning){portalRequestAppointment(typeId);return;}
      portalState.training=data;portalState.stepIndex=Math.max(0,Math.min(Number(data.currentStep||0),data.steps?.length||0));portalRenderTraining();
    }catch(error){alert('Unterweisung konnte nicht geöffnet werden: '+(error.message||error));}
  }
  function portalProgressPercent(){const data=portalState.training;if(!data)return 0;const total=Math.max(1,(data.steps?.length||0)+1);return Math.min(100,Math.round((portalState.stepIndex/total)*100));}
  function portalRenderTraining(){
    const data=portalState.training;if(!data)return;document.getElementById('portalLearningBackdrop')?.remove();
    const steps=data.steps||[];const index=portalState.stepIndex;const step=steps[index];
    const content=step?`<div class="learning-step"><div><span class="portal-badge">Schritt ${index+1} von ${steps.length}</span><h3>${esc(step.title)}</h3><div class="learning-step-copy">${esc(step.body||'')}</div></div>${step.imageFileId?`<div class="learning-step-image-wrap"><span id="learningImageLoading">Bild wird geladen …</span><img id="portalLearningImage" class="learning-step-image" alt="${esc(step.title)}" hidden onclick="portalZoomLearningImage()"></div>`:''}</div>`:portalTestContent(data);
    const label=index>0?'Fortsetzen':'Starten';
    document.body.insertAdjacentHTML('beforeend',`<div id="portalLearningBackdrop" class="learning-modal-backdrop"><div class="learning-modal" role="dialog" aria-modal="true"><div class="learning-modal-head"><div><span class="portal-badge">${label}</span><h2>${esc(data.instructionName)}</h2><p class="muted">Online-Unterweisung</p></div><button class="ghost" onclick="portalCloseLearning()">Schließen</button></div><div class="learning-progress" aria-label="Fortschritt"><span style="width:${portalProgressPercent()}%"></span></div>${content}<div class="learning-actions"><div class="learning-actions-group">${data.templateId?`<button class="ghost" onclick="portalOpenOriginal('${esc(data.templateId)}')">Originalunterlage herunterladen</button>`:''}</div>${step?`<div class="learning-actions-group"><button class="ghost" ${index===0?'disabled':''} onclick="portalLearningPrev()">Zurück</button><button class="primary" onclick="portalLearningNext()">${index===steps.length-1?'Zum Abschluss':'Weiter'}</button></div>`:''}</div></div></div>`);
    if(step?.imageFileId)portalLoadLearningImage(step.imageFileId);
  }
  function portalTestContent(data){
    if(!data.testRequired)return `<div class="learning-test"><h3>Unterweisung abschließen</h3><p>Bestätige, dass du alle Lernschritte vollständig angesehen und verstanden hast.</p><button class="primary" onclick="portalSubmitTraining()">Unterweisung abschließen</button></div>`;
    const questions=data.questions||[];return `<div class="learning-test"><h3>Abschlusstest</h3><p class="muted">Erforderlich: ${esc(data.passPercent||80)} % richtige Antworten.</p>${questions.map((q,qi)=>`<fieldset class="learning-question"><legend>${qi+1}. ${esc(q.question)}</legend>${(q.options||[]).map((opt,oi)=>`<label class="learning-option"><input type="radio" name="portalQuestion_${esc(q.id)}" value="${oi}"><span>${esc(opt)}</span></label>`).join('')}</fieldset>`).join('')}<button class="primary" onclick="portalSubmitTraining()">Test abschließen</button></div>`;
  }
  async function portalLoadLearningImage(fileId){
    try{const file=await api('/files/'+encodeURIComponent(fileId)+'/download');const img=document.getElementById('portalLearningImage');if(img){img.src=file.url;img.hidden=false;}document.getElementById('learningImageLoading')?.remove();}catch{const loading=document.getElementById('learningImageLoading');if(loading)loading.textContent='Bild konnte nicht geladen werden.';}
  }
  function portalZoomLearningImage(){const src=document.getElementById('portalLearningImage')?.src;if(!src)return;document.body.insertAdjacentHTML('beforeend',`<div class="learning-image-modal" onclick="this.remove()"><img src="${esc(src)}" alt="Vergrößerte Lernabbildung"></div>`);}
  async function portalLearningNext(){const data=portalState.training;if(!data)return;portalState.stepIndex=Math.min((data.steps?.length||0),portalState.stepIndex+1);try{await api('/employee-training/'+encodeURIComponent(data.instructionTypeId),{method:'POST',body:JSON.stringify({attemptId:data.attemptId,currentStep:portalState.stepIndex})});}catch{}portalRenderTraining();}
  function portalLearningPrev(){portalState.stepIndex=Math.max(0,portalState.stepIndex-1);portalRenderTraining();}
  function portalCloseLearning(){document.getElementById('portalLearningBackdrop')?.remove();portalState.training=null;}
  async function portalOpenOriginal(templateId){try{const result=await api('/templates/'+encodeURIComponent(templateId)+'/download');window.open(result.url,'_blank','noopener');}catch(error){alert('Originalunterlage konnte nicht geöffnet werden: '+(error.message||error));}}
  async function portalSubmitTraining(){
    const data=portalState.training;if(!data)return;const answers=(data.questions||[]).map(q=>{const chosen=document.querySelector(`input[name="portalQuestion_${CSS.escape(String(q.id))}"]:checked`);return {questionId:q.id,answerIndex:chosen?Number(chosen.value):null};});
    if(data.testRequired&&answers.some(a=>a.answerIndex===null)){alert('Bitte beantworte alle Fragen.');return;}
    try{const result=await api('/employee-training/'+encodeURIComponent(data.instructionTypeId),{method:'POST',body:JSON.stringify({attemptId:data.attemptId,confirmed:true,answers})});if(!result.passed){alert(`Test nicht bestanden (${result.scorePercent||0} %). Du kannst die Unterweisung erneut starten.`);portalCloseLearning();return;}alert('Unterweisung erfolgreich abgeschlossen.');portalCloseLearning();await loadData();setView('dashboard');}catch(error){alert('Abschluss fehlgeschlagen: '+(error.message||error));}
  }

  function portalFileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',').pop());reader.onerror=reject;reader.readAsDataURL(file);});}
  async function portalLoadLearningAdmin(typeId,force=false){
    const box=document.getElementById('portalLearningAdminList');if(!box||String(box.dataset.typeId)!==String(typeId))return;
    if(!force&&portalState.adminCache.has(typeId)){portalRenderLearningAdminList(typeId,portalState.adminCache.get(typeId));return;}
    box.textContent='Lernschritte werden geladen …';
    try{const rows=await api('/learning-steps?instructionTypeId='+encodeURIComponent(typeId)+'&language=de');portalState.adminCache.set(typeId,rows);portalRenderLearningAdminList(typeId,rows);}catch(error){box.innerHTML=`<div class="notice warning">${esc(error.message||error)}</div>`;}
  }
  function portalRenderLearningAdminList(typeId,rows){const box=document.getElementById('portalLearningAdminList');if(!box||String(box.dataset.typeId)!==String(typeId))return;box.innerHTML=rows.length?`<div class="learning-admin-list">${rows.map(s=>`<div class="learning-admin-row"><strong>${Number(s.sortOrder||0)}</strong><div><b>${esc(s.title)}</b><small>${esc((s.body||'').slice(0,180))}${(s.body||'').length>180?'…':''}</small></div><button class="small ${s.status==='published'?'ghost':'primary'}" onclick="portalToggleLearningStep('${esc(s.id)}','${s.status==='published'?'draft':'published'}','${esc(typeId)}')">${s.status==='published'?'Freigabe zurücknehmen':'Fachlich freigeben'}</button></div>`).join('')}</div>`:emptyBucket('Noch keine Lernschritte angelegt.');}
  async function portalSaveLearningStep(typeId){
    const title=document.getElementById('portalStepTitle')?.value.trim();if(!title){alert('Titel fehlt.');return;}const body=document.getElementById('portalStepBody')?.value.trim()||'';const sortOrder=Number(document.getElementById('portalStepOrder')?.value||10);let imageFileId=null;
    try{const file=document.getElementById('portalStepImage')?.files?.[0];if(file){const upload=await api('/learning-steps/image',{method:'POST',body:JSON.stringify({fileName:file.name,contentType:file.type,base64:await portalFileToBase64(file)})});imageFileId=upload.id;}
      await api('/learning-steps',{method:'POST',body:JSON.stringify({instructionTypeId:typeId,language:'de',sortOrder,title,body,imageFileId})});portalState.adminCache.delete(typeId);['portalStepTitle','portalStepBody','portalStepImage'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});await portalLoadLearningAdmin(typeId,true);
    }catch(error){alert('Lernschritt konnte nicht gespeichert werden: '+(error.message||error));}
  }
  async function portalToggleLearningStep(id,status,typeId){try{await api('/learning-steps/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})});portalState.adminCache.delete(typeId);await portalLoadLearningAdmin(typeId,true);}catch(error){alert('Freigabe konnte nicht geändert werden: '+(error.message||error));}}
  async function portalSaveDelivery(typeId){
    const deliveryMode=document.getElementById('portalDeliveryMode')?.value||'practical';const testRequired=!!document.getElementById('portalDeliveryTest')?.checked;const passPercent=Math.max(1,Math.min(100,Number(document.getElementById('portalDeliveryPass')?.value||80)));
    try{await api('/instruction-types/'+encodeURIComponent(typeId),{method:'PATCH',body:JSON.stringify({deliveryMode,testRequired,passPercent})});await loadData();setView('instructions');}catch(error){alert('Abschlussart konnte nicht gespeichert werden: '+(error.message||error));}
  }
  function learningAdminPanel(typeId){
    const t=rowType({typeId});return `<div class="learning-admin"><div class="employee-bucket-head"><div><h3>Bild-Unterweisung & Abschluss</h3><p class="muted">Neue Lernschritte bleiben Entwurf, bis sie ausdrücklich fachlich freigegeben werden.</p></div></div>
      <div class="learning-admin-grid"><div class="field"><label>Durchführung</label><select id="portalDeliveryMode"><option value="practical" ${t.deliveryMode!=='online'?'selected':''}>Praktisch</option><option value="online" ${t.deliveryMode==='online'?'selected':''}>Online</option></select></div><div class="field"><label><input id="portalDeliveryTest" type="checkbox" ${t.testRequired?'checked':''}> Abschlusstest erforderlich</label></div><div class="field"><label>Bestehen ab %</label><input id="portalDeliveryPass" type="number" min="1" max="100" value="${Number(t.passPercent||80)}"></div><div class="full"><button class="ghost small" onclick="portalSaveDelivery('${esc(typeId)}')">Abschlussart speichern</button></div>
      <div class="field"><label>Reihenfolge</label><input id="portalStepOrder" type="number" min="0" value="10"></div><div class="field"><label>Titel</label><input id="portalStepTitle" placeholder="z. B. Sicherer Arbeitsbereich"></div><div class="field"><label>Bild optional</label><input id="portalStepImage" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="field full"><label>Kurze Erklärung</label><textarea id="portalStepBody" placeholder="Kurz und verständlich erklären, was auf diesem Schritt wichtig ist."></textarea></div><div class="full"><button class="primary small" onclick="portalSaveLearningStep('${esc(typeId)}')">Als Entwurf speichern</button></div></div><div id="portalLearningAdminList" data-type-id="${esc(typeId)}"></div></div>`;
  }

  if(typeof renderDashboard==='function'){const original=renderDashboard;renderDashboard=function(){if(isEmployeeExperience())return renderEmployeeDashboard();return original();};}
  if(typeof instructionDetailPanel==='function'){
    const original=instructionDetailPanel;instructionDetailPanel=function(editable=false){const html=original(editable);const selected=window.instructionWorkspaceState?.selectedId||instructionWorkspaceState?.selectedId||'';if(!editable||!selected||!canEditLearning())return html;setTimeout(()=>portalLoadLearningAdmin(selected),0);return html+learningAdminPanel(selected);};
  }

  Object.assign(window,{portalStartInstruction,portalRequestAppointment,portalDownloadProof,portalCloseLearning,portalLearningNext,portalLearningPrev,portalSubmitTraining,portalOpenOriginal,portalZoomLearningImage,portalSaveLearningStep,portalToggleLearningStep,portalSaveDelivery});
})();
