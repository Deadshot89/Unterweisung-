import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('instructionTypes', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'instruction-types/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();
      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT id,name,category,intervalMonths,description,templateId,active,createdAt,updatedAt
                  FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();
      if (request.method === 'POST') {
        if (!body.name || !body.category) return badRequest('name and category are required');
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('name', sql.NVarChar(200), body.name)
          .input('category', sql.NVarChar(120), body.category)
          .input('intervalMonths', sql.Int, Number(body.intervalMonths || 12))
          .input('description', sql.NVarChar(sql.MAX), body.description || null)
          .input('templateId', sql.NVarChar(80), body.templateId || null)
          .query(`INSERT INTO InstructionTypes(id,companyId,name,category,intervalMonths,description,templateId,active)
                  VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1)`);
        await writeAudit(pool, ctx, 'instructionType.created', 'instructionType', id, body);
        return json({ id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('name', sql.NVarChar(200), body.name || null)
        .input('category', sql.NVarChar(120), body.category || null)
        .input('intervalMonths', sql.Int, body.intervalMonths == null ? null : Number(body.intervalMonths))
        .input('description', sql.NVarChar(sql.MAX), body.description || null)
        .input('templateId', sql.NVarChar(80), body.templateId || null)
        .input('active', sql.Bit, body.active === false ? 0 : 1)
        .query(`UPDATE InstructionTypes SET
                  name=COALESCE(@name,name), category=COALESCE(@category,category),
                  intervalMonths=COALESCE(@intervalMonths,intervalMonths), description=COALESCE(@description,description),
                  templateId=COALESCE(@templateId,templateId), active=@active, updatedAt=SYSUTCDATETIME()
                WHERE id=@id AND companyId=@companyId`);
      await writeAudit(pool, ctx, 'instructionType.updated', 'instructionType', id, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
