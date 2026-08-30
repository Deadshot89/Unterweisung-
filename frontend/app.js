const $ = (id) => document.getElementById(id);
const state = { data: null, source: 'loading', statusRows: [], apiAvailable: false, mailConfig: null, me: null, companyId: 'company-essentra', users: [] };

function esc(s=''){return String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function fmtDate(d){return d ? new Date(d).toLocaleDateString('de-DE') : '—'}
function isoDate(d){return d ? new Date(d).toISOString().slice(0,10) : ''}
function addMonths(dateStr, months){const d=new Date(dateStr); d.setMonth(d.getMonth()+Number(months||12)); return d.toISOString().slice(0,10)}
function todayIso(){return new Date().toISOString().slice(0,10)}

async function api(path, options={}){
  const headers = {'Content-Type':'application/json','x-company-id': state.companyId || 'company-essentra', ...(options.headers||{})};
  const res = await fetch('/api' + path, {...options, headers});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadData(){
  try{
    state.me = await api('/me');
    state.companyId = state.me.companyId || state.companyId;
    renderUserInfo();
    state.data = await api('/bootstrap');
    state.apiAvailable = true;
    state.source = 'api';
    try { state.statusRows = await api('/instruction-status'); } catch { state.statusRows = buildLocalStatusRows(); }
    try { state.mailConfig = await api('/mail/config'); } catch { state.mailConfig = { configured:false, missing:['mail/config nicht erreichbar'] }; }
    try { state.users = await api('/users'); } catch { state.users = []; }
  }catch(err){
    const msg = String(err.message || err);
    if(msg.includes('401') || msg.includes('403') || msg.includes('Nicht angemeldet') || msg.includes('freigeschaltet')){
      document.querySelector('main').innerHTML = `<section class="card login-box"><h2>Anmeldung erforderlich</h2><p>Bitte mit Microsoft/Entra anmelden. Falls du bereits angemeldet bist, muss dein Benutzer unter <b>Benutzer/Rechte</b> für die Firma freigeschaltet sein.</p><p class="muted">Fehler: ${esc(msg)}</p><a class="btn primary" href="/.auth/login/aad">Mit Microsoft anmelden</a></section>`;
      renderUserInfo(false);
      return;
    }
    const res = await fetch('/seed/essentra-startdata.json');
    state.data = await res.json();
    state.apiAvailable = false;
    state.source = 'seed';
    state.statusRows = buildLocalStatusRows();
    renderUserInfo(false);
  }
  renderAll();
}

function renderUserInfo(ok=true){
  const el = $('userInfo');
  if(!el) return;
  if(!ok || !state.me) { el.textContent = 'Nicht angemeldet / Seed-Fallback'; return; }
  el.innerHTML = `${esc(state.me.displayName || state.me.email || 'Benutzer')} · ${esc(state.me.companyId)} · ${(state.me.roles||[]).map(r=>`<span class="role-pill">${esc(r)}</span>`).join('')}`;
}

function setView(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  render(id);
}

document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));

function employees(){return state.data?.employees || []}
function types(){return state.data?.types || state.data?.instructionTypes || []}
function records(){return state.data?.records || []}
function companies(){return state.data?.companies || []}
function templates(){return state.data?.templates || []}
function exclusions(){return state.data?.exclusions || []}
function plannedTrainings(){return state.data?.plannedTrainings || []}
function invitations(){return state.data?.invitations || []}
function emp(id){return employees().find(e=>e.id===id) || {name:'—'}}
function type(id){return types().find(t=>t.id===id) || {name:'—'}}

