import { app } from '@azure/functions';
import { getAuthorizedContext, Roles } from '../lib/auth.js';
import { resolveEmployeeAccess } from '../lib/employeeAccess.js';
import { json, serverError } from '../lib/http.js';
import { getPool } from '../lib/db.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

app.http('me', {
  methods: ['GET'], authLevel: 'anonymous', route: 'me',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const requiresCompanySelection = ctx.roles.includes(Roles.SYSTEM_ADMIN) && !ctx.companyId;
      const employeeAccess = requiresCompanySelection
        ? { mode:'system', selfEmployeeId:null, teamEmployeeIds:[] }
        : await resolveEmployeeAccess(pool, ctx);
      await writeSecurityEvent(pool, ctx, 'auth.me.loaded', 'info', { roles: ctx.roles, companyId: ctx.companyId, authMode: ctx.authMode, requiresCompanySelection });
      return json({ authenticated:true,companyId:ctx.companyId,userId:ctx.userId,email:ctx.email,displayName:ctx.userDetails,roles:ctx.roles,
        isSystemAdmin:ctx.roles.includes(Roles.SYSTEM_ADMIN),requiresCompanySelection,isLocalDev:!!ctx.isLocalDev,authMode:ctx.authMode || (ctx.isLocalDev?'dev-bypass':'entra'),
        allowedCompanies:ctx.allowedCompanies,employeeId:employeeAccess.selfEmployeeId,accessMode:employeeAccess.mode,teamEmployeeIds:employeeAccess.teamEmployeeIds });
    } catch (err) { return serverError(err, context); }
  }
});
