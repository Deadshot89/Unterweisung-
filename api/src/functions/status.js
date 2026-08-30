import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getRequestContext } from '../lib/auth.js';

app.http('instructionStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'instruction-status',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query(`SELECT companyId, employeeId, employeeName, email, department, role, lineManagerId, lineManagerName, lineManagerEmail,
                       typeId, instructionName, category, intervalMonths, templateId,
                       recordId, conductedAt, validUntil, recordStatus, source, instructorId, durationMinutes,
                       exclusionId, exclusionReason, status
                FROM dbo.vInstructionStatus
                WHERE companyId=@companyId
                ORDER BY category, instructionName, employeeName`);
      return json(result.recordset);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
