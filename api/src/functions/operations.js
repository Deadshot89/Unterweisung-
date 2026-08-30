import { app } from '@azure/functions';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { ensureContainer, uploadBufferToBlob, createReadSasUrl } from '../lib/blob.js';
import { writeAudit } from '../lib/audit.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

const BACKUP_TABLES = [
  'Companies','CompanySettings','Employees','Templates','InstructionTypes','EmployeeInstructionExclusions',
  'InstructionRecords','PlannedTrainings','TrainingParticipants','ExternalInvitations','TestQuestions','TestResults','Files','Users'
];

function safeCompany(ctx, request) {
  return ctx.roles.includes(Roles.SYSTEM_ADMIN) && request.query.get('companyId') ? request.query.get('companyId') : ctx.companyId;
}

async function countTable(pool, tableName, companyId = null) {
  const hasCompany = !['Companies'].includes(tableName);
  const req = pool.request();
  let where = '';
  if (companyId && hasCompany) {
    req.input('companyId', sql.NVarChar(80), companyId);
    where = ' WHERE companyId=@companyId';
  }
  if (companyId && tableName === 'Companies') {
    req.input('companyId', sql.NVarChar(80), companyId);
    where = ' WHERE id=@companyId';
  }
  const result = await req.query(`SELECT COUNT(*) AS count FROM dbo.${tableName}${where}`);
  return Number(result.recordset[0]?.count || 0);
}

async function exportTable(pool, tableName, companyId) {
  const hasCompany = !['Companies'].includes(tableName);
  const req = pool.request();
  let where = '';
  if (hasCompany) {
    req.input('companyId', sql.NVarChar(80), companyId);
    where = ' WHERE companyId=@companyId';
  } else {
    req.input('companyId', sql.NVarChar(80), companyId);
    where = ' WHERE id=@companyId';
  }
  const result = await req.query(`SELECT * FROM dbo.${tableName}${where}`);
  return result.recordset || [];
}

async function checkMailConfig() {
  const missing = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','GRAPH_SENDER_USER'].filter(k => !process.env[k]);
  return missing.length ? { status: 'not_configured', missing } : { status: 'configured', from: process.env.GRAPH_SENDER_USER };
}

async function runHealthChecks(pool, companyId = null) {
  const details = { ok: true, checkedAt: new Date().toISOString(), database: {}, blob: {}, mail: {}, counts: {}, warnings: [] };

  try {
    const ping = await pool.request().query('SELECT SYSUTCDATETIME() AS utcNow, DB_NAME() AS databaseName');
    details.database = { status: 'ok', databaseName: ping.recordset[0].databaseName, utcNow: ping.recordset[0].utcNow };
  } catch (err) {
    details.ok = false;
    details.database = { status: 'error', message: err.message };
  }

  try {
    await ensureContainer();
    details.blob = { status: 'ok', container: process.env.BLOB_CONTAINER || 'unterweisungsmanager' };
  } catch (err) {
    details.ok = false;
    details.blob = { status: 'error', message: err.message };
  }

  details.mail = await checkMailConfig();
  if (details.mail.status !== 'configured') details.warnings.push('Microsoft Graph Mailversand ist nicht vollständig konfiguriert.');

  if (companyId) {
    for (const table of ['Employees','InstructionTypes','InstructionRecords','ExternalInvitations','Files','Users']) {
      try { details.counts[table] = await countTable(pool, table, companyId); }
      catch (err) { details.warnings.push(`Count ${table} fehlgeschlagen: ${err.message}`); }
    }
  }

  const pendingFiles = companyId ? await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query(`SELECT COUNT(*) AS count FROM dbo.Files WHERE companyId=@companyId AND scanStatus IN ('pending','not_configured') AND status='active'`)
    : { recordset: [{ count: 0 }] };
  if (pendingFiles.recordset[0].count > 0) details.warnings.push(`${pendingFiles.recordset[0].count} Datei(en) haben noch keinen sauberen Scanstatus.`);

  return details;
}

