import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

function companyIdFrom(body) {
  const raw = clean(body.companyId || body.id, 80);
  if (raw) return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const base = slug(body.name || body.legalName || `firma-${uuidv4().slice(0,8)}`) || `firma-${uuidv4().slice(0,8)}`;
  return `company-${base}`.slice(0, 80);
}

function normEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  const email = normEmail(value);
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function companyExists(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query('SELECT TOP 1 id FROM Companies WHERE id=@companyId');
  return !!result.recordset.length;
}

async function tenantHasStarterData(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query(`SELECT
              (SELECT COUNT(*) FROM InstructionTypes WHERE companyId=@companyId) AS typeCount,
              (SELECT COUNT(*) FROM Templates WHERE companyId=@companyId) AS templateCount,
              (SELECT COUNT(*) FROM TestQuestions WHERE companyId=@companyId) AS questionCount`);
  const row = result.recordset[0] || {};
  return Number(row.typeCount || 0) + Number(row.templateCount || 0) + Number(row.questionCount || 0) > 0;
}

async function copyStarterData(pool, ctx, targetCompanyId, body = {}) {
  const sourceCompanyId = clean(body.sourceCompanyId, 80) || process.env.STARTER_COMPANY_ID || process.env.DEFAULT_COMPANY_ID || 'company-essentra';
  if (!targetCompanyId) return { error: 'Zielfirma fehlt.' };
  if (targetCompanyId === sourceCompanyId) return { error: 'Quelle und Ziel dürfen nicht gleich sein.' };
  if (!(await companyExists(pool, targetCompanyId))) return { error: 'Zielfirma existiert nicht.' };
  if (!(await companyExists(pool, sourceCompanyId))) return { error: 'Vorlagefirma existiert nicht.' };
  if (await tenantHasStarterData(pool, targetCompanyId)) return { error: 'Zielfirma hat bereits Unterweisungen/Vorlagen/Testfragen. Startpaket wird nicht doppelt kopiert.' };

  const templates = (await pool.request()
    .input('sourceCompanyId', sql.NVarChar(80), sourceCompanyId)
    .query(`SELECT id,title,fileName,blobPath,category,description,active
            FROM Templates
            WHERE companyId=@sourceCompanyId AND active=1
            ORDER BY title`)).recordset;

  const types = (await pool.request()
    .input('sourceCompanyId', sql.NVarChar(80), sourceCompanyId)
    .query(`SELECT id,name,category,intervalMonths,description,templateId,active
            FROM InstructionTypes
            WHERE companyId=@sourceCompanyId AND active=1
            ORDER BY category,name`)).recordset;

  const questions = (await pool.request()
    .input('sourceCompanyId', sql.NVarChar(80), sourceCompanyId)
    .query(`SELECT id,instructionTypeId,language,question,optionsJson,correctIndex,active
            FROM TestQuestions
            WHERE companyId=@sourceCompanyId AND active=1
            ORDER BY instructionTypeId,language,id`)).recordset;

  if (!types.length) return { error: 'Vorlagefirma hat keine aktiven Unterweisungstypen.' };

  const templateMap = new Map();
  for (const t of templates) {
    const newId = `tpl-${uuidv4()}`;
    templateMap.set(t.id, newId);
    await pool.request()
      .input('id', sql.NVarChar(80), newId)
      .input('companyId', sql.NVarChar(80), targetCompanyId)
      .input('title', sql.NVarChar(240), t.title)
      .input('fileName', sql.NVarChar(260), t.fileName)
      .input('blobPath', sql.NVarChar(500), t.blobPath)
      .input('category', sql.NVarChar(120), t.category || null)
      .input('description', sql.NVarChar(sql.MAX), t.description || null)
      .input('active', sql.Bit, t.active === false ? 0 : 1)
      .query(`INSERT INTO Templates(id,companyId,title,fileName,blobPath,category,description,active)
              VALUES(@id,@companyId,@title,@fileName,@blobPath,@category,@description,@active)`);
  }

  const typeMap = new Map();
  for (const t of types) {
    const newId = `type-${uuidv4()}`;
    typeMap.set(t.id, newId);
    await pool.request()
      .input('id', sql.NVarChar(80), newId)
      .input('companyId', sql.NVarChar(80), targetCompanyId)
      .input('name', sql.NVarChar(200), t.name)
      .input('category', sql.NVarChar(120), t.category)
      .input('intervalMonths', sql.Int, Number(t.intervalMonths || 12))
      .input('description', sql.NVarChar(sql.MAX), t.description || null)
      .input('templateId', sql.NVarChar(80), t.templateId ? (templateMap.get(t.templateId) || null) : null)
      .input('active', sql.Bit, t.active === false ? 0 : 1)
      .query(`INSERT INTO InstructionTypes(id,companyId,name,category,intervalMonths,description,templateId,active)
              VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,@active)`);
  }

  let copiedQuestions = 0;
  for (const q of questions) {
    const newTypeId = typeMap.get(q.instructionTypeId);
    if (!newTypeId) continue;
    await pool.request()
      .input('id', sql.NVarChar(80), `q-${uuidv4()}`)
      .input('companyId', sql.NVarChar(80), targetCompanyId)
      .input('instructionTypeId', sql.NVarChar(80), newTypeId)
      .input('language', sql.NVarChar(10), q.language || 'de')
      .input('question', sql.NVarChar(sql.MAX), q.question)
      .input('optionsJson', sql.NVarChar(sql.MAX), q.optionsJson)
      .input('correctIndex', sql.Int, Number(q.correctIndex || 0))
      .input('active', sql.Bit, q.active === false ? 0 : 1)
      .query(`INSERT INTO TestQuestions(id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active)
              VALUES(@id,@companyId,@instructionTypeId,@language,@question,@optionsJson,@correctIndex,@active)`);
    copiedQuestions++;
  }

  await writeAudit(pool, ctx, 'system.company.starterDataCopied', 'company', targetCompanyId, {
    sourceCompanyId,
    templateCount: templates.length,
    instructionTypeCount: types.length,
    questionCount: copiedQuestions
  });
  await writeSecurityEvent(pool, ctx, 'system.company.starterDataCopied', 'info', { targetCompanyId, sourceCompanyId });

  return {
    ok: true,
    sourceCompanyId,
    targetCompanyId,
    templateCount: templates.length,
    instructionTypeCount: types.length,
    questionCount: copiedQuestions
  };
}

