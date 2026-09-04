import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { learningContentSchemaReady, parseKeyPoints, serialiseKeyPoints, requireLearningContentSchema } from '../lib/learningContent.js';

function clean(value,max){const text=String(value??'').trim();return text?text.slice(0,max):null;}
function deliveryMode(value){const mode=String(value||'practical').toLowerCase();return mode==='online'?'online':'practical';}
async function extendedSchemaReady(pool){const r=await pool.request().query("SELECT COL_LENGTH('dbo.InstructionTypes','deliveryMode') AS deliveryModeColumn,COL_LENGTH('dbo.InstructionTypes','testRequired') AS testRequiredColumn,COL_LENGTH('dbo.InstructionTypes','passPercent') AS passPercentColumn");const row=r.recordset[0]||{};return row.deliveryModeColumn!=null&&row.testRequiredColumn!=null&&row.passPercentColumn!=null;}
async function requireExtendedSchema(pool){if(await extendedSchemaReady(pool))return;const err=new Error('Online-/Praxis-Abschlussarten benötigen noch die freizugebende Datenbankmigration 011.');err.status=503;throw err;}
function richRequested(body={}){return body.learningGoal!==undefined||body.learningIntro!==undefined||body.keyPoints!==undefined;}
function validateRich(body){
  if(body.learningGoal!==undefined&&(typeof body.learningGoal!=='string'||body.learningGoal.length>1000))return 'Lernziel muss Text mit höchstens 1.000 Zeichen sein.';
  if(body.learningIntro!==undefined&&(typeof body.learningIntro!=='string'||body.learningIntro.length>4000))return 'Einleitung muss Text mit höchstens 4.000 Zeichen sein.';
  if(body.keyPoints!==undefined&&!Array.isArray(body.keyPoints)&&typeof body.keyPoints!=='string')return 'Wichtige Merkpunkte müssen als Liste oder Text übergeben werden.';
  return null;
}

