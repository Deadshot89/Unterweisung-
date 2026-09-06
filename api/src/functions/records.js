import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { resolveEmployeeScope, assertEmployeeAllowed, assertEmployeeIdsAllowed, filterRowsByEmployeeScope } from '../lib/employeeScope.js';

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months || 12));
  return d;
}

async function getInterval(pool, companyId, typeId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('typeId', sql.NVarChar(80), typeId)
    .query('SELECT intervalMonths FROM InstructionTypes WHERE companyId=@companyId AND id=@typeId');
  return result.recordset[0]?.intervalMonths || 12;
}

async function assertCompanyEmployees(pool, companyId, employeeIds) {
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (!ids.length) return;
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  const params = ids.map((id, index) => {
    req.input(`targetEmployeeId${index}`, sql.NVarChar(80), id);
    return `@targetEmployeeId${index}`;
  });
  const result = await req.query(`SELECT id FROM Employees WHERE companyId=@companyId AND active=1 AND id IN (${params.join(',')})`);
  if (result.recordset.length !== ids.length) {
    const error = new Error('Mindestens ein Mitarbeiter gehört nicht zur aktiven Firma oder ist inaktiv.');
    error.status = 403;
    throw error;
  }
}

app.http('records', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'records',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const employeeId = url.searchParams.get('employeeId');
        const typeId = url.searchParams.get('typeId');
        if (employeeId) assertEmployeeAllowed(scope, employeeId);
        const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId);
        let where = 'WHERE r.companyId=@companyId';
        if (employeeId) { req.input('employeeId', sql.NVarChar(80), employeeId); where += ' AND r.employeeId=@employeeId'; }
        if (typeId) { req.input('typeId', sql.NVarChar(80), typeId); where += ' AND r.typeId=@typeId'; }
        const result = await req.query(`SELECT r.id,r.employeeId,r.typeId,r.conductedAt,r.validUntil,r.status,r.source,
                         r.instructorId,r.durationMinutes,r.groupId,r.confirmationText,r.certificateFileId,r.createdAt,
                         e.name AS employeeName,t.name AS instructionName,ins.name AS instructorName,f.fileName AS certificateFileName,f.scanStatus AS certificateScanStatus
                  FROM InstructionRecords r
                  LEFT JOIN Employees e ON e.id=r.employeeId AND e.companyId=r.companyId
                  JOIN InstructionTypes t ON t.id=r.typeId AND t.companyId=r.companyId
                  LEFT JOIN Employees ins ON ins.id=r.instructorId AND ins.companyId=r.companyId
                  LEFT JOIN Files f ON f.id=r.certificateFileId AND f.companyId=r.companyId
                  ${where} ORDER BY r.conductedAt DESC`);
        return json(filterRowsByEmployeeScope(scope, result.recordset));
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();
      if (!body.typeId && !body.instructionTypeId) return badRequest('typeId is required');
      const typeId = body.typeId || body.instructionTypeId;
      const employeeIds = [...new Set((Array.isArray(body.employeeIds) ? body.employeeIds : [body.employeeId]).filter(Boolean))];
      if (!employeeIds.length) return badRequest('employeeId or employeeIds is required');
      await assertCompanyEmployees(pool, ctx.companyId, employeeIds);
      assertEmployeeIdsAllowed(scope, employeeIds);
      const conductedAt = body.conductedAt ? new Date(body.conductedAt) : new Date();
      if (Number.isNaN(conductedAt.getTime())) return badRequest('conductedAt ist ungültig');
      const intervalMonths = await getInterval(pool, ctx.companyId, typeId);
      const validUntil = body.validUntil ? new Date(body.validUntil) : addMonths(conductedAt, intervalMonths);
      if (Number.isNaN(validUntil.getTime())) return badRequest('validUntil ist ungültig');
      const groupId = body.groupId || (employeeIds.length > 1 ? uuidv4() : null);
      const created = [];

      for (const employeeId of employeeIds) {
        const id = uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('employeeId', sql.NVarChar(80), employeeId)
          .input('typeId', sql.NVarChar(80), typeId)
          .input('conductedAt', sql.DateTime2, conductedAt)
          .input('validUntil', sql.DateTime2, validUntil)
          .input('status', sql.NVarChar(40), body.status || 'completed')
          .input('source', sql.NVarChar(40), body.source || (groupId ? 'group' : 'manual'))
          .input('instructorId', sql.NVarChar(80), body.instructorId || null)
          .input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Number(body.durationMinutes))
          .input('groupId', sql.NVarChar(80), groupId)
          .input('confirmationText', sql.NVarChar(sql.MAX), body.confirmationText || null)
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,instructorId,durationMinutes,groupId,confirmationText,createdBy)
                  VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source,@instructorId,@durationMinutes,@groupId,@confirmationText,@createdBy)`);
        created.push(id);
      }
      await writeAudit(pool, ctx, groupId ? 'instruction.groupCompleted' : 'instruction.completed', 'instructionRecord', groupId || created[0], { typeId, employeeIds, conductedAt, validUntil });
      return json({ ids: created, groupId, validUntil: validUntil.toISOString().slice(0, 10) }, 201);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
