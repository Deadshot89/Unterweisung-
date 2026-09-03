// v0.21: Unterweisungsunterlagen/Vorlagen hochladen und Unterweisung zuordnen.

function canEditTemplates(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

function templateForType(t){
  return templates().find(x => x.id === t.templateId) || null;
}

function templateOptions(selected=''){
  return `<option value="">Keine Vorlage zugeordnet</option>${templates().filter(t=>t.active!==false).map(t=>`<option value="${esc(t.id)}" ${selected===t.id?'selected':''}>${esc(t.title)} · ${esc(t.fileName||'')}</option>`).join('')}`;
}

function renderInstructions(){
  const editable = canEditTemplates();
  const old = $('instructionSearch')?.value || '';
  $('instructions').innerHTML = `<div class="grid">
    <div class="card span-12"><div class="toolbar"><div><h2>Unterweisungstypen</h2><p class="muted">Aktuelle Firma: <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. Hier werden Unterweisungen und ihre Schulungsunterlagen verbunden.</p></div><input id="instructionSearch" placeholder="Suchen" value="${esc(old)}"></div>${instructionTable(old, editable)}</div>
    ${editable ? templateUploadCard() + templateListCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Hochladen oder Ändern von Vorlagen.</div></div>'}
  </div>`;
  $('instructionSearch')?.addEventListener('input', renderInstructions);
}

function instructionTable(search='', editable=false){
  const q = String(search||'').toLowerCase();
  const rows = types().filter(t=>!q || [t.name,t.category,t.description,templateForType(t)?.title,templateForType(t)?.fileName].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'de') || String(a.name||'').localeCompare(String(b.name||''),'de'));
  if(!rows.length) return '<p class="muted">Keine Unterweisungen vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Unterweisung</th><th>Bereich</th><th>Intervall</th><th>Unterlage/Vorlage</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map(t=>{
    const tpl = templateForType(t);
    return `<tr>
      <td><b>${esc(t.name)}</b><br><span class="muted">${esc(t.description||'')}</span></td>
      <td>${esc(t.category||'—')}</td>
      <td>${esc(t.intervalMonths||12)} Monate</td>
      <td>${tpl ? `<b>${esc(tpl.title)}</b><br><span class="muted">${esc(tpl.fileName||'')}</span>` : '<span class="badge warn">Keine Unterlage</span>'}</td>
      <td>${t.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
      <td>${tpl?`<button class="small" data-template-action="open" data-template-id="${esc(tpl.id)}">Unterlage öffnen</button>`:''} ${editable?`<button class="small" data-template-action="prepare" data-template-id="${esc(t.id)}">Unterlage hochladen</button>`:'—'}</td>
    </tr>`;
  }).join('')}</tbody></table></div><p class="muted">${rows.length} Unterweisungstypen angezeigt.</p>`;
}

function templateUploadCard(){
  return `<div class="card span-12 admin-workspace analysis-upload"><h2>Unterweisungsunterlage hochladen</h2>
    <p class="muted">PDF oder Bild hochladen – auch mit anderem Layout. Daraus entstehen ein gegliederter Entwurf, Sicherheitsaspekte mit Fundstellen und passende Testfragen. Unlesbare oder fehlende Angaben werden zur Prüfung angezeigt.</p>
    <div class="form-grid">
      <input id="tplReplaceId" type="hidden">
      <div class="field"><label>Unterweisung zuordnen</label><select id="tplInstructionType"><option value="__new__">Neue Unterweisung mit Test erstellen</option><option value="">Nur als Vorlage speichern</option>${types().map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="tplAnalysisLanguage">Sprache des Entwurfs</label><select id="tplAnalysisLanguage"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
      <div class="field"><label>Titel *</label><input id="tplTitle" placeholder="z. B. Stapler-Unterweisung 2026"></div>
      <div class="field"><label>Bereich/Kategorie</label><input id="tplCategory" placeholder="z. B. Arbeitssicherheit"></div>
      <div class="field"><label>Datei *</label><input id="tplFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div>
      <div class="field full"><label>Beschreibung / Hinweise</label><textarea id="tplDescription" placeholder="Kurze Beschreibung der Unterlage"></textarea></div>
      <div class="field full"><button class="primary" data-template-action="upload">Hochladen und verarbeiten</button> <button class="ghost" data-template-action="clear">Formular leeren</button></div>
      <div id="tplUploadResult" class="field full muted"></div>
    </div>
  </div>`;
}

function templateListCard(){
  const rows = templates().filter(t=>t.active!==false).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'de'));
  return `<div id="instructionTemplateList" class="card span-12"><h2>Vorlagen dieser Firma</h2>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Titel</th><th>Datei</th><th>Bereich</th><th>Verwendet bei</th><th>Aktion</th></tr></thead><tbody>${rows.map(t=>{
    const usedBy = types().filter(x=>x.templateId===t.id).map(x=>x.name).join(', ') || '—';
    return `<tr><td><b>${esc(t.title)}</b></td><td>${esc(t.fileName||'')}</td><td>${esc(t.category||'—')}</td><td>${esc(usedBy)}</td><td><button class="small" data-template-action="open" data-template-id="${esc(t.id)}">Öffnen</button> <button class="small" data-template-action="replace" data-template-id="${esc(t.id)}">Ersetzen</button></td></tr>`;
  }).join('')}</tbody></table></div>` : '<p class="muted">Noch keine Vorlagen vorhanden.</p>'}</div>`;
}

