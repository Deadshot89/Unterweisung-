import { sql } from './db.js';

export async function completeAssignmentsForRecord(pool, companyId, employeeId, instructionTypeId, recordId, completedAt = new Date()) {
  if (!pool || !companyId || !employeeId || !instructionTypeId || !recordId) return 0;
  const when = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const safeCompletedAt = Number.isNaN(when.getTime()) ? new Date() : when;
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('employeeId', sql.NVarChar(80), employeeId)
    .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .input('recordId', sql.NVarChar(80), recordId)
    .input('completedAt', sql.DateTime2, safeCompletedAt)
    .query(`UPDATE dbo.TrainingAssignments
            SET status='completed',
                completedAt=@completedAt,
                linkedRecordId=@recordId,
                updatedAt=SYSUTCDATETIME()
            WHERE companyId=@companyId
              AND employeeId=@employeeId
              AND instructionTypeId=@instructionTypeId
              AND status IN ('assigned','in_progress')`);
  return Number(result.rowsAffected?.[0] || 0);
}
