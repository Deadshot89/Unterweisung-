import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { DIAGNOSTICS_VIEW_PERMISSION } from '../lib/diagnosticAccess.js';
import { writeAudit } from '../lib/audit.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

app.http('userDiagnosticPermissions', {
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'users/{id}/permissions/diagnostics',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN]);
      const pool = await getPool();
      const userId = clean(request.params.id, 120);
      if (!userId) return badRequest('Benutzer-ID fehlt.');

      const body = await request.json().catch(() => ({}));
      const companyId = clean(body.companyId || request.query.get('companyId') || ctx.companyId, 80);
      if (!companyId) return badRequest('Firma fehlt.');

      const target = await pool.request()
        .input('userId', sql.NVarChar(120), userId)
        .input('companyId', sql.NVarChar(80), companyId)
        .query('SELECT TOP 1 id,companyId,email,displayName,role FROM Users WHERE id=@userId AND companyId=@companyId');
      if (!target.recordset.length) {
        const err = new Error('Benutzer in dieser Firma nicht gefunden.');
        err.status = 404;
        throw err;
      }

      if (request.method === 'PUT') {
        await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .input('userId', sql.NVarChar(120), userId)
          .input('permissionKey', sql.NVarChar(120), DIAGNOSTICS_VIEW_PERMISSION)
          .input('grantedBy', sql.NVarChar(120), ctx.userId)
          .query(`MERGE UserPermissions AS target
                  USING (SELECT @companyId AS companyId,@userId AS userId,@permissionKey AS permissionKey) AS source
                  ON target.companyId=source.companyId AND target.userId=source.userId AND target.permissionKey=source.permissionKey
                  WHEN MATCHED THEN UPDATE SET grantedBy=@grantedBy,grantedAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(companyId,userId,permissionKey,grantedBy)
                  VALUES(@companyId,@userId,@permissionKey,@grantedBy);`);
        await writeAudit(pool, ctx, 'user.permission.granted', 'user', userId, { companyId, permissionKey: DIAGNOSTICS_VIEW_PERMISSION });
        await writeSecurityEvent(pool, ctx, 'user.permission.granted', 'info', { companyId, userId, permissionKey: DIAGNOSTICS_VIEW_PERMISSION });
        return json({ ok: true, diagnosticsView: true });
      }

      await pool.request()
        .input('companyId', sql.NVarChar(80), companyId)
        .input('userId', sql.NVarChar(120), userId)
        .input('permissionKey', sql.NVarChar(120), DIAGNOSTICS_VIEW_PERMISSION)
        .query('DELETE FROM UserPermissions WHERE companyId=@companyId AND userId=@userId AND permissionKey=@permissionKey');
      await writeAudit(pool, ctx, 'user.permission.revoked', 'user', userId, { companyId, permissionKey: DIAGNOSTICS_VIEW_PERMISSION });
      await writeSecurityEvent(pool, ctx, 'user.permission.revoked', 'info', { companyId, userId, permissionKey: DIAGNOSTICS_VIEW_PERMISSION });
      return json({ ok: true, diagnosticsView: false });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
