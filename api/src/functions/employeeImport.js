import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}
function normEmail(value) {
  const email = clean(value, 254);
  return email ? email.toLowerCase() : null;
}
function isEmail(value) {
  const email = normEmail(value);
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function normalizeRow(row = {}) {
  const name = clean(row.name || row.Name || row.mitarbeiter || row.Mitarbeiter, 200);
  const email = normEmail(row.email || row.Email || row['E-Mail'] || row.mail || row.Mail);
  return {
    name,
    email: isEmail(email) ? email : null,
    department: clean(row.department || row.Department || row.Abteilung || row.bereich || row.Bereich, 120),
    role: clean(row.role || row.Role || row.Rolle || row.Funktion, 60) || 'Mitarbeiter',
    chipNr: clean(row.chipNr || row.Chip || row['Chip Nr'] || row['Chip-Nr'] || row.Personalnummer, 80),
    title: clean(row.title || row.Title || row.Titel || row.Position, 200),
    lineManager: clean(row.lineManager || row.lineManagerEmail || row['Line Manager'] || row.Teamleiter || row.Manager, 254)
  };
}

async function findEmployee(pool, companyId, row) {
  if (row.email) {
    const byEmail = await pool.request()
      .input('companyId', sql.NVarChar(80), companyId)
      .input('email', sql.NVarChar(254), row.email)
      .query('SELECT TOP 1 id FROM Employees WHERE companyId=@companyId AND LOWER(email)=LOWER(@email) ORDER BY active DESC, updatedAt DESC, createdAt DESC');
    if (byEmail.recordset[0]) return byEmail.recordset[0].id;
  }
  if (row.name) {
    const byName = await pool.request()
      .input('companyId', sql.NVarChar(80), companyId)
      .input('name', sql.NVarChar(200), row.name)
      .query('SELECT TOP 1 id FROM Employees WHERE companyId=@companyId AND LOWER(name)=LOWER(@name) ORDER BY active DESC, updatedAt DESC, createdAt DESC');
    if (byName.recordset[0]) return byName.recordset[0].id;
  }
  return null;
}

async function findManagerId(pool, companyId, managerValue) {
  const value = clean(managerValue, 254);
  if (!value) return null;
  const req = pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('value', sql.NVarChar(254), value);
  const result = await req.query(`SELECT TOP 1 id FROM Employees
    WHERE companyId=@companyId AND active=1 AND (
      LOWER(email)=LOWER(@value) OR LOWER(name)=LOWER(@value)
    )
    ORDER BY CASE WHEN LOWER(email)=LOWER(@value) THEN 0 ELSE 1 END, name`);
  return result.recordset[0]?.id || null;
}

app.http('employeeImport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'employees/import',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const pool = await getPool();
      const body = await request.json();
      const inputRows = Array.isArray(body.rows) ? body.rows : [];
      if (!inputRows.length) return badRequest('Keine Importzeilen vorhanden.');
      if (inputRows.length > 1000) return badRequest('Maximal 1000 Mitarbeiter pro Import.');

      const rows = inputRows.map(normalizeRow).filter(r => r.name);
      if (!rows.length) return badRequest('Keine gültigen Mitarbeiterzeilen gefunden. Pflichtfeld: Name.');

      const result = { total: inputRows.length, valid: rows.length, created: 0, updated: 0, managersLinked: 0, skipped: [], errors: [] };
      const managerLinks = [];

      for (const row of rows) {
        try {
          const existingId = await findEmployee(pool, ctx.companyId, row);
          if (existingId) {
            await pool.request()
              .input('id', sql.NVarChar(80), existingId)
              .input('companyId', sql.NVarChar(80), ctx.companyId)
              .input('name', sql.NVarChar(200), row.name)
              .input('chipNr', sql.NVarChar(80), row.chipNr)
              .input('email', sql.NVarChar(254), row.email)
              .input('department', sql.NVarChar(120), row.department)
              .input('role', sql.NVarChar(60), row.role)
              .input('title', sql.NVarChar(200), row.title)
              .query(`UPDATE Employees SET
                        name=@name,
                        chipNr=COALESCE(@chipNr,chipNr),
                        email=COALESCE(@email,email),
                        department=COALESCE(@department,department),
                        role=COALESCE(@role,role),
                        title=COALESCE(@title,title),
                        active=1,
                        updatedAt=SYSUTCDATETIME()
                      WHERE id=@id AND companyId=@companyId`);
            result.updated++;
            if (row.lineManager) managerLinks.push({ employeeId: existingId, lineManager: row.lineManager });
          } else {
            const id = `emp-${uuidv4()}`;
            await pool.request()
              .input('id', sql.NVarChar(80), id)
              .input('companyId', sql.NVarChar(80), ctx.companyId)
              .input('name', sql.NVarChar(200), row.name)
              .input('chipNr', sql.NVarChar(80), row.chipNr)
              .input('email', sql.NVarChar(254), row.email)
              .input('department', sql.NVarChar(120), row.department)
              .input('role', sql.NVarChar(60), row.role)
              .input('title', sql.NVarChar(200), row.title)
              .input('createdBy', sql.NVarChar(120), ctx.userId)
              .query(`INSERT INTO Employees(id,companyId,name,chipNr,email,department,role,title,active,createdBy)
                      VALUES(@id,@companyId,@name,@chipNr,@email,@department,@role,@title,1,@createdBy)`);
            result.created++;
            if (row.lineManager) managerLinks.push({ employeeId: id, lineManager: row.lineManager });
          }
        } catch (err) {
          result.errors.push({ name: row.name, email: row.email, error: err.message });
        }
      }

      for (const link of managerLinks) {
        const managerId = await findManagerId(pool, ctx.companyId, link.lineManager);
        if (!managerId || managerId === link.employeeId) continue;
        await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('employeeId', sql.NVarChar(80), link.employeeId)
          .input('managerId', sql.NVarChar(80), managerId)
          .query('UPDATE Employees SET lineManagerId=@managerId, updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@employeeId');
        result.managersLinked++;
      }

      await writeAudit(pool, ctx, 'employee.imported', 'employee', ctx.companyId, result);
      return json({ ok: true, ...result });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
