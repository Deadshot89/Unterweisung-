// RC991: Planung speichern + Graph/ICS-Mail als ein zusammenhängender Führungsworkflow.
(function(){
  function planningFormCardV38(){
    return `<div class="form-grid">
      <input id="planId" type="hidden">
      <div class="field"><label for="planType">Unterweisung *</label><select id="planType"><option value="">Bitte wählen</option>${types().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="planAt">Datum/Zeit *</label><input id="planAt" type="datetime-local"></div>
      <div class="field"><label for="planDuration">Dauer Minuten</label><input id="planDuration" type="number" min="1" max="600" value="30"></div>
      <div class="field"><label for="planLocation">Ort</label><input id="planLocation" value="Schulungsraum / Warehouse"></div>
      <div class="field"><label for="planLineManager">Line Manager / Verantwortlich</label><select id="planLineManager">${lineManagerSelectOptions('')}</select></div>
      <div class="field"><label for="planStatus">Status</label><select id="planStatus"><option value="planned">Geplant</option><option value="invited">Eingeladen</option><option value="cancelled">Storniert</option><option value="completed">Abgeschlossen</option></select></div>
      <div class="field full"><h3 class="field-heading">Teilnehmer *</h3>${planningEmployeeCheckboxes([])}</div>
      <div class="field full admin-form-actions"><button class="primary" data-planning-action="save">Planung speichern</button><button class="primary" data-planning-action="save-mail">Planung speichern und Mail senden</button><button class="ghost" data-planning-action="clear">Formular leeren</button></div>
      <div id="planningResult" class="field full muted"></div>
    </div>`;
  }

  function handlePlanningWorkspaceClickV38(event){
    const button=event.target.closest('button[data-planning-action]');
    if(!button)return;
    const {planningAction,id}=button.dataset;
    if(planningAction==='refresh')return reloadPlannedTrainingResults();
    if(!canEditPlanning())return;
    switch(planningAction){
      case 'save': return savePlannedTraining({sendMail:false});
      case 'save-mail': return savePlannedTraining({sendMail:true});
      case 'clear': return clearPlanningForm();
      case 'edit': return editPlannedTraining(id);
      case 'complete': return completePlannedTraining(id);
      case 'mail': return sendPlannedMail(id);
      case 'cancel': return cancelPlannedTraining(id);
    }
  }

  async function savePlannedTrainingV38({sendMail=false}={}){
    if(!state.apiAvailable){alert('Planung speichern braucht die Azure API.');return;}
    const target=$('planningResult');
    const existingId=$('planId').value.trim();
    const employeeIds=selectedPlanEmployeeIds();
    const body={instructionTypeId:$('planType').value,plannedAt:$('planAt').value,durationMinutes:Number($('planDuration').value||30),location:$('planLocation').value.trim(),lineManagerId:$('planLineManager').value,status:$('planStatus').value,employeeIds};
    if(!body.instructionTypeId){alert('Unterweisung fehlt.');return;}
    if(!body.plannedAt){alert('Datum/Zeit fehlt.');return;}
    if(!employeeIds.length){alert('Bitte mindestens einen Teilnehmer auswählen.');return;}
    target.innerHTML=sendMail?'Planung wird gespeichert und die Terminmail vorbereitet …':'Planung wird gespeichert …';
    try{
      let targetId=existingId;
      if(existingId){
        await api('/planned-trainings/'+encodeURIComponent(existingId),{method:'PATCH',body:JSON.stringify(body)});
      }else{
        const created=await api('/planned-trainings',{method:'POST',body:JSON.stringify(body)});
        targetId=created.id;
      }
      let mailResult=null;
      if(sendMail){
        mailResult=await api('/planned-trainings/'+encodeURIComponent(targetId)+'/send-mail',{method:'POST',body:JSON.stringify({})});
      }
      target.innerHTML=sendMail
        ? `<div class="notice"><b>Planung gespeichert und Terminmail versendet.</b> ${Number(mailResult?.recipients||0)} Empfänger.</div>`
        : '<div class="notice"><b>Planung gespeichert.</b></div>';
      clearPlanningForm();
      await loadData();
      await loadPlannedTrainings(true,true);
      setView('planning');
    }catch(err){
      target.innerHTML=`<div class="notice dangerbox">${sendMail?'Speichern oder Mailversand':'Speichern'} fehlgeschlagen: ${esc(err.message||err)}</div>`;
    }
  }

  async function sendPlannedMailV38(id){
    if(!id)return;
    try{
      const result=await api('/planned-trainings/'+encodeURIComponent(id)+'/send-mail',{method:'POST',body:JSON.stringify({})});
      alert(`Terminmail versendet. Empfänger: ${Number(result.recipients||0)}.`);
      await loadPlannedTrainings(true,true);
      refreshPlannedTrainingResults();
    }catch(error){alert('Terminmail konnte nicht versendet werden: '+String(error.message||error));}
  }

  function plannedTrainingTableV38(rows,editable=false){
    if(!rows.length)return '<p class="muted">Noch keine geplanten Unterweisungen.</p>';
    return `<div class="table-wrap admin-table-wrap"><table class="admin-table planning-table"><thead><tr><th scope="col">Termin / Unterweisung</th><th scope="col">Teilnehmer</th><th scope="col">Ort / Verantwortlich</th><th scope="col">Status / Mail</th><th scope="col">Aktionen</th></tr></thead><tbody>${rows.map(p=>{
      const count=Number(p.participantCount||parseParticipantIds(p).length);
      const sent=Number(p.mailSentCount||0);const errors=Number(p.mailErrorCount||0);
      const mailLabel=sent>0?'Erneut senden':'Termin per Mail senden';
      const mailState=sent>0?`${sent} von ${count} Teilnehmern per Mail informiert${errors?` · ${errors} Fehler`:''}`:'Noch keine Terminmail versendet';
      return `<tr><td data-label="Termin / Unterweisung"><div class="admin-cell"><b>${esc(type(p.instructionTypeId).name||p.instructionName)}</b><span>${fmtDateTime(p.plannedAt)}</span><small class="muted">${esc(p.durationMinutes||'—')} Min.</small></div></td><td data-label="Teilnehmer"><div class="admin-cell"><span>${count} Teilnehmer</span>${p.participantNames?`<details class="admin-details"><summary>Namen anzeigen</summary><p>${esc(p.participantNames)}</p></details>`:''}</div></td><td data-label="Ort / Verantwortlich"><div class="admin-cell"><span>${esc(p.location||'—')}</span><span class="muted">${esc(p.lineManagerName||emp(p.lineManagerId).name||'—')}</span></div></td><td data-label="Status / Mail"><div class="admin-cell">${planningStatusBadge(p.status)}<small class="muted">${esc(mailState)}</small></div></td><td data-label="Aktionen"><div class="admin-actions">${editable?`<button class="small" data-planning-action="edit" data-id="${esc(p.id)}">Bearbeiten</button><button class="small primary" data-planning-action="complete" data-id="${esc(p.id)}">Abschließen</button><button class="small" data-planning-action="mail" data-id="${esc(p.id)}">${mailLabel}</button><details class="admin-details"><summary>Weitere Aktionen</summary><div class="admin-actions"><button class="small ghost" data-planning-action="cancel" data-id="${esc(p.id)}">Stornieren</button></div></details>`:'—'}</div></td></tr>`;
    }).join('')}</tbody></table></div><p class="muted admin-count">${rows.length} Planungen angezeigt.</p>`;
  }

  Object.assign(window,{planningFormCard:planningFormCardV38,handlePlanningWorkspaceClick:handlePlanningWorkspaceClickV38,savePlannedTraining:savePlannedTrainingV38,sendPlannedMail:sendPlannedMailV38,plannedTrainingTable:plannedTrainingTableV38});
})();