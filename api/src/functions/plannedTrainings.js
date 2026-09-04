import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { resolveEmployeeAccess, bindEmployeeScope, requireEmployeeTarget } from '../lib/employeeAccess.js';
import { writeAudit } from '../lib/audit.js';

function clean(value, max) { const text = String(value ?? '').trim(); return text ? text.slice(0, max) : null; }
function parseDate(value) { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
function addMonths(date, months) { const d = new Date(date); d.setMonth(d.getMonth() + Number(months || 12)); return d; }
function uniqueIds(ids = []) { return [...new Set((Array.isArray(ids) ? ids : []).map(x => clean(x, 80)).filter(Boolean))]; }

async function assertInstructionType(pool, companyId, instructionTypeId) {
  const result = await pool.request().input('companyId', sql.NVarChar(80), companyId).input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .query('SELECT TOP 1 id,intervalMonths FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId AND active=1');
  return result.recordset[0] || null;
}

async function assertEmployees(pool, companyId, employeeIds) {
  if (!employeeIds.length) return [];
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  const params = employeeIds.map((id, idx) => { req.input(`employeeId${idx}`, sql.NVarChar(80), id); return `@employeeId${idx}`; });
  const result = await req.query(`SELECT id FROM Employees WHERE companyId=@companyId AND active=1 AND id IN (${params.join(',')})`);
  const found = new Set(result.recordset.map(r => r.id));
  return employeeIds.filter(id => found.has(id));
}

async function getPlannedTraining(pool, companyId, id) {
  const result = await pool.request().input('companyId', sql.NVarChar(80), companyId).input('id', sql.NVarChar(80), id)
    .query(`SELECT TOP 1 p.id,p.companyId,p.instructionTypeId,t.name AS instructionName,t.intervalMonths,p.plannedAt,p.durationMinutes,p.location,p.lineManagerId,p.status
            FROM PlannedTrainings p JOIN InstructionTypes t ON t.companyId=p.companyId AND t.id=p.instructionTypeId
            WHERE p.companyId=@companyId AND p.id=@id`);
  return result.recordset[0] || null;
}

async function replaceParticipants(pool, companyId, plannedTrainingId, employeeIds) {
  await pool.request().input('companyId', sql.NVarChar(80), companyId).input('plannedTrainingId', sql.NVarChar(80), plannedTrainingId)
    .query('DELETE FROM TrainingParticipants WHERE companyId=@companyId AND plannedTrainingId=@plannedTrainingId');
  for (const employeeId of employeeIds) {
    await pool.request().input('id', sql.NVarChar(80), uuidv4()).input('companyId', sql.NVarChar(80), companyId)
      .input('plannedTrainingId', sql.NVarChar(80), plannedTrainingId).input('employeeId', sql.NVarChar(80), employeeId)
      .query(`INSERT INTO TrainingParticipants(id,companyId,plannedTrainingId,employeeId,status) VALUES(@id,@companyId,@plannedTrainingId,@employeeId,'invited')`);
  }
}

async function completeTraining(pool, ctx, access, training, body) {
  const participantResult = await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('plannedTrainingId', sql.NVarChar(80), training.id)
    .query('SELECT employeeId FROM TrainingParticipants WHERE companyId=@companyId AND plannedTrainingId=@plannedTrainingId');
  const employeeIds = participantResult.recordset.map(r => r.employeeId).filter(Boolean);
  if (!employeeIds.length) return { error: 'Keine Teilnehmer in dieser Planung.' };
  employeeIds.forEach(employeeId => requireEmployeeTarget(access, employeeId));
  const conductedAt = parseDate(body.conductedAt) || new Date();
  const validUntil = body.validUntil ? parseDate(body.validUntil) : addMonths(conductedAt, training.intervalMonths || 12);
  const groupId = `grp-${uuidv4()}`;
  const created = [];
  for (const employeeId of employeeIds) {
    const recordId = uuidv4();
    await pool.request().input('id', sql.NVarChar(80), recordId).input('companyId', sql.NVarChar(80), ctx.companyId)
      .input('employeeId', sql.NVarChar(80), employeeId).input('typeId', sql.NVarChar(80), training.instructionTypeId)
      .input('conductedAt', sql.DateTime2, conductedAt).input('validUntil', sql.DateTime2, validUntil)
      .input('status', sql.NVarChar(40), 'completed').input('source', sql.NVarChar(40), 'planned_group')
      .input('instructorId', sql.NVarChar(80), clean(body.instructorId, 80) || access.selfEmployeeId || training.lineManagerId || null)
      .input('durationMinutes', sql.Int, body.durationMinutes == null ? training.durationMinutes : Number(body.durationMinutes))
      .input('groupId', sql.NVarChar(80), groupId).input('confirmationText', sql.NVarChar(sql.MAX), clean(body.confirmationText, 4000) || 'Geplante Gruppenunterweisung abgeschlossen')
      .input('createdBy', sql.NVarChar(120), ctx.userId)
      .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,instructorId,durationMinutes,groupId,confirmationText,createdBy)
              VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source,@instructorId,@durationMinutes,@groupId,@confirmationText,@createdBy)`);
    created.push(recordId);
  }
  await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), training.id)
    .query("UPDATE PlannedTrainings SET status='completed' WHERE companyId=@companyId AND id=@id");
  await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('plannedTrainingId', sql.NVarChar(80), training.id)
    .query("UPDATE TrainingParticipants SET status='completed' WHERE companyId=@companyId AND plannedTrainingId=@plannedTrainingId");
  return { ids: created, groupId, validUntil: validUntil.toISOString().slice(0, 10), participantCount: created.length };
}

app.http('plannedTrainings', {
  methods: ['GET', 'POST', 'PATCH'], authLevel: 'anonymous', route: 'planned-trainings/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const access = await resolveEmployeeAccess(pool, ctx);

      if (request.method === 'GET') {
        const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId);
        let where = 'p.companyId=@companyId';
        if (access.mode === 'self' || access.mode === 'team') {
          const scope = bindEmployeeScope(req, access, 'tpScope.employeeId', 'planEmployee');
          where += ` AND (EXISTS (SELECT 1 FROM TrainingParticipants tpScope WHERE tpScope.companyId=p.companyId AND tpScope.plannedTrainingId=p.id AND ${scope})`;
          if (access.mode === 'team' && access.selfEmployeeId) { req.input('scopeManagerId', sql.NVarChar(80), access.selfEmployeeId); where += ' OR p.lineManagerId=@scopeManagerId'; }
          where += ')';
        }
        const result = await req.query(`SELECT p.id,p.instructionTypeId,t.name AS instructionName,p.plannedAt,p.durationMinutes,p.location,
                         p.lineManagerId,lm.name AS lineManagerName,p.status,p.createdAt,
                         COUNT(tp.id) AS participantCount,
                         SUM(CASE WHEN tp.mailSentAt IS NOT NULL THEN 1 ELSE 0 END) AS mailSentCount,
                         SUM(CASE WHEN tp.mailError IS NOT NULL THEN 1 ELSE 0 END) AS mailErrorCount,
                         STRING_AGG(CAST(tp.employeeId AS NVARCHAR(MAX)), ',') AS participantIds,
                         STRING_AGG(CAST(e.name AS NVARCHAR(MAX)), ', ') AS participantNames
                  FROM PlannedTrainings p JOIN InstructionTypes t ON t.id=p.instructionTypeId AND t.companyId=p.companyId
                  LEFT JOIN Employees lm ON lm.id=p.lineManagerId AND lm.companyId=p.companyId
                  LEFT JOIN TrainingParticipants tp ON tp.plannedTrainingId=p.id AND tp.companyId=p.companyId
                  LEFT JOIN Employees e ON e.id=tp.employeeId AND e.companyId=tp.companyId
                  WHERE ${where}
                  GROUP BY p.id,p.instructionTypeId,t.name,p.plannedAt,p.durationMinutes,p.location,p.lineManagerId,lm.name,p.status,p.createdAt
                  ORDER BY p.plannedAt DESC`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();
      if (access.mode === 'team' && !access.selfEmployeeId) return badRequest('Für den Line Manager ist kein Mitarbeiterkonto mit derselben E-Mail hinterlegt.');

      if (request.method === 'POST') {
        const instructionTypeId = clean(body.instructionTypeId, 80); const plannedAt = parseDate(body.plannedAt);
        if (!instructionTypeId || !plannedAt) return badRequest('Unterweisung und Datum/Zeit sind erforderlich.');
        const instructionType = await assertInstructionType(pool, ctx.companyId, instructionTypeId);
        if (!instructionType) return notFound('Unterweisungstyp nicht gefunden.');
        const requestedEmployeeIds = uniqueIds(body.employeeIds); requestedEmployeeIds.forEach(employeeId => requireEmployeeTarget(access, employeeId));
        const employeeIds = await assertEmployees(pool, ctx.companyId, requestedEmployeeIds);
        if (requestedEmployeeIds.length !== employeeIds.length) return badRequest('Mindestens ein ausgewählter Mitarbeiter ist nicht aktiv oder gehört nicht zur Firma.');
        const id = clean(body.id, 80) || `plan-${uuidv4()}`;
        const lineManagerId = access.mode === 'team' ? access.selfEmployeeId : clean(body.lineManagerId, 80);
        await pool.request().input('id', sql.NVarChar(80), id).input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('instructionTypeId', sql.NVarChar(80), instructionTypeId).input('plannedAt', sql.DateTime2, plannedAt)
          .input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Math.max(1, Number(body.durationMinutes)))
          .input('location', sql.NVarChar(200), clean(body.location, 200)).input('lineManagerId', sql.NVarChar(80), lineManagerId)
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO PlannedTrainings(id,companyId,instructionTypeId,plannedAt,durationMinutes,location,lineManagerId,status,createdBy)
                  VALUES(@id,@companyId,@instructionTypeId,@plannedAt,@durationMinutes,@location,@lineManagerId,'planned',@createdBy)`);
        await replaceParticipants(pool, ctx.companyId, id, employeeIds);
        await writeAudit(pool, ctx, 'training.planned', 'plannedTraining', id, { participantCount: employeeIds.length, instructionTypeId, plannedAt });
        return json({ id, participantCount: employeeIds.length }, 201);
      }

      const id = request.params.id; if (!id) return badRequest('id is required');
      const training = await getPlannedTraining(pool, ctx.companyId, id); if (!training) return notFound('Planung nicht gefunden.');
      if (access.mode === 'team' && String(training.lineManagerId || '') !== String(access.selfEmployeeId || '')) { const err = new Error('Diese Planung ist nicht deinem Team zugewiesen.'); err.status = 403; throw err; }
      if (body.complete === true) {
        const completion = await completeTraining(pool, ctx, access, training, body); if (completion.error) return badRequest(completion.error);
        await writeAudit(pool, ctx, 'training.completed', 'plannedTraining', id, completion); return json({ ok: true, ...completion });
      }
      const fields = []; const req = pool.request().input('id', sql.NVarChar(80), id).input('companyId', sql.NVarChar(80), ctx.companyId);
      if (body.status !== undefined) { req.input('status', sql.NVarChar(40), clean(body.status, 40)); fields.push('status=COALESCE(@status,status)'); }
      if (body.plannedAt !== undefined) { const plannedAt = parseDate(body.plannedAt); if (!plannedAt) return badRequest('Datum/Zeit ist ungültig.'); req.input('plannedAt', sql.DateTime2, plannedAt); fields.push('plannedAt=@plannedAt'); }
      if (body.durationMinutes !== undefined) { req.input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Math.max(1, Number(body.durationMinutes))); fields.push('durationMinutes=@durationMinutes'); }
      if (body.location !== undefined) { req.input('location', sql.NVarChar(200), clean(body.location, 200)); fields.push('location=@location'); }
      if (body.lineManagerId !== undefined) {
        const lineManagerId = access.mode === 'team' ? access.selfEmployeeId : clean(body.lineManagerId, 80);
        req.input('lineManagerId', sql.NVarChar(80), lineManagerId); fields.push('lineManagerId=@lineManagerId');
      }
      if (fields.length) await req.query(`UPDATE PlannedTrainings SET ${fields.join(', ')} WHERE id=@id AND companyId=@companyId`);
      if (Array.isArray(body.employeeIds)) {
        const requestedEmployeeIds = uniqueIds(body.employeeIds); requestedEmployeeIds.forEach(employeeId => requireEmployeeTarget(access, employeeId));
        const employeeIds = await assertEmployees(pool, ctx.companyId, requestedEmployeeIds);
        if (requestedEmployeeIds.length !== employeeIds.length) return badRequest('Mindestens ein ausgewählter Mitarbeiter ist nicht aktiv oder gehört nicht zur Firma.');
        await replaceParticipants(pool, ctx.companyId, id, employeeIds);
      }
      if (!fields.length && !Array.isArray(body.employeeIds)) return badRequest('Keine Änderung angegeben.');
      await writeAudit(pool, ctx, 'training.updated', 'plannedTraining', id, body); return json({ ok: true });
    } catch (err) { return serverError(err, context); }
  }
});