import { sql } from './db.js';
import { sendGraphMail } from './graphMail.js';
import { sendEmptyWebPush } from './webPush.js';

export const TEN_MINUTES = 10 * 60 * 1000;

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function htmlEscape(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}

function diagnosticUrl() {
  const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/diagnostics.html` : '/diagnostics.html';
}

async function markAlertResult(pool, eventId, result, markAlerted = true) {
  const request = pool.request()
    .input('id', sql.BigInt, Number(eventId))
    .input('alertResultJson', sql.NVarChar(sql.MAX), JSON.stringify(result));
  if (markAlerted) {
    await request.query(`UPDATE DiagnosticEvents
                         SET alertedAt=SYSUTCDATETIME(),alertResultJson=@alertResultJson
                         WHERE id=@id`);
  } else {
    await request.query(`UPDATE DiagnosticEvents
                         SET alertResultJson=@alertResultJson
                         WHERE id=@id`);
  }
}

async function isDuplicateAlert(pool, event) {
  if (!event?.dedupeKey) return false;
  const result = await pool.request()
    .input('id', sql.BigInt, Number(event.id))
    .input('dedupeKey', sql.NVarChar(128), event.dedupeKey)
    .input('windowMs', sql.Int, TEN_MINUTES)
    .query(`SELECT TOP 1 id
            FROM DiagnosticEvents
            WHERE dedupeKey=@dedupeKey
              AND id<>@id
              AND alertedAt IS NOT NULL
              AND alertedAt>=DATEADD(MILLISECOND,-@windowMs,SYSUTCDATETIME())
            ORDER BY alertedAt DESC`);
  return !!result.recordset.length;
}

async function loadSystemAdmins(pool) {
  const result = await pool.request().query(`
    SELECT id,email,displayName
    FROM Users
    WHERE role='system_admin' AND active=1 AND email IS NOT NULL
    ORDER BY email`);
  const seen = new Set();
  return result.recordset.filter(user => {
    const key = String(user.email || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadPushSubscriptions(pool) {
  const result = await pool.request().query(`
    SELECT ps.id,ps.userId,ps.endpoint
    FROM PushSubscriptions ps
    INNER JOIN Users u ON u.id=ps.userId
    WHERE u.role='system_admin' AND u.active=1
    ORDER BY ps.updatedAt DESC`);
  return result.recordset;
}

async function companyName(pool, companyId) {
  if (!companyId) return 'Systemweit';
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query('SELECT TOP 1 name FROM Companies WHERE id=@companyId');
  return clean(result.recordset[0]?.name || companyId, 200);
}

function buildCriticalMail(event, company) {
  const url = diagnosticUrl();
  const subject = 'Kritischer Fehler · Unterweisungsmanager';
  const rows = [
    ['Firma', company],
    ['Bereich', event.area || '—'],
    ['Aktion', event.action || '—'],
    ['HTTP-Status', event.httpStatus || '—'],
    ['Fehlercode', event.errorCode || '—'],
    ['API', event.apiPath || '—'],
    ['Meldung', event.errorMessage || '—'],
    ['Zeit', event.createdAt ? new Date(event.createdAt).toLocaleString('de-DE') : '—']
  ];
  const htmlRows = rows.map(([label,value]) => `<tr><td style="padding:5px 14px 5px 0;font-weight:700">${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join('');
  return {
    subject,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#101828;line-height:1.45"><h2>Kritischer Fehler im Unterweisungsmanager</h2><table>${htmlRows}</table><p><a href="${htmlEscape(url)}">Fehlerdiagnose öffnen</a></p><p style="color:#667085;font-size:13px">Gleiche kritische Fehler werden innerhalb von 10 Minuten nicht erneut benachrichtigt.</p></div>`,
    text: `Kritischer Fehler im Unterweisungsmanager\nFirma: ${company}\nBereich: ${event.area || '—'}\nAktion: ${event.action || '—'}\nHTTP-Status: ${event.httpStatus || '—'}\nFehlercode: ${event.errorCode || '—'}\nAPI: ${event.apiPath || '—'}\nMeldung: ${event.errorMessage || '—'}\nDiagnose: ${url}`
  };
}

async function deliverEmail(admins, event, company) {
  const recipients = admins.map(user => user.email).filter(Boolean);
  if (!recipients.length) return { attempted: 0, sent: false, error: 'Kein aktiver Systemadmin mit E-Mail-Adresse.' };
  const mail = buildCriticalMail(event, company);
  try {
    await sendGraphMail({ to: recipients, subject: mail.subject, html: mail.html, text: mail.text });
    return { attempted: recipients.length, sent: true };
  } catch (err) {
    return { attempted: recipients.length, sent: false, error: clean(err?.message || err, 500) };
  }
}

async function deliverPush(pool) {
  const subscriptions = await loadPushSubscriptions(pool);
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await sendEmptyWebPush(subscription.endpoint, { ttl: 120, urgency: 'high' });
      if (result.ok) {
        sent += 1;
        await pool.request()
          .input('id', sql.NVarChar(80), subscription.id)
          .query('UPDATE PushSubscriptions SET lastSuccessAt=SYSUTCDATETIME(),lastErrorAt=NULL,lastError=NULL,updatedAt=SYSUTCDATETIME() WHERE id=@id');
      } else if (result.expired) {
        removed += 1;
        await pool.request()
          .input('id', sql.NVarChar(80), subscription.id)
          .query('DELETE FROM PushSubscriptions WHERE id=@id');
      } else {
        failed += 1;
        await pool.request()
          .input('id', sql.NVarChar(80), subscription.id)
          .input('lastError', sql.NVarChar(1000), `Push-Dienst HTTP ${result.status}`)
          .query('UPDATE PushSubscriptions SET lastErrorAt=SYSUTCDATETIME(),lastError=@lastError,updatedAt=SYSUTCDATETIME() WHERE id=@id');
      }
    } catch (err) {
      failed += 1;
      await pool.request()
        .input('id', sql.NVarChar(80), subscription.id)
        .input('lastError', sql.NVarChar(1000), clean(err?.message || err, 1000))
        .query('UPDATE PushSubscriptions SET lastErrorAt=SYSUTCDATETIME(),lastError=@lastError,updatedAt=SYSUTCDATETIME() WHERE id=@id');
    }
  }

  return { attempted: subscriptions.length, sent, failed, removed };
}

export async function notifyCriticalDiagnostic(pool, event) {
  if (!event || event.severity !== 'critical') return { skipped: true, reason: 'not-critical' };

  if (await isDuplicateAlert(pool, event)) {
    const result = { skipped: true, reason: 'deduplicated', windowMs: TEN_MINUTES };
    await markAlertResult(pool, event.id, result, false);
    return result;
  }

  const admins = await loadSystemAdmins(pool);
  const company = await companyName(pool, event.companyId);
  const [email, push] = await Promise.all([
    deliverEmail(admins, event, company),
    deliverPush(pool)
  ]);
  const result = {
    skipped: false,
    systemAdminCount: admins.length,
    email,
    push
  };
  await markAlertResult(pool, event.id, result, true);
  return result;
}
