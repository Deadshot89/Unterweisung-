import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

const DEFAULTS = {
  mailMode: 'manual',
  mailFromName: 'Unterweisungsmanager',
  mailFromEmail: null,
  replyToEmail: null,
  mailSubjectPrefix: 'Unterweisung',
  mailSignature: 'Vielen Dank.'
};

const MAIL_COLUMNS = ['mailMode','mailFromName','mailFromEmail','replyToEmail','mailSubjectPrefix','mailSignature','mailUpdatedAt'];

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function cleanMailMode(value) {
  const mode = String(value || 'manual').trim().toLowerCase();
  return ['manual','outlook','graph'].includes(mode) ? mode : null;
}

function validEmailOrEmpty(value) {
  const email = clean(value, 254);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : false;
}

async function companySettingsColumns(pool) {
  const result = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CompanySettings')`);
  return new Set(result.recordset.map(r => r.name));
}

async function ensureBaseRow(pool, companyId) {
  await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query(`MERGE CompanySettings AS t
            USING (SELECT @companyId AS companyId) AS s ON t.companyId=s.companyId
            WHEN NOT MATCHED THEN INSERT(companyId, updatedAt) VALUES(@companyId, SYSUTCDATETIME());`);
}

async function readCompanyMailSettings(pool, companyId) {
  const cols = await companySettingsColumns(pool);
  const selects = [
    'companyId',
    cols.has('mailMode') ? 'mailMode' : `'${DEFAULTS.mailMode}' AS mailMode`,
    cols.has('mailFromName') ? 'mailFromName' : `'${DEFAULTS.mailFromName}' AS mailFromName`,
    cols.has('mailFromEmail') ? 'mailFromEmail' : 'CAST(NULL AS NVARCHAR(254)) AS mailFromEmail',
    cols.has('replyToEmail') ? 'replyToEmail' : 'CAST(NULL AS NVARCHAR(254)) AS replyToEmail',
    cols.has('mailSubjectPrefix') ? 'mailSubjectPrefix' : `'${DEFAULTS.mailSubjectPrefix}' AS mailSubjectPrefix`,
    cols.has('mailSignature') ? 'mailSignature' : `'${DEFAULTS.mailSignature}' AS mailSignature`,
    cols.has('mailUpdatedAt') ? 'mailUpdatedAt' : 'CAST(NULL AS DATETIME2) AS mailUpdatedAt'
  ];

  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query(`SELECT ${selects.join(', ')} FROM CompanySettings WHERE companyId=@companyId`);

  const row = result.recordset[0] || { companyId };
  return {
    companyId,
    mailMode: row.mailMode || DEFAULTS.mailMode,
    mailFromName: row.mailFromName || DEFAULTS.mailFromName,
    mailFromEmail: row.mailFromEmail || DEFAULTS.mailFromEmail,
    replyToEmail: row.replyToEmail || DEFAULTS.replyToEmail,
    mailSubjectPrefix: row.mailSubjectPrefix || DEFAULTS.mailSubjectPrefix,
    mailSignature: row.mailSignature || DEFAULTS.mailSignature,
    mailUpdatedAt: row.mailUpdatedAt || null,
    migrationReady: MAIL_COLUMNS.every(c => cols.has(c))
  };
}

async function updateCompanyMailSettings(pool, companyId, body) {
  const cols = await companySettingsColumns(pool);
  const mode = cleanMailMode(body.mailMode);
  if (!mode) return { error: 'Ungültiger Mailmodus. Erlaubt: manual, outlook, graph.' };

  const fromEmail = validEmailOrEmpty(body.mailFromEmail);
  const replyToEmail = validEmailOrEmpty(body.replyToEmail);
  if (fromEmail === false) return { error: 'Absenderadresse ist keine gültige E-Mail-Adresse.' };
  if (replyToEmail === false) return { error: 'Antwortadresse ist keine gültige E-Mail-Adresse.' };

  await ensureBaseRow(pool, companyId);

  const values = {
    mailMode: mode,
    mailFromName: clean(body.mailFromName, 200) || DEFAULTS.mailFromName,
    mailFromEmail: fromEmail,
    replyToEmail,
    mailSubjectPrefix: clean(body.mailSubjectPrefix, 120) || DEFAULTS.mailSubjectPrefix,
    mailSignature: clean(body.mailSignature, 4000) || DEFAULTS.mailSignature
  };

  const assignments = [];
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  for (const [key, value] of Object.entries(values)) {
    if (!cols.has(key)) continue;
    assignments.push(`${key}=@${key}`);
    req.input(key, key === 'mailSignature' ? sql.NVarChar(sql.MAX) : sql.NVarChar(key === 'mailMode' ? 40 : key === 'mailSubjectPrefix' ? 120 : key === 'mailFromName' ? 200 : 254), value);
  }
  if (cols.has('mailUpdatedAt')) assignments.push('mailUpdatedAt=SYSUTCDATETIME()');
  if (cols.has('updatedAt')) assignments.push('updatedAt=SYSUTCDATETIME()');

  if (!assignments.length) return { migrationRequired: true };
  await req.query(`UPDATE CompanySettings SET ${assignments.join(', ')} WHERE companyId=@companyId`);
  return { settings: await readCompanyMailSettings(pool, companyId) };
}

app.http('companyMailSettings', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  route: 'company-mail-settings',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        await ensureBaseRow(pool, ctx.companyId);
        return json(await readCompanyMailSettings(pool, ctx.companyId));
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();
      const result = await updateCompanyMailSettings(pool, ctx.companyId, body);
      if (result.error) return badRequest(result.error);
      if (result.migrationRequired) return json({ ok: false, migrationRequired: true, message: 'Datenbankmigration für Firmen-Maileinstellungen fehlt noch.' }, 409);
      await writeAudit(pool, ctx, 'settings.mail.updated', 'companySettings', ctx.companyId, body);
      return json({ ok: true, settings: result.settings });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
