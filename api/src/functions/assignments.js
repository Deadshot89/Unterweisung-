import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { sendGraphMail } from '../lib/graphMail.js';
import { writeMailLog } from '../lib/mailLog.js';
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

function normalisePercent(value, fallback = 80) {
  if (value === undefined || value === null || value === '') return fallback;
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? Math.round(percent) : false;
}

function forbidden(message = 'Keine Berechtigung für diese Unterweisungsaufgabe.') {
  const error = new Error(message);
  error.status = 403;
  throw error;
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
    .query(`SELECT TOP 1 a.id,a.companyId,a.employeeId,a.instructionTypeId,a.assignedByUserId,a.assignedAt,a.dueAt,
                   a.status,a.testRequired,a.passPercent,a.startedAt,a.completedAt,a.linkedRecordId,
                   a.lastReminderAt,a.reminderCount,a.source,a.note,a.plannedTrainingId,a.createdBy,a.createdAt,a.updatedAt,
                   e.name AS employeeName,e.email AS employeeEmail,t.name AS instructionName,t.category,c.name AS companyName
            FROM dbo.TrainingAssignments a
            JOIN dbo.Employees e ON e.companyId=a.companyId AND e.id=a.employeeId
            JOIN dbo.InstructionTypes t ON t.companyId=a.companyId AND t.id=a.instructionTypeId
            JOIN dbo.Companies c ON c.id=a.companyId
            WHERE a.companyId=@companyId AND a.id=@id`);
  return result.recordset?.[0] || null;
}

async function loadCompanyMailMode(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query(`SELECT TOP 1
              COALESCE(mailMode,'manual') AS mailMode,
              COALESCE(mailSubjectPrefix,'Unterweisung') AS mailSubjectPrefix,
              COALESCE(mailSignature,'Vielen Dank.') AS mailSignature,
              mailFromEmail
            FROM dbo.CompanySettings WHERE companyId=@companyId`);
  const row = result.recordset?.[0] || {};
  const mode = String(row.mailMode || 'manual').toLowerCase();
  return {
    mailMode: ['manual','outlook','graph'].includes(mode) ? mode : 'manual',
    mailSubjectPrefix: row.mailSubjectPrefix || 'Unterweisung',
    mailSignature: row.mailSignature || 'Vielen Dank.',
    mailFromEmail: row.mailFromEmail || null
  };
}

