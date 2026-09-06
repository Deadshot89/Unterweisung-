import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { resolveEmployeeScope, employeeAllowed, assertEmployeeIdsAllowed } from '../lib/employeeScope.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months || 12));
  return d;
}

function uniqueIds(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(x => clean(x, 80)).filter(Boolean))];
}

function forbidden(message = 'Keine Berechtigung für diese Planung.') {
  const error = new Error(message);
  error.status = 403;
  throw error;
}

async function assertInstructionType(pool, companyId, instructionTypeId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .query('SELECT TOP 1 id, intervalMonths FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId AND active=1');
  return result.recordset[0] || null;
}

async function assertEmployees(pool, companyId, employeeIds) {
  if (!employeeIds.length) return [];
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  const params = employeeIds.map((id, idx) => {
    req.input(`employeeId${idx}`, sql.NVarChar(80), id);
    return `@employeeId${idx}`;
  });
  const result = await req.query(`SELECT id FROM Employees WHERE companyId=@companyId AND active=1 AND id IN (${params.join(',')})`);
  const found = new Set(result.recordset.map(r => r.id));
  return employeeIds.filter(id => found.has(id));
}

async function getPlannedTraining(pool, companyId, id) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('id', sql.NVarChar(80), id)
    .query(`SELECT TOP 1 p.id,p.companyId,p.instructionTypeId,t.name AS instructionName,t.intervalMonths,p.plannedAt,p.durationMinutes,p.location,p.lineManagerId,p.status,p.createdAt,p.createdBy,
                   lm.name AS lineManagerName
            FROM PlannedTrainings p
            JOIN InstructionTypes t ON t.companyId=p.companyId AND t.id=p.instructionTypeId
            LEFT JOIN Employees lm ON lm.id=p.lineManagerId AND lm.companyId=p.companyId
            WHERE p.companyId=@companyId AND p.id=@id`);
  return result.recordset[0] || null;
}

async function getParticipants(pool, companyId, plannedTrainingId = null) {
  const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
  let where = 'WHERE tp.companyId=@companyId';
  if (plannedTrainingId) {
    req.input('plannedTrainingId', sql.NVarChar(80), plannedTrainingId);
    where += ' AND tp.plannedTrainingId=@plannedTrainingId';
  }
  const result = await req.query(`SELECT tp.id,tp.plannedTrainingId,tp.employeeId,tp.externalEmail,tp.status,
                                         e.name AS employeeName,e.email AS employeeEmail
                                  FROM TrainingParticipants tp
                                  LEFT JOIN Employees e ON e.id=tp.employeeId AND e.companyId=tp.companyId
                                  ${where}`);
  return result.recordset || [];
}

function planOwnedByActor(scope, ctx, plan) {
  return scope.mode === 'team' && (plan.lineManagerId === scope.actorEmployeeId || plan.createdBy === ctx.userId);
}

function scopedPlanRow(scope, ctx, plan, participants) {
  const internal = participants.filter(p => p.employeeId);
  if (scope.mode === 'company') {
    const names = participants.map(p => p.employeeName || p.externalEmail).filter(Boolean);
    return {
      ...plan,
      participantCount: participants.length,
      participantIds: internal.map(p => p.employeeId).join(','),
      employeeIds: internal.map(p => p.employeeId),
      participantNames: names.join(', '),
      scopeRestricted: false
    };
  }
  const safe = internal.filter(p => employeeAllowed(scope, p.employeeId));
  if (!safe.length && !planOwnedByActor(scope, ctx, plan)) return null;
  return {
    ...plan,
    participantCount: safe.length,
    participantIds: safe.map(p => p.employeeId).join(','),
    employeeIds: safe.map(p => p.employeeId),
    participantNames: safe.map(p => p.employeeName).filter(Boolean).join(', '),
    scopeRestricted: safe.length !== internal.length || participants.some(p => !p.employeeId)
  };
}

function assertPlanMutationAllowed(scope, ctx, plan, participants) {
  if (scope.mode === 'company') return;
  const internalIds = uniqueIds(participants.map(p => p.employeeId));
  if (internalIds.length) assertEmployeeIdsAllowed(scope, internalIds);
  if (!internalIds.length && !planOwnedByActor(scope, ctx, plan)) forbidden();
  if (participants.some(p => !p.employeeId) && !planOwnedByActor(scope, ctx, plan)) forbidden('Externe Teilnehmer dürfen nur in eigenen Team-Planungen bearbeitet werden.');
}

