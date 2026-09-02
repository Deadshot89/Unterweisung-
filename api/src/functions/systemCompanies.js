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
              COUNT(DISTINCT t.id) AS instructionTypeCount
            FROM Companies c
            LEFT JOIN CompanySettings cs ON cs.companyId=c.id
            LEFT JOIN Users u ON u.companyId=c.id
            LEFT JOIN Employees e ON e.companyId=c.id AND e.active=1
            LEFT JOIN InstructionTypes t ON t.companyId=c.id AND t.active=1
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

        await writeAudit(pool, ctx, 'system.company.upserted', 'company', companyId, { name, adminEmail });
        await writeSecurityEvent(pool, ctx, 'system.company.upserted', 'info', { companyId, adminEmail });
        return json({ ok: true, companyId, adminUser }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('company id is required');
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
