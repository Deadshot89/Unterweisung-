import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { resolveEmployeeScope, assertEmployeeAllowed, filterRowsByEmployeeScope } from '../lib/employeeScope.js';

async function assertCompanyEmployee(pool, companyId, employeeId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('employeeId', sql.NVarChar(80), employeeId)
    .query('SELECT TOP 1 id FROM Employees WHERE companyId=@companyId AND id=@employeeId AND active=1');
  if (!result.recordset.length) {
    const error = new Error('Mitarbeiter gehört nicht zur aktiven Firma oder ist inaktiv.');
    error.status = 403;
    throw error;
  }
}

app.http('exclusions', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'exclusions/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT id, employeeId, instructionTypeId, reason, active, createdAt, createdBy
                  FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND active=1`);
        return json(filterRowsByEmployeeScope(scope, result.recordset));
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      if (request.method === 'POST') {
        const body = await request.json();
        if (!body.employeeId || !body.instructionTypeId) return badRequest('employeeId and instructionTypeId are required');
        await assertCompanyEmployee(pool, ctx.companyId, body.employeeId);
        assertEmployeeAllowed(scope, body.employeeId);
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('employeeId', sql.NVarChar(80), body.employeeId)
          .input('instructionTypeId', sql.NVarChar(80), body.instructionTypeId)
          .input('reason', sql.NVarChar(500), body.reason || 'Nicht erforderlich')
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`MERGE EmployeeInstructionExclusions AS target
                  USING (SELECT @companyId AS companyId, @employeeId AS employeeId, @instructionTypeId AS instructionTypeId) AS src
                  ON target.companyId=src.companyId AND target.employeeId=src.employeeId AND target.instructionTypeId=src.instructionTypeId
                  WHEN MATCHED THEN UPDATE SET active=1, reason=@reason, createdBy=@createdBy, createdAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(id,companyId,employeeId,instructionTypeId,reason,active,createdBy)
                       VALUES(@id,@companyId,@employeeId,@instructionTypeId,@reason,1,@createdBy);`);
        await writeAudit(pool, ctx, 'instruction.excluded', 'employeeInstructionExclusion', id, { employeeId: body.employeeId, instructionTypeId: body.instructionTypeId, reason: body.reason || 'Nicht erforderlich' });
        return json({ id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      const target = await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query('SELECT TOP 1 id,employeeId FROM EmployeeInstructionExclusions WHERE id=@id AND companyId=@companyId AND active=1');
      const row = target.recordset[0];
      if (!row) return notFound('Ausnahme nicht gefunden.');
      assertEmployeeAllowed(scope, row.employeeId);
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query('UPDATE EmployeeInstructionExclusions SET active=0 WHERE id=@id AND companyId=@companyId');
      await writeAudit(pool, ctx, 'instruction.exclusionRemoved', 'employeeInstructionExclusion', id, { employeeId: row.employeeId });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
