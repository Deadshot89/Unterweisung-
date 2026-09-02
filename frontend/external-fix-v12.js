// Hotfix v0.13: Externe Links über separate Azure Function API ausführen.
// Standard ist jetzt manuelle Mail: Link erzeugen, Mailtext kopieren, kein Graph-Zwang.

function buildManualInvitationText(result, form){
  const typeName = type(form.instructionTypeId).name || 'Unterweisung';
  const recipient = form.recipientName || 'Teilnehmer/in';
  return `Betreff: Unterweisung durchführen - ${typeName}\n\nHallo ${recipient},\n\nbitte führe die folgende Unterweisung durch:\n${typeName}\n\nLink zur Unterweisung:\n${result.url}\n\nDer Link ist nur zeitlich begrenzt gültig. Bitte öffne den Link am Rechner oder Handy und schließe die Unterweisung vollständig ab. Nach Abschluss wird der Status automatisch im Unterweisungsmanager gespeichert.\n\nVielen Dank.`;
}

function renderExternal(){
  const rows = invitations();
  const instructionTypes = types().filter(t => t && t.active !== false);
  const apiText = state.apiAvailable ? 'Azure API verbunden' : (API_BASE_URL ? 'API konfiguriert, Status wird beim Senden geprüft' : 'Keine API konfiguriert');
  const apiClass = state.apiAvailable || API_BASE_URL ? 'ok' : 'warn';

  $('external').innerHTML = `<div class="grid">
    <div class="card span-12">
      <h2>Externe Unterweisung senden</h2>
      <p class="muted">Erzeugt einen sicheren Einmal-Link. Der Empfänger öffnet die Unterweisung, beantwortet den Test und der Abschluss erscheint danach hier.</p>
      <div class="notice"><b>API-Status:</b> ${badge(apiClass === 'ok' ? 'valid' : 'missing')} ${esc(apiText)}</div>
      <div class="form-grid external-form">
        <div class="field"><label>Empfänger E-Mail</label><input id="inviteEmail" placeholder="name@firma.de"></div>
        <div class="field"><label>Name optional</label><input id="inviteName" placeholder="Vorname Nachname"></div>
        <div class="field"><label>Unterweisung</label><select id="inviteType">${instructionTypes.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Sprache</label><select id="inviteLang"><option value="de">Deutsch</option><option value="en">Englisch</option><option value="pl">Polnisch</option></select></div>
        <div class="field"><label>Gültig Tage</label><input id="inviteDays" type="number" value="14" min="1" max="365"></div>
        <div class="field"><label>Bestehen ab %</label><input id="invitePass" type="number" value="80" min="0" max="100"></div>
        <div class="field"><label>Test erforderlich</label><select id="inviteTest"><option value="1">Ja</option><option value="0">Nein, nur Bestätigung</option></select></div>
        <div class="field"><label>Mail direkt senden</label><select id="inviteSendMail"><option value="0" selected>Nein, nur Link erzeugen</option><option value="1">Ja, per Outlook/Graph</option></select></div>
        <div class="field full"><button class="primary" onclick="createInvitation()">Einmal-Link erzeugen</button> <button onclick="sendDueReminders()">Fällige Erinnerungen senden</button></div>
        <div class="field full"><textarea id="inviteResult" readonly placeholder="Link und Mailtext erscheinen hier"></textarea></div>
      </div>
    </div>
    <div class="card span-12"><h2>Einladungen / externe Abschlüsse</h2>${invitationTable(rows)}</div>
  </div>`;

  if(!instructionTypes.length){
    $('inviteResult').value = 'Keine Unterweisungstypen geladen. Bitte Dashboard prüfen und Seite mit Strg+F5 neu laden.';
  }
}

async function createInvitation(){
  const resultBox = $('inviteResult');
  try{
    const email = $('inviteEmail').value.trim();
    const instructionTypeId = $('inviteType').value;
    if(!email){ alert('E-Mail fehlt.'); return; }
    if(!instructionTypeId){ alert('Bitte eine Unterweisung auswählen.'); return; }

    const form = {
      email,
      recipientName: $('inviteName').value.trim(),
      instructionTypeId,
      language: $('inviteLang').value,
      validDays: Number($('inviteDays').value || 14),
      passPercent: Number($('invitePass').value || 80),
      testRequired: $('inviteTest').value === '1',
      sendMail: $('inviteSendMail').value === '1'
    };

    resultBox.value = 'Einmal-Link wird erstellt ...';

    const result = await api('/invitations', {
      method: 'POST',
      body: JSON.stringify(form)
    });

    state.apiAvailable = true;
    state.source = 'api';
    const manualText = buildManualInvitationText(result, form);
    const output = (result.mail?.sent ? 'Mail gesendet.\n\n' : 'Link erstellt.\n\n') +
      result.url +
      (result.mail?.error ? '\n\nMailfehler: ' + result.mail.error : '') +
      '\n\n--- Mailtext zum Kopieren ---\n' + manualText;

    resultBox.value = output;
    try { await navigator.clipboard.writeText(manualText); } catch {}
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
