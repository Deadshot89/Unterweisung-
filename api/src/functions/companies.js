import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('companies', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'companies/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        if (ctx.roles.includes(Roles.SYSTEM_ADMIN)) {
          const result = await pool.request().query('SELECT id,name,legalName,addressLine,defaultLanguage,active,createdAt,updatedAt FROM Companies ORDER BY name');
          return json(result.recordset);
        }
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query('SELECT id,name,legalName,addressLine,defaultLanguage,active,createdAt,updatedAt FROM Companies WHERE id=@companyId');
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN]);
      const body = await request.json();

      if (request.method === 'POST') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN]);
        if (!body.name) return badRequest('name is required');
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('name', sql.NVarChar(200), body.name)
          .input('legalName', sql.NVarChar(240), body.legalName || null)
          .input('addressLine', sql.NVarChar(300), body.addressLine || null)
          .input('defaultLanguage', sql.NVarChar(10), body.defaultLanguage || 'de')
          .query(`INSERT INTO Companies(id,name,legalName,addressLine,defaultLanguage,active)
                  VALUES(@id,@name,@legalName,@addressLine,@defaultLanguage,1)`);
        await writeAudit(pool, ctx, 'company.created', 'company', id, { name: body.name });
        return json({ id }, 201);
      }

      const id = request.params.id || ctx.companyId;
      if (!id) return badRequest('id is required');
      if (!ctx.roles.includes(Roles.SYSTEM_ADMIN) && id !== ctx.companyId) {
        const err = new Error('Firma darf nicht geändert werden');
        err.status = 403;
        throw err;
      }
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('name', sql.NVarChar(200), body.name || null)
        .input('legalName', sql.NVarChar(240), body.legalName || null)
        .input('addressLine', sql.NVarChar(300), body.addressLine || null)
        .input('defaultLanguage', sql.NVarChar(10), body.defaultLanguage || null)
        .input('active', sql.Bit, body.active === false ? 0 : 1)
        .query(`UPDATE Companies SET
                  name=COALESCE(@name,name),
                  legalName=COALESCE(@legalName,legalName),
                  addressLine=COALESCE(@addressLine,addressLine),
                  defaultLanguage=COALESCE(@defaultLanguage,defaultLanguage),
                  active=@active,
                  updatedAt=SYSUTCDATETIME()
                WHERE id=@id`);
      await writeAudit(pool, ctx, 'company.updated', 'company', id, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
