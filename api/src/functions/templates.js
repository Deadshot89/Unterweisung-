import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('templates', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'templates/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT id,title,fileName,blobPath AS path,category,description,active,createdAt
                  FROM Templates WHERE companyId=@companyId ORDER BY category,title`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();
      if (request.method === 'POST') {
        if (!body.title || !body.fileName || !body.path) return badRequest('title, fileName and path are required');
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('title', sql.NVarChar(240), body.title)
          .input('fileName', sql.NVarChar(260), body.fileName)
          .input('blobPath', sql.NVarChar(500), body.path || body.blobPath)
          .input('category', sql.NVarChar(120), body.category || null)
          .input('description', sql.NVarChar(sql.MAX), body.description || null)
          .query(`INSERT INTO Templates(id,companyId,title,fileName,blobPath,category,description,active)
                  VALUES(@id,@companyId,@title,@fileName,@blobPath,@category,@description,1)`);
        await writeAudit(pool, ctx, 'template.created', 'template', id, body);
        return json({ id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('title', sql.NVarChar(240), body.title || null)
        .input('fileName', sql.NVarChar(260), body.fileName || null)
        .input('blobPath', sql.NVarChar(500), body.path || body.blobPath || null)
        .input('category', sql.NVarChar(120), body.category || null)
        .input('description', sql.NVarChar(sql.MAX), body.description || null)
        .input('active', sql.Bit, body.active === false ? 0 : 1)
        .query(`UPDATE Templates SET title=COALESCE(@title,title), fileName=COALESCE(@fileName,fileName),
                  blobPath=COALESCE(@blobPath,blobPath), category=COALESCE(@category,category),
                  description=COALESCE(@description,description), active=@active
                WHERE id=@id AND companyId=@companyId`);
      await writeAudit(pool, ctx, 'template.updated', 'template', id, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
