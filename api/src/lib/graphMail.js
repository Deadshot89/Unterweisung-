function cfg(name) { return process.env[name] || ''; }
function splitEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value).split(/[;,]/).map(v => v.trim()).filter(Boolean);
}
function graphRecipient(email) {
  return { emailAddress: { address: email } };
}
function htmlEscape(s='') {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function fmtDateTime(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('de-DE'); } catch { return String(value); }
}
function b64(text) { return Buffer.from(text, 'utf8').toString('base64'); }

export function mailConfigStatus() {
  const required = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];
  const missing = required.filter(k => !cfg(k));
  return { configured: missing.length === 0, missing, from: cfg('MAIL_FROM') || null, provider: 'microsoft-graph' };
}

async function getGraphToken() {
  const status = mailConfigStatus();
  if (!status.configured) {
    const err = new Error(`Microsoft Graph Mail ist nicht konfiguriert: ${status.missing.join(', ')}`);
    err.status = 503;
    throw err;
  }
  const tenant = cfg('GRAPH_TENANT_ID');
  const body = new URLSearchParams({
    client_id: cfg('GRAPH_CLIENT_ID'),
    client_secret: cfg('GRAPH_CLIENT_SECRET'),
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Graph Token konnte nicht geladen werden: ${res.status} ${text}`);
    err.status = 502;
    throw err;
  }
  const json = await res.json();
  return json.access_token;
}

export async function sendGraphMail({ to, cc, subject, html, text, attachments = [], from, saveToSentItems = true }) {
  const fromEmail = from || cfg('MAIL_FROM');
  const toList = splitEmails(to);
  const ccList = splitEmails(cc);
  if (!toList.length) {
    const err = new Error('Keine Empfängeradresse vorhanden');
    err.status = 400;
    throw err;
  }
  const token = await getGraphToken();
  const message = {
    subject,
    body: { contentType: html ? 'HTML' : 'Text', content: html || text || '' },
    toRecipients: toList.map(graphRecipient),
    ccRecipients: ccList.map(graphRecipient),
    attachments: attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: a.contentBytes || b64(a.content || '')
    }))
  };
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems })
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Mailversand fehlgeschlagen: ${res.status} ${errText}`);
    err.status = 502;
    throw err;
  }
  return { ok: true, provider: 'microsoft-graph', from: fromEmail, to: toList, cc: ccList };
}

export function buildExternalInvitationMail({ companyName, recipientName, instructionName, language, url, expiresAt, testRequired, passPercent }) {
  const subject = `Unterweisung: ${instructionName}`;
  const name = recipientName || 'Teilnehmer/in';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#101828;line-height:1.45">
    <h2>Unterweisung erforderlich</h2>
    <p>Hallo ${htmlEscape(name)},</p>
    <p>für Sie wurde eine digitale Unterweisung bereitgestellt.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Firma</td><td>${htmlEscape(companyName || '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Unterweisung</td><td>${htmlEscape(instructionName)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Sprache</td><td>${htmlEscape(language || 'de')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Ablaufdatum</td><td>${htmlEscape(fmtDateTime(expiresAt))}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Test</td><td>${testRequired ? `erforderlich, bestanden ab ${Number(passPercent || 80)} %` : 'nicht erforderlich'}</td></tr>
    </table>
    <p><a href="${htmlEscape(url)}" style="display:inline-block;background:#0f6f8f;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Unterweisung öffnen</a></p>
    <p style="color:#667085;font-size:13px">Der Link ist persönlich und zeitlich begrenzt. Bitte nicht weiterleiten.</p>
  </div>`;
  const text = `Unterweisung erforderlich\n\nHallo ${name},\n\nbitte öffnen Sie die Unterweisung: ${url}\n\nUnterweisung: ${instructionName}\nAblauf: ${fmtDateTime(expiresAt)}\n`;
  return { subject, html, text };
}

export function buildReminderMail(args) {
  const m = buildExternalInvitationMail(args);
  return { ...m, subject: `Erinnerung: ${args.instructionName}` };
}

export function buildPlannedTrainingMail({ companyName, instructionName, plannedAt, durationMinutes, location, participantsText, organizerName }) {
  const subject = `Einladung Unterweisung: ${instructionName}`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#101828;line-height:1.45">
    <h2>Einladung zur Unterweisung</h2>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Firma</td><td>${htmlEscape(companyName || '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Unterweisung</td><td>${htmlEscape(instructionName)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Termin</td><td>${htmlEscape(fmtDateTime(plannedAt))}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Dauer</td><td>${durationMinutes || 30} Minuten</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Ort</td><td>${htmlEscape(location || '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;font-weight:700">Organisator</td><td>${htmlEscape(organizerName || '—')}</td></tr>
    </table>
    <p>Bitte nehmen Sie an der geplanten Unterweisung teil.</p>
    ${participantsText ? `<p style="color:#667085;font-size:13px">Teilnehmer: ${htmlEscape(participantsText)}</p>` : ''}
  </div>`;
  const text = `Einladung zur Unterweisung\n\nUnterweisung: ${instructionName}\nTermin: ${fmtDateTime(plannedAt)}\nDauer: ${durationMinutes || 30} Minuten\nOrt: ${location || '—'}\n`;
  return { subject, html, text };
}

export function buildIcs({ uid, title, description, location, startDate, durationMinutes, organizerEmail }) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + Number(durationMinutes || 30) * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unterweisungsmanager//Training//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${String(title || 'Unterweisung').replace(/\n/g,' ')}`,
    `DESCRIPTION:${String(description || '').replace(/\n/g,'\\n')}`,
    `LOCATION:${String(location || '').replace(/\n/g,' ')}`,
    organizerEmail ? `ORGANIZER:mailto:${organizerEmail}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);
  return lines.join('\r\n');
}