app.http('instructionTypes', {
  methods:['GET','POST','PATCH'],authLevel:'anonymous',route:'instruction-types/{id?}',
  handler:async(request,context)=>{
    try{
      const ctx=await getAuthorizedContext(request);const pool=await getPool();
      if(request.method==='GET'){
        const extended=await extendedSchemaReady(pool);const rich=await learningContentSchemaReady(pool);
        const extraExtended=extended?',deliveryMode,testRequired,passPercent':'';
        const extraRich=rich?',learningGoal,learningIntro,keyPointsJson':'';
        const result=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId)
          .query(`SELECT id,name,category,intervalMonths,description,templateId,active${extraExtended}${extraRich},createdAt,updatedAt FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
        result.recordset=result.recordset.map(row=>{
          const mapped={...row,deliveryMode:extended?(row.deliveryMode||'practical'):'practical',testRequired:extended?!!row.testRequired:false,passPercent:extended?Number(row.passPercent||80):80,
            learningGoal:rich?String(row.learningGoal||''):'',learningIntro:rich?String(row.learningIntro||''):'',keyPoints:rich?parseKeyPoints(row.keyPointsJson):[]};
          delete mapped.keyPointsJson;return mapped;
        });
        return json(result.recordset);
      }
      assertRole(ctx,[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN,Roles.HSE]);const body=await request.json();
      if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>1000000))return badRequest('Beschreibung muss Text mit höchstens 1.000.000 Zeichen sein.');
      const richError=validateRich(body);if(richError)return badRequest(richError);
      const extendedRequested=body.deliveryMode!==undefined||body.testRequired!==undefined||body.passPercent!==undefined;if(extendedRequested)await requireExtendedSchema(pool);
      if(richRequested(body))await requireLearningContentSchema(pool);
      const extended=await extendedSchemaReady(pool);const rich=await learningContentSchemaReady(pool);
      if(request.method==='POST'){
        const name=clean(body.name,200);const category=clean(body.category,120);if(!name||!category)return badRequest('Name und Bereich/Kategorie sind erforderlich.');const id=clean(body.id,80)||`type-${uuidv4()}`;
        const req=pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('name',sql.NVarChar(200),name).input('category',sql.NVarChar(120),category)
          .input('intervalMonths',sql.Int,Math.max(1,Number(body.intervalMonths||12))).input('description',sql.NVarChar(sql.MAX),clean(body.description,1000000)).input('templateId',sql.NVarChar(80),clean(body.templateId,80));
        let columns='id,companyId,name,category,intervalMonths,description,templateId,active';let values='@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1';
        if(extended){req.input('deliveryMode',sql.NVarChar(20),deliveryMode(body.deliveryMode)).input('testRequired',sql.Bit,body.testRequired===true?1:0).input('passPercent',sql.Int,Math.max(1,Math.min(100,Number(body.passPercent||80))));columns+=',deliveryMode,testRequired,passPercent';values+=',@deliveryMode,@testRequired,@passPercent';}
        if(rich){req.input('learningGoal',sql.NVarChar(1000),clean(body.learningGoal,1000)).input('learningIntro',sql.NVarChar(4000),clean(body.learningIntro,4000)).input('keyPointsJson',sql.NVarChar(sql.MAX),body.keyPoints===undefined?null:serialiseKeyPoints(body.keyPoints));columns+=',learningGoal,learningIntro,keyPointsJson';values+=',@learningGoal,@learningIntro,@keyPointsJson';}
        await req.query(`INSERT INTO InstructionTypes(${columns}) VALUES(${values})`);
        await writeAudit(pool,ctx,'instructionType.created','instructionType',id,{name,category,intervalMonths:body.intervalMonths,templateId:body.templateId||null,deliveryMode:body.deliveryMode||'practical',testRequired:!!body.testRequired,learningGoal:body.learningGoal||null});return json({id},201);
      }
      const id=request.params.id;if(!id)return badRequest('id is required');const exists=await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).query('SELECT TOP 1 id FROM InstructionTypes WHERE id=@id AND companyId=@companyId');if(!exists.recordset.length)return notFound('Unterweisungstyp nicht gefunden.');
      const req=pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('name',sql.NVarChar(200),clean(body.name,200)).input('category',sql.NVarChar(120),clean(body.category,120))
        .input('intervalMonths',sql.Int,body.intervalMonths==null?null:Math.max(1,Number(body.intervalMonths))).input('description',sql.NVarChar(sql.MAX),body.description===undefined?null:clean(body.description,1000000))
        .input('templateId',sql.NVarChar(80),body.templateId===undefined?null:clean(body.templateId,80)).input('clearTemplate',sql.Bit,body.templateId===''?1:0).input('active',sql.Bit,body.active===undefined?null:(body.active===false?0:1));
      let extra='';
      if(extendedRequested){req.input('deliveryMode',sql.NVarChar(20),body.deliveryMode===undefined?null:deliveryMode(body.deliveryMode)).input('testRequired',sql.Bit,body.testRequired===undefined?null:(body.testRequired?1:0)).input('passPercent',sql.Int,body.passPercent===undefined?null:Math.max(1,Math.min(100,Number(body.passPercent))));extra+=`,deliveryMode=COALESCE(@deliveryMode,deliveryMode),testRequired=COALESCE(@testRequired,testRequired),passPercent=COALESCE(@passPercent,passPercent)`;}
      if(richRequested(body)){req.input('learningGoal',sql.NVarChar(1000),body.learningGoal===undefined?null:clean(body.learningGoal,1000)).input('learningGoalSpecified',sql.Bit,body.learningGoal===undefined?0:1)
        .input('learningIntro',sql.NVarChar(4000),body.learningIntro===undefined?null:clean(body.learningIntro,4000)).input('learningIntroSpecified',sql.Bit,body.learningIntro===undefined?0:1)
        .input('keyPointsJson',sql.NVarChar(sql.MAX),body.keyPoints===undefined?null:serialiseKeyPoints(body.keyPoints)).input('keyPointsSpecified',sql.Bit,body.keyPoints===undefined?0:1);
        extra+=`,learningGoal=CASE WHEN @learningGoalSpecified=1 THEN @learningGoal ELSE learningGoal END,learningIntro=CASE WHEN @learningIntroSpecified=1 THEN @learningIntro ELSE learningIntro END,keyPointsJson=CASE WHEN @keyPointsSpecified=1 THEN @keyPointsJson ELSE keyPointsJson END`;}
      await req.query(`UPDATE InstructionTypes SET name=COALESCE(@name,name),category=COALESCE(@category,category),intervalMonths=COALESCE(@intervalMonths,intervalMonths),description=CASE WHEN @description IS NULL THEN description ELSE @description END,templateId=CASE WHEN @clearTemplate=1 THEN NULL WHEN @templateId IS NULL THEN templateId ELSE @templateId END,active=COALESCE(@active,active)${extra},updatedAt=SYSUTCDATETIME() WHERE id=@id AND companyId=@companyId`);
      await writeAudit(pool,ctx,'instructionType.updated','instructionType',id,body);return json({ok:true});
    }catch(err){return serverError(err,context);}
  }
});
