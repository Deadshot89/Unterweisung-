// v0.15: Firmenbezogene Mail-Einstellungen.
// Jede Firma/Mandant kann eigenen Mailmodus, Absenderhinweis, Antwortadresse und Signatur pflegen.

async function loadCompanyMailSettings(force=false){
  if(state.companyMailSettings && !force) return state.companyMailSettings;
  if(!state.apiAvailable && !API_BASE_URL){
    state.companyMailSettings = {
      mailMode: 'manual',
      mailFromName: 'Unterweisungsmanager',
      mailFromEmail: '',
      replyToEmail: '',
      mailSubjectPrefix: 'Unterweisung',
      mailSignature: 'Vielen Dank.',
      migrationReady: false
    };
    return state.companyMailSettings;
  }
  try{
    state.companyMailSettings = await api('/company-mail-settings');
  }catch(err){
    state.companyMailSettings = {
      mailMode: 'manual',
      mailFromName: 'Unterweisungsmanager',
      mailFromEmail: '',
      replyToEmail: '',
      mailSubjectPrefix: 'Unterweisung',
      mailSignature: 'Vielen Dank.',
      error: String(err.message || err),
      migrationReady: false
    };
  }
  return state.companyMailSettings;
}

function mailModeLabel(mode){
  return ({
    manual: 'Nur Link + Mailtext',
    outlook: 'Mailprogramm öffnen',
    graph: 'Microsoft Graph automatisch'
  })[mode || 'manual'] || 'Nur Link + Mailtext';
}

function renderCompanies(){
  const settings = state.companyMailSettings;
  const companyRows = companies().map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.id)}</td><td>${esc(c.defaultLanguage||'de')}</td><td>${c.active!==false?'<span class="badge ok">Aktiv</span>':'<span class="badge warn">Inaktiv</span>'}</td></tr>`).join('');

  $('companies').innerHTML = `<div class="grid">
    <div class="card span-12"><h2>Firmen / Mandanten</h2><div class="table-wrap"><table><thead><tr><th>Firma</th><th>ID</th><th>Sprache</th><th>Status</th></tr></thead><tbody>${companyRows}</tbody></table></div></div>
    <div class="card span-12"><div class="toolbar"><div><h2>Mailversand dieser Firma</h2><p class="muted">Diese Werte gelten nur für den aktuell angemeldeten Mandanten <b>${esc(state.companyId || DEFAULT_COMPANY_ID)}</b>. So kann Firma A später mit ZZ und Firma B mit YY arbeiten.</p></div><button class="ghost" onclick="loadCompanyMailSettings(true).then(renderCompanies)">Neu laden</button></div>
      ${settings ? renderCompanyMailSettingsForm(settings) : '<p class="muted">Mail-Einstellungen werden geladen ...</p>'}
    </div>
  </div>`;

  if(!settings){
    loadCompanyMailSettings().then(()=>renderCompanies());
  }
}

function renderCompanyMailSettingsForm(s){
  const graphHint = s.mailMode === 'graph'
    ? '<div class="notice warning"><b>Hinweis:</b> Graph funktioniert nur, wenn diese Firma später ihren Microsoft-365-Tenant freigibt und die Absender-Mailbox dort existiert.</div>'
    : '<div class="notice"><b>Aktueller Modus:</b> Link/Mailtext funktionieren ohne Microsoft-365-Firmenkonto.</div>';
  const migrationHint = s.migrationReady === false
    ? '<div class="notice warning"><b>Datenbankmigration läuft eventuell noch.</b> Nach GitHub Seed/Migration bitte neu laden.</div>'
    : '';

  return `${migrationHint}${graphHint}
    <div class="form-grid">
      <div class="field"><label>Mailmodus</label><select id="companyMailMode">
        <option value="manual" ${s.mailMode==='manual'?'selected':''}>Nur Link + Mailtext erzeugen</option>
        <option value="outlook" ${s.mailMode==='outlook'?'selected':''}>Mailprogramm / Outlook öffnen</option>
        <option value="graph" ${s.mailMode==='graph'?'selected':''}>Microsoft Graph automatisch senden</option>
      </select></div>
      <div class="field"><label>Absendername / Anzeigename</label><input id="companyMailFromName" value="${esc(s.mailFromName||'Unterweisungsmanager')}" placeholder="z. B. Firma A Unterweisungen"></div>
      <div class="field"><label>Absenderadresse / Firmenadresse</label><input id="companyMailFromEmail" value="${esc(s.mailFromEmail||'')}" placeholder="z. B. zz@firma-a.de"></div>
      <div class="field"><label>Antwort an</label><input id="companyReplyToEmail" value="${esc(s.replyToEmail||'')}" placeholder="z. B. sicherheit@firma-a.de"></div>
      <div class="field"><label>Betreff-Präfix</label><input id="companyMailSubjectPrefix" value="${esc(s.mailSubjectPrefix||'Unterweisung')}" placeholder="Unterweisung"></div>
      <div class="field"><label>Zuletzt geändert</label><input disabled value="${esc(fmtDate(s.mailUpdatedAt))}"></div>
      <div class="field full"><label>Signatur</label><textarea id="companyMailSignature" placeholder="Vielen Dank.">${esc(s.mailSignature||'Vielen Dank.')}</textarea></div>
      <div class="field full"><button class="primary" onclick="saveCompanyMailSettings()">Mail-Einstellungen speichern</button></div>
    </div>
    <p class="muted">Für deinen aktuellen Test bleibt <b>Nur Link + Mailtext erzeugen</b> die sichere Standardlösung. Automatisches Graph-Senden wird erst für Firmenkunden mit eigener Freigabe produktiv aktiviert.</p>`;
}

async function saveCompanyMailSettings(){
  if(!state.apiAvailable && !API_BASE_URL){ alert('API nicht verbunden.'); return; }
  const body = {
    mailMode: $('companyMailMode').value,
    mailFromName: $('companyMailFromName').value.trim(),
    mailFromEmail: $('companyMailFromEmail').value.trim(),
    replyToEmail: $('companyReplyToEmail').value.trim(),
    mailSubjectPrefix: $('companyMailSubjectPrefix').value.trim(),
    mailSignature: $('companyMailSignature').value.trim()
  };
  try{
    const result = await api('/company-mail-settings', { method: 'PATCH', body: JSON.stringify(body) });
    state.companyMailSettings = result.settings || body;
    alert('Mail-Einstellungen gespeichert.');
    renderCompanies();
  }catch(err){
    alert('Mail-Einstellungen konnten nicht gespeichert werden: ' + String(err.message || err));
  }
}
