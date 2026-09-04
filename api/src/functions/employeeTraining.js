import { app } from '@azure/functions';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';
import { resolveEmployeeAccess } from '../lib/employeeAccess.js';
import { saveCertificateHtml } from '../lib/certificate.js';
import { writeAudit } from '../lib/audit.js';
import { loadPublishedLearningContent } from '../lib/learningContent.js';

function clean(value,max){const text=String(value??'').trim();return text?text.slice(0,max):null;}
function addMonths(date,months){const d=new Date(date);d.setMonth(d.getMonth()+Number(months||12));return d;}
function setupError(err){const text=String(err.message||err);if(/Invalid object name 'InternalTrainingAttempts'|Invalid object name 'InstructionLearningSteps'|Invalid column name 'deliveryMode'|Invalid column name 'testRequired'|Invalid column name 'passPercent'/i.test(text)){const e=new Error('Interne Online-Unterweisungen benötigen noch die freizugebende Datenbankmigration 011.');e.status=503;return e;}return err;}
function nextLearningProgress(currentStep,requestedStep,stepCount){
  const current=Math.max(0,Math.min(Number(stepCount||0),Number(currentStep||0)));
  const requested=Math.max(0,Math.min(Number(stepCount||0),Number(requestedStep||0)));
  return Math.max(current,Math.min(requested,current+1));
}

async function loadType(pool,companyId,employeeId,instructionTypeId){
  const result=await pool.request().input('companyId',sql.NVarChar(80),companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId)
    .query(`SELECT TOP 1 t.id,t.name,t.category,t.intervalMonths,t.description,t.templateId,t.deliveryMode,t.testRequired,t.passPercent,t.active,
                   e.name AS employeeName,e.email,c.name AS companyName,c.legalName
            FROM InstructionTypes t JOIN Employees e ON e.companyId=t.companyId AND e.id=@employeeId JOIN Companies c ON c.id=t.companyId
            WHERE t.companyId=@companyId AND t.id=@instructionTypeId AND t.active=1`);
  return result.recordset[0]||null;
}
async function newQuestionSnapshot(pool,companyId,instructionTypeId,language,testRequired){
  if(!testRequired)return [];
  const result=await pool.request().input('companyId',sql.NVarChar(80),companyId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId).input('language',sql.NVarChar(10),language)
    .query(`SELECT TOP 10 id,question,optionsJson,correctIndex FROM TestQuestions
            WHERE companyId=@companyId AND instructionTypeId=@instructionTypeId AND language=@language AND active=1 ORDER BY NEWID()`);
  if(!result.recordset.length){const err=new Error('Für diese Online-Unterweisung sind noch keine aktiven Testfragen freigegeben.');err.status=409;throw err;}
  return result.recordset.map(row=>({id:row.id,question:row.question,options:JSON.parse(row.optionsJson||'[]'),correctIndex:Number(row.correctIndex)}));
}
function safeQuestions(snapshot){return (snapshot||[]).map(q=>({id:q.id,question:q.question,options:q.options}));}
function answerResult(snapshot,answers){
  const map=new Map((Array.isArray(answers)?answers:[]).map(a=>[String(a.questionId||''),Number(a.answerIndex)]));
  if(snapshot.length!==map.size||snapshot.some(q=>!map.has(String(q.id))))return {error:'Bitte alle Fragen genau einmal beantworten.'};
  let correct=0;const details=snapshot.map(q=>{const selected=map.get(String(q.id));const ok=Number.isInteger(selected)&&selected===Number(q.correctIndex);if(ok)correct++;return {questionId:q.id,selectedIndex:selected,correctIndex:Number(q.correctIndex),correct:ok};});
  return {details,scorePercent:snapshot.length?Math.round(correct/snapshot.length*10000)/100:100};
}

