import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, hasRole, assertRole, Roles } from '../lib/auth.js';
import { uploadBufferToBlob } from '../lib/blob.js';
import { decodeBase64Upload, validateUploadedFile, blobPathForUpload, initialScanStatus } from '../lib/uploadSecurity.js';
import { writeAudit } from '../lib/audit.js';
import { learningContentSchemaReady, requireLearningContentSchema } from '../lib/learningContent.js';

const EDIT_ROLES=[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN,Roles.HSE];
function clean(value,max){const text=String(value??'').trim();return text?text.slice(0,max):null;}
function language(value){const v=String(value||'de').trim().toLowerCase();return ['de','en','pl'].includes(v)?v:'de';}
function richRequested(body={}){return body.imageCaption!==undefined||body.calloutTitle!==undefined||body.calloutText!==undefined;}
function setupError(err){if(/Invalid object name 'InstructionLearningSteps'/i.test(String(err.message||err))){const e=new Error('Bild-Lernschritte benötigen noch die freizugebende Datenbankmigration 011.');e.status=503;return e;}return err;}

async function validateImage(pool,companyId,imageFileId){
  if(!imageFileId)return true;
  const result=await pool.request().input('companyId',sql.NVarChar(80),companyId).input('id',sql.NVarChar(80),imageFileId)
    .query('SELECT TOP 1 id,contentType,status,scanStatus FROM Files WHERE companyId=@companyId AND id=@id');
  const file=result.recordset[0];return !!file&&String(file.contentType||'').startsWith('image/')&&file.status!=='blocked'&&!['blocked','quarantined'].includes(file.scanStatus);
}
async function linkImage(pool,companyId,imageFileId,stepId){
  if(!imageFileId)return;
  await pool.request().input('companyId',sql.NVarChar(80),companyId).input('id',sql.NVarChar(80),imageFileId).input('stepId',sql.NVarChar(80),stepId)
    .query("UPDATE Files SET linkedEntityType='learning_step',linkedEntityId=@stepId WHERE companyId=@companyId AND id=@id");
}
async function uploadLearningImage(pool,ctx,body){
  const buffer=decodeBase64Upload(body);const validation=validateUploadedFile({fileName:body.fileName,contentType:body.contentType,buffer});
  if(!String(validation.contentType||'').startsWith('image/'))return badRequest('Für Lernschritte sind nur JPG, PNG oder WEBP erlaubt.');
  const id=`learning-image-${uuidv4()}`;const blobPath=blobPathForUpload({companyId:ctx.companyId,kind:'learning-images',fileId:id,fileName:validation.safeName});const scanStatus=initialScanStatus();
  await uploadBufferToBlob(blobPath,buffer,validation.contentType,{kind:'learning-image',metadata:{companyId:ctx.companyId,kind:'learning-image',fileId:id,sha256:validation.sha256,uploadedBy:String(ctx.userId||'').slice(0,100)},tags:{companyId:ctx.companyId.slice(0,128),kind:'learning-image',scanStatus:scanStatus.slice(0,128)}});
  await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('kind',sql.NVarChar(60),'learning_image')
    .input('fileName',sql.NVarChar(260),validation.safeName).input('originalFileName',sql.NVarChar(260),clean(body.fileName,260)).input('blobPath',sql.NVarChar(500),blobPath)
    .input('contentType',sql.NVarChar(120),validation.contentType).input('sizeBytes',sql.BigInt,validation.sizeBytes).input('sha256',sql.NVarChar(128),validation.sha256)
    .input('extension',sql.NVarChar(20),validation.extension).input('scanStatus',sql.NVarChar(40),scanStatus).input('createdBy',sql.NVarChar(120),ctx.userId)
    .query(`INSERT INTO Files(id,companyId,kind,fileName,originalFileName,blobPath,contentType,sizeBytes,sha256,extension,status,scanStatus,createdBy)
            VALUES(@id,@companyId,@kind,@fileName,@originalFileName,@blobPath,@contentType,@sizeBytes,@sha256,@extension,'active',@scanStatus,@createdBy)`);
  await writeAudit(pool,ctx,'learningImage.uploaded','file',id,{fileName:validation.safeName,sizeBytes:validation.sizeBytes,scanStatus});
  return json({id,fileName:validation.safeName,contentType:validation.contentType,sizeBytes:validation.sizeBytes,scanStatus},201);
}

