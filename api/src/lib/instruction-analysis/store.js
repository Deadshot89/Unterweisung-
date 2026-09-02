import { createHash, randomUUID } from 'node:crypto';
import { sql } from '../db.js';
import { getContainerClient } from '../blob.js';
import { aiConfiguration,analysisRequest,providerRequest,completedAnalysis,sourcePageCount } from './provider.js';
import { validateAnalysis,instructionText } from './schema.js';
import { balancedPositions,placeCorrectAnswer } from '../question-order.js';

const conflict=message=>Object.assign(new Error(message),{status:409});
const request=(pool,companyId)=>pool.request().input('companyId',sql.NVarChar(80),companyId);
export function analysisId(file,companyId){return 'ia-'+createHash('sha256').update(JSON.stringify([companyId,file.templateId,file.sha256,file.instructionTypeId,file.language])).digest('hex').slice(0,48);}
export async function findAnalysis(pool,companyId,id){
 const result=await request(pool,companyId).input('id',sql.NVarChar(80),id).query('SELECT * FROM dbo.InstructionAnalyses WHERE companyId=@companyId AND id=@id');
 if(!result.recordset.length) throw Object.assign(new Error('Analyse nicht gefunden.'),{status:404});return result.recordset[0];
}
export function publicAnalysis(row,includeResult=true){
 return {id:row.id,templateId:row.templateId,instructionTypeId:row.instructionTypeId,title:row.title,fileName:row.fileName,language:row.language,pageCount:row.pageCount,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt,publishedAt:row.publishedAt,errorCode:row.errorCode,errorMessage:row.errorMessage,result:includeResult&&row.resultJson?JSON.parse(row.resultJson):null};
}
export async function createAnalysisJob(pool,ctx,file,buffer){
 const id=analysisId(file,ctx.companyId);let pageCount=null,errorCode=null,errorMessage=null;
 let status=aiConfiguration().configured?'queued':'configuration_required';
 try{pageCount=await sourcePageCount(buffer,file.contentType);}catch(error){status='failed';errorCode=error.code;errorMessage=error.message;}
 await request(pool,ctx.companyId).input('id',sql.NVarChar(80),id)
  .input('templateId',sql.NVarChar(80),file.templateId).input('typeId',sql.NVarChar(80),file.instructionTypeId)
  .input('hash',sql.NVarChar(128),file.sha256).input('blobPath',sql.NVarChar(500),file.blobPath)
  .input('fileName',sql.NVarChar(260),file.fileName).input('contentType',sql.NVarChar(120),file.contentType).input('title',sql.NVarChar(240),file.title)
  .input('language',sql.NVarChar(10),file.language).input('pageCount',sql.Int,pageCount).input('status',sql.NVarChar(40),status)
  .input('errorCode',sql.NVarChar(80),errorCode).input('errorMessage',sql.NVarChar(1200),errorMessage).input('userId',sql.NVarChar(120),ctx.userId)
  .query(`MERGE dbo.InstructionAnalyses WITH (HOLDLOCK) AS target USING (SELECT @id AS id) AS source ON target.id=source.id
    WHEN NOT MATCHED THEN INSERT(id,companyId,templateId,instructionTypeId,sourceSha256,sourceBlobPath,fileName,contentType,title,language,pageCount,status,errorCode,errorMessage,createdBy,expectedTypeUpdatedAt)
    VALUES(@id,@companyId,@templateId,@typeId,@hash,@blobPath,@fileName,@contentType,@title,@language,@pageCount,@status,@errorCode,@errorMessage,@userId,(SELECT updatedAt FROM dbo.InstructionTypes WHERE id=@typeId AND companyId=@companyId));`);
 return findAnalysis(pool,ctx.companyId,id);
}
async function failJob(pool,companyId,id,error,fromStatuses=['starting','processing'],attemptToken=null){
 // Never expose provider bodies, credentials, SQL messages or source contents in error status.
 const allowed=new Set(['source_changed','source_unreadable','invalid_analysis','incomplete_analysis','analysis_refused','unsupported_source','provider_unavailable','configuration_required','invalid_configuration']);
 const code=allowed.has(error.code)||/^provider_http_\d{3}$/.test(error.code||'')?error.code:'analysis_failed';
 const message=allowed.has(error.code)||/^provider_http_\d{3}$/.test(error.code||'')?error.message:'Analyse fehlgeschlagen. Die Unterlage bleibt gespeichert; bitte erneut versuchen.';
 const req=request(pool,companyId).input('id',sql.NVarChar(80),id).input('code',sql.NVarChar(80),code).input('message',sql.NVarChar(1200),message).input('attemptToken',sql.NVarChar(80),attemptToken);
 fromStatuses.forEach((status,index)=>req.input('s'+index,sql.NVarChar(40),status));
 await req.query(`UPDATE dbo.InstructionAnalyses SET status='failed',errorCode=@code,errorMessage=@message,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id AND (@attemptToken IS NULL OR attemptToken=@attemptToken) AND status IN (${fromStatuses.map((_,i)=>'@s'+i).join(',')})`);
}
export async function startAnalysis(pool,ctx,id){
 let row=await findAnalysis(pool,ctx.companyId,id);const config=aiConfiguration();
 if(!config.configured) return {...row,status:'configuration_required'};
 if(!row.pageCount) return row;
 const attemptToken=randomUUID();
 const claim=await request(pool,ctx.companyId).input('id',sql.NVarChar(80),id).input('attemptToken',sql.NVarChar(80),attemptToken).query(`UPDATE dbo.InstructionAnalyses SET attemptToken=@attemptToken,status='starting',startedAt=SYSUTCDATETIME(),updatedAt=SYSUTCDATETIME(),errorCode=NULL,errorMessage=NULL,providerResponseId=NULL,resultJson=NULL
   OUTPUT INSERTED.id WHERE companyId=@companyId AND id=@id AND status IN ('queued','configuration_required','failed')`);
 if(!claim.recordset.length) return row;
 try {
   const blob=getContainerClient({kind:'template'}).getBlockBlobClient(row.sourceBlobPath);
   const buffer=await blob.downloadToBuffer();
   if(createHash('sha256').update(buffer).digest('hex')!==row.sourceSha256) throw Object.assign(new Error('Die Quelldatei stimmt nicht mehr mit diesem Upload überein. Bitte erneut hochladen.'),{code:'source_changed'});
   const response=await providerRequest('responses',{method:'POST',body:analysisRequest({...row,buffer},config)},config);
   if(!/^[A-Za-z0-9_-]{1,200}$/.test(response.id||'')) throw Object.assign(new Error('Die Analyseantwort ist ungültig.'),{code:'invalid_analysis'});
   await request(pool,ctx.companyId).input('id',sql.NVarChar(80),id).input('responseId',sql.NVarChar(200),response.id).input('attemptToken',sql.NVarChar(80),attemptToken).query(`UPDATE dbo.InstructionAnalyses SET providerResponseId=@responseId,status='processing',updatedAt=SYSUTCDATETIME(),lastPolledAt=NULL WHERE companyId=@companyId AND id=@id AND status='starting' AND attemptToken=@attemptToken`);
 }catch(error){await failJob(pool,ctx.companyId,id,error,['starting'],attemptToken);}
 return findAnalysis(pool,ctx.companyId,id);
}
export async function pollAnalysis(pool,ctx,id){
 let row=await findAnalysis(pool,ctx.companyId,id);
 if(row.status==='starting' && Date.now()-new Date(row.startedAt).getTime()>120000){await failJob(pool,ctx.companyId,id,new Error(),['starting'],row.attemptToken);return findAnalysis(pool,ctx.companyId,id);}
 if(row.status!=='processing') return row;
 const claim=await request(pool,ctx.companyId).input('id',sql.NVarChar(80),id).input('attemptToken',sql.NVarChar(80),row.attemptToken).query(`UPDATE dbo.InstructionAnalyses SET lastPolledAt=SYSUTCDATETIME() OUTPUT INSERTED.id WHERE companyId=@companyId AND id=@id AND status='processing' AND attemptToken=@attemptToken AND (lastPolledAt IS NULL OR lastPolledAt<DATEADD(second,-3,SYSUTCDATETIME()))`);
 if(!claim.recordset.length) return row;
 try {
   const response=await providerRequest('responses/'+row.providerResponseId);
   if(['queued','in_progress'].includes(response.status)) return row;
   const result=validateAnalysis(balanceAnalysisQuestions(completedAnalysis(response)),row);
   const saved=await request(pool,ctx.companyId).input('id',sql.NVarChar(80),id).input('result',sql.NVarChar(sql.MAX),JSON.stringify(result))
    .input('responseId',sql.NVarChar(200),row.providerResponseId).query(`UPDATE dbo.InstructionAnalyses SET resultJson=@result,status='ready',updatedAt=SYSUTCDATETIME() OUTPUT INSERTED.id WHERE companyId=@companyId AND id=@id AND providerResponseId=@responseId AND status='processing'`);
   if(saved.recordset.length) {try{await providerRequest('responses/'+row.providerResponseId,{method:'DELETE'});}catch{/* Stored locally; provider retention policy applies if cleanup is temporarily unavailable. */}}
 }catch(error){if(error.code!=='provider_unavailable'&&!/^provider_http_(429|5\d\d)$/.test(error.code||'')) await failJob(pool,ctx.companyId,id,error,['processing'],row.attemptToken);}
 return findAnalysis(pool,ctx.companyId,id);
}
export function balanceAnalysisQuestions(data){
 // Validate structure before reordering; persist the order once so review and publication agree.
 if(!Array.isArray(data?.questions)) return data;
 const positions=balancedPositions(data.questions.length,4);
 return {...data,questions:data.questions.map((q,index)=>{
   if(!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.correctIndex)||q.correctIndex<0||q.correctIndex>3) return q;
   return {...q,options:placeCorrectAnswer(q.options,q.correctIndex,positions[index]).map(o=>o.text),correctIndex:positions[index]};
 })};
}
export function publishedQuestions(row,result){
 return result.data.questions.map((question,index)=>({id:'qa-'+createHash('sha256').update(row.id+':'+index).digest('hex').slice(0,48),question:question.question,
   optionsJson:JSON.stringify(question.options),correctIndex:question.correctIndex,sourceAspectId:question.aspectId,explanation:question.explanation,sourceEvidenceJson:JSON.stringify(question.evidence)}));
}
export async function publishAnalysis(pool,ctx,id,reviewConfirmed){
 if(reviewConfirmed!==true) throw Object.assign(new Error('Bitte Unterlage, Gerätebezug und Sicherheitsabdeckung fachlich prüfen und bestätigen.'),{status:400});
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let open=true;
 const req=()=>new sql.Request(tx).input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),id);
 try {
   const rows=await req().query('SELECT * FROM dbo.InstructionAnalyses WITH (UPDLOCK,HOLDLOCK) WHERE companyId=@companyId AND id=@id');
   const row=rows.recordset[0];if(!row) throw Object.assign(new Error('Analyse nicht gefunden.'),{status:404});
   if(row.status==='published'){await tx.rollback();open=false;return row;}
   if(row.status!=='ready') throw conflict('Der Entwurf ist noch nicht bereit.');
   const result=validateAnalysis(JSON.parse(row.resultJson).data,row);
   if(!result.publishable) throw conflict('Die Sicherheitsabdeckung ist noch unvollständig. Bitte fehlende Angaben in der Unterlage ergänzen.');
   const current=await req().query(`SELECT a.id FROM dbo.InstructionAnalyses a
     JOIN dbo.Templates t ON t.id=a.templateId AND t.companyId=a.companyId
     JOIN dbo.Files f ON f.id=t.id AND f.companyId=t.companyId
     JOIN dbo.InstructionTypes it ON it.id=a.instructionTypeId AND it.companyId=a.companyId
     WHERE a.id=@id AND a.companyId=@companyId AND t.blobPath=a.sourceBlobPath AND f.sha256=a.sourceSha256 AND t.active=1
       AND (it.updatedAt=a.expectedTypeUpdatedAt OR (it.updatedAt IS NULL AND a.expectedTypeUpdatedAt IS NULL))
       AND NOT EXISTS(SELECT 1 FROM dbo.InstructionAnalyses newer WHERE newer.companyId=a.companyId AND newer.instructionTypeId=a.instructionTypeId AND newer.createdAt>a.createdAt AND newer.language=a.language AND newer.status<>'failed')`);
   if(!current.recordset.length) throw conflict('Unterlage oder Unterweisung wurde inzwischen geändert. Bitte den aktuellen Stand erneut analysieren.');
   const questions=publishedQuestions(row,result);
   await req().input('typeId',sql.NVarChar(80),row.instructionTypeId).input('language',sql.NVarChar(10),row.language).input('questions',sql.NVarChar(sql.MAX),JSON.stringify(questions))
    .input('description',sql.NVarChar(sql.MAX),instructionText(result.data)).input('templateId',sql.NVarChar(80),row.templateId).input('userId',sql.NVarChar(120),ctx.userId)
    .query(`UPDATE dbo.TestQuestions SET active=0,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND sourceAnalysisId IS NOT NULL AND sourceAspectId IS NOT NULL;
      INSERT INTO dbo.TestQuestions(id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active,sourceAnalysisId,sourceAspectId,explanation,sourceEvidenceJson)
      SELECT q.id,@companyId,@typeId,@language,q.question,q.optionsJson,q.correctIndex,1,@id,q.sourceAspectId,q.explanation,q.sourceEvidenceJson FROM OPENJSON(@questions)
       WITH(id NVARCHAR(80),question NVARCHAR(MAX),optionsJson NVARCHAR(MAX),correctIndex INT,sourceAspectId NVARCHAR(80),explanation NVARCHAR(MAX),sourceEvidenceJson NVARCHAR(MAX)) q;
      UPDATE dbo.InstructionTypes SET templateId=@templateId,description=@description,active=1,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@typeId;
      UPDATE dbo.InstructionAnalyses SET status='published',publishedAt=SYSUTCDATETIME(),publishedBy=@userId,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id;
      INSERT INTO dbo.SecurityEvents(companyId,actorUserId,eventType,severity,detailsJson) VALUES(@companyId,@userId,'instruction.analysis.published','info',CONCAT('{"analysisId":"',@id,'","reviewConfirmed":true}'));`);
   await tx.commit();open=false;
   return findAnalysis(pool,ctx.companyId,id);
 }catch(error){if(open) await tx.rollback().catch(()=>{});throw error;}
}
