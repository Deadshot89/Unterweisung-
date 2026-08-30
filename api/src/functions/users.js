import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

const VALID_ROLES = new Set([Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.EMPLOYEE, Roles.SYSTEM_ADMIN]);
function normEmail(email) { return String(email || '').trim().toLowerCase(); }
function roleOrDefault(role) {
  const value = String(role || Roles.EMPLOYEE).toLowerCase().trim();
  return VALID_ROLES.has(value) ? value : Roles.EMPLOYEE;
}

app.http('users', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'users/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
        const companyId = ctx.roles.includes(Roles.SYSTEM_ADMIN) && request.query.get('companyId') ? request.query.get('companyId') : ctx.companyId;
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .query(`SELECT id,companyId,email,displayName,role,active,entraObjectId,provider,lastSeenAt,createdAt,updatedAt
                  FROM Users WHERE companyId=@companyId ORDER BY displayName,email`);
        return json(result.recordset);
      }

      const body = await request.json();
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN]);

      if (request.method === 'POST') {
        const companyId = ctx.roles.includes(Roles.SYSTEM_ADMIN) && body.companyId ? body.companyId : ctx.companyId;
        const email = normEmail(body.email);
        if (!email) return badRequest('email is required');
        const displayName = body.displayName || email;
        const role = roleOrDefault(body.role);
        if (role === Roles.SYSTEM_ADMIN && !ctx.roles.includes(Roles.SYSTEM_ADMIN)) return badRequest('Nur System Admin darf System Admin anlegen');
        const id = body.id || `user-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(120), id)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('email', sql.NVarChar(254), email)
          .input('displayName', sql.NVarChar(200), displayName)
          .input('role', sql.NVarChar(60), role)
          .input('entraObjectId', sql.NVarChar(120), body.entraObjectId || null)
          .input('notes', sql.NVarChar(1000), body.notes || null)
          .query(`MERGE Users AS t USING (SELECT @companyId AS companyId, @email AS email) AS s
                  ON t.companyId=s.companyId AND LOWER(t.email)=LOWER(s.email)
                  WHEN MATCHED THEN UPDATE SET displayName=@displayName,role=@role,active=1,entraObjectId=COALESCE(@entraObjectId,entraObjectId),notes=@notes,updatedAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(id,companyId,email,displayName,role,active,entraObjectId,provider,invitedAt,notes)
                  VALUES(@id,@companyId,@email,@displayName,@role,1,@entraObjectId,'aad',SYSUTCDATETIME(),@notes);`);
        await writeAudit(pool, ctx, 'user.upserted', 'user', id, { email, role, companyId });
        await writeSecurityEvent(pool, ctx, 'user.upserted', 'info', { email, role, companyId });
        return json({ id, ok: true }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      const role = body.role ? roleOrDefault(body.role) : null;
      if (role === Roles.SYSTEM_ADMIN && !ctx.roles.includes(Roles.SYSTEM_ADMIN)) return badRequest('Nur System Admin darf System Admin setzen');
      await pool.request()
        .input('id', sql.NVarChar(120), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('displayName', sql.NVarChar(200), body.displayName || null)
        .input('role', sql.NVarChar(60), role)
        .input('active', sql.Bit, body.active === false ? 0 : 1)
        .input('entraObjectId', sql.NVarChar(120), body.entraObjectId || null)
        .input('notes', sql.NVarChar(1000), body.notes || null)
        .query(`UPDATE Users SET
                  displayName=COALESCE(@displayName,displayName),
                  role=COALESCE(@role,role),
                  active=@active,
                  entraObjectId=COALESCE(@entraObjectId,entraObjectId),
                  notes=COALESCE(@notes,notes),
                  updatedAt=SYSUTCDATETIME()
                WHERE id=@id AND (@companyId=companyId OR EXISTS(SELECT 1 FROM Users WHERE id=@id AND @companyId IS NOT NULL))`);
      await writeAudit(pool, ctx, 'user.updated', 'user', id, body);
      await writeSecurityEvent(pool, ctx, 'user.updated', 'info', { id, role, active: body.active !== false });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
