import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, serverError } from '../lib/http.js';
import { getRequestContext } from '../lib/auth.js';

app.http('bootstrap', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bootstrap',
  handler: async (request, context) => {
    try {
      const { companyId } = getRequestContext(request);
      const pool = await getPool();
      const req = pool.request().input('companyId', sql.NVarChar(80), companyId);
      const [companies, employees, types, templates, records] = await Promise.all([
        req.query('SELECT id, name, active FROM Companies WHERE id=@companyId'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, chipNr, email, department, active, role, lineManagerId AS shiftLeaderId, title FROM Employees WHERE companyId=@companyId ORDER BY name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, name, category, intervalMonths, description, templateId, active FROM InstructionTypes WHERE companyId=@companyId ORDER BY category, name'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, title, fileName, blobPath AS path, category, description FROM Templates WHERE companyId=@companyId ORDER BY title'),
        pool.request().input('companyId', sql.NVarChar(80), companyId).query('SELECT id, employeeId, typeId, conductedAt AS date, validUntil AS nextDue, status, instructorId, durationMinutes, groupId FROM InstructionRecords WHERE companyId=@companyId')
      ]);
      return json({
        companies: companies.recordset,
        employees: employees.recordset,
        types: types.recordset,
        templates: templates.recordset,
        records: records.recordset,
        tests: [],
        plannedTrainings: [],
        proofs: []
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
