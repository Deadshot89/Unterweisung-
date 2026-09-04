// Auth / Mandanten-Kontext für Azure Static Web Apps + Microsoft Entra + Azure Functions.
// Produktion/Cloud: x-ms-client-principal kommt von Static Web Apps Auth / Entra.
// Alternativ kann ein signierter HttpOnly-Passwort-Session-Cookie denselben Rollenpfad verwenden.

import { getPool, sql } from './db.js';
import { passwordSessionFromRequest } from './passwordAuth.js';

export const Roles = Object.freeze({
  SYSTEM_ADMIN: 'system_admin', COMPANY_ADMIN: 'company_admin', HSE: 'hse', LINE_MANAGER: 'line_manager', EMPLOYEE: 'employee', AUTHENTICATED: 'authenticated', ANONYMOUS: 'anonymous'
});

const ROLE_MAP = new Map([
  ['systemadmin',Roles.SYSTEM_ADMIN],['system_admin',Roles.SYSTEM_ADMIN],['system admin',Roles.SYSTEM_ADMIN],['unterweisungsmanager.system_admin',Roles.SYSTEM_ADMIN],
  ['admin',Roles.COMPANY_ADMIN],['company_admin',Roles.COMPANY_ADMIN],['companyadmin',Roles.COMPANY_ADMIN],['firmen_admin',Roles.COMPANY_ADMIN],['unterweisungsmanager.company_admin',Roles.COMPANY_ADMIN],
  ['hse',Roles.HSE],['safety',Roles.HSE],['unterweisungsmanager.hse',Roles.HSE],
  ['line_manager',Roles.LINE_MANAGER],['linemanager',Roles.LINE_MANAGER],['line manager',Roles.LINE_MANAGER],['teamleader',Roles.LINE_MANAGER],['team leader',Roles.LINE_MANAGER],['unterweisungsmanager.line_manager',Roles.LINE_MANAGER],
  ['employee',Roles.EMPLOYEE],['mitarbeiter',Roles.EMPLOYEE],['unterweisungsmanager.employee',Roles.EMPLOYEE],['authenticated',Roles.AUTHENTICATED],['anonymous',Roles.ANONYMOUS]
]);

function decodePrincipal(raw){ if(!raw)return null; try{return JSON.parse(Buffer.from(raw,'base64').toString('utf8'));}catch{return null;} }
function normalizeEmail(value){ return String(value||'').trim().toLowerCase(); }
function normalizeRoles(roles=[]){ return [...new Set((roles||[]).map(r=>ROLE_MAP.get(String(r||'').toLowerCase().trim())||String(r||'').toLowerCase().trim()).filter(Boolean))]; }
function splitList(value){ return String(value||'').split(/[;,]/).map(v=>normalizeEmail(v)).filter(Boolean); }
function isLocalDevelopment(){ if(String(process.env.AUTH_LOCAL_DEV||'').toLowerCase()==='true')return true; const env=String(process.env.NODE_ENV||'').toLowerCase(); return env==='development'||env==='test'; }
function isProduction(){ return !isLocalDevelopment(); }
function parseCompanyHeader(request){ return request.headers.get('x-company-id')||request.headers.get('x-company')||null; }
function shouldGrantDevSystemAdmin(email){ if(String(process.env.AUTH_DEV_SYSTEM_ADMIN||'').toLowerCase()==='true')return true; const operators=splitList(process.env.SYSTEM_ADMIN_EMAILS||process.env.OPERATOR_EMAILS||''); return !!email&&operators.includes(normalizeEmail(email)); }
function defaultCompanyId(){ return process.env.DEFAULT_COMPANY_ID||process.env.COMPANY_ID||'company-essentra'; }

export function getRequestContext(request){
  const rawPrincipal=request.headers.get('x-ms-client-principal');
  const principal=decodePrincipal(rawPrincipal);
  const passwordSession=principal?null:passwordSessionFromRequest(request);
  const localDev=isLocalDevelopment()&&!rawPrincipal&&!passwordSession;
  const devRoles=localDev?request.headers.get('x-dev-roles'):null;
  const requestedCompanyId=parseCompanyHeader(request);
  const principalRoles=normalizeRoles(devRoles?devRoles.split(','):(principal?.userRoles||[]));
  const userDetails=principal?.userDetails||passwordSession?.email||(localDev?request.headers.get('x-dev-user'):null)||'';
  const userId=principal?.userId||passwordSession?.userId||(localDev?request.headers.get('x-dev-user-id'):null)||userDetails||'anonymous';
  let roles=principalRoles.length?principalRoles:[(principal||passwordSession)?Roles.AUTHENTICATED:Roles.ANONYMOUS];
  if(localDev)roles=normalizeRoles([...roles,Roles.COMPANY_ADMIN,Roles.HSE,Roles.LINE_MANAGER]);
  return { companyId:localDev?(requestedCompanyId||defaultCompanyId()):(requestedCompanyId||null), requestedCompanyId, userId, userDetails, email:normalizeEmail(passwordSession?.email||userDetails), roles, isAuthenticated:!!principal||!!passwordSession||localDev, isLocalDev:localDev, principal, passwordSession, authMode:principal?'entra':passwordSession?'password':localDev?'dev-bypass':'anonymous', allowedCompanies:[], ipAddress:request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('client-ip')||null, userAgent:request.headers.get('user-agent')||null };
}

