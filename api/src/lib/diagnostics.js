import { createHash } from 'node:crypto';
import { sql } from './db.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function boundedStatus(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 && number <= 999 ? Math.trunc(number) : 0;
}

export function diagnosticSeverity(input = {}, options = {}) {
  const httpStatus = boundedStatus(input.httpStatus);
  if (httpStatus >= 500) return 'critical';
  if (httpStatus >= 400) return 'warning';
  if (options.allowExplicitCritical && String(input.severity || '').toLowerCase() === 'critical') return 'critical';
  if (String(input.severity || '').toLowerCase() === 'warning') return 'warning';
  return 'info';
}

export function safeDiagnosticInput(input = {}) {
  return {
    area: clean(input.area, 120),
    action: clean(input.action, 160),
    errorMessage: clean(input.errorMessage, 2000),
    errorCode: clean(input.errorCode, 120),
    apiPath: clean(input.apiPath, 500),
    httpMethod: clean(input.httpMethod, 16)?.toUpperCase() || null,
    httpStatus: boundedStatus(input.httpStatus),
    userAgent: clean(input.userAgent, 1000),
    appVersion: clean(input.appVersion, 60)
  };
}

export function diagnosticDedupeKey(companyId, input = {}) {
  const safe = safeDiagnosticInput(input);
  return createHash('sha256')
    .update([
      clean(companyId, 80) || '-',
      safe.area || '-',
      safe.action || '-',
      safe.errorCode || '-',
      safe.apiPath || '-',
      String(safe.httpStatus || 0)
    ].join('|'))
    .digest('hex');
}

export async function recordDiagnosticEvent(pool, ctx, input = {}, options = {}) {
  const safe = safeDiagnosticInput(input);
  const companyId = clean(options.companyId ?? ctx?.companyId, 80);
  const actorUserId = clean(options.actorUserId ?? ctx?.userId, 120);
  const severity = diagnosticSeverity(input, { allowExplicitCritical: !!options.allowExplicitCritical });
  const dedupeKey = diagnosticDedupeKey(companyId, safe);
  const detailsJson = JSON.stringify({
    source: clean(options.source, 60) || 'application',
    correlationId: clean(options.correlationId, 120)
  });

  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('actorUserId', sql.NVarChar(120), actorUserId)
    .input('severity', sql.NVarChar(20), severity)
    .input('area', sql.NVarChar(120), safe.area)
    .input('action', sql.NVarChar(160), safe.action)
    .input('errorMessage', sql.NVarChar(2000), safe.errorMessage)
    .input('errorCode', sql.NVarChar(120), safe.errorCode)
    .input('apiPath', sql.NVarChar(500), safe.apiPath)
    .input('httpMethod', sql.NVarChar(16), safe.httpMethod)
    .input('httpStatus', sql.Int, safe.httpStatus || null)
    .input('userAgent', sql.NVarChar(1000), safe.userAgent)
    .input('appVersion', sql.NVarChar(60), safe.appVersion)
    .input('dedupeKey', sql.NVarChar(128), dedupeKey)
    .input('detailsJson', sql.NVarChar(sql.MAX), detailsJson)
    .query(`INSERT INTO DiagnosticEvents(
              companyId,actorUserId,severity,area,action,errorMessage,errorCode,apiPath,httpMethod,httpStatus,
              userAgent,appVersion,dedupeKey,detailsJson
            )
            OUTPUT inserted.id,inserted.companyId,inserted.actorUserId,inserted.severity,inserted.area,inserted.action,
                   inserted.errorMessage,inserted.errorCode,inserted.apiPath,inserted.httpMethod,inserted.httpStatus,
                   inserted.userAgent,inserted.appVersion,inserted.dedupeKey,inserted.createdAt,inserted.alertedAt
            VALUES(
              @companyId,@actorUserId,@severity,@area,@action,@errorMessage,@errorCode,@apiPath,@httpMethod,@httpStatus,
              @userAgent,@appVersion,@dedupeKey,@detailsJson
            )`);
  return result.recordset[0];
}

export function diagnosticListLimit(value, fallback = 200) {
  const number = Number(value || fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(500, Math.trunc(number)));
}
