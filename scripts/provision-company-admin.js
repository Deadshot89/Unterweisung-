import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';

function fail(message){ throw new Error(message); }
function normEmail(value){ return String(value || '').trim().toLowerCase(); }
function clean(value,max=240){ const text=String(value ?? '').trim(); return text ? text.slice(0,max) : ''; }

const requestPath=path.resolve(process.argv[2] || 'operations/company-admin-provision-request.json');
if(!fs.existsSync(requestPath)) fail(`Provisionierungs-Request fehlt: ${requestPath}`);
const request=JSON.parse(fs.readFileSync(requestPath,'utf8'));

const branch=clean(process.env.PROVISION_BRANCH || process.env.GITHUB_REF_NAME,200);
const expectedBranch=clean(request.expectedBranch,200);
const companyName=clean(request.companyName,240);
const companyIdRequested=clean(request.companyId,80);
const legalName=clean(request.legalName || request.companyName,240);
const addressLine=clean(request.addressLine,300);
const defaultLanguage=clean(request.defaultLanguage || 'de',10) || 'de';
const createCompanyIfMissing=request.createCompanyIfMissing===true;
const displayName=clean(request.displayName,200);
const email=normEmail(request.email);
const role=clean(request.role,60);
const requestId=clean(request.requestId,120);
const confirmed=request.confirmed===true;
const exclusive=request.exclusive===true;

if(!process.env.SQL_CONNECTION_STRING) fail('SQL_CONNECTION_STRING fehlt.');
if(!requestId) fail('requestId fehlt.');
if(!confirmed) fail('Provisionierung ist nicht ausdrücklich bestätigt.');
if(!expectedBranch || !expectedBranch.startsWith('company/')) fail('expectedBranch muss ein Firmenbranch sein.');
if(branch !== expectedBranch) fail(`Request ist nur für ${expectedBranch} freigegeben, aktueller Branch ist ${branch || 'unbekannt'}.`);
if(!companyName) fail('companyName fehlt.');
if(createCompanyIfMissing && !companyIdRequested) fail('Bei createCompanyIfMissing=true muss companyId explizit gesetzt sein.');
if(companyIdRequested && !/^company-[a-z0-9][a-z0-9-]*$/.test(companyIdRequested)) fail('companyId muss stabil im Format company-<slug> gesetzt sein.');
if(!displayName) fail('displayName fehlt.');
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Gültige E-Mail-Adresse fehlt.');
if(role !== 'company_admin') fail('Dieser Provisionierungsweg darf ausschließlich company_admin setzen.');
if(!exclusive) fail('Für Firmenadmins muss exclusive=true gesetzt sein, damit keine parallele Firmenzuordnung bestehen bleibt.');

