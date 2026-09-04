// RC991: Führungskräfte können Team-Mitarbeiter oder rein externe Personen sicher einladen.
(function(){
  function roles(){return state.me?.roles||[];}
  function isLineManagerOnly(){return roles().includes('line_manager')&&!roles().some(r=>['system_admin','company_admin','hse'].includes(r));}
  function teamEmployees(){
    const ids=new Set((state.me?.teamEmployeeIds||[]).map(String));
    const rows=employees().filter(e=>e.active!==false);
    return ids.size?rows.filter(e=>ids.has(String(e.id))):rows.filter(e=>String(e.id)!==String(state.me?.employeeId||''));
  }
  function instructionOptions(mode,selected=''){
    const all=types().filter(t=>t&&t.active!==false);
    const available=mode==='external'?all.filter(t=>String(t.deliveryMode||'practical')==='online'):all;
    return available.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(t.name)}${mode==='external'?' · Online':''}</option>`).join('');
  }
  function teamOptions(){return teamEmployees().map(e=>`<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.email||'keine E-Mail')}</option>`).join('');}

  function externalRecipientModeChanged(){
    const mode=$('inviteRecipientMode')?.value||'external';
    const team=$('inviteTeamWrap');const external=$('inviteExternalWrap');
    if(team)team.hidden=mode!=='team';if(external)external.hidden=mode!=='external';
    if($('inviteType'))$('inviteType').innerHTML=instructionOptions(mode,$('inviteType')?.value||'');
    if(mode==='team')externalTeamEmployeeChanged();
  }
  function externalTeamEmployeeChanged(){
    const row=teamEmployees().find(e=>String(e.id)===String($('inviteEmployee')?.value||''));
    if(!row)return;
    if($('inviteEmail'))$('inviteEmail').value=row.email||'';
    if($('inviteName'))$('inviteName').value=row.name||'';
  }

  function renderExternalV38(){
    const rows=invitations();const settings=state.companyMailSettings;const defaultMode=selectedMailMode(settings);
    const recipientDefault=isLineManagerOnly()?'team':'external';
    const apiText=state.apiAvailable?'Azure API verbunden':(API_BASE_URL?'API konfiguriert, Status wird beim Senden geprüft':'Keine API konfiguriert');
    $('external').innerHTML=`<div class="grid admin-workspace"><div class="card span-12"><div class="toolbar admin-toolbar"><div><h2>Externe Unterweisung senden</h2><p class="muted">Führungskräfte können Team-Mitarbeiter oder eine externe Person ohne Benutzerkonto einladen. Externe Personen erhalten ausschließlich freigegebene Online-Unterweisungen.</p></div></div><div class="notice"><b>API-Status:</b> ${esc(apiText)}<br><b>Hinweis:</b> Praktische Unterweisungen können nicht als konto-freie externe Unterweisung versendet werden.</div>
      <div class="form-grid external-form">
        <div class="field"><label for="inviteRecipientMode">Empfängerart</label><select id="inviteRecipientMode"><option value="team" ${recipientDefault==='team'?'selected':''}>Team-Mitarbeiter</option><option value="external" ${recipientDefault==='external'?'selected':''}>Externe Person</option></select></div>
        <div class="field" id="inviteTeamWrap"><label for="inviteEmployee">Team-Mitarbeiter</label><select id="inviteEmployee"><option value="">Bitte wählen</option>${teamOptions()}</select></div>
        <div class="field" id="inviteExternalWrap"><label for="inviteEmail">Empfänger E-Mail</label><input type="email" id="inviteEmail" placeholder="name@externe-firma.de"></div>
        <div class="field"><label for="inviteName">Name</label><input id="inviteName" placeholder="Vorname Nachname"></div>
        <div class="field"><label for="inviteType">Unterweisung</label><select id="inviteType">${instructionOptions(recipientDefault)}</select></div>
        <div class="field"><label for="inviteLang">Sprache</label><select id="inviteLang"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
        <div class="field"><label for="inviteDays">Gültig Tage</label><input id="inviteDays" type="number" value="14" min="1" max="365"></div>
        <div class="field"><label for="invitePass">Bestehen ab %</label><input id="invitePass" type="number" value="80" min="1" max="100"></div>
        <div class="field"><label for="inviteTest">Test erforderlich</label><select id="inviteTest"><option value="1">Ja</option><option value="0">Nein, nur Bestätigung</option></select></div>
        <div class="field"><label for="inviteMailMode">Versand</label><select id="inviteMailMode"><option value="manual" ${defaultMode==='manual'?'selected':''}>Link + Mailtext erzeugen</option><option value="outlook" ${defaultMode==='outlook'?'selected':''}>Mailprogramm / Outlook öffnen</option><option value="graph" ${defaultMode==='graph'?'selected':''}>Direkt per Firmenmail senden</option></select></div>
        <div class="field full admin-form-actions"><button class="primary" data-invitation-action="create">Unterweisung vorbereiten / senden</button></div>
        <div class="field full"><label for="inviteResult">Versandergebnis / Mailtext</label><textarea id="inviteResult" readonly placeholder="Link und Versandinformation erscheinen hier"></textarea></div>
      </div></div><div class="card span-12"><div class="toolbar admin-toolbar"><h2>Einladungen / externe Abschlüsse</h2><button class="ghost" data-invitation-action="refresh">Aktualisieren</button></div>${invitationTable(rows)}</div></div>`;
    $('external').onclick=handleInvitationWorkspaceClick;
    $('inviteRecipientMode').onchange=externalRecipientModeChanged;
    $('inviteEmployee').onchange=externalTeamEmployeeChanged;
    externalRecipientModeChanged();
    if(!settings&&(state.apiAvailable||API_BASE_URL))getCompanyMailSettingsSafe().then(()=>{if(document.getElementById('external')?.classList.contains('active'))renderExternalV38();});
  }

  async function createInvitationV38(){
    const resultBox=$('inviteResult');
    try{
      const recipientMode=$('inviteRecipientMode')?.value||'external';
      const employeeId=recipientMode==='team'?($('inviteEmployee')?.value||null):null;
      const teamRow=employeeId?teamEmployees().find(e=>String(e.id)===String(employeeId)):null;
      const email=(recipientMode==='team'?(teamRow?.email||''):$('inviteEmail').value).trim();
      const recipientName=(recipientMode==='team'?(teamRow?.name||''):$('inviteName').value).trim();
      const instructionTypeId=$('inviteType').value;
      const selectedType=types().find(t=>String(t.id)===String(instructionTypeId));
      if(recipientMode==='team'&&!employeeId){alert('Bitte einen Team-Mitarbeiter auswählen.');return;}
      if(!email){alert('E-Mail fehlt.');return;}
      if(!instructionTypeId){alert('Bitte eine Unterweisung auswählen.');return;}
      if(recipientMode==='external'&&String(selectedType?.deliveryMode||'practical')!=='online'){alert('Externe Personen können nur Online-Unterweisungen erhalten.');return;}
      const mailMode=$('inviteMailMode').value;
      const form={email,recipientName,employeeId,instructionTypeId,deliveryMode:selectedType?.deliveryMode||'practical',language:$('inviteLang').value,validDays:Number($('inviteDays').value||14),passPercent:Number($('invitePass').value||80),testRequired:$('inviteTest').value==='1',sendMail:mailMode==='graph'};
      resultBox.value='Sicherer Unterweisungslink wird erstellt …';
      const settings=await getCompanyMailSettingsSafe();
      const result=await api('/invitations',{method:'POST',body:JSON.stringify(form)});
      const manualText=buildManualInvitationText(result,form,settings);
      const output=(result.mail?.sent?'Mail gesendet.\n\n':'Link erstellt.\n\n')+result.url+(result.mail?.error?'\n\nMailfehler: '+result.mail.error:'')+'\n\n--- Mailtext zum Kopieren ---\n'+manualText;
      resultBox.value=output;
      try{await navigator.clipboard.writeText(manualText);}catch{}
      if(mailMode==='outlook')openMailClient(email,manualText);
      await loadData();setView('external');const next=$('inviteResult');if(next)next.value=output;
    }catch(err){const msg=String(err.message||err);if(resultBox)resultBox.value='Fehler beim Erstellen/Senden:\n'+msg;alert('Externe Unterweisung konnte nicht erstellt/gesendet werden: '+msg);}
  }

  Object.assign(window,{renderExternal:renderExternalV38,createInvitation:createInvitationV38,externalRecipientModeChanged,externalTeamEmployeeChanged});
})();