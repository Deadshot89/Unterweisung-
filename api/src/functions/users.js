import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { hashPassword } from '../lib/passwordAuth.js';
import { writeAudit } from '../lib/audit.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

const VALID_ROLES = new Set([Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.EMPLOYEE, Roles.SYSTEM_ADMIN]);
function normEmail(email){return String(email||'').trim().toLowerCase();}
function clean(value,max){const text=String(value??'').trim();return text?text.slice(0,max):null;}
function validEmail(value){const email=normEmail(value);return email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;}
function roleOrDefault(role){const value=String(role||Roles.EMPLOYEE).toLowerCase().trim();return VALID_ROLES.has(value)?value:Roles.EMPLOYEE;}
function targetCompanyId(ctx,value){return ctx.roles.includes(Roles.SYSTEM_ADMIN)&&value?clean(value,80):ctx.companyId;}
function canManageRole(ctx,role){if(role===Roles.SYSTEM_ADMIN)return ctx.roles.includes(Roles.SYSTEM_ADMIN);if(ctx.roles.includes(Roles.SYSTEM_ADMIN))return true;return [Roles.COMPANY_ADMIN,Roles.HSE,Roles.LINE_MANAGER,Roles.EMPLOYEE].includes(role);}

async function passwordSchemaReady(pool){
  const result=await pool.request().query("SELECT COL_LENGTH('dbo.Users','passwordHash') AS passwordHashColumn, COL_LENGTH('dbo.Users','sessionVersion') AS sessionVersionColumn");
  return result.recordset[0]?.passwordHashColumn!=null&&result.recordset[0]?.sessionVersionColumn!=null;
}
async function requirePasswordSchema(pool){if(await passwordSchemaReady(pool))return;const err=new Error('Passwortverwaltung benötigt noch die freizugebende Datenbankmigration 011.');err.status=503;throw err;}
async function updatePasswordCredential(pool,{id,companyId,password}){
  await requirePasswordSchema(pool);
  const passwordHash=password?await hashPassword(password):null;
  await pool.request().input('id',sql.NVarChar(120),id).input('companyId',sql.NVarChar(80),companyId).input('passwordHash',sql.NVarChar(600),passwordHash)
    .query(`UPDATE Users SET passwordHash=@passwordHash,passwordSetAt=CASE WHEN @passwordHash IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
            failedLoginCount=0,lockedUntil=NULL,sessionVersion=ISNULL(sessionVersion,1)+1,provider=CASE WHEN @passwordHash IS NULL THEN 'aad' ELSE 'dual' END,updatedAt=SYSUTCDATETIME()
            WHERE id=@id AND companyId=@companyId`);
  return !!passwordHash;
}