const pool=await sql.connect(process.env.SQL_CONNECTION_STRING);
const transaction=new sql.Transaction(pool);
let begun=false;
try{
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  begun=true;

  const companyRequest=new sql.Request(transaction);
  companyRequest.input('companyName',sql.NVarChar(240),companyName);
  companyRequest.input('companyIdRequested',sql.NVarChar(80),companyIdRequested || null);
  const companyResult=await companyRequest.query(`
    SELECT id,name,legalName,active
    FROM Companies
    WHERE (@companyIdRequested IS NOT NULL AND id=@companyIdRequested)
       OR (active=1 AND (name=@companyName OR legalName=@companyName))
  `);
  const companyRows=companyResult.recordset || [];
  const uniqueIds=[...new Set(companyRows.map(row=>String(row.id || '')).filter(Boolean))];
  if(uniqueIds.length > 1) fail(`Die Zielfirma ist nicht eindeutig. Treffer: ${uniqueIds.length}.`);

  let companyId='';
  let companyCreated=false;
  if(uniqueIds.length === 0){
    if(!createCompanyIfMissing) fail('Die aktive Zielfirma fehlt und createCompanyIfMissing ist nicht freigegeben.');
    companyId=companyIdRequested;
    const createCompanyRequest=new sql.Request(transaction);
    createCompanyRequest.input('companyId',sql.NVarChar(80),companyId);
    createCompanyRequest.input('companyName',sql.NVarChar(200),companyName);
    createCompanyRequest.input('legalName',sql.NVarChar(240),legalName || null);
    createCompanyRequest.input('addressLine',sql.NVarChar(300),addressLine || null);
    createCompanyRequest.input('defaultLanguage',sql.NVarChar(10),defaultLanguage);
    await createCompanyRequest.query(`
      INSERT INTO Companies(id,name,legalName,addressLine,defaultLanguage,active)
      VALUES(@companyId,@companyName,@legalName,@addressLine,@defaultLanguage,1)
    `);
    const settingsRequest=new sql.Request(transaction);
    settingsRequest.input('companyId',sql.NVarChar(80),companyId);
    await settingsRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM CompanySettings WHERE companyId=@companyId)
        INSERT INTO CompanySettings(companyId,updatedAt) VALUES(@companyId,SYSUTCDATETIME())
    `);
    companyCreated=true;
  }else{
    companyId=uniqueIds[0];
    const row=companyRows.find(item=>String(item.id)===companyId);
    if(!row || Number(row.active)!==1) fail('Die gefundene Zielfirma ist nicht aktiv. Eine Reaktivierung ist über diesen Weg nicht erlaubt.');
    if(companyIdRequested && companyId !== companyIdRequested) fail(`Die gefundene Zielfirma hat eine andere ID (${companyId}).`);
    if(String(row.name)!==companyName && String(row.legalName || '')!==companyName) fail('Die angegebene companyId gehört zu einer anderen Firma.');
    const settingsRequest=new sql.Request(transaction);
    settingsRequest.input('companyId',sql.NVarChar(80),companyId);
    await settingsRequest.query(`
      IF NOT EXISTS (SELECT 1 FROM CompanySettings WHERE companyId=@companyId)
        INSERT INTO CompanySettings(companyId,updatedAt) VALUES(@companyId,SYSUTCDATETIME())
    `);
  }

  const deactivateRequest=new sql.Request(transaction);
  deactivateRequest.input('email',sql.NVarChar(254),email);
  deactivateRequest.input('companyId',sql.NVarChar(80),companyId);
  await deactivateRequest.query(`
    UPDATE Users
    SET active=0, updatedAt=SYSUTCDATETIME()
    WHERE LOWER(email)=LOWER(@email)
      AND companyId<>@companyId
      AND active=1
  `);

  const userId=`user-${uuidv4()}`;
  const upsertRequest=new sql.Request(transaction);
  upsertRequest.input('id',sql.NVarChar(120),userId);
  upsertRequest.input('companyId',sql.NVarChar(80),companyId);
  upsertRequest.input('email',sql.NVarChar(254),email);
  upsertRequest.input('displayName',sql.NVarChar(200),displayName);
  upsertRequest.input('role',sql.NVarChar(60),'company_admin');
  await upsertRequest.query(`
    MERGE Users AS target
    USING (SELECT @companyId AS companyId, @email AS email) AS source
      ON target.companyId=source.companyId AND LOWER(target.email)=LOWER(source.email)
    WHEN MATCHED THEN
      UPDATE SET displayName=@displayName, role=@role, active=1, updatedAt=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT(id,companyId,email,displayName,role,active,provider,invitedAt)
      VALUES(@id,@companyId,@email,@displayName,@role,1,'aad',SYSUTCDATETIME());
  `);

  const verifyRequest=new sql.Request(transaction);
  verifyRequest.input('email',sql.NVarChar(254),email);
  const verifyResult=await verifyRequest.query(`
    SELECT u.id,u.companyId,u.email,u.displayName,u.role,u.active,c.name AS companyName,c.active AS companyActive
    FROM Users u
    INNER JOIN Companies c ON c.id=u.companyId
    WHERE LOWER(u.email)=LOWER(@email) AND u.active=1
  `);
  const activeRows=verifyResult.recordset || [];
  if(activeRows.length !== 1) fail(`Sicherheitsprüfung fehlgeschlagen: ${activeRows.length} aktive Firmenzuordnungen gefunden.`);
  const row=activeRows[0];
  if(String(row.companyId)!==companyId || String(row.role)!=='company_admin' || Number(row.companyActive)!==1) fail('Sicherheitsprüfung fehlgeschlagen: falscher Mandant, falsche Rolle oder inaktive Firma.');

  const settingsVerifyRequest=new sql.Request(transaction);
  settingsVerifyRequest.input('companyId',sql.NVarChar(80),companyId);
  const settingsVerify=await settingsVerifyRequest.query('SELECT companyId FROM CompanySettings WHERE companyId=@companyId');
  if((settingsVerify.recordset || []).length !== 1) fail('Sicherheitsprüfung fehlgeschlagen: Basiseinstellungen der Firma fehlen.');

  await transaction.commit();
  begun=false;
  console.log(JSON.stringify({ok:true,requestId,companyId,companyName:row.companyName,companyCreated,email:row.email,displayName:row.displayName,role:row.role,exclusive:true}));
}catch(error){
  if(begun){ try{ await transaction.rollback(); }catch{} }
  throw error;
}finally{
  await pool.close();
}