app.http('systemCompanies', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'system/companies/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN]);
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request().query(`SELECT
              c.id,
              c.name,
              c.legalName,
              c.addressLine,
              c.defaultLanguage,
              c.active,
              c.createdAt,
              c.updatedAt,
              cs.mailMode,
              cs.mailFromName,
              cs.mailFromEmail,
              cs.replyToEmail,
              COUNT(DISTINCT u.id) AS userCount,
              SUM(CASE WHEN u.active=1 AND u.role='company_admin' THEN 1 ELSE 0 END) AS companyAdminCount,
              COUNT(DISTINCT e.id) AS employeeCount,
              COUNT(DISTINCT tpl.id) AS templateCount,
              COUNT(DISTINCT t.id) AS instructionTypeCount,
              COUNT(DISTINCT q.id) AS testQuestionCount
            FROM Companies c
            LEFT JOIN CompanySettings cs ON cs.companyId=c.id
            LEFT JOIN Users u ON u.companyId=c.id
            LEFT JOIN Employees e ON e.companyId=c.id AND e.active=1
            LEFT JOIN Templates tpl ON tpl.companyId=c.id AND tpl.active=1
            LEFT JOIN InstructionTypes t ON t.companyId=c.id AND t.active=1
            LEFT JOIN TestQuestions q ON q.companyId=c.id AND q.active=1
            GROUP BY c.id,c.name,c.legalName,c.addressLine,c.defaultLanguage,c.active,c.createdAt,c.updatedAt,
                     cs.mailMode,cs.mailFromName,cs.mailFromEmail,cs.replyToEmail
            ORDER BY c.createdAt DESC, c.name`);
        return json(result.recordset);
      }

      const body = await request.json();

      if (request.method === 'POST') {
        const companyId = companyIdFrom(body);
        const name = clean(body.name, 200);
        if (!name) return badRequest('Firmenname fehlt.');
        const legalName = clean(body.legalName, 240) || name;
        const defaultLanguage = ['de','en','pl'].includes(String(body.defaultLanguage || 'de').toLowerCase()) ? String(body.defaultLanguage || 'de').toLowerCase() : 'de';
        const adminEmail = validEmail(body.adminEmail);
        const adminName = clean(body.adminName, 200) || adminEmail || null;

        await pool.request()
          .input('id', sql.NVarChar(80), companyId)
          .input('name', sql.NVarChar(200), name)
          .input('legalName', sql.NVarChar(240), legalName)
          .input('addressLine', sql.NVarChar(300), clean(body.addressLine, 300))
          .input('defaultLanguage', sql.NVarChar(10), defaultLanguage)
          .input('active', sql.Bit, body.active === false ? 0 : 1)
          .query(`MERGE Companies AS t
                  USING (SELECT @id AS id) AS s ON t.id=s.id
                  WHEN MATCHED THEN UPDATE SET name=@name, legalName=@legalName, addressLine=@addressLine, defaultLanguage=@defaultLanguage, active=@active, updatedAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(id,name,legalName,addressLine,defaultLanguage,active)
                    VALUES(@id,@name,@legalName,@addressLine,@defaultLanguage,@active);`);

        await pool.request()
          .input('companyId', sql.NVarChar(80), companyId)
          .input('mailFromName', sql.NVarChar(200), `${name} Unterweisungen`.slice(0, 200))
          .input('mailSubjectPrefix', sql.NVarChar(120), 'Unterweisung')
          .input('mailSignature', sql.NVarChar(sql.MAX), 'Vielen Dank.')
          .query(`MERGE CompanySettings AS t
                  USING (SELECT @companyId AS companyId) AS s ON t.companyId=s.companyId
                  WHEN MATCHED THEN UPDATE SET updatedAt=SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT(companyId,mailMode,mailFromName,mailSubjectPrefix,mailSignature,updatedAt,mailUpdatedAt)
                    VALUES(@companyId,'manual',@mailFromName,@mailSubjectPrefix,@mailSignature,SYSUTCDATETIME(),SYSUTCDATETIME());`);

        let adminUser = null;
        if (adminEmail) {
          const userId = `user-${uuidv4()}`;
          await pool.request()
            .input('id', sql.NVarChar(120), userId)
            .input('companyId', sql.NVarChar(80), companyId)
            .input('email', sql.NVarChar(254), adminEmail)
            .input('displayName', sql.NVarChar(200), adminName || adminEmail)
            .query(`MERGE Users AS t USING (SELECT @companyId AS companyId, @email AS email) AS s
                    ON t.companyId=s.companyId AND LOWER(t.email)=LOWER(s.email)
                    WHEN MATCHED THEN UPDATE SET displayName=@displayName, role='company_admin', active=1, updatedAt=SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN INSERT(id,companyId,email,displayName,role,active,provider,invitedAt)
                      VALUES(@id,@companyId,@email,@displayName,'company_admin',1,'aad',SYSUTCDATETIME());`);
          adminUser = { email: adminEmail, displayName: adminName || adminEmail, role: 'company_admin' };
        }

        let starterData = null;
        if (body.copyStarterData === true || body.copyStarterData === 'true') {
          starterData = await copyStarterData(pool, ctx, companyId, body);
          if (starterData.error) return badRequest(starterData.error);
        }

        await writeAudit(pool, ctx, 'system.company.upserted', 'company', companyId, { name, adminEmail, copiedStarterData: !!starterData });
        await writeSecurityEvent(pool, ctx, 'system.company.upserted', 'info', { companyId, adminEmail });
        return json({ ok: true, companyId, adminUser, starterData }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('company id is required');

      if (body.action === 'copyStarterData') {
        const result = await copyStarterData(pool, ctx, id, body);
        if (result.error) return badRequest(result.error);
        return json(result);
      }

      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('name', sql.NVarChar(200), clean(body.name, 200))
        .input('legalName', sql.NVarChar(240), clean(body.legalName, 240))
        .input('addressLine', sql.NVarChar(300), clean(body.addressLine, 300))
        .input('defaultLanguage', sql.NVarChar(10), clean(body.defaultLanguage, 10))
        .input('active', sql.Bit, body.active === false ? 0 : 1)
        .query(`UPDATE Companies SET
                  name=COALESCE(@name,name),
                  legalName=COALESCE(@legalName,legalName),
                  addressLine=COALESCE(@addressLine,addressLine),
                  defaultLanguage=COALESCE(@defaultLanguage,defaultLanguage),
                  active=@active,
                  updatedAt=SYSUTCDATETIME()
                WHERE id=@id`);
      await writeAudit(pool, ctx, 'system.company.updated', 'company', id, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