function isExcluded(employeeId,typeId){return exclusions().some(x=>x.active!==false && x.employeeId===employeeId && (x.typeId===typeId || x.instructionTypeId===typeId))}
function lastRecord(employeeId,typeId){
  return records().filter(r=>r.employeeId===employeeId && (r.typeId===typeId || r.instructionTypeId===typeId))
    .sort((a,b)=>String(b.date||b.conductedAt||'').localeCompare(String(a.date||a.conductedAt||'')))[0];
}
function calcStatus(e,t){
  if(isExcluded(e.id,t.id)) return {status:'not_required'};
  const r=lastRecord(e.id,t.id);
  if(!r) return {status:'missing'};
  const date = r.date || r.conductedAt;
  const due = r.nextDue || r.validUntil || (date ? addMonths(date,t.intervalMonths||12) : null);
  const now = new Date();
  if(due && new Date(due) < now) return {status:'expired', record:r, due};
  if(due && new Date(due) <= new Date(now.getTime()+30*86400000)) return {status:'critical', record:r, due};
  if(due && new Date(due) <= new Date(now.getTime()+60*86400000)) return {status:'soon', record:r, due};
  return {status:'valid', record:r, due};
}
function buildLocalStatusRows(){
  const rows=[];
  for(const e of employees().filter(x=>x.active!==false)){
    for(const t of types().filter(x=>x.active!==false)){
      const s=calcStatus(e,t);
      rows.push({employeeId:e.id, employeeName:e.name, email:e.email, department:e.department, role:e.role, lineManagerId:e.shiftLeaderId||e.lineManagerId, lineManagerName:emp(e.shiftLeaderId||e.lineManagerId).name, typeId:t.id, instructionName:t.name, category:t.category, intervalMonths:t.intervalMonths, conductedAt:s.record?.date||s.record?.conductedAt, validUntil:s.due, status:s.status, exclusionId: exclusions().find(x=>x.employeeId===e.id && (x.typeId===t.id||x.instructionTypeId===t.id))?.id});
    }
  }
  return rows;
}

function stats(){
  const rows = state.statusRows.length ? state.statusRows : buildLocalStatusRows();
  return rows.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1; return a;}, {valid:0, soon:0, critical:0, expired:0, missing:0, not_required:0});
}
function badge(status){
  const map={valid:['ok','Gültig'],soon:['soon','Bald fällig'],critical:['warn','Kritisch'],expired:['bad','Abgelaufen'],missing:['warn','Fehlt'],not_required:['info','Nicht erforderlich']};
  const m=map[status]||['info',status]; return `<span class="badge ${m[0]}">${m[1]}</span>`;
}

function renderAll(){render('dashboard')}
function render(id){({dashboard:renderDashboard,companies:renderCompanies,employees:renderEmployees,instructions:renderInstructions,status:renderStatus,planning:renderPlanning,external:renderExternal,users:renderUsers,security:renderSecurity}[id]||renderDashboard)()}

