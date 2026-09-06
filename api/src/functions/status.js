import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';
import { resolveEmployeeScope, filterRowsByEmployeeScope } from '../lib/employeeScope.js';

app.http('instructionStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'instruction-status',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query(`SELECT companyId, employeeId, employeeName, email, department, role, lineManagerId, lineManagerName, lineManagerEmail,
                       typeId, instructionName, category, intervalMonths, templateId,
                       recordId, conductedAt, validUntil, recordStatus, source, instructorId, durationMinutes, groupId,
                       certificateFileId, certificateFileName, certificateScanStatus, certificateStatus,
                       exclusionId, exclusionReason, status
                FROM dbo.vInstructionStatus
                WHERE companyId=@companyId
                ORDER BY category, instructionName, employeeName`);
      return json(filterRowsByEmployeeScope(scope, result.recordset));
    } catch (err) {
      return serverError(err, context);
    }
  }
});
