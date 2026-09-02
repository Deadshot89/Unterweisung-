// v0.26: Essentra-Live-Pruefkonsole im Dashboard.
// Ziel: Erst Funktionen fuer Essentra stabil testen, danach Design.

const ESSENTRA_LIVE_CHECK_KEY = 'um_essentra_live_check_v26';

const ESSENTRA_LIVE_CHECKS = [
  {
    group: 'Grundlage / Verbindung',
    items: [
      ['deployVisible', 'Aktuelle Online-Version sichtbar', 'Website neu laden mit Strg+F5 und prüfen, ob v0.25 oder höher angezeigt wird.'],
      ['apiConnected', 'Azure API verbunden', 'Dashboard muss Datenquelle API anzeigen, nicht Seed-Fallback.'],
      ['essentraLoaded', 'Essentra-Daten geladen', 'Firmen 1, Mitarbeiter und Unterweisungstypen müssen geladen sein.'],
      ['systemAdminVisible', 'System-Admin-Rechte sichtbar', 'Oben muss Tobias mit system_admin/company_admin/hse angezeigt werden.']
    ]
  },
  {
    group: 'Mitarbeiter / Benutzer',
    items: [
      ['employeeCreate', 'Mitarbeiter einzeln anlegen', 'Testmitarbeiter anlegen und danach wieder deaktivieren oder löschen/überschreiben.'],
      ['employeeImport', 'Mitarbeiter-Import testen', 'Mindestens 2 kopierte Excel/CSV-Zeilen importieren.'],
      ['lineManagerAssign', 'Line Manager zuordnen', 'Line Manager setzen und in Mitarbeiterliste/Status prüfen.'],
      ['userRoles', 'Benutzer/Rechte testen', 'Testbenutzer mit Rolle anlegen, Rolle ändern, aktiv/inaktiv prüfen.']
    ]
  },
  {
    group: 'Unterweisungen / Vorlagen / Fragen',
    items: [
      ['instructionCreate', 'Unterweisungstyp anlegen/bearbeiten', 'Name, Kategorie, Intervall und Status ändern.'],
      ['templateUpload', 'Unterweisungsunterlage hochladen', 'PDF/JPG/PNG hochladen und der Unterweisung zuordnen.'],
      ['templateOpen', 'Unterlage wieder öffnen', 'Hochgeladene Unterlage über Blob-Download öffnen.'],
      ['questionCreate', 'Testfragen anlegen/bearbeiten', 'Frage mit 4 Antworten speichern und richtige Antwort prüfen.']
    ]
  },
  {
    group: 'Planung / Durchführung / Status',
    items: [
      ['planningCreate', 'Unterweisung planen', 'Termin mit mehreren Teilnehmern speichern.'],
      ['planningEdit', 'Planung bearbeiten', 'Ort, Zeit, Teilnehmer oder Line Manager ändern.'],
      ['planningComplete', 'Planung abschließen', 'Planung als durchgeführt abschließen.'],
      ['statusUpdates', 'Status aktualisiert sich', 'Nach Abschluss muss der Status der Teilnehmer gültig werden.'],
      ['bulkComplete', 'Sammelabschluss testen', 'Mehrere Statuszeilen markieren und gemeinsam abschließen.'],
      ['statusCsv', 'CSV-Export testen', 'Statusliste exportieren und Datei öffnen.']
    ]
  },
  {
    group: 'Externe Unterweisung / Nachweise',
    items: [
      ['externalLink', 'Einmal-Link erzeugen', 'Aus Status oder Externe Links einen Link erzeugen.'],
      ['externalOpen', 'Externen Link öffnen', 'Link in neuem Fenster öffnen und Unterlage/Test prüfen.'],
      ['externalComplete', 'Externen Test abschließen', 'Test bestehen und Abschluss speichern.'],
      ['externalNoRepeat', 'Link nach Abschluss gesperrt', 'Abgeschlossenen Link erneut öffnen und Sperre prüfen.'],
      ['proofUploadSingle', 'Nachweis einzeln hochladen', 'Nachweis zu einem Unterweisungseintrag hochladen.'],
      ['proofUploadGroup', 'Nachweis Gruppe übernehmen', 'Nachweis auf Gruppenunterweisung anwenden.']
    ]
  },
  {
    group: 'Betrieb / Sicherheit',
    items: [
      ['backupHealth', 'Healthcheck starten', 'Betrieb/Backup öffnen und Healthcheck starten.'],
      ['backupExport', 'Backup exportieren', 'Backup erzeugen und Download-Link prüfen.'],
      ['restoreValidate', 'Restore-Prüfung starten', 'Restore-Prüfung für ein Backup ausführen.'],
      ['auditVisible', 'Audit/Security-Events sichtbar', 'Änderungen müssen im Audit/Security-Bereich auftauchen.'],
      ['roleGuard', 'Rollen-Oberfläche testen', 'Mit anderer Rolle prüfen, ob gesperrte Bereiche ausgeblendet/blockiert sind.']
    ]
  }
];