app.http('learningSteps', {
  methods:['GET','POST','PATCH'],authLevel:'anonymous',route:'learning-steps/{id?}',
  handler:async(request,context)=>{
    try{
      const ctx=await getAuthorizedContext(request);const pool=await getPool();const canEdit=hasRole(ctx,EDIT_ROLES);const rich=await learningContentSchemaReady(pool);
      if(request.method==='GET'){
        const instructionTypeId=clean(request.query.get('instructionTypeId'),80);if(!instructionTypeId)return badRequest('instructionTypeId is required');const lang=language(request.query.get('language'));
        const extraRich=rich?',s.imageCaption,s.calloutTitle,s.calloutText':'';
        const result=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId).input('language',sql.NVarChar(10),lang)
          .query(`SELECT s.id,s.instructionTypeId,s.language,s.sortOrder,s.title,s.body,s.imageFileId${extraRich},s.status,s.reviewedBy,s.reviewedAt,s.createdAt,s.updatedAt,
                         f.fileName AS imageFileName,f.contentType AS imageContentType
                  FROM InstructionLearningSteps s LEFT JOIN Files f ON f.companyId=s.companyId AND f.id=s.imageFileId
                  WHERE s.companyId=@companyId AND s.instructionTypeId=@instructionTypeId AND s.language=@language ${canEdit?'':"AND s.status='published'"}
                  ORDER BY s.sortOrder,s.createdAt`);
        result.recordset=result.recordset.map(row=>({...row,imageCaption:rich?String(row.imageCaption||''):'',calloutTitle:rich?String(row.calloutTitle||''):'',calloutText:rich?String(row.calloutText||''):''}));
        return json(result.recordset);
      }
      assertRole(ctx,EDIT_ROLES);const body=await request.json();
      if(request.method==='POST'&&request.params.id==='image')return await uploadLearningImage(pool,ctx,body);
      if(richRequested(body))await requireLearningContentSchema(pool);
      if(request.method==='POST'){
        const instructionTypeId=clean(body.instructionTypeId,80);const title=clean(body.title,240);if(!instructionTypeId||!title)return badRequest('Unterweisung und Titel sind erforderlich.');
        const exists=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),instructionTypeId).query('SELECT TOP 1 id FROM InstructionTypes WHERE companyId=@companyId AND id=@id');if(!exists.recordset.length)return notFound('Unterweisung nicht gefunden.');
        const imageFileId=clean(body.imageFileId,80);if(!(await validateImage(pool,ctx.companyId,imageFileId)))return badRequest('Das ausgewählte Bild ist nicht verfügbar oder kein freigegebenes Bild.');
        const id=clean(body.id,80)||`step-${uuidv4()}`;const requestBody=pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('instructionTypeId',sql.NVarChar(80),instructionTypeId)
          .input('language',sql.NVarChar(10),language(body.language)).input('sortOrder',sql.Int,Math.max(0,Number(body.sortOrder||10))).input('title',sql.NVarChar(240),title)
          .input('body',sql.NVarChar(sql.MAX),clean(body.body,20000)).input('imageFileId',sql.NVarChar(80),imageFileId).input('createdBy',sql.NVarChar(120),ctx.userId);
        if(rich){requestBody.input('imageCaption',sql.NVarChar(1000),clean(body.imageCaption,1000)).input('calloutTitle',sql.NVarChar(120),clean(body.calloutTitle,120)).input('calloutText',sql.NVarChar(2000),clean(body.calloutText,2000));
          await requestBody.query(`INSERT INTO InstructionLearningSteps(id,companyId,instructionTypeId,language,sortOrder,title,body,imageFileId,imageCaption,calloutTitle,calloutText,status,createdBy)
                  VALUES(@id,@companyId,@instructionTypeId,@language,@sortOrder,@title,@body,@imageFileId,@imageCaption,@calloutTitle,@calloutText,'draft',@createdBy)`);
        }else{
          await requestBody.query(`INSERT INTO InstructionLearningSteps(id,companyId,instructionTypeId,language,sortOrder,title,body,imageFileId,status,createdBy)
                  VALUES(@id,@companyId,@instructionTypeId,@language,@sortOrder,@title,@body,@imageFileId,'draft',@createdBy)`);
        }
        await linkImage(pool,ctx.companyId,imageFileId,id);await writeAudit(pool,ctx,'learningStep.created','learningStep',id,{instructionTypeId,title,imageCaption:body.imageCaption||null});return json({id,status:'draft'},201);
      }
      const id=clean(request.params.id,80);if(!id)return badRequest('id is required');const existing=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),id).query('SELECT TOP 1 id,instructionTypeId,status FROM InstructionLearningSteps WHERE companyId=@companyId AND id=@id');if(!existing.recordset.length)return notFound('Lernschritt nicht gefunden.');
      const imageFileId=body.imageFileId===undefined?undefined:clean(body.imageFileId,80);if(imageFileId!==undefined&&!(await validateImage(pool,ctx.companyId,imageFileId)))return badRequest('Das ausgewählte Bild ist nicht verfügbar oder kein freigegebenes Bild.');
      const publish=body.status==='published';const unpublish=body.status==='draft';const req=pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).input('id',sql.NVarChar(80),id).input('title',sql.NVarChar(240),body.title===undefined?null:clean(body.title,240)).input('body',sql.NVarChar(sql.MAX),body.body===undefined?null:clean(body.body,20000))
        .input('sortOrder',sql.Int,body.sortOrder===undefined?null:Math.max(0,Number(body.sortOrder))).input('imageFileId',sql.NVarChar(80),imageFileId===undefined?null:imageFileId).input('imageSpecified',sql.Bit,body.imageFileId===undefined?0:1)
        .input('language',sql.NVarChar(10),body.language===undefined?null:language(body.language)).input('publish',sql.Bit,publish?1:0).input('unpublish',sql.Bit,unpublish?1:0).input('reviewedBy',sql.NVarChar(120),ctx.userId);
      let richUpdate='';
      if(richRequested(body)){
        req.input('imageCaption',sql.NVarChar(1000),body.imageCaption===undefined?null:clean(body.imageCaption,1000)).input('imageCaptionSpecified',sql.Bit,body.imageCaption===undefined?0:1)
          .input('calloutTitle',sql.NVarChar(120),body.calloutTitle===undefined?null:clean(body.calloutTitle,120)).input('calloutTitleSpecified',sql.Bit,body.calloutTitle===undefined?0:1)
          .input('calloutText',sql.NVarChar(2000),body.calloutText===undefined?null:clean(body.calloutText,2000)).input('calloutTextSpecified',sql.Bit,body.calloutText===undefined?0:1);
        richUpdate=`,imageCaption=CASE WHEN @imageCaptionSpecified=1 THEN @imageCaption ELSE imageCaption END,calloutTitle=CASE WHEN @calloutTitleSpecified=1 THEN @calloutTitle ELSE calloutTitle END,calloutText=CASE WHEN @calloutTextSpecified=1 THEN @calloutText ELSE calloutText END`;
      }
      await req.query(`UPDATE InstructionLearningSteps SET title=COALESCE(@title,title),body=CASE WHEN @body IS NULL THEN body ELSE @body END,sortOrder=COALESCE(@sortOrder,sortOrder),
                imageFileId=CASE WHEN @imageSpecified=1 THEN @imageFileId ELSE imageFileId END,language=COALESCE(@language,language),status=CASE WHEN @publish=1 THEN 'published' WHEN @unpublish=1 THEN 'draft' ELSE status END${richUpdate},
                reviewedBy=CASE WHEN @publish=1 THEN @reviewedBy ELSE reviewedBy END,reviewedAt=CASE WHEN @publish=1 THEN SYSUTCDATETIME() ELSE reviewedAt END,updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@id`);
      if(imageFileId!==undefined)await linkImage(pool,ctx.companyId,imageFileId,id);await writeAudit(pool,ctx,publish?'learningStep.published':'learningStep.updated','learningStep',id,{...body,imageFileId});return json({ok:true,status:publish?'published':unpublish?'draft':existing.recordset[0].status});
    }catch(err){return serverError(setupError(err),context);}
  }
});
