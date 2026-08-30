const $ = (id) => document.getElementById(id);
const state = { data: null, source: 'loading', statusRows: [], apiAvailable: false };

function esc(s=''){return String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function fmtDate(d){return d ? new Date(d).toLocaleDateString('de-DE') : '—'}
function isoDate(d){return d ? new Date(d).toISOString().slice(0,10) : ''}
function addMonths(dateStr, months){const d=new Date(dateStr); d.setMonth(d.getMonth()+Number(months||12)); return d.toISOString().slice(0,10)}
function todayIso(){return new Date().toISOString().slice(0,10)}

async function api(path, options={}){
  const headers = {'Content-Type':'application/json','x-company-id':'company-essentra', ...(options.headers||{})};
  const res = await fetch('/api' + path, {...options, headers});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadData(){
  try{
    state.data = await api('/bootstrap');
    state.apiAvailable = true;
    state.source = 'api';
    try { state.statusRows = await api('/instruction-status'); } catch { state.statusRows = buildLocalStatusRows(); }
  }catch(err){
    const res = await fetch('/seed/essentra-startdata.json');
    state.data = await res.json();
    state.apiAvailable = false;
    state.source = 'seed';
    state.statusRows = buildLocalStatusRows();
  }
  renderAll();
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
function render(id){({dashboard:renderDashboard,companies:renderCompanies,employees:renderEmployees,instructions:renderInstructions,status:renderStatus,planning:renderPlanning,external:renderExternal,security:renderSecurity}[id]||renderDashboard)()}

function renderDashboard(){
  const s=stats();
  $('dashboard').innerHTML=`<div class="grid">
    <div class="card kpi"><div class="label">Datenquelle</div><div class="value blue">${state.source.toUpperCase()}</div><div class="muted">${state.apiAvailable?'Azure API verbunden':'Seed-Fallback'}</div></div>
    <div class="card kpi"><div class="label">Firmen</div><div class="value blue">${companies().length}</div></div>
    <div class="card kpi"><div class="label">Mitarbeiter</div><div class="value blue">${employees().length}</div></div>
    <div class="card kpi"><div class="label">Unterweisungstypen</div><div class="value blue">${types().length}</div></div>
    <div class="card kpi"><div class="label">Gültig</div><div class="value green">${s.valid||0}</div></div>
    <div class="card kpi"><div class="label">Bald fällig</div><div class="value yellow">${(s.soon||0)+(s.critical||0)}</div></div>
    <div class="card kpi"><div class="label">Abgelaufen</div><div class="value red">${s.expired||0}</div></div>
    <div class="card kpi"><div class="label">Fehlend</div><div class="value yellow">${s.missing||0}</div></div>
    <div class="card"><h2>Online-Version v0.4</h2><p>Diese Version enthält die externe Unterweisungsstrecke: Einmal-Link öffnen, Unterlage ansehen, Test beantworten, Abschluss speichern und Nachweisdatei vorbereiten.</p></div>
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
  $('status').innerHTML=`<div class="card"><div class="toolbar"><h2>Unterweisungsstatus</h2><div class="filters"><input id="statusSearch" placeholder="Mitarbeiter, Bereich, Line Manager" value="${esc(fSearch)}"><select id="statusFilter"><option value="">Alle Status</option>${['missing','expired','critical','soon','valid','not_required'].map(s=>`<option value="${s}" ${fStatus===s?'selected':''}>${s}</option>`).join('')}</select><select id="typeFilter"><option value="">Alle Unterweisungen</option>${types().map(t=>`<option value="${t.id}" ${fType===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div></div><div class="table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Unterweisung</th><th>Bereich</th><th>Line Manager</th><th>Letztes Datum</th><th>Fällig bis</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,800).map(r=>`<tr><td><b>${esc(r.employeeName)}</b><br><span class="muted">${esc(r.email||'')}</span></td><td>${esc(r.instructionName)}</td><td>${esc(r.category)}</td><td>${esc(r.lineManagerName||'—')}</td><td>${fmtDate(r.conductedAt)}</td><td>${fmtDate(r.validUntil)}</td><td>${badge(r.status)}</td><td>${statusActions(r)}</td></tr>`).join('')}</tbody></table></div><p class="muted">${rows.length} Einträge. API-Quelle: ${state.apiAvailable?'online':'Seed-Fallback'}</p></div>`;
  ['statusSearch','statusFilter','typeFilter'].forEach(id=>$(id).addEventListener('input',renderStatus));
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
  $('planning').innerHTML=`<div class="grid"><div class="card"><h2>Unterweisung planen</h2><p class="muted">Hier wird später zusätzlich Microsoft Graph für echte Outlook-Einladungen angebunden. Aktuell speichert die API den Termin und Teilnehmer.</p><div class="form-grid"><div class="field"><label>Unterweisung</label><select id="planType">${types().map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Datum/Zeit</label><input id="planAt" type="datetime-local"></div><div class="field"><label>Dauer Minuten</label><input id="planDuration" type="number" value="30"></div><div class="field"><label>Ort</label><input id="planLocation" value="Schulungsraum / Warehouse"></div><div class="field full"><button class="primary" onclick="createPlannedTraining()">Planung speichern</button></div></div></div><div class="card"><h2>Geplante Unterweisungen</h2>${plannedTable()}</div></div>`;
}
function plannedTable(){
  const rows=plannedTrainings();
  if(!rows.length) return '<p class="muted">Noch keine geplanten Unterweisungen.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Unterweisung</th><th>Ort</th><th>Dauer</th><th>Status</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${fmtDate(p.plannedAt)}</td><td>${esc(type(p.instructionTypeId).name||p.instructionName)}</td><td>${esc(p.location||'—')}</td><td>${esc(p.durationMinutes||'—')} Min.</td><td>${esc(p.status)}</td></tr>`).join('')}</tbody></table></div>`;
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
        <div class="field full"><button class="primary" onclick="createInvitation()">Einmal-Link erzeugen</button></div>
        <div class="field full"><textarea id="inviteResult" readonly placeholder="Link erscheint hier"></textarea></div>
      </div>
    </div>
    <div class="card"><h2>Einladungen / externe Abschlüsse</h2>${invitationTable(rows)}</div>
  </div>`;
}
function invitationTable(rows){
  if(!rows.length) return '<p class="muted">Noch keine externen Einladungen vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Empfänger</th><th>Unterweisung</th><th>Sprache</th><th>Status</th><th>Ablauf</th><th>Abgeschlossen</th><th>Nachweis</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.recipientName||r.employeeName||r.email)}</b><br><span class="muted">${esc(r.email||'')}</span></td><td>${esc(r.instructionName)}</td><td>${esc(r.language||'de')}</td><td>${badgeInvitation(r.status)}</td><td>${fmtDate(r.expiresAt)}</td><td>${fmtDate(r.completedAt)}</td><td>${r.certificateFileId?`<button class="small" onclick="openFile('${esc(r.certificateFileId)}')">Öffnen</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
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
  const result=await api('/invitations',{method:'POST',body:JSON.stringify({email,recipientName:$('inviteName').value.trim(),instructionTypeId:$('inviteType').value,language:$('inviteLang').value,validDays:Number($('inviteDays').value||14),passPercent:Number($('invitePass').value||80),testRequired:$('inviteTest').value==='1'})});
  $('inviteResult').value=result.url;
  await loadData(); setView('external');
}
function renderSecurity(){
  $('security').innerHTML=`<div class="card"><h2>Sicherheitsstatus v0.4</h2><ul><li>Mandanten-Konzept über <code>companyId</code> in allen Fach-Endpunkten.</li><li>Rollenprüfung für Admin/HSE/Line Manager vorbereitet.</li><li>Audit-Log bei Änderungen vorbereitet.</li><li>Statusmatrix trennt Pflicht, fällig, abgelaufen und nicht erforderlich.</li><li>Externe Links verwenden Token-Hash statt Klartext-Token in SQL.</li><li>Nächster Schritt: Microsoft Graph Mailversand, echtes PDF-Rendering und Entra Rollen produktiv aktivieren.</li></ul></div>`;
}
loadData();
