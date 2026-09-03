import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

function clean(value,max){const text=String(value??'').trim();return text?text.slice(0,max):null;}
function deliveryMode(value){const mode=String(value||'practical').toLowerCase();return mode==='online'?'online':'practical';}
async function extendedSchemaReady(pool){const r=await pool.request().query("SELECT COL_LENGTH('dbo.InstructionTypes','deliveryMode') AS deliveryModeColumn,COL_LENGTH('dbo.InstructionTypes','testRequired') AS testRequiredColumn,COL_LENGTH('dbo.InstructionTypes','passPercent') AS passPercentColumn");const row=r.recordset[0]||{};return row.deliveryModeColumn!=null&&row.testRequiredColumn!=null&&row.passPercentColumn!=null;}
async function requireExtendedSchema(pool){if(await extendedSchemaReady(pool))return;const err=new Error('Online-/Praxis-Abschlussarten benötigen noch die freizugebende Datenbankmigration 011.');err.status=503;throw err;}

app.http('instructionTypes', {
  methods:['GET','POST','PATCH'],authLevel:'anonymous',route:'instruction-types/{id?}',
  handler:async(request,context)=>{
    try{
      const ctx=await getAuthorizedContext(request);const pool=await getPool();
      if(request.method==='GET'){
        let result;
        if(await extendedSchemaReady(pool)){
          result=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).query(`SELECT id,name,category,intervalMonths,description,templateId,active,deliveryMode,testRequired,passPercent,createdAt,updatedAt FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
        }else{
          result=await pool.request().input('companyId',sql.NVarChar(80),ctx.companyId).query(`SELECT id,name,category,intervalMonths,description,templateId,active,createdAt,updatedAt FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
          result.recordset=result.recordset.map(row=>({...row,deliveryMode:'practical',testRequired:false,passPercent:80}));
        }
        return json(result.recordset);
      }
      assertRole(ctx,[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN,Roles.HSE]);const body=await request.json();
      if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>1000000))return badRequest('Beschreibung muss Text mit höchstens 1.000.000 Zeichen sein.');
      const extendedRequested=body.deliveryMode!==undefined||body.testRequired!==undefined||body.passPercent!==undefined;if(extendedRequested)await requireExtendedSchema(pool);
      if(request.method==='POST'){
        const name=clean(body.name,200);const category=clean(body.category,120);if(!name||!category)return badRequest('Name und Bereich/Kategorie sind erforderlich.');const id=clean(body.id,80)||`type-${uuidv4()}`;
        if(await extendedSchemaReady(pool)){
          await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('name',sql.NVarChar(200),name).input('category',sql.NVarChar(120),category)
            .input('intervalMonths',sql.Int,Math.max(1,Number(body.intervalMonths||12))).input('description',sql.NVarChar(sql.MAX),clean(body.description,1000000)).input('templateId',sql.NVarChar(80),clean(body.templateId,80))
            .input('deliveryMode',sql.NVarChar(20),deliveryMode(body.deliveryMode)).input('testRequired',sql.Bit,body.testRequired===true?1:0).input('passPercent',sql.Int,Math.max(1,Math.min(100,Number(body.passPercent||80))))
            .query(`INSERT INTO InstructionTypes(id,companyId,name,category,intervalMonths,description,templateId,active,deliveryMode,testRequired,passPercent) VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1,@deliveryMode,@testRequired,@passPercent)`);
        }else{
          await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('name',sql.NVarChar(200),name).input('category',sql.NVarChar(120),category)
            .input('intervalMonths',sql.Int,Math.max(1,Number(body.intervalMonths||12))).input('description',sql.NVarChar(sql.MAX),clean(body.description,1000000)).input('templateId',sql.NVarChar(80),clean(body.templateId,80))
            .query(`INSERT INTO InstructionTypes(id,companyId,name,category,intervalMonths,description,templateId,active) VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1)`);
        }
        await writeAudit(pool,ctx,'instructionType.created','instructionType',id,{name,category,intervalMonths:body.intervalMonths,templateId:body.templateId||null,deliveryMode:body.deliveryMode||'practical',testRequired:!!body.testRequired});return json({id},201);
      }
      const id=request.params.id;if(!id)return badRequest('id is required');const exists=await pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).query('SELECT TOP 1 id FROM InstructionTypes WHERE id=@id AND companyId=@companyId');if(!exists.recordset.length)return notFound('Unterweisungstyp nicht gefunden.');
      const req=pool.request().input('id',sql.NVarChar(80),id).input('companyId',sql.NVarChar(80),ctx.companyId).input('name',sql.NVarChar(200),clean(body.name,200)).input('category',sql.NVarChar(120),clean(body.category,120))
        .input('intervalMonths',sql.Int,body.intervalMonths==null?null:Math.max(1,Number(body.intervalMonths))).input('description',sql.NVarChar(sql.MAX),body.description===undefined?null:clean(body.description,1000000))
        .input('templateId',sql.NVarChar(80),body.templateId===undefined?null:clean(body.templateId,80)).input('clearTemplate',sql.Bit,body.templateId===''?1:0).input('active',sql.Bit,body.active===undefined?null:(body.active===false?0:1));
      let extra='';
      if(extendedRequested){req.input('deliveryMode',sql.NVarChar(20),body.deliveryMode===undefined?null:deliveryMode(body.deliveryMode)).input('testRequired',sql.Bit,body.testRequired===undefined?null:(body.testRequired?1:0)).input('passPercent',sql.Int,body.passPercent===undefined?null:Math.max(1,Math.min(100,Number(body.passPercent))));extra=`,deliveryMode=COALESCE(@deliveryMode,deliveryMode),testRequired=COALESCE(@testRequired,testRequired),passPercent=COALESCE(@passPercent,passPercent)`;}
      await req.query(`UPDATE InstructionTypes SET name=COALESCE(@name,name),category=COALESCE(@category,category),intervalMonths=COALESCE(@intervalMonths,intervalMonths),description=CASE WHEN @description IS NULL THEN description ELSE @description END,templateId=CASE WHEN @clearTemplate=1 THEN NULL WHEN @templateId IS NULL THEN templateId ELSE @templateId END,active=COALESCE(@active,active)${extra},updatedAt=SYSUTCDATETIME() WHERE id=@id AND companyId=@companyId`);
      await writeAudit(pool,ctx,'instructionType.updated','instructionType',id,body);return json({ok:true});
    }catch(err){return serverError(err,context);}
  }
});
