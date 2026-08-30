import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';

app.http('managerReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reports/manager-training-time',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const url = new URL(request.url);
      const from = url.searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString();
      const to = url.searchParams.get('to') || new Date().toISOString();
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('from', sql.DateTime2, new Date(from))
        .input('to', sql.DateTime2, new Date(to))
        .query(`SELECT monthKey, responsibleId, responsibleName, instructionTypeId, instructionName,
                       SUM(participantRecords) AS participantRecords,
                       SUM(trainingEvents) AS trainingEvents,
                       SUM(participantMinutes) AS participantMinutes
                FROM dbo.vManagerTrainingTimeMonthly
                WHERE companyId=@companyId AND monthStart >= DATEFROMPARTS(YEAR(@from),MONTH(@from),1)
                  AND monthStart <= DATEFROMPARTS(YEAR(@to),MONTH(@to),1)
                GROUP BY monthKey,responsibleId,responsibleName,instructionTypeId,instructionName
                ORDER BY monthKey DESC, responsibleName, instructionName`);
      return json(result.recordset);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
