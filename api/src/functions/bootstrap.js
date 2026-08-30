import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';

app.http('bootstrap', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bootstrap',
  handler: async (request, context) => {
    try {
      const { companyId } = await getAuthorizedContext(request);
      const pool = await getPool();
      const [companies, employees, types, templates, records, exclusions, plannedTrainings, invitations] = await Promise.all([
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, legalName, addressLine, defaultLanguage, active FROM Companies WHERE id=@companyId'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, chipNr, email, department, active, role, lineManagerId AS shiftLeaderId, title FROM Employees WHERE companyId=@companyId ORDER BY name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, category, intervalMonths, description, templateId, active FROM InstructionTypes WHERE companyId=@companyId ORDER BY category, name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, title, fileName, blobPath AS path, category, description, active FROM Templates WHERE companyId=@companyId ORDER BY title'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, employeeId, typeId, conductedAt AS date, validUntil AS nextDue, status, instructorId, durationMinutes, groupId, source FROM InstructionRecords WHERE companyId=@companyId'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, employeeId, instructionTypeId AS typeId, reason, active FROM EmployeeInstructionExclusions WHERE companyId=@companyId AND active=1'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, instructionTypeId, plannedAt, durationMinutes, location, lineManagerId, status FROM PlannedTrainings WHERE companyId=@companyId ORDER BY plannedAt DESC'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT TOP 300 id,email,recipientName,employeeId,employeeName,instructionTypeId,instructionName,category,language,status,expiresAt,startedAt,completedAt,testRequired,passPercent,certificateFileId,certificateFileName,createdAt FROM vExternalInvitations WHERE companyId=@companyId ORDER BY createdAt DESC')
      ]);
      return json({
        companies: companies.recordset,
        employees: employees.recordset,
        types: types.recordset,
        templates: templates.recordset,
        records: records.recordset,
        exclusions: exclusions.recordset,
        plannedTrainings: plannedTrainings.recordset,
        invitations: invitations.recordset,
        tests: [],
        proofs: []
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