function clearTemplateUploadForm(){
  ['tplReplaceId','tplTitle','tplCategory','tplDescription'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  if($('tplInstructionType')) $('tplInstructionType').value='__new__';
  if($('tplFile')) $('tplFile').value='';
  if($('tplUploadResult')) $('tplUploadResult').innerHTML='';
}

function prepareTemplateUpload(typeId){
  const t = type(typeId);
  const tpl = templateForType(t);
  $('tplInstructionType').value = typeId;
  $('tplReplaceId').value = tpl?.id || '';
  $('tplTitle').value = tpl?.title || t.name || '';
  $('tplCategory').value = tpl?.category || t.category || '';
  $('tplDescription').value = tpl?.description || t.description || '';
  document.getElementById('tplTitle')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function prepareTemplateReplace(templateId){
  const tpl = templates().find(t=>t.id===templateId);
  if(!tpl) return;
  const usedBy = types().find(t=>t.templateId===templateId);
  $('tplReplaceId').value = tpl.id;
  $('tplInstructionType').value = usedBy?.id || '';
  $('tplTitle').value = tpl.title || '';
  $('tplCategory').value = tpl.category || '';
  $('tplDescription').value = tpl.description || '';
  document.getElementById('tplFile')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function openTemplate(templateId){
  if(!state.apiAvailable){ alert('Vorlagen werden erst mit verbundener Azure API geöffnet.'); return; }
  const companyId=state.companyId;
  try{
    const result = await api('/templates/' + encodeURIComponent(templateId) + '/download');
    if(state.companyId!==companyId) return;
    window.open(result.url, '_blank', 'noopener');
  }catch(err){
    if(state.companyId===companyId) alert('Unterlage konnte nicht geöffnet werden: ' + String(err.message || err));
  }
}

async function uploadTemplateFile(){
  if(!state.apiAvailable && !API_BASE_URL){ alert('API nicht verbunden.'); return; }
  const file = $('tplFile')?.files?.[0];
  if(!file){ alert('Datei fehlt.'); return; }
  const title = $('tplTitle').value.trim() || file.name;
  if(!title){ alert('Titel fehlt.'); return; }
  const target = $('tplUploadResult');
  if(state.templateUploadBusy) return;
  const companyId=state.companyId;
  const current=()=>state.companyId===companyId && target===$('tplUploadResult');
  const fieldIds=['tplReplaceId','tplInstructionType','tplAnalysisLanguage','tplTitle','tplCategory','tplDescription'];
  const draft=Object.fromEntries(fieldIds.map(id=>[id,$(id).value]));
  const unchanged=()=>current() && $('tplFile')?.files?.[0]===file && fieldIds.every(id=>$(id)?.value===draft[id]);
  const body = {
    templateId: draft.tplReplaceId.trim() || undefined,
    instructionTypeId: ['','__new__'].includes(draft.tplInstructionType) ? undefined : draft.tplInstructionType,
    createInstruction: draft.tplInstructionType === '__new__',
    analyse: !!draft.tplInstructionType,
    language: draft.tplAnalysisLanguage,
    title,
    category: draft.tplCategory.trim(),
    description: draft.tplDescription.trim(),
    fileName: file.name,
    contentType: file.type
  };
  state.templateUploadBusy=true;
  const button=document.querySelector('[data-template-action="upload"]');
  if(button) button.disabled=true;
  target.innerHTML = 'Upload läuft …';
  let uploaded=false;
  try{
    body.base64 = await fileToBase64(file);
    if(!current()) return;
    const result = await api('/templates/upload', { method:'POST', body: JSON.stringify(body) });
    if(!current()) return;
    uploaded=true;
    if(unchanged()) clearTemplateUploadForm();
    target.innerHTML = `<div class="notice"><b>Unterlage hochgeladen.</b><br>${esc(result.fileName)} · ${Number(result.sizeBytes||0).toLocaleString('de-DE')} Bytes · Scanstatus: ${esc(result.scanStatus||'pending')}</div>`;
    await refreshInstructionWorkspaceData(companyId);
    if(!current()) return;
    if(result.analysisError) target.textContent='Unterlage hochgeladen. '+result.analysisError;
    if(result.analysis && typeof openInstructionAnalysis === 'function'){
      if(instructionAnalysesState.companyId!==companyId) resetInstructionAnalyses();
      await openInstructionAnalysis(result.analysis.id, true);
    }
  }catch(err){
    if(current()) target.innerHTML = `<div class="notice dangerbox">${uploaded?'Unterlage hochgeladen, aber Aktualisierung fehlgeschlagen':'Upload fehlgeschlagen'}: ${esc(err.message || err)}</div>`;
  }finally{
    state.templateUploadBusy=false;
    if(button) button.disabled=false;
  }
}

function bindTemplateWorkspaceControls(){
  document.querySelectorAll('#instructions [data-template-action]').forEach(button=>{
    button.onclick=()=>{
      const action=button.dataset.templateAction,id=button.dataset.templateId;
      if(action==='upload') return uploadTemplateFile();
      if(action==='clear') return clearTemplateUploadForm();
      if(action==='open') return openTemplate(id);
      if(action==='replace') return prepareTemplateReplace(id);
      if(action==='prepare') return prepareTemplateUpload(id);
    };
  });
}
