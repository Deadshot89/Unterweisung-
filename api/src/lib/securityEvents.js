import { sql } from './db.js';

export async function writeSecurityEvent(pool, ctx, eventType, severity = 'info', details = null) {
  try {
    await pool.request()
      .input('companyId', sql.NVarChar(80), ctx?.companyId || null)
      .input('actorUserId', sql.NVarChar(120), ctx?.userId || null)
      .input('eventType', sql.NVarChar(120), eventType)
      .input('severity', sql.NVarChar(40), severity)
      .input('ipAddress', sql.NVarChar(80), ctx?.ipAddress || null)
      .input('userAgent', sql.NVarChar(500), ctx?.userAgent || null)
      .input('detailsJson', sql.NVarChar(sql.MAX), details ? JSON.stringify(details) : null)
      .query(`INSERT INTO SecurityEvents(companyId,actorUserId,eventType,severity,ipAddress,userAgent,detailsJson)
              VALUES(@companyId,@actorUserId,@eventType,@severity,@ipAddress,@userAgent,@detailsJson)`);
  } catch (err) {
    console.error('SecurityEvents failed', err.message);
  }
}
