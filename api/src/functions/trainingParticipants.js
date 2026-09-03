import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { resolveEmployeeAccess, requireEmployeeTarget } from '../lib/employeeAccess.js';
import { writeAudit } from '../lib/audit.js';

async function loadTraining(pool,companyId,trainingId){const result=await pool.request().input('companyId',sql.NVarChar(80),companyId).input('id',sql.NVarChar(80),trainingId).query('SELECT TOP 1 id,lineManagerId FROM PlannedTrainings WHERE companyId=@companyId AND id=@id');return result.recordset[0]||null;}

app.http('trainingParticipants',{methods:['GET','POST','PATCH'],authLevel:'anonymous',route:'planned-trainings/{trainingId}/participants/{id?}',handler:async(request,context)=>{
  try{
    const ctx=await getAuthorizedContext(request);const trainingId=request.params.trainingId;if(!trainingId)return badRequest('trainingId is required');const pool=await getPool();const access=await resolveEmployeeAccess(pool,ctx);const training=await loadTraining(pool,ctx.companyId,trainingId);if(!training)return badRequest('Geplante Unterweisung nicht gefunden.');
    if(access.mode==='team'&&String(training.lineManagerId||'')!==String(access.selfEmployeeId||'')){const err=new Error('Diese Planung ist nicht deinem Team zugewiesen.');err.status=403;throw err;}
    if(request.method==='GET'){
      const result=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('trainingId',sql.NVarChar(80),trainingId).query(`SELECT tp.id,tp.employeeId,e.name AS employeeName,e.email,tp.externalEmail,tp.status,tp.createdAt FROM TrainingParticipants tp LEFT JOIN Employees e ON e.id=tp.employeeId AND e.companyId=tp.companyId WHERE tp.companyId=@companyId AND tp.plannedTrainingId=@trainingId ORDER BY e.name,tp.externalEmail`);if(access.mode==='self')return json(result.recordset.filter(row=>String(row.employeeId||'')===String(access.selfEmployeeId||'')));if(access.mode==='team')return json(result.recordset.filter(row=>!row.employeeId||String(row.employeeId)===String(access.selfEmployeeId)||access.teamEmployeeIds.includes(String(row.employeeId))));return json(result.recordset);
    }
    assertRole(ctx,[Roles.COMPANY_ADMIN,Roles.HSE,Roles.LINE_MANAGER]);const body=await request.json();
    if(request.method==='POST'){if(!body.employeeId&&!body.externalEmail)return badRequest('employeeId or externalEmail is required');if(access.mode==='team'){if(!body.employeeId)return badRequest('Line Manager können nur zugewiesene interne Mitarbeiter hinzufügen.');requireEmployeeTarget(access,body.employeeId);}const id=body.id||uuidv4();await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('plannedTrainingId',sql.NVarChar(80),trainingId).input('employeeId',sql.NVarChar(80),body.employeeId||null).input('externalEmail',sql.NVarChar(254),body.externalEmail||null).query(`INSERT INTO TrainingParticipants(id,companyId,plannedTrainingId,employeeId,externalEmail,status) VALUES(@id,@companyId,@plannedTrainingId,@employeeId,@externalEmail,'invited')`);await writeAudit(pool,ctx,'training.participantAdded','trainingParticipant',id,{trainingId});return json({id},201);}
    const id=request.params.id;if(!id)return badRequest('id is required');if(access.mode==='team'){const participant=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('trainingId',sql.NVarChar(80),trainingId).input('id',sql.NVarChar(80),id).query('SELECT TOP 1 employeeId FROM TrainingParticipants WHERE companyId=@companyId AND plannedTrainingId=@trainingId AND id=@id');if(!participant.recordset[0])return badRequest('Teilnehmer nicht gefunden.');requireEmployeeTarget(access,participant.recordset[0].employeeId);}
    await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('trainingId',sql.NVarChar(80),trainingId).input('status',sql.NVarChar(40),body.status||'invited').query('UPDATE TrainingParticipants SET status=@status WHERE id=@id AND companyId=@companyId AND plannedTrainingId=@trainingId');await writeAudit(pool,ctx,'training.participantUpdated','trainingParticipant',id,body);return json({ok:true});
  }catch(err){return serverError(err,context);}
}});