app.http('operations', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'operations/{action?}/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const action = request.params.action || 'overview';
      const id = request.params.id;
      const companyId = safeCompany(ctx, request);

      if (request.method === 'GET' && action === 'overview') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT * FROM dbo.vOperationsOverview WHERE companyId=@companyId`);
        return json(result.recordset[0] || { companyId, warning: 'Keine Übersicht gefunden' });
      }

      if (request.method === 'GET' && action === 'health') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const details = await runHealthChecks(pool, companyId);
        const healthId = `health-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), healthId)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('status', sql.NVarChar(40), details.ok ? 'ok' : 'error')
          .input('databaseStatus', sql.NVarChar(80), details.database.status)
          .input('blobStatus', sql.NVarChar(80), details.blob.status)
          .input('mailStatus', sql.NVarChar(80), details.mail.status)
          .input('authStatus', sql.NVarChar(80), ctx.isAuthenticated ? 'ok' : 'anonymous')
          .input('detailsJson', sql.NVarChar(sql.MAX), JSON.stringify(details))
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO SystemHealthSnapshots(id,companyId,status,databaseStatus,blobStatus,mailStatus,authStatus,detailsJson,createdBy)
                  VALUES(@id,@companyId,@status,@databaseStatus,@blobStatus,@mailStatus,@authStatus,@detailsJson,@createdBy)`);
        return json({ id: healthId, ...details }, details.ok ? 200 : 503);
      }

      if (request.method === 'GET' && action === 'health-history') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT TOP 50 id,status,checkedAt,databaseStatus,blobStatus,mailStatus,authStatus,createdBy
                  FROM SystemHealthSnapshots WHERE companyId=@companyId ORDER BY checkedAt DESC`);
        return json(result.recordset);
      }

      if (request.method === 'GET' && action === 'backups') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT TOP 100 id,companyId,backupType,status,startedAt,completedAt,requestedBy,fileName,sizeBytes,sha256,blobPath,errorMessage
                  FROM BackupRuns WHERE companyId=@companyId ORDER BY startedAt DESC`);
        return json(result.recordset);
      }

      if (request.method === 'GET' && action === 'backup-download') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        if (!id) return badRequest('backup id is required');
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .input('id', sql.NVarChar(80), id)
          .query(`SELECT id,blobPath,status FROM BackupRuns WHERE companyId=@companyId AND id=@id`);
        const row = result.recordset[0];
        if (!row) return notFound('Backup nicht gefunden');
        if (row.status !== 'completed' || !row.blobPath) return badRequest('Backup ist nicht downloadbereit');
        await writeAudit(pool, ctx, 'backup.download.url_created', 'backup', id, { companyId });
        return json({ url: createReadSasUrl(row.blobPath, 10), expiresMinutes: 10 });
      }

      if (request.method === 'POST' && action === 'backup-export') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const backupId = `backup-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), backupId)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('requestedBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO BackupRuns(id,companyId,backupType,status,requestedBy) VALUES(@id,@companyId,'manual_json_export','started',@requestedBy)`);

        try {
          const data = { metadata: { backupId, companyId, createdAt: new Date().toISOString(), version: '0.8.0', tables: BACKUP_TABLES }, tables: {} };
          const counts = {};
          for (const table of BACKUP_TABLES) {
            data.tables[table] = await exportTable(pool, table, companyId);
            counts[table] = data.tables[table].length;
          }
          const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
          const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
          const fileName = `unterweisungsmanager-backup-${companyId}-${new Date().toISOString().slice(0,10)}-${backupId.slice(-8)}.json`;
          const blobPath = `backups/${companyId}/${new Date().toISOString().slice(0,10)}/${fileName}`;
          await uploadBufferToBlob(blobPath, buffer, 'application/json', { metadata: { companyId, backupId, sha256 } });
          await pool.request()
            .input('id', sql.NVarChar(80), backupId)
            .input('blobPath', sql.NVarChar(600), blobPath)
            .input('fileName', sql.NVarChar(260), fileName)
            .input('sizeBytes', sql.BigInt, buffer.length)
            .input('sha256', sql.NVarChar(128), sha256)
            .input('tableCountsJson', sql.NVarChar(sql.MAX), JSON.stringify(counts))
            .query(`UPDATE BackupRuns SET status='completed',completedAt=SYSUTCDATETIME(),blobPath=@blobPath,fileName=@fileName,sizeBytes=@sizeBytes,sha256=@sha256,tableCountsJson=@tableCountsJson WHERE id=@id`);
          await writeAudit(pool, ctx, 'backup.export.completed', 'backup', backupId, { companyId, counts, sizeBytes: buffer.length });
          await writeSecurityEvent(pool, ctx, 'backup.export.completed', 'info', { companyId, backupId });
          return json({ id: backupId, companyId, fileName, sizeBytes: buffer.length, sha256, counts, download: `/api/operations/backup-download/${backupId}` }, 201);
        } catch (err) {
          await pool.request()
            .input('id', sql.NVarChar(80), backupId)
            .input('errorMessage', sql.NVarChar(sql.MAX), err.message)
            .query(`UPDATE BackupRuns SET status='failed',completedAt=SYSUTCDATETIME(),errorMessage=@errorMessage WHERE id=@id`);
          throw err;
        }
      }

      if (request.method === 'POST' && action === 'restore-validate') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const body = await request.json().catch(() => ({}));
        const backupRunId = body.backupRunId || id || null;
        if (!backupRunId) return badRequest('backupRunId is required');
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .input('id', sql.NVarChar(80), backupRunId)
          .query(`SELECT id,status,sha256,sizeBytes,tableCountsJson,blobPath FROM BackupRuns WHERE companyId=@companyId AND id=@id`);
        const row = result.recordset[0];
        const validation = { exists: !!row, status: row?.status || 'missing', hasBlobPath: !!row?.blobPath, hasSha256: !!row?.sha256, sizeBytes: row?.sizeBytes || 0, tableCounts: row?.tableCountsJson ? JSON.parse(row.tableCountsJson) : null, note: 'Restore wird bewusst nicht automatisch produktiv ausgeführt. Diese Prüfung bestätigt nur Backup-Metadaten. Wiederherstellung erfolgt über dokumentierten Restore-Prozess in Staging.' };
        const checkId = `restore-check-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), checkId)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('backupRunId', sql.NVarChar(80), backupRunId)
          .input('status', sql.NVarChar(40), validation.exists && validation.status === 'completed' ? 'valid' : 'warning')
          .input('checkedBy', sql.NVarChar(120), ctx.userId)
          .input('validationJson', sql.NVarChar(sql.MAX), JSON.stringify(validation))
          .query(`INSERT INTO RestoreChecks(id,companyId,backupRunId,status,checkedBy,validationJson) VALUES(@id,@companyId,@backupRunId,@status,@checkedBy,@validationJson)`);
        await writeAudit(pool, ctx, 'restore.validate', 'backup', backupRunId, validation);
        return json({ id: checkId, ...validation });
      }

      if (request.method === 'GET' && action === 'security-events') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT TOP 100 id,companyId,actorUserId,eventType,severity,createdAt,ipAddress,userAgent,detailsJson
                  FROM SecurityEvents WHERE companyId=@companyId ORDER BY createdAt DESC`);
        return json(result.recordset);
      }

      if (request.method === 'GET' && action === 'audit') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT TOP 100 id,companyId,actorUserId,action,entityType,entityId,createdAt,detailsJson
                  FROM AuditLog WHERE companyId=@companyId ORDER BY createdAt DESC`);
        return json(result.recordset);
      }

      return notFound('Operations-Endpunkt nicht gefunden');
    } catch (err) {
      return serverError(err, context);
    }
  }
});
