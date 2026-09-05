import { createHash, randomUUID } from 'node:crypto';
import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { assertDiagnosticAccess } from '../lib/diagnosticAccess.js';
import { diagnosticListLimit, recordDiagnosticEvent } from '../lib/diagnostics.js';
import { notifyCriticalDiagnostic } from '../lib/diagnosticAlerts.js';
import { getVapidPublicKey } from '../lib/webPush.js';
import { mailConfigStatus } from '../lib/graphMail.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function isSystemAdmin(ctx) {
  return !!ctx?.roles?.includes(Roles.SYSTEM_ADMIN);
}

function scopedCompanyId(ctx, request) {
  if (!isSystemAdmin(ctx)) return ctx.companyId;
  return clean(request?.query?.get('companyId'), 80);
}

function alertRuntimeStatus() {
  const mail = mailConfigStatus();
  let pushConfigured = true;
  try {
    getVapidPublicKey();
  } catch {
    pushConfigured = false;
  }
  return {
    emailConfigured: !!mail.configured,
    emailProvider: mail.provider || 'microsoft-graph',
    emailMissing: Array.isArray(mail.missing) ? mail.missing : [],
    pushConfigured,
    pushProvider: 'web-push'
  };
}

function endpointHash(endpoint) {
  return createHash('sha256').update(String(endpoint || '')).digest('hex');
}