app.http('employeeTraining', {
  methods:['GET','POST'],authLevel:'anonymous',route:'employee-training/{instructionTypeId}',
  handler:async(request,context)=>{
    try{
      const ctx=await getAuthorizedContext(request);const pool=await getPool();const access=await resolveEmployeeAccess(pool,ctx);
      const employeeId=access.selfEmployeeId;if(!employeeId){const err=new Error('Für dein Benutzerkonto ist kein Mitarbeiter mit derselben E-Mail hinterlegt.');err.status=409;throw err;}
      const instructionTypeId=clean(request.params.instructionTypeId,80);if(!instructionTypeId)return badRequest('instructionTypeId is required');
      const language=String(request.query.get('language')||'de').toLowerCase();const type=await loadType(pool,ctx.companyId,employeeId,instructionTypeId);if(!type)return notFound('Unterweisung nicht gefunden.');
      const exclusion=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId)
        .query('SELECT TOP 1 id FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND employeeId=@employeeId AND instructionTypeId=@instructionTypeId AND active=1');
      if(exclusion.recordset.length){const err=new Error('Diese Unterweisung ist für dich als nicht erforderlich markiert.');err.status=409;throw err;}
      const content=await loadPublishedLearningContent(pool,{companyId:ctx.companyId,instructionTypeId,language});
      const steps=content.steps.map(({imageBlobPath,imageFileName,...step})=>step);
      const contentPayload={learningGoal:content.learningGoal,learningIntro:content.learningIntro,keyPoints:content.keyPoints};

      if(request.method==='GET'){
        if(String(type.deliveryMode||'practical')!=='online')return json({instructionTypeId,instructionName:type.name,description:type.description,deliveryMode:'practical',requiresPlanning:true,canSelfComplete:false,templateId:type.templateId,steps,...contentPayload});
        let attempt=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId)
          .query("SELECT TOP 1 id,status,currentStep,questionSnapshotJson,startedAt FROM InternalTrainingAttempts WHERE companyId=@companyId AND employeeId=@employeeId AND instructionTypeId=@instructionTypeId AND status='started' ORDER BY startedAt DESC");
        let row=attempt.recordset[0];
        if(!row){
          const snapshot=await newQuestionSnapshot(pool,ctx.companyId,instructionTypeId,language,!!type.testRequired);const id=`attempt-${crypto.randomUUID()}`;
          await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId)
            .input('language',sql.NVarChar(10),language).input('snapshot',sql.NVarChar(sql.MAX),JSON.stringify(snapshot)).input('createdBy',sql.NVarChar(120),ctx.userId)
            .query(`INSERT INTO InternalTrainingAttempts(id,companyId,employeeId,instructionTypeId,language,status,currentStep,questionSnapshotJson,createdBy)
                    VALUES(@id,@companyId,@employeeId,@instructionTypeId,@language,'started',0,@snapshot,@createdBy)`);
          row={id,status:'started',currentStep:0,questionSnapshotJson:JSON.stringify(snapshot),startedAt:new Date().toISOString()};
        }
        const snapshot=JSON.parse(row.questionSnapshotJson||'[]');
        return json({attemptId:row.id,instructionTypeId,instructionName:type.name,description:type.description,deliveryMode:'online',requiresPlanning:false,canSelfComplete:true,testRequired:!!type.testRequired,passPercent:Number(type.passPercent||80),templateId:type.templateId,steps,currentStep:Number(row.currentStep||0),questions:safeQuestions(snapshot),...contentPayload});
      }

      if(String(type.deliveryMode||'practical')!=='online'){const err=new Error('Praktische Unterweisungen müssen durch einen berechtigten Verantwortlichen bestätigt werden.');err.status=409;throw err;}
      const body=await request.json();const attemptId=clean(body.attemptId,80);if(!attemptId)return badRequest('attemptId is required');
      const attemptResult=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId).input('id',sql.NVarChar(80),attemptId)
        .query("SELECT TOP 1 id,status,currentStep,questionSnapshotJson FROM InternalTrainingAttempts WHERE companyId=@companyId AND employeeId=@employeeId AND instructionTypeId=@instructionTypeId AND id=@id");
      const attempt=attemptResult.recordset[0];if(!attempt)return notFound('Lernfortschritt nicht gefunden.');if(attempt.status==='completed')return json({ok:true,passed:true,alreadyCompleted:true});
      if(body.confirmed!==true){
        const currentStep=nextLearningProgress(attempt.currentStep,body.currentStep,steps.length);
        await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),attemptId).input('currentStep',sql.Int,currentStep)
          .query("UPDATE InternalTrainingAttempts SET currentStep=@currentStep,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id AND status='started'");
        return json({ok:true,currentStep});
      }
      if(attempt.currentStep < steps.length){
        return json({error:'Bitte alle Lernschritte vollständig durchlaufen, bevor du die Unterweisung abschließt.'},409);
      }
      const snapshot=JSON.parse(attempt.questionSnapshotJson||'[]');let test={details:[],scorePercent:100};
      if(type.testRequired){test=answerResult(snapshot,body.answers);if(test.error)return badRequest(test.error);}
      const passed=!type.testRequired||test.scorePercent>=Number(type.passPercent||80);
      if(!passed){
        await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),attemptId).input('answers',sql.NVarChar(sql.MAX),JSON.stringify(test.details)).input('score',sql.Decimal(5,2),test.scorePercent)
          .query("UPDATE InternalTrainingAttempts SET status='failed',answersJson=@answers,scorePercent=@score,passed=0,completedAt=SYSUTCDATETIME(),updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id");
        await writeAudit(pool,ctx,'employeeTraining.failed','internalTrainingAttempt',attemptId,{instructionTypeId,employeeId,scorePercent:test.scorePercent});
        return json({ok:false,passed:false,scorePercent:test.scorePercent,passPercent:Number(type.passPercent||80)});
      }
      const conductedAt=new Date();const validUntil=addMonths(conductedAt,type.intervalMonths||12);const recordId=crypto.randomUUID();
      const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let open=true;
      try{
        const req=new sql.Request(tx);const lock=await req.input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),attemptId)
          .query("SELECT status FROM InternalTrainingAttempts WITH (UPDLOCK,HOLDLOCK) WHERE companyId=@companyId AND id=@id");
        if(lock.recordset[0]?.status==='completed'){await tx.rollback();open=false;return json({ok:true,passed:true,alreadyCompleted:true});}
        await new sql.Request(tx).input('id',sql.NVarChar(80),recordId).input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('typeId',sql.NVarChar(80),instructionTypeId)
          .input('conductedAt',sql.DateTime2,conductedAt).input('validUntil',sql.DateTime2,validUntil).input('createdBy',sql.NVarChar(120),ctx.userId)
          .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,confirmationText,createdBy)
                  VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,'completed','online_self','Online-Unterweisung digital abgeschlossen',@createdBy)`);
        await new sql.Request(tx).input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),attemptId).input('recordId',sql.NVarChar(80),recordId)
          .input('answers',sql.NVarChar(sql.MAX),JSON.stringify(test.details)).input('score',sql.Decimal(5,2),test.scorePercent)
          .query("UPDATE InternalTrainingAttempts SET status='completed',answersJson=@answers,scorePercent=@score,passed=1,recordId=@recordId,completedAt=SYSUTCDATETIME(),updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id");
        if(type.testRequired){await new sql.Request(tx).input('id',sql.NVarChar(80),crypto.randomUUID()).input('companyId',sql.NVarChar(80),ctx.companyId).input('employeeId',sql.NVarChar(80),employeeId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId).input('language',sql.NVarChar(10),language).input('score',sql.Decimal(5,2),test.scorePercent).input('answers',sql.NVarChar(sql.MAX),JSON.stringify(test.details)).input('recordId',sql.NVarChar(80),recordId).query(`INSERT INTO TestResults(id,companyId,employeeId,instructionTypeId,language,scorePercent,passed,answersJson,linkedRecordId) VALUES(@id,@companyId,@employeeId,@instructionTypeId,@language,@score,1,@answers,@recordId)`);}
        await tx.commit();open=false;
      }catch(error){if(open)await tx.rollback().catch(()=>{});throw error;}
      let certificate=null;
      try{
        certificate=await saveCertificateHtml(pool,ctx,{company:{name:type.companyName,legalName:type.legalName},employeeName:type.employeeName,email:type.email,instructionName:type.name,language,conductedAt,validUntil,scorePercent:type.testRequired?test.scorePercent:null,passed:true,confirmationText:'Online-Unterweisung digital abgeschlossen'});
        await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),recordId).input('fileId',sql.NVarChar(80),certificate.id).query('UPDATE InstructionRecords SET certificateFileId=@fileId WHERE companyId=@companyId AND id=@id');
      }catch(error){context?.warn?.(`certificate creation failed: ${error.message}`);}
      await writeAudit(pool,ctx,'employeeTraining.completed','instructionRecord',recordId,{instructionTypeId,employeeId,scorePercent:type.testRequired?test.scorePercent:null,certificateFileId:certificate?.id||null});
      return json({ok:true,passed:true,scorePercent:type.testRequired?test.scorePercent:null,recordId,certificateFileId:certificate?.id||null,validUntil:validUntil.toISOString()});
    }catch(err){return serverError(setupError(err),context);}
  }
});
