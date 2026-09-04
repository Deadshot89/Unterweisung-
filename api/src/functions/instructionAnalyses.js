import { app } from '@azure/functions';
import { getPool,sql } from '../lib/db.js';
import { json,badRequest,serverError } from '../lib/http.js';
import { getAuthorizedContext,assertRole,Roles } from '../lib/auth.js';
import { aiConfiguration } from '../lib/instruction-analysis/provider.js';
import { publicAnalysis,startAnalysis,pollAnalysis,publishAnalysis } from '../lib/instruction-analysis/store.js';
app.http('instructionAnalyses',{
 methods:['GET','POST'],authLevel:'anonymous',route:'instruction-analyses/{id?}',
 handler:async(request,context)=>{
  try {
   const ctx=await getAuthorizedContext(request);assertRole(ctx,[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN,Roles.HSE]);
   const pool=await getPool(),id=request.params.id;
   if(request.method==='GET') {
    if(id) return json(publicAnalysis(await pollAnalysis(pool,ctx,id)));
    const rows=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).query('SELECT TOP 50 * FROM dbo.InstructionAnalyses WHERE companyId=@companyId ORDER BY createdAt DESC');
    return json({configured:aiConfiguration().configured,analyses:rows.recordset.map(row=>publicAnalysis(row,false))});
   }
   if(!id) return badRequest('Analyse-ID fehlt.');
   const body=await request.json();
   if(body.action==='start') return json(publicAnalysis(await startAnalysis(pool,ctx,id)));
   if(body.action==='publish') return json(publicAnalysis(await publishAnalysis(pool,ctx,id,body.reviewConfirmed)));
   return badRequest('Unbekannte Analyseaktion.');
  }catch(error){return serverError(error,context);}
 }
});