function validPushEndpoint(value) {
  const endpoint = clean(value, 2048);
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function addEventFilters(dbRequest, where, request, companyId) {
  if (companyId) {
    dbRequest.input('companyId', sql.NVarChar(80), companyId);
    where.push('d.companyId=@companyId');
  }
  const severity = clean(request.query.get('severity'), 20)?.toLowerCase();
  if (['critical','warning','info'].includes(severity)) {
    dbRequest.input('severity', sql.NVarChar(20), severity);
    where.push('d.severity=@severity');
  }
  const search = clean(request.query.get('search'), 200);
  if (search) {
    dbRequest.input('search', sql.NVarChar(220), `%${search}%`);
    where.push(`(d.area LIKE @search OR d.action LIKE @search OR d.errorMessage LIKE @search OR d.errorCode LIKE @search OR d.apiPath LIKE @search)`);
  }
}

async function readEvents(pool, ctx, request, forcedLimit = null) {
  const companyId = scopedCompanyId(ctx, request);
  const limit = forcedLimit || diagnosticListLimit(request.query.get('limit'));
  const dbRequest = pool.request().input('limit', sql.Int, limit);
  const where = [];
  addEventFilters(dbRequest, where, request, companyId);
  const result = await dbRequest.query(`
    SELECT TOP (@limit)
      d.id,d.companyId,c.name AS companyName,d.actorUserId,u.displayName AS actorName,u.email AS actorEmail,
      d.severity,d.area,d.action,d.errorMessage,d.errorCode,d.apiPath,d.httpMethod,d.httpStatus,
      d.userAgent,d.appVersion,d.createdAt,d.alertedAt
    FROM DiagnosticEvents d
    LEFT JOIN Companies c ON c.id=d.companyId
    LEFT JOIN Users u ON u.id=d.actorUserId AND (u.companyId=d.companyId OR d.companyId IS NULL)
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY d.createdAt DESC,d.id DESC`);
  return { companyId, events: result.recordset };
}

app.http('diagnosticEvents', {
  methods: ['GET','POST'],
  authLevel: 'anonymous',
  route: 'diagnostics/events',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      if (request.method === 'POST') {
        const input = await request.json().catch(() => ({}));
        const event = await recordDiagnosticEvent(pool, ctx, {
          area: input.area,
          action: input.action,
          errorMessage: input.errorMessage,
          errorCode: input.errorCode,
          apiPath: input.apiPath,
          httpMethod: input.httpMethod,
          httpStatus: input.httpStatus,
          appVersion: input.appVersion,
          userAgent: request.headers.get('user-agent')
        }, { source: 'frontend' });
        let alert = null;
        if (event.severity === 'critical') {
          try {
            alert = await notifyCriticalDiagnostic(pool, event);
          } catch (err) {
            alert = { skipped: false, delivered: false, error: clean(err?.message || err, 500) };
          }
        }
        return json({ ok: true, event, alert }, 201);
      }

      await assertDiagnosticAccess(pool, ctx);
      const result = await readEvents(pool, ctx, request);
      return json(result);
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('diagnosticStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diagnostics/status',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      await assertDiagnosticAccess(pool, ctx);
      const companyId = scopedCompanyId(ctx, request);
      const dbRequest = pool.request();
      const where = ['createdAt>=DATEADD(HOUR,-24,SYSUTCDATETIME())'];
      if (companyId) {
        dbRequest.input('companyId', sql.NVarChar(80), companyId);
        where.push('companyId=@companyId');
      }
      const counts = await dbRequest.query(`
        SELECT
          SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) AS critical,
          SUM(CASE WHEN severity='warning' THEN 1 ELSE 0 END) AS warning,
          SUM(CASE WHEN severity='info' THEN 1 ELSE 0 END) AS info,
          COUNT(*) AS total,
          MAX(createdAt) AS lastEventAt
        FROM DiagnosticEvents WHERE ${where.join(' AND ')}`);
      const row = counts.recordset[0] || {};
      const alertStatus = alertRuntimeStatus();
      return json({
        ok: true,
        scope: companyId || 'all',
        database: 'ok',
        api: 'ok',
        alerts: {
          email: {
            configured: alertStatus.emailConfigured,
            provider: alertStatus.emailProvider,
            missing: alertStatus.emailMissing
          },
          push: {
            configured: alertStatus.pushConfigured,
            provider: alertStatus.pushProvider
          }
        },
        windowHours: 24,
        counts: {
          critical: Number(row.critical || 0),
          warning: Number(row.warning || 0),
          info: Number(row.info || 0),
          total: Number(row.total || 0)
        },
        lastEventAt: row.lastEventAt || null
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('diagnosticLatestCritical', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diagnostics/latest-critical',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      await assertDiagnosticAccess(pool, ctx);
      const companyId = scopedCompanyId(ctx, request);
      const dbRequest = pool.request();
      const where = ["d.severity='critical'"];
      if (companyId) {
        dbRequest.input('companyId', sql.NVarChar(80), companyId);
        where.push('d.companyId=@companyId');
      }
      const result = await dbRequest.query(`
        SELECT TOP 1 d.id,d.companyId,c.name AS companyName,d.actorUserId,u.displayName AS actorName,
               d.severity,d.area,d.action,d.errorMessage,d.errorCode,d.apiPath,d.httpMethod,d.httpStatus,
               d.userAgent,d.appVersion,d.createdAt,d.alertedAt
        FROM DiagnosticEvents d
        LEFT JOIN Companies c ON c.id=d.companyId
        LEFT JOIN Users u ON u.id=d.actorUserId AND (u.companyId=d.companyId OR d.companyId IS NULL)
        WHERE ${where.join(' AND ')}
        ORDER BY d.createdAt DESC,d.id DESC`);
      return json({ event: result.recordset[0] || null });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('diagnosticExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diagnostics/export',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      await assertDiagnosticAccess(pool, ctx);
      const result = await readEvents(pool, ctx, request, 500);
      const generatedAt = new Date().toISOString();
      const body = JSON.stringify({
        format: 'Unterweisungsmanager-Diagnose-v1',
        generatedAt,
        scope: result.companyId || 'all',
        eventCount: result.events.length,
        events: result.events
      }, null, 2);
      const date = generatedAt.slice(0,10);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="unterweisungsmanager-diagnose-${date}.json"`,
          'Cache-Control': 'no-store'
        }
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('diagnosticPushConfig', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diagnostics/push/config',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN]);
      return json({ publicKey: getVapidPublicKey() });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('diagnosticPushSubscriptions', {
  methods: ['POST','DELETE'],
  authLevel: 'anonymous',
  route: 'diagnostics/push/subscriptions',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN]);
      const pool = await getPool();
      const input = await request.json().catch(() => ({}));
      const endpoint = validPushEndpoint(input.endpoint);
      if (!endpoint) return badRequest('Gültiger HTTPS-Push-Endpunkt fehlt.');
      const hash = endpointHash(endpoint);

      if (request.method === 'DELETE') {
        await pool.request()
          .input('userId', sql.NVarChar(120), ctx.userId)
          .input('endpointHash', sql.NVarChar(128), hash)
          .query('DELETE FROM PushSubscriptions WHERE userId=@userId AND endpointHash=@endpointHash');
        return json({ ok: true, active: false });
      }

      const id = `push-${randomUUID()}`;
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('userId', sql.NVarChar(120), ctx.userId)
        .input('endpoint', sql.NVarChar(2048), endpoint)
        .input('endpointHash', sql.NVarChar(128), hash)
        .query(`MERGE PushSubscriptions AS target
                USING (SELECT @endpointHash AS endpointHash) AS source
                ON target.endpointHash=source.endpointHash
                WHEN MATCHED THEN UPDATE SET userId=@userId,endpoint=@endpoint,updatedAt=SYSUTCDATETIME(),lastError=NULL,lastErrorAt=NULL
                WHEN NOT MATCHED THEN INSERT(id,userId,endpoint,endpointHash)
                VALUES(@id,@userId,@endpoint,@endpointHash);`);
      return json({ ok: true, active: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
