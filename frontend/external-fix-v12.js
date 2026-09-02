// Hotfix v0.15: Externe Links + Firmen-Mailsteuerung.
// Standard ist manuelle Mail: Link erzeugen, Mailtext kopieren, kein Graph-Zwang.

async function getCompanyMailSettingsSafe(){
  if(state.companyMailSettings) return state.companyMailSettings;
  if(!state.apiAvailable && !API_BASE_URL){
    state.companyMailSettings = { mailMode:'manual', mailFromName:'Unterweisungsmanager', mailSubjectPrefix:'Unterweisung', mailSignature:'Vielen Dank.' };
    return state.companyMailSettings;
  }
  try{
    state.companyMailSettings = await api('/company-mail-settings');
  }catch{
    state.companyMailSettings = { mailMode:'manual', mailFromName:'Unterweisungsmanager', mailSubjectPrefix:'Unterweisung', mailSignature:'Vielen Dank.' };
  }
  return state.companyMailSettings;
}

function selectedMailMode(settings){
  const mode = settings?.mailMode || 'manual';
  return ['manual','outlook','graph'].includes(mode) ? mode : 'manual';
}

function buildManualInvitationText(result, form, settings={}){
  const typeName = type(form.instructionTypeId).name || 'Unterweisung';
  const recipient = form.recipientName || 'Teilnehmer/in';
  const prefix = settings.mailSubjectPrefix || 'Unterweisung';
  const subject = `${prefix}: ${typeName}`;
  const reply = settings.replyToEmail ? `\n\nBei Rückfragen bitte antworten an: ${settings.replyToEmail}` : '';
  const sender = settings.mailFromName ? `\n\nAbsender: ${settings.mailFromName}${settings.mailFromEmail ? ' <' + settings.mailFromEmail + '>' : ''}` : '';
  const signature = settings.mailSignature || 'Vielen Dank.';
  return `Betreff: ${subject}\n\nHallo ${recipient},\n\nbitte führe die folgende Unterweisung durch:\n${typeName}\n\nLink zur Unterweisung:\n${result.url}\n\nDer Link ist zeitlich begrenzt gültig. Bitte öffne den Link am Rechner oder Handy, lies die Unterweisung vollständig und schließe den Test ab. Nach Abschluss wird der Status automatisch im Unterweisungsmanager gespeichert.${reply}${sender}\n\n${signature}`;
}

function mailSubjectFromText(text){
  const line = String(text || '').split('\n')[0] || 'Betreff: Unterweisung durchführen';
  return line.replace(/^Betreff:\s*/i,'').trim() || 'Unterweisung durchführen';
}

function mailBodyFromText(text){
  return String(text || '').replace(/^Betreff:.*\n\n?/i,'');
}

