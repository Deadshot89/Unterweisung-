import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';

app.http('employees', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'employees/{id?}',
  handler: async (request, context) => {
    try {
      const { companyId, userId } = await getAuthorizedContext(request);
      const pool = await getPool();
      if (request.method === 'GET') {
        const result = await pool.request().input('companyId', sql.NVarChar(80), companyId)
          .query('SELECT id, name, chipNr, email, department, active, role, lineManagerId FROM Employees WHERE companyId=@companyId ORDER BY name');
        return json(result.recordset);
      }
      const body = await request.json();
      if (request.method === 'POST') {
        if (!body.name) return badRequest('name is required');
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('name', sql.NVarChar(200), body.name)
          .input('chipNr', sql.NVarChar(80), body.chipNr || null)
          .input('email', sql.NVarChar(254), body.email || null)
          .input('department', sql.NVarChar(120), body.department || null)
          .input('role', sql.NVarChar(60), body.role || 'Mitarbeiter')
          .input('lineManagerId', sql.NVarChar(80), body.lineManagerId || body.shiftLeaderId || null)
          .input('createdBy', sql.NVarChar(120), userId)
          .query(`INSERT INTO Employees(id,companyId,name,chipNr,email,department,role,lineManagerId,active,createdBy)
                  VALUES(@id,@companyId,@name,@chipNr,@email,@department,@role,@lineManagerId,1,@createdBy)`);
        return json({ id }, 201);
      }
      if (request.method === 'PATCH') {
        const id = request.params.id;
        if (!id) return badRequest('id is required');
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('active', sql.Bit, body.active === false ? 0 : 1)
          .input('lineManagerId', sql.NVarChar(80), body.lineManagerId || body.shiftLeaderId || null)
          .query(`UPDATE Employees SET active=@active, lineManagerId=COALESCE(@lineManagerId,lineManagerId), updatedAt=SYSUTCDATETIME()
                  WHERE id=@id AND companyId=@companyId`);
        return json({ ok: true });
      }
    } catch (err) {
      return serverError(err, context);
    }
  }
});