function readEssentraLiveCheckState(){
  try{ return JSON.parse(localStorage.getItem(ESSENTRA_LIVE_CHECK_KEY) || '{}'); }
  catch{ return {}; }
}

function writeEssentraLiveCheckState(next){
  localStorage.setItem(ESSENTRA_LIVE_CHECK_KEY, JSON.stringify(next));
}

function allEssentraChecks(){
  return ESSENTRA_LIVE_CHECKS.flatMap(g => g.items.map(item => ({ group:g.group, id:item[0], label:item[1], hint:item[2] })));
}

function essentraProgress(){
  const stateMap = readEssentraLiveCheckState();
  const all = allEssentraChecks();
  const done = all.filter(x => stateMap[x.id]?.done === true).length;
  return { done, total: all.length, percent: all.length ? Math.round(done / all.length * 100) : 0 };
}

function setEssentraCheck(id, checked){
  const stateMap = readEssentraLiveCheckState();
  stateMap[id] = { ...(stateMap[id] || {}), done: checked, changedAt: new Date().toISOString() };
  writeEssentraLiveCheckState(stateMap);
  renderEssentraLiveCheck();
}

function setEssentraNote(id, value){
  const stateMap = readEssentraLiveCheckState();
  stateMap[id] = { ...(stateMap[id] || {}), note: String(value || '').slice(0, 1000), changedAt: new Date().toISOString() };
  writeEssentraLiveCheckState(stateMap);
}

function renderEssentraLiveCheck(){
  const target = document.getElementById('essentraLiveCheck');
  if(!target) return;
  const stateMap = readEssentraLiveCheckState();
  const p = essentraProgress();
  target.innerHTML = `<div class="card span-12">
    <div class="toolbar">
      <div><h2>Essentra Live-Prüfung</h2><p class="muted">Erst diese Funktionsprüfung abarbeiten. Danach starten wir mit dem Design.</p></div>
      <div class="filters"><button class="primary" onclick="runEssentraSmokeCheck()">API-Smokecheck</button><button class="ghost" onclick="exportEssentraLiveCheck()">Prüfstand exportieren</button><button class="ghost" onclick="resetEssentraLiveCheck()">Zurücksetzen</button></div>
    </div>
    <div class="grid compact-kpis">
      <div class="card kpi mini"><div class="label">Erledigt</div><div class="value green">${p.done}</div></div>
      <div class="card kpi mini"><div class="label">Offen</div><div class="value yellow">${p.total - p.done}</div></div>
      <div class="card kpi mini"><div class="label">Fortschritt</div><div class="value blue">${p.percent}%</div></div>
    </div>
    <div id="essentraSmokeResult"></div>
    ${ESSENTRA_LIVE_CHECKS.map(group => `<details open class="live-check-group"><summary><b>${esc(group.group)}</b></summary>
      <div class="table-wrap"><table><thead><tr><th>OK</th><th>Prüfpunkt</th><th>Was testen?</th><th>Notiz / Fehler</th></tr></thead><tbody>${group.items.map(item => {
        const id = item[0];
        const row = stateMap[id] || {};
        return `<tr>
          <td><input type="checkbox" ${row.done?'checked':''} onchange="setEssentraCheck('${esc(id)}', this.checked)"></td>
          <td><b>${esc(item[1])}</b>${row.changedAt?`<br><span class="muted">${fmtDate(row.changedAt)}</span>`:''}</td>
          <td>${esc(item[2])}</td>
          <td><textarea class="small-note" placeholder="Fehler oder Ergebnis notieren" oninput="setEssentraNote('${esc(id)}', this.value)">${esc(row.note || '')}</textarea></td>
        </tr>`;
      }).join('')}</tbody></table></div>
    </details>`).join('')}
  </div>`;
}

