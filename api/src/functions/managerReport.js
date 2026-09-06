import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { resolveEmployeeScope } from '../lib/employeeScope.js';

async function companyReport(pool, ctx, from, to) {
  return pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('from', sql.DateTime2, from)
    .input('to', sql.DateTime2, to)
    .query(`SELECT monthKey, responsibleId, responsibleName, instructionTypeId, instructionName,
                   SUM(participantRecords) AS participantRecords,
                   SUM(trainingEvents) AS trainingEvents,
                   SUM(participantMinutes) AS participantMinutes
            FROM dbo.vManagerTrainingTimeMonthly
            WHERE companyId=@companyId AND monthStart >= DATEFROMPARTS(YEAR(@from),MONTH(@from),1)
              AND monthStart <= DATEFROMPARTS(YEAR(@to),MONTH(@to),1)
            GROUP BY monthKey,responsibleId,responsibleName,instructionTypeId,instructionName
            ORDER BY monthKey DESC, responsibleName, instructionName`);
}

async function scopedTeamReport(pool, ctx, scope, from, to) {
  const employeeIds = [...(scope.allowedEmployeeIds || [])];
  if (!employeeIds.length) return { recordset: [] };
  const req = pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('from', sql.DateTime2, from)
    .input('to', sql.DateTime2, to);
  const params = employeeIds.map((employeeId, index) => {
    req.input(`employeeId${index}`, sql.NVarChar(80), employeeId);
    return `@employeeId${index}`;
  });
  return req.query(`SELECT
      FORMAT(r.conductedAt,'yyyy-MM') AS monthKey,
      COALESCE(lm.id,r.instructorId) AS responsibleId,
      COALESCE(lm.name,ins.name,N'Unbekannt') AS responsibleName,
      t.id AS instructionTypeId,
      t.name AS instructionName,
      COUNT(*) AS participantRecords,
      COUNT(DISTINCT COALESCE(r.groupId,r.id)) AS trainingEvents,
      SUM(COALESCE(r.durationMinutes,0)) AS participantMinutes
    FROM InstructionRecords r
    JOIN InstructionTypes t ON t.companyId=r.companyId AND t.id=r.typeId
    JOIN Employees e ON e.companyId=r.companyId AND e.id=r.employeeId
    LEFT JOIN Employees lm ON lm.companyId=e.companyId AND lm.id=e.lineManagerId
    LEFT JOIN Employees ins ON ins.companyId=r.companyId AND ins.id=r.instructorId
    WHERE r.companyId=@companyId
      AND r.status='completed'
      AND r.employeeId IN (${params.join(',')})
      AND r.conductedAt >= DATEFROMPARTS(YEAR(@from),MONTH(@from),1)
      AND r.conductedAt < DATEADD(month,1,DATEFROMPARTS(YEAR(@to),MONTH(@to),1))
    GROUP BY FORMAT(r.conductedAt,'yyyy-MM'),COALESCE(lm.id,r.instructorId),COALESCE(lm.name,ins.name,N'Unbekannt'),t.id,t.name
    ORDER BY monthKey DESC,responsibleName,instructionName`);
}

app.http('managerReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reports/manager-training-time',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const url = new URL(request.url);
      const from = new Date(url.searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString());
      const to = new Date(url.searchParams.get('to') || new Date().toISOString());
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);
      const result = scope.mode === 'company'
        ? await companyReport(pool, ctx, from, to)
        : await scopedTeamReport(pool, ctx, scope, from, to);
      return json(result.recordset);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
