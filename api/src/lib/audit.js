import { sql } from './db.js';

export async function writeAudit(pool, ctx, action, entityType = null, entityId = null, details = null) {
  try {
    await pool.request()
      .input('companyId', sql.NVarChar(80), ctx.companyId || null)
      .input('actorUserId', sql.NVarChar(120), ctx.userId || null)
      .input('action', sql.NVarChar(120), action)
      .input('entityType', sql.NVarChar(80), entityType)
      .input('entityId', sql.NVarChar(80), entityId)
      .input('ipAddress', sql.NVarChar(80), ctx.ipAddress || null)
      .input('userAgent', sql.NVarChar(500), ctx.userAgent || null)
      .input('detailsJson', sql.NVarChar(sql.MAX), details ? JSON.stringify(details) : null)
      .query(`INSERT INTO AuditLog(companyId,actorUserId,action,entityType,entityId,ipAddress,userAgent,detailsJson)
              VALUES(@companyId,@actorUserId,@action,@entityType,@entityId,@ipAddress,@userAgent,@detailsJson)`);
  } catch (err) {
    // Audit darf die Fachaktion nicht blockieren, wird aber im Function-Log sichtbar.
    console.error('AuditLog failed', err.message);
  }
}
