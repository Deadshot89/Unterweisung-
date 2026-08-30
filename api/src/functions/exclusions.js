import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('exclusions', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'exclusions/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT id, employeeId, instructionTypeId, reason, active, createdAt, createdBy
                  FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND active=1`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      if (request.method === 'POST') {
        const body = await request.json();
        if (!body.employeeId || !body.instructionTypeId) return badRequest('employeeId and instructionTypeId are required');
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
        await writeAudit(pool, ctx, 'instruction.excluded', 'employeeInstructionExclusion', id, body);
        return json({ id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query('UPDATE EmployeeInstructionExclusions SET active=0 WHERE id=@id AND companyId=@companyId');
      await writeAudit(pool, ctx, 'instruction.exclusionRemoved', 'employeeInstructionExclusion', id);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