function renderDashboard(){
  const s=stats();
  $('dashboard').innerHTML=`<div class="grid">
    <div class="card kpi"><div class="label">Datenquelle</div><div class="value blue">${state.source.toUpperCase()}</div><div class="muted">${state.apiAvailable?'Azure API verbunden':'Seed-Fallback'}</div></div>
    <div class="card kpi"><div class="label">Firmen</div><div class="value blue">${companies().length}</div></div>
    <div class="card kpi"><div class="label">Mitarbeiter</div><div class="value blue">${employees().length}</div></div>
    <div class="card kpi"><div class="label">Unterweisungstypen</div><div class="value blue">${types().length}</div></div>
    <div class="card kpi"><div class="label">Mail</div><div class="value ${state.mailConfig?.configured?'green':'yellow'}">${state.mailConfig?.configured?'OK':'OFF'}</div><div class="muted">${state.mailConfig?.from||'Graph fehlt'}</div></div>
    <div class="card kpi"><div class="label">Gültig</div><div class="value green">${s.valid||0}</div></div>
    <div class="card kpi"><div class="label">Bald fällig</div><div class="value yellow">${(s.soon||0)+(s.critical||0)}</div></div>
    <div class="card kpi"><div class="label">Abgelaufen</div><div class="value red">${s.expired||0}</div></div>
    <div class="card kpi"><div class="label">Fehlend</div><div class="value yellow">${s.missing||0}</div></div>
    <div class="card"><h2>Online-Version v0.7</h2><p>Diese Version enthält zusätzlich Microsoft-Entra-Login, Benutzer-/Rollenverwaltung, Microsoft-Graph-Mailversand, externe Unterweisungslinks und gehärteten Nachweis-Upload.</p></div>
  </div>`;
}
function renderCompanies(){
  $('companies').innerHTML=`<div class="card"><h2>Firmen / Mandanten</h2><div class="table-wrap"><table><thead><tr><th>Firma</th><th>ID</th><th>Sprache</th><th>Status</th></tr></thead><tbody>${companies().map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.id)}</td><td>${esc(c.defaultLanguage||'de')}</td><td>${c.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderEmployees(){
  const old = $('empSearch')?.value || '';
  $('employees').innerHTML=`<div class="card"><div class="toolbar"><h2>Mitarbeiter-Stammdaten</h2><input id="empSearch" placeholder="Suchen" value="${esc(old)}"></div>${employeeTable(old)}</div>`;
  $('empSearch').addEventListener('input', renderEmployees);
}
function employeeTable(q=''){
  q=q.toLowerCase();
  const rows=employees().filter(e=>!q || [e.name,e.email,e.department,e.role,emp(e.shiftLeaderId||e.lineManagerId).name].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Abteilung</th><th>Rolle</th><th>Line Manager</th><th>Status</th></tr></thead><tbody>${rows.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.email)}</td><td>${esc(e.department)}</td><td>${esc(e.role)}</td><td>${esc(emp(e.shiftLeaderId||e.lineManagerId).name)}</td><td>${e.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderInstructions(){
  $('instructions').innerHTML=`<div class="card"><h2>Unterweisungstypen</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Bereich</th><th>Intervall</th><th>Vorlage</th><th>Status</th></tr></thead><tbody>${types().map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.category)}</td><td>${esc(t.intervalMonths||12)} Monate</td><td>${esc((templates().find(x=>x.id===t.templateId)||{}).title||'—')}</td><td>${t.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderStatus(){
  const fStatus=$('statusFilter')?.value||'';
  const fSearch=$('statusSearch')?.value||'';
  const fType=$('typeFilter')?.value||'';
  let rows=(state.statusRows.length?state.statusRows:buildLocalStatusRows()).filter(r=>(!fStatus||r.status===fStatus)&&(!fType||r.typeId===fType));
  if(fSearch) rows=rows.filter(r=>[r.employeeName,r.email,r.department,r.lineManagerName,r.instructionName,r.category].join(' ').toLowerCase().includes(fSearch.toLowerCase()));
  $('status').innerHTML=`<div class="card"><div class="toolbar"><h2>Unterweisungsstatus</h2><div class="filters"><input id="statusSearch" placeholder="Mitarbeiter, Bereich, Line Manager" value="${esc(fSearch)}"><select id="statusFilter"><option value="">Alle Status</option>${['missing','expired','critical','soon','valid','not_required'].map(s=>`<option value="${s}" ${fStatus===s?'selected':''}>${s}</option>`).join('')}</select><select id="typeFilter"><option value="">Alle Unterweisungen</option>${types().map(t=>`<option value="${t.id}" ${fType===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div></div><div class="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Unterweisung</th><th>Bereich</th><th>Line Manager</th><th>Letztes Datum</th><th>Fällig bis</th><th>Status</th><th>Nachweis</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,800).map(r=>`<tr><td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email||'')}</span></td><td>${esc(r.instructionName)}</td><td>${esc(r.category)}</td><td>${esc(r.lineManagerName||'—')}</td><td>${fmtDate(r.conductedAt)}</td><td>${fmtDate(r.validUntil)}</td><td>${badge(r.status)}</td><td>${proofCell(r)}</td><td>${statusActions(r)}</td></tr>`).join('')}</tbody></table></div><p class="muted">${rows.length} Einträge. API-Quelle: ${state.apiAvailable?'online':'Seed-Fallback'}</p></div>`;
  ['statusSearch','statusFilter','typeFilter'].forEach(id=>$(id).addEventListener('input',renderStatus));
}

function proofCell(r){
  if(!r.recordId) return '<span class="muted">—</span>';
  const hasFile = r.certificateFileId;
  const scan = r.certificateScanStatus ? ` <span class="muted">(${esc(r.certificateScanStatus)})</span>` : '';
  const open = hasFile ? `<button class="small" onclick="openFile('${esc(r.certificateFileId)}')">Öffnen</button>${scan}` : '<span class="muted">kein Upload</span>';
  return `${open}<br><button class="small" onclick="uploadProofForRecord('${esc(r.recordId)}','${esc(r.groupId||'')}')">Nachweis hochladen</button>`;
}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result||'').split(',').pop());
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}
async function uploadProofForRecord(recordId, groupId=''){
  if(!state.apiAvailable){alert('Seed-Fallback: Nachweis-Upload braucht API/Azure Blob Storage.'); return;}
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/pdf,image/jpeg,image/png,image/webp';
  input.onchange=async()=>{
    const file=input.files && input.files[0];
    if(!file) return;
    const applyGroup = groupId && confirm('Diesen Nachweis auf alle Teilnehmer der Gruppenunterweisung übernehmen?');
    try{
      const base64=await fileToBase64(file);
      const body={recordId: applyGroup ? null : recordId, groupId: applyGroup ? groupId : null, fileName:file.name, contentType:file.type, base64};
      const result=await api('/proof-files',{method:'POST',body:JSON.stringify(body)});
      alert(`Nachweis hochgeladen. Scanstatus: ${result.scanStatus}. Aktualisierte Einträge: ${result.recordsUpdated}.`);
      await loadData(); setView('status');
    }catch(err){ alert('Upload fehlgeschlagen: '+(err.message||err)); }
  };
  input.click();
}
function statusActions(r){
  if(r.status==='not_required') return `<button class="small" onclick="removeExclusion('${esc(r.exclusionId||'')}')">Wieder erforderlich</button>`;
  return `<button class="small" onclick="markNotRequired('${esc(r.employeeId)}','${esc(r.typeId)}')">Nicht erforderlich</button> <button class="small primary" onclick="conductOne('${esc(r.employeeId)}','${esc(r.typeId)}')">Durchführen</button>`;
}
async function markNotRequired(employeeId,typeId){
  if(!state.apiAvailable){alert('Seed-Fallback: Dafür muss die API/Azure SQL laufen.'); return;}
  await api('/exclusions',{method:'POST',body:JSON.stringify({employeeId,instructionTypeId:typeId,reason:'Nicht erforderlich'})});
  await loadData(); setView('status');
}
async function removeExclusion(id){
  if(!state.apiAvailable || !id){alert('Keine Online-Exclusion-ID vorhanden.'); return;}
  await api('/exclusions/'+id,{method:'DELETE'}); await loadData(); setView('status');
}
async function conductOne(employeeId,typeId){
  if(!state.apiAvailable){alert('Seed-Fallback: Durchführung wird erst mit API/Azure SQL gespeichert.'); return;}
  const durationMinutes = Number(prompt('Dauer in Minuten?', '30') || 30);
  await api('/records',{method:'POST',body:JSON.stringify({employeeId,typeId,conductedAt:new Date().toISOString(),durationMinutes})});
  await loadData(); setView('status');
}
function renderPlanning(){
  $('planning').innerHTML=`<div class="grid"><div class="card"><h2>Unterweisung planen</h2><p class="muted">Planung speichert Termin und Teilnehmer. Über Microsoft Graph kann daraus eine echte Outlook-Mail mit ICS-Termin verschickt werden.</p><div class="form-grid"><div class="field"><label>Unterweisung</label><select id="planType">${types().map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Datum/Zeit</label><input id="planAt" type="datetime-local"></div><div class="field"><label>Dauer Minuten</label><input id="planDuration" type="number" value="30"></div><div class="field"><label>Ort</label><input id="planLocation" value="Schulungsraum / Warehouse"></div><div class="field full"><button class="primary" onclick="createPlannedTraining()">Planung speichern</button></div></div></div><div class="card"><h2>Geplante Unterweisungen</h2>${plannedTable()}</div></div>`;
}
function plannedTable(){
  const rows=plannedTrainings();
  if(!rows.length) return '<p class="muted">Noch keine geplanten Unterweisungen.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Unterweisung</th><th>Ort</th><th>Dauer</th><th>Status</th><th>Mail</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${fmtDate(p.plannedAt)}</td><td>${esc(type(p.instructionTypeId).name||p.instructionName)}</td><td>${esc(p.location||'—')}</td><td>${esc(p.durationMinutes||'—')} Min.</td><td>${esc(p.status)}</td><td><button class="small" onclick="sendPlannedMail('${esc(p.id)}')">Outlook senden</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function createPlannedTraining(){
  if(!state.apiAvailable){alert('Seed-Fallback: Planung wird erst mit API/Azure SQL gespeichert.'); return;}
  const instructionTypeId=$('planType').value;
  const plannedAt=$('planAt').value;
  if(!plannedAt){alert('Bitte Datum/Zeit eintragen.'); return;}
  await api('/planned-trainings',{method:'POST',body:JSON.stringify({instructionTypeId,plannedAt,durationMinutes:Number($('planDuration').value||30),location:$('planLocation').value})});
  await loadData(); setView('planning');
}
function renderExternal(){
  const rows=invitations();
  $('external').innerHTML=`<div class="grid">
    <div class="card"><h2>Externe Unterweisung senden</h2><p class="muted">Erzeugt einen sicheren Einmal-Link. Der Empfänger öffnet die Unterweisung, beantwortet den Test und der Abschluss erscheint danach hier.</p>
      <div class="form-grid">
        <div class="field"><label>Empfänger E-Mail</label><input id="inviteEmail" placeholder="name@firma.de"></div>
        <div class="field"><label>Name optional</label><input id="inviteName" placeholder="Vorname Nachname"></div>
        <div class="field"><label>Unterweisung</label><select id="inviteType">${types().map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Sprache</label><select id="inviteLang"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
        <div class="field"><label>Gültig Tage</label><input id="inviteDays" type="number" value="14"></div>
        <div class="field"><label>Bestehen ab %</label><input id="invitePass" type="number" value="80"></div>
        <div class="field"><label>Test erforderlich</label><select id="inviteTest"><option value="1">Ja</option><option value="0">Nein, nur Bestätigung</option></select></div>
        <div class="field"><label>Mail direkt senden</label><select id="inviteSendMail"><option value="1">Ja, per Outlook/Graph</option><option value="0">Nein, nur Link erzeugen</option></select></div><div class="field full"><button class="primary" onclick="createInvitation()">Einmal-Link erzeugen / senden</button> <button onclick="sendDueReminders()">Fällige Erinnerungen senden</button></div>
        <div class="field full"><textarea id="inviteResult" readonly placeholder="Link erscheint hier"></textarea></div>
      </div>
    </div>
    <div class="card"><h2>Einladungen / externe Abschlüsse</h2>${invitationTable(rows)}</div>
  </div>`;
}
function invitationTable(rows){
  if(!rows.length) return '<p class="muted">Noch keine externen Einladungen vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Empfänger</th><th>Unterweisung</th><th>Sprache</th><th>Status</th><th>Ablauf</th><th>Abgeschlossen</th><th>Nachweis</th><th>Mail</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.recipientName||r.employeeName||r.email)}</b><br><span class="muted">${esc(r.email||'')}</span></td><td>${esc(r.instructionName)}</td><td>${esc(r.language||'de')}</td><td>${badgeInvitation(r.status)}</td><td>${fmtDate(r.expiresAt)}</td><td>${fmtDate(r.completedAt)}</td><td>${r.certificateFileId?`<button class="small" onclick="openFile('${esc(r.certificateFileId)}')">Öffnen</button>`:'—'}</td><td>${r.mailSentAt?`<span class="muted">gesendet ${fmtDate(r.mailSentAt)}</span>`:`<button class="small" onclick="sendInvitationMail('${esc(r.id)}')">Senden</button>`}${r.mailError?`<br><span class="muted">Fehler: ${esc(r.mailError)}</span>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}
function badgeInvitation(status){
  const map={sent:['info','Gesendet'],opened:['soon','Geöffnet'],failed:['bad','Test nicht bestanden'],completed:['ok','Abgeschlossen'],cancelled:['warn','Storniert']};
  const m=map[status]||['info',status||'—']; return `<span class="badge ${m[0]}">${m[1]}</span>`;
}
async function openFile(id){
  if(!state.apiAvailable){alert('Dateien werden erst mit API/Azure Blob geöffnet.'); return;}
  const f=await api('/files/'+encodeURIComponent(id)+'/download');
  window.open(f.url,'_blank','noopener');
}
async function createInvitation(){
  if(!state.apiAvailable){alert('Seed-Fallback: Externe Links brauchen API/Azure SQL.'); return;}
  const email=$('inviteEmail').value.trim(); if(!email){alert('E-Mail fehlt.'); return;}
  const result=await api('/invitations',{method:'POST',body:JSON.stringify({email,recipientName:$('inviteName').value.trim(),instructionTypeId:$('inviteType').value,language:$('inviteLang').value,validDays:Number($('inviteDays').value||14),passPercent:Number($('invitePass').value||80),testRequired:$('inviteTest').value==='1',sendMail:$('inviteSendMail').value==='1'})});
  $('inviteResult').value=(result.mail?.sent?'Mail gesendet.\n':'')+result.url+(result.mail?.error?'\nMailfehler: '+result.mail.error:'');
  await loadData(); setView('external');
}

async function sendInvitationMail(id){
  if(!state.apiAvailable){alert('Mailversand braucht API/Azure.'); return;}
  const result=await api('/invitations/'+encodeURIComponent(id)+'/send-mail',{method:'POST',body:JSON.stringify({validDays:14})});
  alert('Mail gesendet. Neuer Link ist aktiv bis '+fmtDate(result.expiresAt));
  await loadData(); setView('external');
}
async function sendDueReminders(){
  if(!state.apiAvailable){alert('Mailversand braucht API/Azure.'); return;}
  const result=await api('/invitations/send-reminders',{method:'POST',body:JSON.stringify({dueDays:3,validDays:7,max:50})});
  alert('Erinnerungen gesendet: '+(result.sent?.length||0)+' / Fehler: '+(result.failed?.length||0));
  await loadData(); setView('external');
}
async function sendPlannedMail(id){
  if(!state.apiAvailable){alert('Outlook-Mail braucht API/Azure.'); return;}
  const result=await api('/planned-trainings/'+encodeURIComponent(id)+'/send-mail',{method:'POST',body:JSON.stringify({})});
  alert('Outlook-Mail gesendet an '+(result.recipients||0)+' Empfänger.');
  await loadData(); setView('planning');
}


function renderUsers(){
  const rows = state.users || [];
  const canEdit = state.me?.roles?.includes('company_admin') || state.me?.roles?.includes('system_admin');
  $('users').innerHTML=`<div class="grid">
    <div class="card"><h2>Benutzer / Rechte</h2><p class="muted">Diese Tabelle steuert den produktiven Zugriff. Microsoft-Login allein reicht nicht: Der Benutzer muss hier aktiv für die Firma freigeschaltet sein.</p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Letzter Zugriff</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${esc(u.displayName)}</b></td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td><td>${fmtDate(u.lastSeenAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Keine Benutzer geladen oder keine Berechtigung.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card"><h2>Benutzer anlegen</h2><p class="muted">Nur Firmen Admin/System Admin. E-Mail muss zur Microsoft-Anmeldung passen.</p>
      <div class="form-grid">
        <div class="field"><label>Name</label><input id="userName" placeholder="Vorname Nachname" ${canEdit?'':'disabled'}></div>
        <div class="field"><label>E-Mail</label><input id="userEmail" placeholder="name@firma.de" ${canEdit?'':'disabled'}></div>
        <div class="field"><label>Rolle</label><select id="userRole" ${canEdit?'':'disabled'}><option value="employee">Mitarbeiter</option><option value="line_manager">Line Manager</option><option value="hse">HSE</option><option value="company_admin">Firmen Admin</option></select></div>
        <div class="field full"><button class="primary" onclick="createUser()" ${canEdit?'':'disabled'}>Benutzer speichern</button></div>
      </div>
    </div>
  </div>`;
}
async function createUser(){
  if(!state.apiAvailable){alert('API nicht verbunden.'); return;}
  const email=$('userEmail').value.trim();
  const displayName=$('userName').value.trim() || email;
  const role=$('userRole').value;
  if(!email){alert('E-Mail fehlt.'); return;}
  await api('/users',{method:'POST',body:JSON.stringify({email,displayName,role})});
  state.users = await api('/users');
  renderUsers();
}

function renderSecurity(){
  $('security').innerHTML=`<div class="card"><h2>Sicherheitsstatus v0.6</h2><ul><li>Mandanten-Konzept über <code>companyId</code> in allen Fach-Endpunkten.</li><li>Rollenprüfung für System Admin/Firmen Admin/HSE/Line Manager/Mitarbeiter produktiv vorbereitet.</li><li>Audit-Log bei Änderungen vorbereitet.</li><li>Statusmatrix trennt Pflicht, fällig, abgelaufen und nicht erforderlich.</li><li>Externe Links verwenden Token-Hash statt Klartext-Token in SQL.</li><li>Microsoft Graph Mailversand ist vorbereitet: Einladung, Erinnerung, geplanter Gruppentermin mit ICS. Microsoft Entra Login und DB-Freischaltung sind vorbereitet. Nachweis-Upload ist gehärtet: Dateityp-/Größenprüfung, privater Blob-Speicher, Scanstatus, Downloadrechte und Audit-Log. Nächster Schritt: Backup-/Restore-Konsole und Admin-Betriebsmonitoring.</li></ul></div>`;
}
loadData();