function openMailClient(email, text){
  const subject = mailSubjectFromText(text);
  const body = mailBodyFromText(text);
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function scoreLabel(row){
  if(row.scorePercent === null || row.scorePercent === undefined || row.scorePercent === '') return '—';
  const score = Number(row.scorePercent);
  if(!Number.isFinite(score)) return '—';
  return `${score.toLocaleString('de-DE', {maximumFractionDigits: 2})} %`;
}

function resultBadge(row){
  if(row.passed === true || row.passed === 1) return '<span class="badge ok">Bestanden</span>';
  if(row.passed === false || row.passed === 0) return '<span class="badge bad">Nicht bestanden</span>';
  if(row.status === 'completed') return '<span class="badge ok">Abgeschlossen</span>';
  return '<span class="badge info">Offen</span>';
}

function invitationTable(rows){
  if(!rows.length) return '<p class="muted">Noch keine externen Einladungen vorhanden.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Empfänger</th><th>Unterweisung</th><th>Status</th><th>Testergebnis</th><th>Fragen</th><th>Ablauf</th><th>Abgeschlossen</th><th>Nachweis</th><th>Mail</th></tr></thead><tbody>${rows.map(r=>{
    const questions = r.answeredQuestions ? `${Number(r.answeredQuestions).toLocaleString('de-DE')} beantwortet` : '—';
    return `<tr>
      <td><b>${esc(r.recipientName||r.employeeName||r.email)}</b><br><span class="muted">${esc(r.email||'')}</span></td>
      <td>${esc(r.instructionName)}<br><span class="muted">${esc((r.language||'de').toUpperCase())}</span></td>
      <td>${badgeInvitation(r.status)}<br>${resultBadge(r)}</td>
      <td><b>${scoreLabel(r)}</b><br><span class="muted">Bestehen ab ${esc(r.passPercent||80)} %</span></td>
      <td>${questions}</td>
      <td>${fmtDate(r.expiresAt)}</td>
      <td>${fmtDate(r.completedAt || r.testCompletedAt)}</td>
      <td>${r.certificateFileId?`<button class="small" onclick="openFile('${esc(r.certificateFileId)}')">Nachweis öffnen</button>`:'—'}</td>
      <td>${r.mailSentAt?`<span class="muted">gesendet ${fmtDate(r.mailSentAt)}</span>`:`<span class="muted">manuell / Link</span>`}${r.mailError?`<br><span class="muted">Fehler: ${esc(r.mailError)}</span>`:''}</td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderExternal(){
  const rows = invitations();
  const instructionTypes = types().filter(t => t && t.active !== false);
  const apiText = state.apiAvailable ? 'Azure API verbunden' : (API_BASE_URL ? 'API konfiguriert, Status wird beim Senden geprüft' : 'Keine API konfiguriert');
  const apiClass = state.apiAvailable || API_BASE_URL ? 'ok' : 'warn';
  const settings = state.companyMailSettings;
  const defaultMode = selectedMailMode(settings);
  const settingsLine = settings ? `${mailModeLabel(defaultMode)} · ${settings.mailFromName || 'Unterweisungsmanager'}${settings.replyToEmail ? ' · Antwort an ' + settings.replyToEmail : ''}` : 'Firmen-Mailsteuerung wird geladen ...';

  $('external').innerHTML = `<div class="grid">
    <div class="card span-12">
      <h2>Externe Unterweisung senden</h2>
      <p class="muted">Erzeugt einen sicheren Einmal-Link. Der Empfänger liest die Unterweisung, beantwortet den Test und der Abschluss erscheint danach automatisch unten in der Tabelle.</p>
      <div class="notice"><b>API-Status:</b> ${badge(apiClass === 'ok' ? 'valid' : 'missing')} ${esc(apiText)}<br><b>Mailsteuerung:</b> ${esc(settingsLine)}</div>
      <div class="form-grid external-form">
        <div class="field"><label>Empfänger E-Mail</label><input id="inviteEmail" placeholder="name@firma.de"></div>
        <div class="field"><label>Name optional</label><input id="inviteName" placeholder="Vorname Nachname"></div>
        <div class="field"><label>Unterweisung</label><select id="inviteType">${instructionTypes.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Sprache</label><select id="inviteLang"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
        <div class="field"><label>Gültig Tage</label><input id="inviteDays" type="number" value="14" min="1" max="365"></div>
        <div class="field"><label>Bestehen ab %</label><input id="invitePass" type="number" value="80" min="0" max="100"></div>
        <div class="field"><label>Test erforderlich</label><select id="inviteTest"><option value="1">Ja</option><option value="0">Nein, nur Bestätigung</option></select></div>
        <div class="field"><label>Mailmodus</label><select id="inviteMailMode">
          <option value="manual" ${defaultMode==='manual'?'selected':''}>Nur Link + Mailtext erzeugen</option>
          <option value="outlook" ${defaultMode==='outlook'?'selected':''}>Mailprogramm / Outlook öffnen</option>
          <option value="graph" ${defaultMode==='graph'?'selected':''}>Graph senden (nur Firmenmail aktiv)</option>
        </select></div>
        <div class="field full"><button class="primary" onclick="createInvitation()">Einmal-Link erzeugen</button></div>
        <div class="field full"><textarea id="inviteResult" readonly placeholder="Link und Mailtext erscheinen hier"></textarea></div>
      </div>
    </div>
    <div class="card span-12"><div class="toolbar"><h2>Einladungen / externe Abschlüsse</h2><button class="ghost" onclick="loadData().then(()=>setView('external'))">Aktualisieren</button></div>${invitationTable(rows)}</div>
  </div>`;

  if(!instructionTypes.length){
    $('inviteResult').value = 'Keine Unterweisungstypen geladen. Bitte Dashboard prüfen und Seite mit Strg+F5 neu laden.';
  }
  if(!settings && (state.apiAvailable || API_BASE_URL)){
    getCompanyMailSettingsSafe().then(()=>{
      const externalView = document.getElementById('external');
      if(externalView?.classList.contains('active')) renderExternal();
    });
  }
}

async function createInvitation(){
  const resultBox = $('inviteResult');
  try{
    const email = $('inviteEmail').value.trim();
    const instructionTypeId = $('inviteType').value;
    if(!email){ alert('E-Mail fehlt.'); return; }
    if(!instructionTypeId){ alert('Bitte eine Unterweisung auswählen.'); return; }

    const mailMode = $('inviteMailMode').value;
    const form = {
      email,
      recipientName: $('inviteName').value.trim(),
      instructionTypeId,
      language: $('inviteLang').value,
      validDays: Number($('inviteDays').value || 14),
      passPercent: Number($('invitePass').value || 80),
      testRequired: $('inviteTest').value === '1',
      sendMail: mailMode === 'graph'
    };

    resultBox.value = 'Einmal-Link wird erstellt ...';

    const settings = await getCompanyMailSettingsSafe();
    const result = await api('/invitations', {
      method: 'POST',
      body: JSON.stringify(form)
    });

    state.apiAvailable = true;
    state.source = 'api';
    const manualText = buildManualInvitationText(result, form, settings);
    const output = (result.mail?.sent ? 'Mail gesendet.\n\n' : 'Link erstellt.\n\n') +
      result.url +
      (result.mail?.error ? '\n\nMailfehler: ' + result.mail.error : '') +
      '\n\n--- Mailtext zum Kopieren ---\n' + manualText;

    resultBox.value = output;
    try { await navigator.clipboard.writeText(manualText); } catch {}
    if(mailMode === 'outlook') openMailClient(email, manualText);
    await loadData();
    setView('external');
    const nextBox = $('inviteResult');
    if(nextBox) nextBox.value = output;
  }catch(err){
    const msg = String(err.message || err);
    if(resultBox) resultBox.value = 'Fehler beim Erstellen/Senden:\n' + msg;
    alert('Externer Link konnte nicht erstellt/gesendet werden: ' + msg);
  }
}
