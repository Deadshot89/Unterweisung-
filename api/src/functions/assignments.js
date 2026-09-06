import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import {
  resolveEmployeeScope as getEmployeeScope,
  assertEmployeeAllowed,
  assertEmployeeIdsAllowed,
  filterRowsByEmployeeScope
} from '../lib/employeeScope.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function uniqueIds(value) {
  const rows = Array.isArray(value) ? value : [value];
  return [...new Set(rows.map(id => clean(id, 80)).filter(Boolean))];
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? false : date;
}

function forbidden(message = 'Keine Berechtigung für diese Unterweisungsaufgabe.') {
  const error = new Error(message);
  error.status = 403;
  throw error;
}

function hasRole(ctx, role) {
  return Array.isArray(ctx?.roles) && ctx.roles.includes(role);
}

function canManageAssignments(ctx) {
  return [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER].some(role => hasRole(ctx, role));
}

async function assertCompanyEmployees(pool, companyId, employeeIds) {
  if (!employeeIds.length) return;
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  const params = employeeIds.map((id, index) => {
    req.input(`employeeId${index}`, sql.NVarChar(80), id);
    return `@employeeId${index}`;
  });
  const result = await req.query(`SELECT id FROM dbo.Employees
                                  WHERE companyId=@companyId AND active=1 AND id IN (${params.join(',')})`);
  if ((result.recordset || []).length !== employeeIds.length) forbidden('Mindestens ein Mitarbeiter gehört nicht zur aktiven Firma oder ist inaktiv.');
}

async function assertInstructionType(pool, companyId, instructionTypeId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .query('SELECT TOP 1 id FROM dbo.InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId AND active=1');
  if (!result.recordset?.length) {
    const error = new Error('Unterweisungstyp nicht gefunden oder nicht aktiv.');
    error.status = 404;
    throw error;
  }
}

async function loadAssignment(pool, companyId, id) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('id', sql.NVarChar(80), id)
    .query(`SELECT TOP 1 a.id,a.companyId,a.employeeId,a.instructionTypeId,a.assignedAt,a.dueAt,a.status,a.source,a.note,
                   a.plannedTrainingId,a.completedAt,a.completedRecordId,a.createdBy,a.createdAt,a.updatedAt,
                   e.name AS employeeName,t.name AS instructionName,t.category
            FROM dbo.TrainingAssignments a
            JOIN dbo.Employees e ON e.companyId=a.companyId AND e.id=a.employeeId
            JOIN dbo.InstructionTypes t ON t.companyId=a.companyId AND t.id=a.instructionTypeId
            WHERE a.companyId=@companyId AND a.id=@id`);
  return result.recordset?.[0] || null;
}