app.http('users', {
  methods:['GET','POST','PATCH'],authLevel:'anonymous',route:'users/{id?}',
  handler:async(request,context)=>{
    try{
      const ctx=await getAuthorizedContext(request);const pool=await getPool();
      if(request.method==='GET'){
        assertRole(ctx,[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN,Roles.HSE]);
        const companyId=targetCompanyId(ctx,request.query.get('companyId'));
        let result;
        if(await passwordSchemaReady(pool)){
          result=await pool.request().input('companyId',sql.NVarChar(80),companyId)
            .query(`SELECT id,companyId,email,displayName,role,active,entraObjectId,provider,lastSeenAt,createdAt,updatedAt,notes,
                           CASE WHEN passwordHash IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END AS passwordEnabled
                    FROM Users WHERE companyId=@companyId ORDER BY displayName,email`);
        }else{
          result=await pool.request().input('companyId',sql.NVarChar(80),companyId)
            .query(`SELECT id,companyId,email,displayName,role,active,entraObjectId,provider,lastSeenAt,createdAt,updatedAt,notes
                    FROM Users WHERE companyId=@companyId ORDER BY displayName,email`);
          result.recordset=result.recordset.map(row=>({...row,passwordEnabled:false}));
        }
        return json(result.recordset);
      }

      const body=await request.json();assertRole(ctx,[Roles.SYSTEM_ADMIN,Roles.COMPANY_ADMIN]);
      if(request.method==='POST'){
        const companyId=targetCompanyId(ctx,body.companyId);const email=validEmail(body.email);if(!email)return badRequest('Gültige E-Mail-Adresse fehlt.');
        const displayName=clean(body.displayName,200)||email;const role=roleOrDefault(body.role);if(!canManageRole(ctx,role))return badRequest('Diese Rolle darfst du nicht vergeben.');
        const id=clean(body.id,120)||`user-${uuidv4()}`;
        if(body.password!==undefined)await requirePasswordSchema(pool);
        await pool.request().input('id',sql.NVarChar(120),id).input('companyId',sql.NVarChar(80),companyId).input('email',sql.NVarChar(254),email)
          .input('displayName',sql.NVarChar(200),displayName).input('role',sql.NVarChar(60),role).input('entraObjectId',sql.NVarChar(120),clean(body.entraObjectId,120)).input('notes',sql.NVarChar(1000),clean(body.notes,1000))
          .query(`MERGE Users AS t USING (SELECT @companyId AS companyId,@email AS email) AS s ON t.companyId=s.companyId AND LOWER(t.email)=LOWER(s.email)
                  WHEN MATCHED THEN UPDATE SET displayName=@displayName,role=@role,active=1,entraObjectId=COALESCE(@entraObjectId,entraObjectId),notes=@notes,updatedAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(id,companyId,email,displayName,role,active,entraObjectId,provider,invitedAt,notes)
                  VALUES(@id,@companyId,@email,@displayName,@role,1,@entraObjectId,'aad',SYSUTCDATETIME(),@notes);`);
        const stored=await pool.request().input('companyId',sql.NVarChar(80),companyId).input('email',sql.NVarChar(254),email).query('SELECT TOP 1 id FROM Users WHERE companyId=@companyId AND LOWER(email)=LOWER(@email)');
        const actualId=stored.recordset[0]?.id||id;
        let passwordEnabled=null;if(body.password!==undefined)passwordEnabled=await updatePasswordCredential(pool,{id:actualId,companyId,password:String(body.password||'')});
        await writeAudit(pool,ctx,'user.upserted','user',actualId,{email,role,companyId,passwordChanged:body.password!==undefined});
        await writeSecurityEvent(pool,ctx,'user.upserted','info',{email,role,companyId,passwordChanged:body.password!==undefined});
        return json({id:actualId,ok:true,passwordEnabled},201);
      }

      const id=request.params.id;if(!id)return badRequest('id is required');const role=body.role?roleOrDefault(body.role):null;if(role&&!canManageRole(ctx,role))return badRequest('Diese Rolle darfst du nicht setzen.');
      const companyId=targetCompanyId(ctx,body.companyId);const active=body.active===false?0:1;if(body.password!==undefined)await requirePasswordSchema(pool);
      await pool.request().input('id',sql.NVarChar(120),id).input('companyId',sql.NVarChar(80),companyId).input('displayName',sql.NVarChar(200),clean(body.displayName,200))
        .input('role',sql.NVarChar(60),role).input('active',sql.Bit,active).input('entraObjectId',sql.NVarChar(120),clean(body.entraObjectId,120)).input('notes',sql.NVarChar(1000),clean(body.notes,1000))
        .query(`UPDATE Users SET displayName=COALESCE(@displayName,displayName),role=COALESCE(@role,role),active=@active,
                entraObjectId=COALESCE(@entraObjectId,entraObjectId),notes=COALESCE(@notes,notes),updatedAt=SYSUTCDATETIME()
                WHERE id=@id AND companyId=@companyId`);
      let passwordEnabled=null;if(body.password!==undefined)passwordEnabled=await updatePasswordCredential(pool,{id,companyId,password:String(body.password||'')});
      await writeAudit(pool,ctx,'user.updated','user',id,{...body,password:undefined,passwordChanged:body.password!==undefined,companyId});
      await writeSecurityEvent(pool,ctx,'user.updated','info',{id,role,active:active===1,passwordChanged:body.password!==undefined,companyId});
      return json({ok:true,passwordEnabled});
    }catch(err){return serverError(err,context);}
  }
});
