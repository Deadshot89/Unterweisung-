import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { resolveEmployeeAccess, bindEmployeeScope } from '../lib/employeeAccess.js';
import { writeAudit } from '../lib/audit.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function normEmail(value) {
  const email = clean(value, 254);
  return email ? email.toLowerCase() : null;
}

function validEmailOrEmpty(value) {
  const email = normEmail(value);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : false;
}

app.http('employees', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'employees/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const { companyId, userId } = ctx;
      const pool = await getPool();
      if (request.method === 'GET') {
        const access = await resolveEmployeeAccess(pool, ctx);
        const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
        const scope = bindEmployeeScope(req, access, 'id', 'employeeScope');
        const result = await req.query(`SELECT id,name,chipNr,email,department,active,role,lineManagerId,title,createdAt,updatedAt
                                        FROM Employees WHERE companyId=@companyId AND ${scope} ORDER BY name`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();

      if (request.method === 'POST') {
        const name = clean(body.name, 200);
        if (!name) return badRequest('Name fehlt.');
        const email = validEmailOrEmpty(body.email);
        if (email === false) return badRequest('E-Mail-Adresse ist ungültig.');
        const id = clean(body.id, 80) || `emp-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('name', sql.NVarChar(200), name)
          .input('chipNr', sql.NVarChar(80), clean(body.chipNr, 80))
          .input('email', sql.NVarChar(254), email)
          .input('department', sql.NVarChar(120), clean(body.department, 120))
          .input('role', sql.NVarChar(60), clean(body.role, 60) || 'Mitarbeiter')
          .input('title', sql.NVarChar(200), clean(body.title, 200))
          .input('lineManagerId', sql.NVarChar(80), clean(body.lineManagerId || body.shiftLeaderId, 80))
          .input('createdBy', sql.NVarChar(120), userId)
          .query(`INSERT INTO Employees(id,companyId,name,chipNr,email,department,role,title,lineManagerId,active,createdBy)
                  VALUES(@id,@companyId,@name,@chipNr,@email,@department,@role,@title,@lineManagerId,1,@createdBy)`);
        await writeAudit(pool, ctx, 'employee.created', 'employee', id, { name, email });
        return json({ id }, 201);
      }

      if (request.method === 'PATCH') {
        const id = request.params.id;
        if (!id) return badRequest('id is required');
        const email = body.email === undefined ? undefined : validEmailOrEmpty(body.email);
        if (email === false) return badRequest('E-Mail-Adresse ist ungültig.');
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), companyId)
          .input('name', sql.NVarChar(200), body.name === undefined ? null : clean(body.name, 200))
          .input('chipNr', sql.NVarChar(80), body.chipNr === undefined ? null : clean(body.chipNr, 80))
          .input('email', sql.NVarChar(254), email === undefined ? null : email)
          .input('department', sql.NVarChar(120), body.department === undefined ? null : clean(body.department, 120))
          .input('role', sql.NVarChar(60), body.role === undefined ? null : clean(body.role, 60))
          .input('title', sql.NVarChar(200), body.title === undefined ? null : clean(body.title, 200))
          .input('active', sql.Bit, body.active === false ? 0 : 1)
          .input('lineManagerId', sql.NVarChar(80), body.lineManagerId === undefined && body.shiftLeaderId === undefined ? null : clean(body.lineManagerId || body.shiftLeaderId, 80))
          .query(`UPDATE Employees SET
                    name=COALESCE(@name,name),chipNr=COALESCE(@chipNr,chipNr),email=COALESCE(@email,email),
                    department=COALESCE(@department,department),role=COALESCE(@role,role),title=COALESCE(@title,title),
                    active=@active,lineManagerId=COALESCE(@lineManagerId,lineManagerId),updatedAt=SYSUTCDATETIME()
                  WHERE id=@id AND companyId=@companyId`);
        await writeAudit(pool, ctx, 'employee.updated', 'employee', id, body);
        return json({ ok: true });
      }
    } catch (err) {
      return serverError(err, context);
    }
  }
});