app.http('assignments', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'assignments/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await getEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const employeeId = clean(url.searchParams.get('employeeId'), 80);
        const status = clean(url.searchParams.get('status'), 40);
        if (employeeId) assertEmployeeAllowed(scope, employeeId);
        const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId);
        let where = 'WHERE a.companyId=@companyId';
        if (employeeId) {
          req.input('employeeId', sql.NVarChar(80), employeeId);
          where += ' AND a.employeeId=@employeeId';
        }
        if (status) {
          req.input('status', sql.NVarChar(40), status);
          where += ' AND a.status=@status';
        }
        const result = await req.query(`SELECT a.id,a.employeeId,a.instructionTypeId,a.assignedAt,a.dueAt,a.status,a.source,a.note,
                                               a.plannedTrainingId,a.completedAt,a.completedRecordId,a.createdBy,a.createdAt,a.updatedAt,
                                               e.name AS employeeName,t.name AS instructionName,t.category
                                        FROM dbo.TrainingAssignments a
                                        JOIN dbo.Employees e ON e.companyId=a.companyId AND e.id=a.employeeId
                                        JOIN dbo.InstructionTypes t ON t.companyId=a.companyId AND t.id=a.instructionTypeId
                                        ${where}
                                        ORDER BY CASE WHEN a.status IN ('assigned','in_progress') THEN 0 ELSE 1 END,
                                                 CASE WHEN a.dueAt IS NULL THEN 1 ELSE 0 END,a.dueAt,a.assignedAt DESC`);
        return json(filterRowsByEmployeeScope(scope, result.recordset));
      }

      if (request.method === 'POST') {
        if (!canManageAssignments(ctx)) forbidden();
        const body = await request.json();
        const instructionTypeId = clean(body.instructionTypeId || body.typeId, 80);
        const employeeIds = uniqueIds(body.employeeIds || body.employeeId);
        if (!instructionTypeId) return badRequest('instructionTypeId ist erforderlich.');
        if (!employeeIds.length) return badRequest('Mindestens ein Mitarbeiter ist erforderlich.');
        const dueAt = parseDate(body.dueAt);
        if (dueAt === false) return badRequest('Fälligkeitsdatum ist ungültig.');
        await assertInstructionType(pool, ctx.companyId, instructionTypeId);
        await assertCompanyEmployees(pool, ctx.companyId, employeeIds);
        assertEmployeeIdsAllowed(scope, employeeIds);

        const ids = [];
        for (const employeeId of employeeIds) {
          const id = `assign-${uuidv4()}`;
          const result = await pool.request()
            .input('id', sql.NVarChar(80), id)
            .input('companyId', sql.NVarChar(80), ctx.companyId)
            .input('employeeId', sql.NVarChar(80), employeeId)
            .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
            .input('dueAt', sql.DateTime2, dueAt || null)
            .input('source', sql.NVarChar(40), clean(body.source, 40) || 'manual')
            .input('note', sql.NVarChar(1000), clean(body.note, 1000))
            .input('plannedTrainingId', sql.NVarChar(80), clean(body.plannedTrainingId, 80))
            .input('createdBy', sql.NVarChar(120), ctx.userId)
            .query(`UPDATE dbo.TrainingAssignments WITH (UPDLOCK,HOLDLOCK)
                    SET dueAt=@dueAt,
                        note=@note,
                        plannedTrainingId=COALESCE(@plannedTrainingId,plannedTrainingId),
                        updatedAt=SYSUTCDATETIME()
                    OUTPUT inserted.id
                    WHERE companyId=@companyId AND employeeId=@employeeId AND instructionTypeId=@instructionTypeId
                      AND status IN ('assigned','in_progress');
                    IF @@ROWCOUNT=0
                    BEGIN
                      INSERT INTO dbo.TrainingAssignments(id,companyId,employeeId,instructionTypeId,dueAt,status,source,note,plannedTrainingId,createdBy)
                      OUTPUT inserted.id
                      VALUES(@id,@companyId,@employeeId,@instructionTypeId,@dueAt,'assigned',@source,@note,@plannedTrainingId,@createdBy);
                    END`);
          const returnedId = result.recordset?.[0]?.id || result.recordsets?.flat?.().find(row => row?.id)?.id || id;
          ids.push(returnedId);
        }
        await writeAudit(pool, ctx, 'assignment.createdOrUpdated', 'trainingAssignment', ids[0], {
          employeeIds,
          instructionTypeId,
          dueAt: dueAt?.toISOString() || null,
          count: ids.length
        });
        return json({ ids, count: ids.length }, 201);
      }

      const id = clean(request.params.id, 80);
      if (!id) return badRequest('id ist erforderlich.');
      const assignment = await loadAssignment(pool, ctx.companyId, id);
      if (!assignment) return notFound('Unterweisungsaufgabe nicht gefunden.');
      assertEmployeeAllowed(scope, assignment.employeeId);
      const body = await request.json();
      const requestedStatus = body.status === undefined ? undefined : clean(body.status, 40);

      if (requestedStatus === 'completed') {
        return badRequest('Status completed darf nicht direkt gesetzt werden. Eine Aufgabe wird nur durch einen echten Unterweisungseintrag (InstructionRecord) abgeschlossen.');
      }

      const employeeSelf = hasRole(ctx, Roles.EMPLOYEE) && !canManageAssignments(ctx);
      if (employeeSelf) {
        if (requestedStatus !== 'in_progress' || Object.keys(body).some(key => !['status'].includes(key))) {
          forbidden('Mitarbeiter dürfen ihre eigene Aufgabe nur als begonnen markieren.');
        }
      } else if (!canManageAssignments(ctx)) {
        forbidden();
      }

      const allowedStatuses = employeeSelf ? new Set(['in_progress']) : new Set(['assigned','in_progress','cancelled']);
      if (requestedStatus !== undefined && !allowedStatuses.has(requestedStatus)) return badRequest('Status ist nicht erlaubt.');
      const dueAt = body.dueAt === undefined ? undefined : parseDate(body.dueAt);
      if (dueAt === false) return badRequest('Fälligkeitsdatum ist ungültig.');
      if (employeeSelf && dueAt !== undefined) forbidden();

      const fields = [];
      const req = pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id);
      if (requestedStatus !== undefined) {
        req.input('status', sql.NVarChar(40), requestedStatus);
        fields.push('status=@status');
      }
      if (dueAt !== undefined) {
        req.input('dueAt', sql.DateTime2, dueAt || null);
        fields.push('dueAt=@dueAt');
      }
      if (body.note !== undefined) {
        if (employeeSelf) forbidden();
        req.input('note', sql.NVarChar(1000), clean(body.note, 1000));
        fields.push('note=@note');
      }
      if (!fields.length) return badRequest('Keine Änderung angegeben.');
      fields.push('updatedAt=SYSUTCDATETIME()');
      await req.query(`UPDATE dbo.TrainingAssignments SET ${fields.join(', ')} WHERE companyId=@companyId AND id=@id`);
      await writeAudit(pool, ctx, 'assignment.updated', 'trainingAssignment', id, {
        status: requestedStatus,
        dueAt: dueAt instanceof Date ? dueAt.toISOString() : dueAt,
        noteChanged: body.note !== undefined
      });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