async function replaceParticipants(pool, companyId, plannedTrainingId, employeeIds) {
  await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('plannedTrainingId', sql.NVarChar(80), plannedTrainingId)
    .query('DELETE FROM TrainingParticipants WHERE companyId=@companyId AND plannedTrainingId=@plannedTrainingId');

  for (const employeeId of employeeIds) {
    await pool.request()
      .input('id', sql.NVarChar(80), uuidv4())
      .input('companyId', sql.NVarChar(80), companyId)
      .input('plannedTrainingId', sql.NVarChar(80), plannedTrainingId)
      .input('employeeId', sql.NVarChar(80), employeeId)
      .query(`INSERT INTO TrainingParticipants(id,companyId,plannedTrainingId,employeeId,status)
              VALUES(@id,@companyId,@plannedTrainingId,@employeeId,'invited')`);
  }
}

async function completeTraining(pool, ctx, training, body, participants) {
  const employeeIds = uniqueIds(participants.map(r => r.employeeId));
  if (!employeeIds.length) return { error: 'Keine internen Teilnehmer in dieser Planung.' };

  const conductedAt = parseDate(body.conductedAt) || new Date();
  const validUntil = body.validUntil ? parseDate(body.validUntil) : addMonths(conductedAt, training.intervalMonths || 12);
  if (!validUntil) return { error: 'Gültigkeitsdatum ist ungültig.' };
  const groupId = `grp-${uuidv4()}`;
  const created = [];

  for (const employeeId of employeeIds) {
    const recordId = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(80), recordId)
      .input('companyId', sql.NVarChar(80), ctx.companyId)
      .input('employeeId', sql.NVarChar(80), employeeId)
      .input('typeId', sql.NVarChar(80), training.instructionTypeId)
      .input('conductedAt', sql.DateTime2, conductedAt)
      .input('validUntil', sql.DateTime2, validUntil)
      .input('status', sql.NVarChar(40), 'completed')
      .input('source', sql.NVarChar(40), 'planned_group')
      .input('instructorId', sql.NVarChar(80), clean(body.instructorId, 80) || training.lineManagerId || null)
      .input('durationMinutes', sql.Int, body.durationMinutes == null ? training.durationMinutes : Number(body.durationMinutes))
      .input('groupId', sql.NVarChar(80), groupId)
      .input('confirmationText', sql.NVarChar(sql.MAX), clean(body.confirmationText, 4000) || 'Geplante Gruppenunterweisung abgeschlossen')
      .input('createdBy', sql.NVarChar(120), ctx.userId)
      .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,instructorId,durationMinutes,groupId,confirmationText,createdBy)
              VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source,@instructorId,@durationMinutes,@groupId,@confirmationText,@createdBy)`);
    created.push(recordId);
  }

  await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('id', sql.NVarChar(80), training.id)
    .query(`UPDATE PlannedTrainings SET status='completed' WHERE companyId=@companyId AND id=@id`);
  await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('plannedTrainingId', sql.NVarChar(80), training.id)
    .query(`UPDATE TrainingParticipants SET status='completed' WHERE companyId=@companyId AND plannedTrainingId=@plannedTrainingId`);

  return { ids: created, groupId, validUntil: validUntil.toISOString().slice(0, 10), participantCount: created.length };
}

app.http('plannedTrainings', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'planned-trainings/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const plans = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT p.id,p.instructionTypeId,t.name AS instructionName,p.plannedAt,p.durationMinutes,p.location,
                         p.lineManagerId,lm.name AS lineManagerName,p.status,p.createdAt,p.createdBy
                  FROM PlannedTrainings p
                  JOIN InstructionTypes t ON t.id=p.instructionTypeId AND t.companyId=p.companyId
                  LEFT JOIN Employees lm ON lm.id=p.lineManagerId AND lm.companyId=p.companyId
                  WHERE p.companyId=@companyId
                  ORDER BY p.plannedAt DESC`);
        const participants = await getParticipants(pool, ctx.companyId);
        const byPlan = new Map();
        for (const participant of participants) {
          if (!byPlan.has(participant.plannedTrainingId)) byPlan.set(participant.plannedTrainingId, []);
          byPlan.get(participant.plannedTrainingId).push(participant);
        }
        const rows = plans.recordset.map(plan => scopedPlanRow(scope, ctx, plan, byPlan.get(plan.id) || [])).filter(Boolean);
        return json(rows);
      }

      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();

      if (request.method === 'POST') {
        const instructionTypeId = clean(body.instructionTypeId, 80);
        const plannedAt = parseDate(body.plannedAt);
        if (!instructionTypeId || !plannedAt) return badRequest('Unterweisung und Datum/Zeit sind erforderlich.');
        const instructionType = await assertInstructionType(pool, ctx.companyId, instructionTypeId);
        if (!instructionType) return notFound('Unterweisungstyp nicht gefunden.');
        const requestedEmployeeIds = uniqueIds(body.employeeIds);
        const employeeIds = await assertEmployees(pool, ctx.companyId, requestedEmployeeIds);
        if (requestedEmployeeIds.length !== employeeIds.length) return badRequest('Mindestens ein ausgewählter Mitarbeiter ist nicht aktiv oder gehört nicht zur Firma.');
        assertEmployeeIdsAllowed(scope, employeeIds);

        let lineManagerId = clean(body.lineManagerId, 80);
        if (scope.mode === 'team') {
          if (lineManagerId && lineManagerId !== scope.actorEmployeeId) forbidden('Führungskräfte dürfen Planungen nur sich selbst zuordnen.');
          lineManagerId = scope.actorEmployeeId;
        }
        const id = clean(body.id, 80) || `plan-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
          .input('plannedAt', sql.DateTime2, plannedAt)
          .input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Math.max(1, Number(body.durationMinutes)))
          .input('location', sql.NVarChar(200), clean(body.location, 200))
          .input('lineManagerId', sql.NVarChar(80), lineManagerId)
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO PlannedTrainings(id,companyId,instructionTypeId,plannedAt,durationMinutes,location,lineManagerId,status,createdBy)
                  VALUES(@id,@companyId,@instructionTypeId,@plannedAt,@durationMinutes,@location,@lineManagerId,'planned',@createdBy)`);
        await replaceParticipants(pool, ctx.companyId, id, employeeIds);
        await writeAudit(pool, ctx, 'training.planned', 'plannedTraining', id, { participantCount: employeeIds.length, instructionTypeId, plannedAt });
        return json({ id, participantCount: employeeIds.length }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      const training = await getPlannedTraining(pool, ctx.companyId, id);
      if (!training) return notFound('Planung nicht gefunden.');
      const currentParticipants = await getParticipants(pool, ctx.companyId, id);
      assertPlanMutationAllowed(scope, ctx, training, currentParticipants);

      if (body.complete === true) {
        assertEmployeeIdsAllowed(scope, uniqueIds(currentParticipants.map(p => p.employeeId)));
        const completion = await completeTraining(pool, ctx, training, body, currentParticipants);
        if (completion.error) return badRequest(completion.error);
        await writeAudit(pool, ctx, 'training.completed', 'plannedTraining', id, completion);
        return json({ ok: true, ...completion });
      }

      const fields = [];
      const req = pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId);
      if (body.status !== undefined) { req.input('status', sql.NVarChar(40), clean(body.status, 40)); fields.push('status=COALESCE(@status,status)'); }
      if (body.plannedAt !== undefined) { const plannedAt = parseDate(body.plannedAt); if (!plannedAt) return badRequest('Datum/Zeit ist ungültig.'); req.input('plannedAt', sql.DateTime2, plannedAt); fields.push('plannedAt=@plannedAt'); }
      if (body.durationMinutes !== undefined) { req.input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Math.max(1, Number(body.durationMinutes))); fields.push('durationMinutes=@durationMinutes'); }
      if (body.location !== undefined) { req.input('location', sql.NVarChar(200), clean(body.location, 200)); fields.push('location=@location'); }
      if (body.lineManagerId !== undefined) {
        const requestedManager = clean(body.lineManagerId, 80);
        if (scope.mode === 'team' && requestedManager !== scope.actorEmployeeId) forbidden('Führungskräfte dürfen Planungen nur sich selbst zuordnen.');
        req.input('lineManagerId', sql.NVarChar(80), requestedManager);
        fields.push('lineManagerId=@lineManagerId');
      }

      let nextEmployeeIds = null;
      if (Array.isArray(body.employeeIds)) {
        const requestedEmployeeIds = uniqueIds(body.employeeIds);
        const employeeIds = await assertEmployees(pool, ctx.companyId, requestedEmployeeIds);
        if (requestedEmployeeIds.length !== employeeIds.length) return badRequest('Mindestens ein ausgewählter Mitarbeiter ist nicht aktiv oder gehört nicht zur Firma.');
        assertEmployeeIdsAllowed(scope, employeeIds);
        nextEmployeeIds = employeeIds;
      }
      if (!fields.length && nextEmployeeIds === null) return badRequest('Keine Änderung angegeben.');
      if (fields.length) await req.query(`UPDATE PlannedTrainings SET ${fields.join(', ')} WHERE id=@id AND companyId=@companyId`);
      if (nextEmployeeIds !== null) await replaceParticipants(pool, ctx.companyId, id, nextEmployeeIds);
      await writeAudit(pool, ctx, 'training.updated', 'plannedTraining', id, { status: body.status, plannedAt: body.plannedAt, durationMinutes: body.durationMinutes, location: body.location, lineManagerId: body.lineManagerId, participantCount: nextEmployeeIds?.length });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