async function runEssentraSmokeCheck(){
  const target = document.getElementById('essentraSmokeResult');
  if(!target) return;
  target.innerHTML = '<div class="notice">API-Smokecheck läuft ...</div>';
  const checks = [
    ['me', () => api('/me')],
    ['bootstrap', () => api('/bootstrap')],
    ['instruction-status', () => api('/instruction-status')],
    ['users', () => api('/users')],
    ['planned-trainings', () => api('/planned-trainings')],
    ['test-questions', () => api('/test-questions')]
  ];
  const results = [];
  for(const [name, fn] of checks){
    try{
      const data = await fn();
      results.push({ name, ok:true, count:Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0) });
    }catch(err){
      results.push({ name, ok:false, error:String(err.message || err).slice(0, 300) });
    }
  }
  const ok = results.every(r => r.ok);
  target.innerHTML = `<div class="notice ${ok?'':'dangerbox'}"><b>API-Smokecheck: ${ok?'OK':'Fehler gefunden'}</b><pre>${esc(JSON.stringify(results, null, 2))}</pre></div>`;
}

function exportEssentraLiveCheck(){
  const stateMap = readEssentraLiveCheckState();
  const p = essentraProgress();
  const lines = [`Essentra Live-Pruefung v0.26`, `Stand: ${new Date().toLocaleString('de-DE')}`, `Fortschritt: ${p.done}/${p.total} (${p.percent}%)`, ''];
  for(const group of ESSENTRA_LIVE_CHECKS){
    lines.push(group.group);
    for(const item of group.items){
      const row = stateMap[item[0]] || {};
      lines.push(`${row.done?'[OK]':'[OFFEN]'} ${item[1]} - ${item[2]}${row.note ? ' | Notiz: ' + row.note : ''}`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  try{ navigator.clipboard.writeText(text); }catch{}
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `essentra-live-pruefung-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetEssentraLiveCheck(){
  if(!confirm('Essentra-Prüfstand wirklich zurücksetzen?')) return;
  localStorage.removeItem(ESSENTRA_LIVE_CHECK_KEY);
  renderEssentraLiveCheck();
}

const originalRenderDashboardV26 = window.renderDashboard;
window.renderDashboard = function renderDashboard(){
  if(typeof originalRenderDashboardV26 === 'function') originalRenderDashboardV26();
  const dashboard = document.getElementById('dashboard');
  if(!dashboard) return;
  const existing = document.getElementById('essentraLiveCheck');
  if(!existing){
    const holder = document.createElement('div');
    holder.id = 'essentraLiveCheck';
    holder.className = 'grid';
    dashboard.appendChild(holder);
  }
  renderEssentraLiveCheck();
};

window.setEssentraCheck = setEssentraCheck;
window.setEssentraNote = setEssentraNote;
window.runEssentraSmokeCheck = runEssentraSmokeCheck;
window.exportEssentraLiveCheck = exportEssentraLiveCheck;
window.resetEssentraLiveCheck = resetEssentraLiveCheck;

const style = document.createElement('style');
style.textContent = `
  .live-check-group{margin:12px 0;border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff}
  .live-check-group summary{cursor:pointer;padding:8px}
  .small-note{min-height:54px;width:100%;font-size:12px}
`;
document.head.appendChild(style);
