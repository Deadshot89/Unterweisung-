import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('settings', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  route: 'settings',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT companyId,yellowWarningDays,orangeCriticalDays,defaultResponsibleEmail,hseEmail,dataRetentionMonths,updatedAt
                  FROM CompanySettings WHERE companyId=@companyId`);
        return json(result.recordset[0] || {
          companyId: ctx.companyId,
          yellowWarningDays: 60,
          orangeCriticalDays: 30,
          defaultResponsibleEmail: null,
          hseEmail: null,
          dataRetentionMonths: 120
        });
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();
      const yellow = Number(body.yellowWarningDays ?? 60);
      const orange = Number(body.orangeCriticalDays ?? 30);
      if (yellow < 1 || orange < 1 || orange > yellow) return badRequest('Warnfristen ungültig: orange muss kleiner/gleich gelb sein.');

      await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('yellowWarningDays', sql.Int, yellow)
        .input('orangeCriticalDays', sql.Int, orange)
        .input('defaultResponsibleEmail', sql.NVarChar(254), body.defaultResponsibleEmail || null)
        .input('hseEmail', sql.NVarChar(254), body.hseEmail || null)
        .input('dataRetentionMonths', sql.Int, Number(body.dataRetentionMonths ?? 120))
        .query(`MERGE CompanySettings AS t
                USING (SELECT @companyId AS companyId) AS s ON t.companyId=s.companyId
                WHEN MATCHED THEN UPDATE SET yellowWarningDays=@yellowWarningDays, orangeCriticalDays=@orangeCriticalDays,
                  defaultResponsibleEmail=@defaultResponsibleEmail, hseEmail=@hseEmail, dataRetentionMonths=@dataRetentionMonths, updatedAt=SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT(companyId,yellowWarningDays,orangeCriticalDays,defaultResponsibleEmail,hseEmail,dataRetentionMonths,updatedAt)
                  VALUES(@companyId,@yellowWarningDays,@orangeCriticalDays,@defaultResponsibleEmail,@hseEmail,@dataRetentionMonths,SYSUTCDATETIME());`);
      await writeAudit(pool, ctx, 'settings.updated', 'companySettings', ctx.companyId, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