function dbRoleToRole(role){ return ROLE_MAP.get(String(role||'').toLowerCase().trim())||String(role||'').toLowerCase().trim(); }

async function activeCompanyExists(pool, companyId){
  if(!companyId)return false;
  const result=await pool.request().input('companyId',sql.NVarChar(80),companyId)
    .query('SELECT TOP 1 id FROM Companies WHERE id=@companyId AND active=1');
  return !!result.recordset.length;
}

function systemAdminSelectionContext(base, identity, roles, allowedCompanies, authMode=base.authMode){
  const normalized=normalizeRoles([...roles,Roles.SYSTEM_ADMIN,Roles.AUTHENTICATED]);
  return {...base,companyId:null,userId:identity.userId||base.userId,userDetails:identity.displayName||base.userDetails,email:normalizeEmail(identity.email||base.email),roles:normalized,allowedCompanies,isAuthenticated:true,authMode};
}

export async function getAuthorizedContext(request){
  const base=getRequestContext(request);
  const devBypass=String(process.env.AUTH_DEV_BYPASS||'').toLowerCase()==='true';
  const requireDbUser=String(process.env.AUTH_REQUIRE_DB_USER||(isProduction()?'true':'false')).toLowerCase()==='true';
  if(devBypass&&!base.isAuthenticated&&base.isLocalDev){
    const devEmail=normalizeEmail(process.env.DEV_USER_EMAIL||'pilot-admin@local');
    const roles=[Roles.COMPANY_ADMIN,Roles.HSE,Roles.LINE_MANAGER,Roles.AUTHENTICATED];
    if(shouldGrantDevSystemAdmin(devEmail))roles.unshift(Roles.SYSTEM_ADMIN);
    const isDevSystemAdmin=roles.includes(Roles.SYSTEM_ADMIN);
    const devCompanyId=base.requestedCompanyId || defaultCompanyId(); const selectedCompanyId=isDevSystemAdmin?(base.requestedCompanyId || null):devCompanyId;
    const allowedCompanies=selectedCompanyId?[{companyId:selectedCompanyId,role:isDevSystemAdmin?Roles.SYSTEM_ADMIN:Roles.COMPANY_ADMIN,userId:process.env.DEV_USER_ID||'dev-admin',email:devEmail,displayName:process.env.DEV_USER_NAME||'Pilot Admin'}]:[];
    return {...base,companyId:selectedCompanyId,userId:process.env.DEV_USER_ID||'dev-admin',userDetails:process.env.DEV_USER_NAME||'Pilot Admin',email:devEmail,roles:normalizeRoles(roles),allowedCompanies,isAuthenticated:true,isLocalDev:true,authMode:'dev-bypass'};
  }
  if(!base.isAuthenticated){ const err=new Error('Nicht angemeldet');err.status=401;throw err; }
  let pool; try{pool=await getPool();}catch(err){if(!requireDbUser&&base.isLocalDev)return base;throw err;}
  const email=normalizeEmail(base.email||base.userDetails); const userId=String(base.userId||'');
  const req=pool.request().input('email',sql.NVarChar(254),email||null).input('userId',sql.NVarChar(120),userId||null);
  const passwordMode=base.authMode==='password';
  let res;
  try{
    res=await req.query(passwordMode
      ? `SELECT id,companyId,email,displayName,role,active,entraObjectId,sessionVersion FROM Users WHERE active=1 AND id=@userId AND LOWER(email)=LOWER(@email)`
      : `SELECT id,companyId,email,displayName,role,active,entraObjectId FROM Users WHERE active=1 AND (LOWER(email)=LOWER(@email) OR id=@userId OR entraObjectId=@userId)`);
  }catch(err){
    if(passwordMode&&/Invalid column name 'sessionVersion'/i.test(String(err.message||err))){const setup=new Error('Passwort-Anmeldung benötigt noch die freizugebende Datenbankmigration 011.');setup.status=503;throw setup;}
    throw err;
  }
  const dbUsers=res.recordset||[];
  if(passwordMode&&dbUsers.length){ const tokenVersion=Number(base.passwordSession?.sessionVersion||0); const dbVersion=Number(dbUsers[0].sessionVersion||1); if(!tokenVersion||tokenVersion!==dbVersion){const err=new Error('Passwort-Sitzung ist nicht mehr gültig. Bitte erneut anmelden.');err.status=401;throw err;} }
  const principalRoles=normalizeRoles(base.roles);
  const isSystemAdminByPrincipal=principalRoles.includes(Roles.SYSTEM_ADMIN)||shouldGrantDevSystemAdmin(email);
  const isSystemAdminByDb=dbUsers.some(u=>dbRoleToRole(u.role)===Roles.SYSTEM_ADMIN);
  const isSystemAdmin=isSystemAdminByPrincipal||isSystemAdminByDb;
  if(!dbUsers.length&&!requireDbUser&&base.isLocalDev){
    const roles=normalizeRoles([...base.roles,Roles.COMPANY_ADMIN,Roles.HSE,Roles.LINE_MANAGER,Roles.AUTHENTICATED,...(isSystemAdminByPrincipal?[Roles.SYSTEM_ADMIN]:[])]);
    const selectedCompanyId=roles.includes(Roles.SYSTEM_ADMIN)?(base.requestedCompanyId || null):(base.companyId||defaultCompanyId());
    const allowedCompanies=selectedCompanyId?[{companyId:selectedCompanyId,role:roles.includes(Roles.SYSTEM_ADMIN)?Roles.SYSTEM_ADMIN:Roles.COMPANY_ADMIN,userId:base.userId,email:base.email,displayName:base.userDetails||'Lokaler Testbenutzer'}]:[];
    return {...base,companyId:selectedCompanyId,roles,allowedCompanies,isAuthenticated:true};
  }
  if(!dbUsers.length&&requireDbUser&&!isSystemAdminByPrincipal){const err=new Error('Benutzer ist nicht im Unterweisungsmanager freigeschaltet');err.status=403;throw err;}
  const allowedCompanies=dbUsers.map(u=>({companyId:u.companyId,role:dbRoleToRole(u.role),userId:u.id,email:u.email,displayName:u.displayName}));
  const requested=base.requestedCompanyId; let selected=null;
  if(requested)selected=allowedCompanies.find(c=>c.companyId===requested)||null;
  if(requested&&!selected&&!isSystemAdmin){const err=new Error('Kein Zugriff auf die angeforderte Firma.');err.status=403;throw err;}
  if(!isSystemAdmin&&allowedCompanies.length>1){const err=new Error('Mehrere Firmenzuordnungen sind für Firmenbenutzer nicht zulässig.');err.status=403;throw err;}
  if(!selected&&!isSystemAdmin&&allowedCompanies.length===1)selected=allowedCompanies[0];
  if(isSystemAdmin&&requested&&!selected){
    if(!(await activeCompanyExists(pool,requested))){const err=new Error('Die ausgewählte Firma ist nicht aktiv oder existiert nicht.');err.status=403;throw err;}
    const root=allowedCompanies.find(c=>c.role===Roles.SYSTEM_ADMIN)||allowedCompanies[0]||{userId:base.userId,email:base.email,displayName:base.userDetails};
    selected={companyId:requested,role:Roles.SYSTEM_ADMIN,userId:root.userId,email:root.email,displayName:root.displayName};
  }
  if(isSystemAdmin&&!requested){
    const root=allowedCompanies.find(c=>c.role===Roles.SYSTEM_ADMIN)||allowedCompanies[0]||{userId:base.userId,email:base.email,displayName:base.userDetails};
    const seenUserId=root.userId||base.userId;
    if(seenUserId)pool.request().input('id',sql.NVarChar(120),seenUserId).query('UPDATE Users SET lastSeenAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME() WHERE id=@id').catch(err=>console.warn('lastSeenAt update failed',err.message));
    return systemAdminSelectionContext(base,root,principalRoles,allowedCompanies,base.authMode);
  }
  if(!selected){const err=new Error('Keine Firma für diesen Benutzer zugeordnet');err.status=403;throw err;}
  const selectedRoles=normalizeRoles([selected.role,...principalRoles.filter(r=>r===Roles.SYSTEM_ADMIN),...(isSystemAdmin?[Roles.SYSTEM_ADMIN]:[])]); if(!selectedRoles.includes(Roles.AUTHENTICATED))selectedRoles.push(Roles.AUTHENTICATED);
  const seenUserId=allowedCompanies.find(c=>c.role===Roles.SYSTEM_ADMIN)?.userId||selected.userId;
  pool.request().input('id',sql.NVarChar(120),seenUserId).query('UPDATE Users SET lastSeenAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME() WHERE id=@id').catch(err=>console.warn('lastSeenAt update failed',err.message));
  return {...base,companyId:selected.companyId,userId:selected.userId||base.userId,userDetails:selected.displayName||base.userDetails,email:normalizeEmail(selected.email||base.email),roles:selectedRoles,allowedCompanies,isAuthenticated:true,authMode:base.authMode};
}

export function hasRole(ctx,allowedRoles=[]){if(!allowedRoles?.length)return true;if(ctx.roles?.includes(Roles.SYSTEM_ADMIN))return true;return allowedRoles.some(r=>ctx.roles?.includes(r));}
export function assertAuthenticated(ctx){if(!ctx?.isAuthenticated||ctx.roles?.includes(Roles.ANONYMOUS)){const err=new Error('Nicht angemeldet');err.status=401;throw err;}}
export function assertRole(ctx,allowedRoles=[]){assertAuthenticated(ctx);if(!hasRole(ctx,allowedRoles)){const err=new Error('Keine Berechtigung für diese Aktion');err.status=403;throw err;}}
