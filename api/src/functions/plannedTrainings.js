import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

app.http('plannedTrainings', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'planned-trainings/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT p.id,p.instructionTypeId,t.name AS instructionName,p.plannedAt,p.durationMinutes,p.location,
                         p.lineManagerId,lm.name AS lineManagerName,p.status,p.createdAt,
                         (SELECT COUNT(*) FROM TrainingParticipants tp WHERE tp.plannedTrainingId=p.id AND tp.companyId=p.companyId) AS participantCount
                  FROM PlannedTrainings p
                  JOIN InstructionTypes t ON t.id=p.instructionTypeId AND t.companyId=p.companyId
                  LEFT JOIN Employees lm ON lm.id=p.lineManagerId AND lm.companyId=p.companyId
                  WHERE p.companyId=@companyId ORDER BY p.plannedAt DESC`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();

      if (request.method === 'POST') {
        if (!body.instructionTypeId || !body.plannedAt) return badRequest('instructionTypeId and plannedAt are required');
        const id = body.id || uuidv4();
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('instructionTypeId', sql.NVarChar(80), body.instructionTypeId)
          .input('plannedAt', sql.DateTime2, new Date(body.plannedAt))
          .input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Number(body.durationMinutes))
          .input('location', sql.NVarChar(200), body.location || null)
          .input('lineManagerId', sql.NVarChar(80), body.lineManagerId || null)
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO PlannedTrainings(id,companyId,instructionTypeId,plannedAt,durationMinutes,location,lineManagerId,status,createdBy)
                  VALUES(@id,@companyId,@instructionTypeId,@plannedAt,@durationMinutes,@location,@lineManagerId,'planned',@createdBy)`);
        const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : [];
        for (const employeeId of employeeIds) {
          await pool.request()
            .input('id', sql.NVarChar(80), uuidv4())
            .input('companyId', sql.NVarChar(80), ctx.companyId)
            .input('plannedTrainingId', sql.NVarChar(80), id)
            .input('employeeId', sql.NVarChar(80), employeeId)
            .query(`INSERT INTO TrainingParticipants(id,companyId,plannedTrainingId,employeeId,status)
                    VALUES(@id,@companyId,@plannedTrainingId,@employeeId,'invited')`);
        }
        await writeAudit(pool, ctx, 'training.planned', 'plannedTraining', id, { participantCount: employeeIds.length });
        return json({ id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('status', sql.NVarChar(40), body.status || null)
        .input('plannedAt', sql.DateTime2, body.plannedAt ? new Date(body.plannedAt) : null)
        .input('durationMinutes', sql.Int, body.durationMinutes == null ? null : Number(body.durationMinutes))
        .input('location', sql.NVarChar(200), body.location || null)
        .query(`UPDATE PlannedTrainings SET
                  status=COALESCE(@status,status), plannedAt=COALESCE(@plannedAt,plannedAt),
                  durationMinutes=COALESCE(@durationMinutes,durationMinutes), location=COALESCE(@location,location)
                WHERE id=@id AND companyId=@companyId`);
      await writeAudit(pool, ctx, 'training.updated', 'plannedTraining', id, body);
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
