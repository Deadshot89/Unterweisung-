import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';
import { resolveEmployeeAccess, bindEmployeeScope } from '../lib/employeeAccess.js';
import { learningContentSchemaReady, parseKeyPoints } from '../lib/learningContent.js';

async function instructionTypes(pool, companyId) {
  const rich = await learningContentSchemaReady(pool);
  let extended = true;
  let result;
  try {
    result = await pool.request().input('companyId', sql.NVarChar(80), companyId)
      .query(`SELECT id,name,category,intervalMonths,description,templateId,active,deliveryMode,testRequired,passPercent${rich?',learningGoal,learningIntro,keyPointsJson':''}
              FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
  } catch (err) {
    if (!/Invalid column name 'deliveryMode'|Invalid column name 'testRequired'|Invalid column name 'passPercent'/i.test(String(err.message || err))) throw err;
    extended = false;
    result = await pool.request().input('companyId', sql.NVarChar(80), companyId)
      .query(`SELECT id,name,category,intervalMonths,description,templateId,active${rich?',learningGoal,learningIntro,keyPointsJson':''}
              FROM InstructionTypes WHERE companyId=@companyId ORDER BY category,name`);
  }
  result.recordset = result.recordset.map(row => {
    const mapped = {
      ...row,
      deliveryMode: extended ? (row.deliveryMode || 'practical') : 'practical',
      testRequired: extended ? !!row.testRequired : false,
      passPercent: extended ? Number(row.passPercent || 80) : 80,
      learningGoal: rich ? String(row.learningGoal || '') : '',
      learningIntro: rich ? String(row.learningIntro || '') : '',
      keyPoints: rich ? parseKeyPoints(row.keyPointsJson) : []
    };
    delete mapped.keyPointsJson;
    return mapped;
  });
  return result;
}

app.http('bootstrap', {
  methods: ['GET'], authLevel: 'anonymous', route: 'bootstrap',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const companyId = ctx.companyId;
      const pool = await getPool();
      const access = await resolveEmployeeAccess(pool, ctx);

      const companiesPromise = pool.request().input('companyId', sql.NVarChar(80), companyId)
        .query('SELECT id,name,legalName,addressLine,defaultLanguage,active FROM Companies WHERE id=@companyId');
      const employeeReq = pool.request().input('companyId', sql.NVarChar(80), companyId);
      const employeeScope = bindEmployeeScope(employeeReq, access, 'id', 'bootEmployee');
      const employeesPromise = employeeReq.query(`SELECT id,name,chipNr,email,department,active,role,lineManagerId AS shiftLeaderId,title
                                                   FROM Employees WHERE companyId=@companyId AND ${employeeScope} ORDER BY name`);
      const typesPromise = instructionTypes(pool, companyId);
      const templatesPromise = pool.request().input('companyId', sql.NVarChar(80), companyId)
        .query('SELECT id,title,fileName,blobPath AS path,category,description,active FROM Templates WHERE companyId=@companyId ORDER BY title');

      const recordReq = pool.request().input('companyId', sql.NVarChar(80), companyId);
      const recordScope = bindEmployeeScope(recordReq, access, 'r.employeeId', 'bootRecord');
      const recordsPromise = recordReq.query(`SELECT r.id,r.employeeId,r.typeId,r.conductedAt AS date,r.validUntil AS nextDue,r.status,r.instructorId,r.durationMinutes,r.groupId,r.source,r.certificateFileId,
                                               f.fileName AS certificateFileName,f.scanStatus AS certificateScanStatus
                                        FROM InstructionRecords r LEFT JOIN Files f ON f.companyId=r.companyId AND f.id=r.certificateFileId
                                        WHERE r.companyId=@companyId AND ${recordScope}`);

      const exclusionReq = pool.request().input('companyId', sql.NVarChar(80), companyId);
      const exclusionScope = bindEmployeeScope(exclusionReq, access, 'employeeId', 'bootExclusion');
      const exclusionsPromise = exclusionReq.query(`SELECT id,employeeId,instructionTypeId AS typeId,reason,active
                                                     FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND active=1 AND ${exclusionScope}`);

      const planReq = pool.request().input('companyId', sql.NVarChar(80), companyId);
      let planWhere = 'p.companyId=@companyId';
      if (access.mode === 'self' || access.mode === 'team') {
        const planScope = bindEmployeeScope(planReq, access, 'tp.employeeId', 'bootPlan');
        planWhere += ` AND (EXISTS (SELECT 1 FROM TrainingParticipants tp WHERE tp.companyId=p.companyId AND tp.plannedTrainingId=p.id AND ${planScope})`;
        if (access.mode === 'team' && access.selfEmployeeId) { planReq.input('managerEmployeeId', sql.NVarChar(80), access.selfEmployeeId); planWhere += ' OR p.lineManagerId=@managerEmployeeId'; }
        planWhere += ')';
      }
      const plannedPromise = planReq.query(`SELECT p.id,p.instructionTypeId,p.plannedAt,p.durationMinutes,p.location,p.lineManagerId,p.status
                                            FROM PlannedTrainings p WHERE ${planWhere} ORDER BY p.plannedAt DESC`);

      let invitationsPromise;
      if (access.mode === 'company' || access.mode === 'system') {
        invitationsPromise = pool.request().input('companyId', sql.NVarChar(80), companyId)
          .query('SELECT TOP 300 id,email,recipientName,employeeId,employeeName,instructionTypeId,instructionName,category,language,status,expiresAt,startedAt,completedAt,testRequired,passPercent,certificateFileId,certificateFileName,createdAt FROM vExternalInvitations WHERE companyId=@companyId ORDER BY createdAt DESC');
      } else {
        const inviteReq = pool.request().input('companyId', sql.NVarChar(80), companyId);
        const inviteScope = bindEmployeeScope(inviteReq, access, 'employeeId', 'bootInvite');
        invitationsPromise = inviteReq.query(`SELECT TOP 300 id,email,recipientName,employeeId,employeeName,instructionTypeId,instructionName,category,language,status,expiresAt,startedAt,completedAt,testRequired,passPercent,certificateFileId,certificateFileName,createdAt
                                               FROM vExternalInvitations WHERE companyId=@companyId AND ${inviteScope} ORDER BY createdAt DESC`);
      }

      const [companies, employees, types, templates, records, exclusions, plannedTrainings, invitations] = await Promise.all([
        companiesPromise, employeesPromise, typesPromise, templatesPromise, recordsPromise, exclusionsPromise, plannedPromise, invitationsPromise
      ]);
      return json({ companies:companies.recordset,employees:employees.recordset,types:types.recordset,templates:templates.recordset,records:records.recordset,
        exclusions:exclusions.recordset,plannedTrainings:plannedTrainings.recordset,invitations:invitations.recordset,tests:[],proofs:[] });
    } catch (err) { return serverError(err, context); }
  }
});