function reminderDraft(assignment, settings) {
  const due = assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString('de-DE') : 'ohne feste Frist';
  const subject = `${settings.mailSubjectPrefix}: Erinnerung ${assignment.instructionName}`;
  const text = `Hallo ${assignment.employeeName},\n\nbitte erledigen Sie die zugewiesene Unterweisung „${assignment.instructionName}“.\nFälligkeit: ${due}.\n\n${settings.mailSignature}`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#101828"><p>Hallo ${String(assignment.employeeName || '').replace(/[&<>"']/g, '')},</p><p>bitte erledigen Sie die zugewiesene Unterweisung <b>${String(assignment.instructionName || '').replace(/[&<>"']/g, '')}</b>.</p><p>Fälligkeit: ${due}.</p><p>${String(settings.mailSignature || '').replace(/\n/g,'<br>')}</p></div>`;
  return { to: assignment.employeeEmail, subject, text, html };
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
        const result = await req.query(`SELECT a.id,a.employeeId,a.instructionTypeId,a.assignedByUserId,a.assignedAt,a.dueAt,
                                               a.status,a.testRequired,a.passPercent,a.startedAt,a.completedAt,a.linkedRecordId,
                                               a.lastReminderAt,a.reminderCount,a.source,a.note,a.plannedTrainingId,a.createdBy,a.createdAt,a.updatedAt,
                                               e.name AS employeeName,t.name AS instructionName,t.category
                                        FROM dbo.TrainingAssignments a
                                        JOIN dbo.Employees e ON e.companyId=a.companyId AND e.id=a.employeeId
                                        JOIN dbo.InstructionTypes t ON t.companyId=a.companyId AND t.id=a.instructionTypeId
                                        ${where}
                                        ORDER BY CASE WHEN a.status IN ('assigned','in_progress') THEN 0 ELSE 1 END,
                                                 CASE WHEN a.dueAt IS NULL THEN 1 ELSE 0 END,a.dueAt,a.assignedAt DESC`);
        return json(filterRowsByEmployeeScope(scope, result.recordset));
      }

      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();

      if (request.method === 'POST') {
        const instructionTypeId = clean(body.instructionTypeId || body.typeId, 80);
        const employeeIds = uniqueIds(body.employeeIds || body.employeeId);
        if (!instructionTypeId) return badRequest('instructionTypeId ist erforderlich.');
        if (!employeeIds.length) return badRequest('Mindestens ein Mitarbeiter ist erforderlich.');
        const dueAt = parseDate(body.dueAt);
        if (dueAt === false) return badRequest('Fälligkeitsdatum ist ungültig.');
        const passPercent = normalisePercent(body.passPercent, 80);
        if (passPercent === false) return badRequest('passPercent muss zwischen 0 und 100 liegen.');
        const testRequired = body.testRequired === false ? 0 : 1;
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
            .input('assignedByUserId', sql.NVarChar(120), ctx.userId)
            .input('dueAt', sql.DateTime2, dueAt || null)
            .input('testRequired', sql.Bit, testRequired)
            .input('passPercent', sql.Int, passPercent)
            .input('createdBy', sql.NVarChar(120), ctx.userId)
            .query(`UPDATE dbo.TrainingAssignments WITH (UPDLOCK,HOLDLOCK)
                    SET dueAt=@dueAt,
                        testRequired=@testRequired,
                        passPercent=@passPercent,
                        assignedByUserId=@assignedByUserId,
                        updatedAt=SYSUTCDATETIME()
                    OUTPUT inserted.id
                    WHERE companyId=@companyId AND employeeId=@employeeId AND instructionTypeId=@instructionTypeId
                      AND status IN ('assigned','in_progress');
                    IF @@ROWCOUNT=0
                    BEGIN
                      INSERT INTO dbo.TrainingAssignments(id,companyId,employeeId,instructionTypeId,assignedByUserId,dueAt,status,testRequired,passPercent,source,createdBy)
                      OUTPUT inserted.id
                      VALUES(@id,@companyId,@employeeId,@instructionTypeId,@assignedByUserId,@dueAt,'assigned',@testRequired,@passPercent,'manual',@createdBy);
                    END`);
          const returnedId = result.recordset?.[0]?.id || result.recordsets?.flat?.().find(row => row?.id)?.id || id;
          ids.push(returnedId);
        }
        await writeAudit(pool, ctx, 'assignment.created', 'trainingAssignment', ids[0], {
          employeeIds,
          instructionTypeId,
          dueAt: dueAt?.toISOString() || null,
          testRequired: !!testRequired,
          passPercent,
          count: ids.length
        });
        return json({ ids, count: ids.length }, 201);
      }

      const id = clean(request.params.id, 80);
      if (!id) return badRequest('id ist erforderlich.');
      const assignment = await loadAssignment(pool, ctx.companyId, id);
      if (!assignment) return notFound('Unterweisungsaufgabe nicht gefunden.');
      assertEmployeeAllowed(scope, assignment.employeeId);
      const requestedStatus = body.status === undefined ? undefined : clean(body.status, 40);
      if (requestedStatus === 'completed') {
        return badRequest('Status completed darf nicht direkt gesetzt werden. Eine Aufgabe wird nur durch einen echten Unterweisungseintrag (InstructionRecord) abgeschlossen.');
      }
      if (requestedStatus !== undefined && requestedStatus !== 'cancelled') return badRequest('Über diese API darf nur cancelled gesetzt werden.');
      const dueAt = body.dueAt === undefined ? undefined : parseDate(body.dueAt);
      if (dueAt === false) return badRequest('Fälligkeitsdatum ist ungültig.');
      const passPercent = body.passPercent === undefined ? undefined : normalisePercent(body.passPercent);
      if (passPercent === false) return badRequest('passPercent muss zwischen 0 und 100 liegen.');

      const allowedKeys = new Set(['status','dueAt','testRequired','passPercent']);
      if (Object.keys(body).some(key => !allowedKeys.has(key))) return badRequest('Diese Änderung ist für Assignments nicht erlaubt.');
      const fields = [];
      const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), id);
      if (requestedStatus !== undefined) { req.input('status', sql.NVarChar(40), requestedStatus); fields.push('status=@status'); }
      if (dueAt !== undefined) { req.input('dueAt', sql.DateTime2, dueAt || null); fields.push('dueAt=@dueAt'); }
      if (body.testRequired !== undefined) { req.input('testRequired', sql.Bit, body.testRequired === false ? 0 : 1); fields.push('testRequired=@testRequired'); }
      if (passPercent !== undefined) { req.input('passPercent', sql.Int, passPercent); fields.push('passPercent=@passPercent'); }
      if (!fields.length) return badRequest('Keine Änderung angegeben.');
      fields.push('updatedAt=SYSUTCDATETIME()');
      await req.query(`UPDATE dbo.TrainingAssignments SET ${fields.join(', ')} WHERE companyId=@companyId AND id=@id AND status<>'completed'`);
      await writeAudit(pool, ctx, requestedStatus === 'cancelled' ? 'assignment.cancelled' : 'assignment.updated', 'trainingAssignment', id, {
        status: requestedStatus,
        dueAt: dueAt instanceof Date ? dueAt.toISOString() : dueAt,
        testRequired: body.testRequired,
        passPercent
      });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('assignmentReminder', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'assignments/{id}/send-reminder',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const pool = await getPool();
      const scope = await getEmployeeScope(pool, ctx);
      const id = clean(request.params.id, 80);
      const assignment = await loadAssignment(pool, ctx.companyId, id);
      if (!assignment) return notFound('Unterweisungsaufgabe nicht gefunden.');
      assertEmployeeAllowed(scope, assignment.employeeId);
      if (!['assigned','in_progress'].includes(assignment.status)) return badRequest('Nur offene Assignments können erinnert werden.');
      if (!assignment.employeeEmail) return badRequest('Für diesen Mitarbeiter ist keine E-Mail-Adresse hinterlegt.');

      const settings = await loadCompanyMailMode(pool, ctx.companyId);
      const mailDraft = reminderDraft(assignment, settings);
      if (settings.mailMode === 'manual' || settings.mailMode === 'outlook') {
        await writeAudit(pool, ctx, 'assignment.reminderPrepared', 'trainingAssignment', id, { mailMode: settings.mailMode });
        return json({ ok: true, sent: false, prepared: true, mailMode: settings.mailMode, mailDraft });
      }

      try {
        const sent = await sendGraphMail({
          to: mailDraft.to,
          subject: mailDraft.subject,
          html: mailDraft.html,
          text: mailDraft.text,
          from: settings.mailFromEmail || undefined
        });
        await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('id', sql.NVarChar(80), id)
          .query(`UPDATE dbo.TrainingAssignments
                  SET lastReminderAt=SYSUTCDATETIME(), reminderCount=reminderCount+1, updatedAt=SYSUTCDATETIME()
                  WHERE companyId=@companyId AND id=@id AND status IN ('assigned','in_progress')`);
        await writeMailLog(pool, ctx, {
          companyId: ctx.companyId,
          relatedEntityType: 'trainingAssignment',
          relatedEntityId: id,
          provider: sent.provider,
          fromEmail: sent.from,
          to: sent.to,
          cc: sent.cc,
          subject: mailDraft.subject,
          bodyPreview: mailDraft.text,
          status: 'sent'
        });
        await writeAudit(pool, ctx, 'assignment.reminderSent', 'trainingAssignment', id, { mailMode: 'graph' });
        return json({ ok: true, sent: true, prepared: false, mailMode: 'graph' });
      } catch (mailErr) {
        await writeMailLog(pool, ctx, {
          companyId: ctx.companyId,
          relatedEntityType: 'trainingAssignment',
          relatedEntityId: id,
          provider: 'microsoft-graph',
          to: mailDraft.to,
          subject: mailDraft.subject,
          bodyPreview: mailDraft.text,
          status: 'failed',
          errorMessage: mailErr.message || String(mailErr)
        });
        throw mailErr;
      }
    } catch (err) {
      return serverError(err, context);
    }
  }
});
