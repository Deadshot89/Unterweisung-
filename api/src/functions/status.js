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
        .query(`WITH latest AS (
                  SELECT r.*, ROW_NUMBER() OVER(PARTITION BY r.employeeId,r.typeId ORDER BY r.conductedAt DESC, r.createdAt DESC) rn
                  FROM InstructionRecords r WHERE r.companyId=@companyId
                )
                SELECT e.id AS employeeId,e.name AS employeeName,e.email,e.department,e.role,e.lineManagerId,
                       lm.name AS lineManagerName,
                       t.id AS typeId,t.name AS instructionName,t.category,t.intervalMonths,t.templateId,
                       l.id AS recordId,l.conductedAt,l.validUntil,l.status AS recordStatus,l.source,l.instructorId,l.durationMinutes,
                       ex.id AS exclusionId, ex.reason AS exclusionReason,
                       CASE
                         WHEN ex.id IS NOT NULL THEN 'not_required'
                         WHEN l.id IS NULL THEN 'missing'
                         WHEN l.validUntil IS NOT NULL AND l.validUntil < SYSUTCDATETIME() THEN 'expired'
                         WHEN l.validUntil IS NOT NULL AND l.validUntil <= DATEADD(day,30,SYSUTCDATETIME()) THEN 'critical'
                         WHEN l.validUntil IS NOT NULL AND l.validUntil <= DATEADD(day,60,SYSUTCDATETIME()) THEN 'soon'
                         ELSE 'valid'
                       END AS status
                FROM Employees e
                CROSS JOIN InstructionTypes t
                LEFT JOIN Employees lm ON lm.id=e.lineManagerId AND lm.companyId=e.companyId
                LEFT JOIN latest l ON l.companyId=e.companyId AND l.employeeId=e.id AND l.typeId=t.id AND l.rn=1
                LEFT JOIN EmployeeInstructionExclusions ex ON ex.companyId=e.companyId AND ex.employeeId=e.id AND ex.instructionTypeId=t.id AND ex.active=1
                WHERE e.companyId=@companyId AND e.active=1 AND t.companyId=@companyId AND t.active=1
                ORDER BY t.category,t.name,e.name`);
      return json(result.recordset);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
