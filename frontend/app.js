const $ = (id) => document.getElementById(id);
const state = { data: null, source: 'loading' };

function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function fmtDate(d){return d ? new Date(d).toLocaleDateString('de-DE') : '—'}

async function api(path, options={}){
  const res = await fetch('/api' + path, { headers:{'Content-Type':'application/json','x-company-id':'company-essentra'}, ...options });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadData(){
  try{
    state.data = await api('/bootstrap');
    state.source = 'api';
  }catch(err){
    const res = await fetch('/seed/essentra-startdata.json');
    state.data = await res.json();
    state.source = 'seed';
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
function emp(id){return employees().find(e=>e.id===id) || {name:'—'}}

function stats(){
  const today = new Date();
  let valid=0, expired=0, missing=0, notReq=0;
  for(const e of employees().filter(x=>x.active!==false)){
    for(const t of types()){
      const rs = records().filter(r=>r.employeeId===e.id && r.typeId===t.id);
      const last = rs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
      if(!last){missing++; continue;}
      if(last.status==='not_required'){notReq++; continue;}
      const due = last.nextDue || (last.date ? addMonths(last.date,t.intervalMonths||12) : null);
      if(due && new Date(due) < today) expired++; else valid++;
    }
  }
  return {valid, expired, missing, notReq};
}
function addMonths(dateStr, months){const d=new Date(dateStr); d.setMonth(d.getMonth()+Number(months||12)); return d.toISOString().slice(0,10)}

function renderAll(){render('dashboard')}
function render(id){({dashboard:renderDashboard,companies:renderCompanies,employees:renderEmployees,instructions:renderInstructions,external:renderExternal,security:renderSecurity}[id]||renderDashboard)()}

function renderDashboard(){
  const s=stats();
  $('dashboard').innerHTML=`<div class="grid">
    <div class="card kpi"><div class="label">Datenquelle</div><div class="value blue">${state.source.toUpperCase()}</div><div class="muted">API oder Seed</div></div>
    <div class="card kpi"><div class="label">Firmen</div><div class="value blue">${companies().length}</div></div>
    <div class="card kpi"><div class="label">Mitarbeiter</div><div class="value blue">${employees().length}</div></div>
    <div class="card kpi"><div class="label">Unterweisungstypen</div><div class="value blue">${types().length}</div></div>
    <div class="card kpi"><div class="label">Gültig</div><div class="value green">${s.valid}</div></div>
    <div class="card kpi"><div class="label">Abgelaufen</div><div class="value red">${s.expired}</div></div>
    <div class="card kpi"><div class="label">Fehlend</div><div class="value yellow">${s.missing}</div></div>
    <div class="card kpi"><div class="label">Nicht erforderlich</div><div class="value blue">${s.notReq}</div></div>
    <div class="card"><h2>Nächster Schritt</h2><p>Dieses Frontend ist vorbereitet für echte API-Daten aus Azure SQL. Die API-Endpunkte und das SQL-Schema liegen im ZIP unter <code>api/</code> und <code>database/</code>.</p></div>
  </div>`;
}
function renderCompanies(){
  $('companies').innerHTML=`<div class="card"><h2>Firmen / Mandanten</h2><div class="table-wrap"><table><thead><tr><th>Firma</th><th>ID</th><th>Status</th></tr></thead><tbody>${companies().map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.id)}</td><td><span class="badge ok">Aktiv</span></td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderEmployees(){
  $('employees').innerHTML=`<div class="card"><div class="toolbar"><h2>Mitarbeiter-Stammdaten</h2><input id="empSearch" placeholder="Suchen" oninput="renderEmployees()" value="${esc($('empSearch')?.value||'')}"></div>${employeeTable()}</div>`;
}
function employeeTable(){
  const q=($('empSearch')?.value||'').toLowerCase();
  const rows=employees().filter(e=>!q || [e.name,e.email,e.department,e.role,emp(e.shiftLeaderId).name].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Abteilung</th><th>Rolle</th><th>Line Manager</th><th>Status</th></tr></thead><tbody>${rows.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.email)}</td><td>${esc(e.department)}</td><td>${esc(e.role)}</td><td>${esc(emp(e.shiftLeaderId).name)}</td><td>${e.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderInstructions(){
  $('instructions').innerHTML=`<div class="card"><h2>Unterweisungstypen</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Bereich</th><th>Intervall</th><th>Vorlage</th></tr></thead><tbody>${types().map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.category)}</td><td>${esc(t.intervalMonths||12)} Monate</td><td>${esc((templates().find(x=>x.id===t.templateId)||{}).title||'—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderExternal(){
  $('external').innerHTML=`<div class="grid"><div class="card"><h2>Externe Unterweisung senden</h2><p class="muted">In der Produktionsversion erzeugt die API hier einen einmaligen Token-Link. Der Link wird per Outlook/Microsoft Graph versendet und der Abschluss landet automatisch in Azure SQL.</p><div class="form-grid"><div class="field"><label>Empfänger E-Mail</label><input id="inviteEmail" placeholder="name@firma.de"></div><div class="field"><label>Unterweisung</label><select>${types().map(t=>`<option>${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Sprache</label><select><option>Deutsch</option><option>Englisch</option><option>Polnisch</option></select></div><div class="field full"><button class="primary" onclick="alert('Nächster Schritt: API /api/invitations aktivieren und Mailversand anbinden.')">Einladung vorbereiten</button></div></div></div></div>`;
}
function renderSecurity(){
  $('security').innerHTML=`<div class="card"><h2>Sicherheitsstatus v0.1</h2><ul><li>Mandanten-Konzept über <code>companyId</code> vorbereitet.</li><li>API-Ordner für Azure Functions vorbereitet.</li><li>SQL-Schema mit Audit-Log vorbereitet.</li><li>PDFs liegen nicht mehr in Browserdaten, sondern werden für Blob Storage vorbereitet.</li><li>Login/Rollen werden als nächster Schritt mit Microsoft Entra angebunden.</li></ul></div>`;
}
loadData();
