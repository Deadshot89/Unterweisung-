import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';
import { resolveEmployeeScope, employeeAllowed, filterRowsByEmployeeScope } from '../lib/employeeScope.js';

function scopedPlans(scope, ctx, plans, participants) {
  if (scope.mode === 'company') return plans;
  const byPlan = new Map();
  for (const p of participants) {
    if (!byPlan.has(p.plannedTrainingId)) byPlan.set(p.plannedTrainingId, []);
    byPlan.get(p.plannedTrainingId).push(p);
  }
  return plans.flatMap(plan => {
    const all = byPlan.get(plan.id) || [];
    const internal = all.filter(p => p.employeeId);
    const safe = internal.filter(p => employeeAllowed(scope, p.employeeId));
    const ownedByActor = scope.mode === 'team' && (plan.lineManagerId === scope.actorEmployeeId || plan.createdBy === ctx.userId);
    if (!safe.length && !ownedByActor) return [];
    return [{
      ...plan,
      participantCount: safe.length,
      participantIds: safe.map(p => p.employeeId),
      participantNames: safe.map(p => p.employeeName).filter(Boolean),
      scopeRestricted: safe.length !== internal.length || all.some(p => !p.employeeId)
    }];
  });
}

function scopedInvitations(scope, ctx, rows) {
  if (scope.mode === 'company') return rows;
  return rows.filter(row => row.employeeId ? employeeAllowed(scope, row.employeeId) : (scope.mode === 'team' && row.createdBy === ctx.userId));
}

app.http('bootstrap', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bootstrap',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const { companyId } = ctx;
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);
      const [companies, employees, types, templates, records, exclusions, assignments, plannedTrainings, participants, invitations] = await Promise.all([
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, legalName, addressLine, defaultLanguage, active FROM Companies WHERE id=@companyId'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, chipNr, email, department, active, role, lineManagerId AS shiftLeaderId, title FROM Employees WHERE companyId=@companyId ORDER BY name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, category, intervalMonths, description, templateId, active FROM InstructionTypes WHERE companyId=@companyId ORDER BY category, name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, title, fileName, blobPath AS path, category, description, active FROM Templates WHERE companyId=@companyId ORDER BY title'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT r.id, r.employeeId, r.typeId, r.conductedAt AS date, r.validUntil AS nextDue, r.status, r.instructorId, r.durationMinutes, r.groupId, r.source, r.certificateFileId, f.fileName AS certificateFileName, f.scanStatus AS certificateScanStatus FROM InstructionRecords r LEFT JOIN Files f ON f.companyId=r.companyId AND f.id=r.certificateFileId WHERE r.companyId=@companyId'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, employeeId, instructionTypeId AS typeId, reason, active FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND active=1'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query(`SELECT a.id,a.employeeId,a.instructionTypeId,a.assignedByUserId,a.assignedAt,a.dueAt,a.status,
          a.testRequired,a.passPercent,a.startedAt,a.completedAt,a.linkedRecordId,a.lastReminderAt,a.reminderCount,
          a.source,a.note,a.plannedTrainingId,a.createdBy,a.createdAt,a.updatedAt,
          e.name AS employeeName,t.name AS instructionName,t.category
          FROM TrainingAssignments a
          JOIN Employees e ON e.companyId=a.companyId AND e.id=a.employeeId
          JOIN InstructionTypes t ON t.companyId=a.companyId AND t.id=a.instructionTypeId
          WHERE a.companyId=@companyId
          ORDER BY CASE WHEN a.status IN ('assigned','in_progress') THEN 0 ELSE 1 END,
                   CASE WHEN a.dueAt IS NULL THEN 1 ELSE 0 END,a.dueAt,a.assignedAt DESC`),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, instructionTypeId, plannedAt, durationMinutes, location, lineManagerId, status, createdBy FROM PlannedTrainings WHERE companyId=@companyId ORDER BY plannedAt DESC'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query(`SELECT tp.plannedTrainingId,tp.employeeId,tp.externalEmail,e.name AS employeeName
          FROM TrainingParticipants tp
          LEFT JOIN Employees e ON e.companyId=tp.companyId AND e.id=tp.employeeId
          WHERE tp.companyId=@companyId`),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT TOP 300 id,email,recipientName,employeeId,employeeName,instructionTypeId,instructionName,category,language,status,expiresAt,startedAt,completedAt,testRequired,passPercent,certificateFileId,certificateFileName,createdAt,createdBy FROM vExternalInvitations WHERE companyId=@companyId ORDER BY createdAt DESC')
      ]);
      return json({
        companies: companies.recordset,
        employees: filterRowsByEmployeeScope(scope, employees.recordset, 'id'),
        types: types.recordset,
        templates: templates.recordset,
        records: filterRowsByEmployeeScope(scope, records.recordset),
        exclusions: filterRowsByEmployeeScope(scope, exclusions.recordset),
        assignments: filterRowsByEmployeeScope(scope, assignments.recordset),
        plannedTrainings: scopedPlans(scope, ctx, plannedTrainings.recordset, participants.recordset),
        invitations: scopedInvitations(scope, ctx, invitations.recordset),
        tests: [],
        proofs: []
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
