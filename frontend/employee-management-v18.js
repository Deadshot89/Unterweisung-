// v0.18: Mitarbeiteranlage und Excel/CSV-Import für Firmen.
// Import ist bewusst als Kopieren/Einfügen gelöst: Excel-Zeilen markieren, kopieren, hier einfügen.

function canEditEmployees(){
  const roles = state.me?.roles || [];
  return roles.includes('system_admin') || roles.includes('company_admin') || roles.includes('hse');
}

function managerOptions(selected=''){
  const list = employees().filter(e => e.active !== false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
  return `<option value="">Kein Line Manager</option>${list.map(e=>`<option value="${esc(e.id)}" ${selected===e.id?'selected':''}>${esc(e.name)}${e.email?' · '+esc(e.email):''}</option>`).join('')}`;
}

function renderEmployees(){
  const old = $('empSearch')?.value || '';
  const editable = canEditEmployees();
  const companyName = companies().find(c => c.id === state.companyId)?.name || 'Aktuelle Firma';
  $('employees').innerHTML=`<div class="grid admin-workspace">
    <div class="card span-12"><div class="toolbar admin-toolbar"><div><h2>Mitarbeiter-Stammdaten</h2><p class="muted">${esc(companyName)} · Stammdaten und Zuständigkeiten</p></div><div class="admin-search"><label for="empSearch">Mitarbeiter suchen</label><input id="empSearch" type="search" placeholder="Name, E-Mail oder Bereich" value="${esc(old)}" aria-controls="employeeResults"></div></div><div id="employeeResults">${employeeTable(old, editable)}</div></div>
    ${editable ? employeeCreateCard() + employeeImportCard() : '<div class="card span-12"><div class="notice warning">Du hast keine Berechtigung zum Bearbeiten der Mitarbeiter.</div></div>'}
  </div>`;
  $('employees').onclick = handleEmployeeWorkspaceClick;
  $('empSearch')?.addEventListener('input', event => {
    $('employeeResults').innerHTML = employeeTable(event.target.value, editable);
  });
}

function handleEmployeeWorkspaceClick(event){
  const button = event.target.closest('button[data-employee-action]');
  if(!button || !canEditEmployees()) return;
  const {employeeAction, id, active} = button.dataset;
  switch(employeeAction){
    case 'edit': return editEmployee(id);
    case 'toggle': return toggleEmployee(id, active === 'true');
    case 'save': return saveEmployee();
    case 'clear': return clearEmployeeForm();
    case 'import': return importEmployeesFromText();
    case 'clear-import': $('employeeImportText').value=''; break;
  }
}

function employeeTable(q='', editable=false){
  q=String(q||'').toLowerCase();
  const rows=employees().filter(e=>!q || [e.name,e.email,e.department,e.role,e.title,emp(e.shiftLeaderId||e.lineManagerId).name].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
  if(!rows.length) return `<p class="admin-empty" role="status">${q ? 'Keine Mitarbeiter für diese Suche gefunden.' : 'Keine Mitarbeiter vorhanden. Lege Mitarbeiter einzeln an oder nutze den Import aus Excel.'}</p>`;
  return `<div class="table-wrap admin-table-wrap"><table class="admin-table employee-table"><thead><tr><th scope="col">Mitarbeiter</th><th scope="col">Bereich / Funktion</th><th scope="col">Line Manager</th><th scope="col">Status</th><th scope="col">Aktionen</th></tr></thead><tbody>${rows.map(e=>`<tr>
    <td data-label="Mitarbeiter"><div class="admin-cell"><b>${esc(e.name)}</b><span class="muted">${esc(e.email||'—')}</span>${e.title?`<small class="muted">${esc(e.title)}</small>`:''}</div></td>
    <td data-label="Bereich / Funktion"><div class="admin-cell"><span>${esc(e.department||'—')}</span><span class="muted">${esc(e.role||'Mitarbeiter')}</span></div></td>
    <td data-label="Line Manager">${esc(emp(e.shiftLeaderId||e.lineManagerId).name)}</td>
    <td data-label="Status">${e.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td>
    <td data-label="Aktionen"><div class="admin-actions">${editable?`<button class="small" data-employee-action="edit" data-id="${esc(e.id)}">Bearbeiten</button><button class="small ghost" data-employee-action="toggle" data-id="${esc(e.id)}" data-active="${e.active===false}">${e.active!==false?'Deaktivieren':'Aktivieren'}</button>`:'—'}</div></td>
  </tr>`).join('')}</tbody></table></div><p class="muted admin-count" role="status">${rows.length} Mitarbeiter angezeigt.</p>`;
}

function employeeCreateCard(){
  return `<div class="card span-12"><h2>Mitarbeiter anlegen / bearbeiten</h2>
    <div class="form-grid">
      <input id="empEditId" type="hidden">
      <div class="field"><label for="empName">Name *</label><input id="empName" placeholder="Vorname Nachname"></div>
      <div class="field"><label for="empEmail">E-Mail</label><input id="empEmail" placeholder="name@firma.de"></div>
      <div class="field"><label for="empDepartment">Abteilung/Bereich</label><input id="empDepartment" placeholder="z. B. Lager, Produktion, Büro"></div>
      <div class="field"><label for="empRole">Rolle/Funktion</label><input id="empRole" placeholder="Mitarbeiter" value="Mitarbeiter"></div>
      <div class="field"><label for="empTitle">Position/Titel</label><input id="empTitle" placeholder="z. B. Teamleiter"></div>
      <div class="field"><label for="empChip">Chip/Personalnummer</label><input id="empChip" placeholder="optional"></div>
      <div class="field full"><label for="empLineManager">Line Manager</label><select id="empLineManager">${managerOptions()}</select></div>
      <div class="field full"><button class="primary" data-employee-action="save">Mitarbeiter speichern</button> <button class="ghost" data-employee-action="clear">Formular leeren</button></div>
    </div>
  </div>`;
}

function employeeImportCard(){
  return `<div class="card span-12"><h2>Mitarbeiter aus Excel importieren</h2>
    <p class="muted">In Excel Zeilen markieren, kopieren und hier einfügen. Erste Zeile darf Überschrift sein. Unterstützte Spalten: Name, E-Mail, Abteilung, Rolle, Chip, Line Manager.</p>
    <div class="notice"><b>Beispiel:</b><br><code>Name;E-Mail;Abteilung;Rolle;Chip;Line Manager</code><br><code>Max Mustermann;max@firma.de;Lager;Mitarbeiter;12345;Chef Name</code></div>
    <div class="field"><label for="employeeImportText">Excel-/CSV-Zeilen</label><textarea id="employeeImportText" placeholder="Name;E-Mail;Abteilung;Rolle;Chip;Line Manager\nMax Mustermann;max@firma.de;Lager;Mitarbeiter;12345;Chef Name"></textarea></div>
    <div class="toolbar"><button class="primary" data-employee-action="import">Mitarbeiter importieren</button><button class="ghost" data-employee-action="clear-import">Leeren</button></div>
    <div id="employeeImportResult" class="muted"></div>
  </div>`;
}

function parseEmployeeImportText(text){
  const lines = String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const detectDelimiter = (line) => ['\t','; ',',', ';'].reduce((best, d) => (line.split(d).length > line.split(best).length ? d : best), ';');
  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const split = (line) => line.split(delimiter).map(v=>v.trim());
  let header = split(lines[0]).map(h => h.toLowerCase());
  const hasHeader = header.some(h => ['name','mitarbeiter','e-mail','email','mail','abteilung','rolle','chip','line manager','teamleiter'].includes(h));
  const defaultHeader = ['name','email','department','role','chipNr','lineManager'];
  const rows = [];
  for(const line of lines.slice(hasHeader ? 1 : 0)){
    const cells = split(line);
    const keys = hasHeader ? header : defaultHeader;
    const row = {};
    keys.forEach((key,i)=>{
      const k = key.replace(/^e-mail$/,'email').replace(/^mail$/,'email').replace(/^abteilung$/,'department').replace(/^rolle$/,'role').replace(/^chip$/,'chipNr').replace(/^chip nr$/,'chipNr').replace(/^chip-nr$/,'chipNr').replace(/^line manager$/,'lineManager').replace(/^teamleiter$/,'lineManager').replace(/^mitarbeiter$/,'name');
      row[k] = cells[i] || '';
    });
    if(row.name || cells[0]) rows.push({ name: row.name || cells[0], email: row.email || cells[1] || '', department: row.department || cells[2] || '', role: row.role || cells[3] || 'Mitarbeiter', chipNr: row.chipNr || cells[4] || '', lineManager: row.lineManager || cells[5] || '' });
  }
  return rows;
}

function clearEmployeeForm(){
  ['empEditId','empName','empEmail','empDepartment','empTitle','empChip'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  if($('empRole')) $('empRole').value='Mitarbeiter';
  if($('empLineManager')) $('empLineManager').value='';
}

function editEmployee(id){
  const e = employees().find(x=>x.id===id);
  if(!e) return;
  $('empEditId').value = e.id;
  $('empName').value = e.name || '';
  $('empEmail').value = e.email || '';
  $('empDepartment').value = e.department || '';
  $('empRole').value = e.role || 'Mitarbeiter';
  $('empTitle').value = e.title || '';
  $('empChip').value = e.chipNr || '';
  $('empLineManager').value = e.lineManagerId || e.shiftLeaderId || '';
  window.scrollTo({ top: document.getElementById('empName').getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}

async function saveEmployee(){
  const name = $('empName').value.trim();
  if(!name){ alert('Name fehlt.'); return; }
  const id = $('empEditId').value.trim();
  const body = {
    name,
    email: $('empEmail').value.trim(),
    department: $('empDepartment').value.trim(),
    role: $('empRole').value.trim() || 'Mitarbeiter',
    title: $('empTitle').value.trim(),
    chipNr: $('empChip').value.trim(),
    lineManagerId: $('empLineManager').value || ''
  };
  try{
    if(id){ await api('/employees/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(body) }); }
    else { await api('/employees', { method:'POST', body: JSON.stringify(body) }); }
    await loadData();
    setView('employees');
    alert('Mitarbeiter gespeichert.');
  }catch(err){
    alert('Mitarbeiter konnte nicht gespeichert werden: ' + String(err.message || err));
  }
}

async function toggleEmployee(id, active){
  try{
    await api('/employees/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ active }) });
    await loadData();
    setView('employees');
  }catch(err){
    alert('Status konnte nicht geändert werden: ' + String(err.message || err));
  }
}

async function importEmployeesFromText(){
  const text = $('employeeImportText').value;
  const rows = parseEmployeeImportText(text);
  if(!rows.length){ alert('Keine Importzeilen erkannt.'); return; }
  const target = $('employeeImportResult');
  target.innerHTML = 'Import läuft ...';
  try{
    const result = await api('/employees/import', { method:'POST', body: JSON.stringify({ rows }) });
    target.innerHTML = `<div class="notice"><b>Import abgeschlossen.</b><br>${result.created||0} neu angelegt · ${result.updated||0} aktualisiert · ${result.managersLinked||0} Line Manager verknüpft${result.errors?.length ? '<br>Fehler: '+esc(result.errors.length) : ''}</div>`;
    await loadData();
    setView('employees');
  }catch(err){
    target.innerHTML = `<div class="notice dangerbox">Import fehlgeschlagen: ${esc(err.message || err)}</div>`;
  }
}
