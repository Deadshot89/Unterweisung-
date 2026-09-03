import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, notFound, forbidden, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { resolveEmployeeAccess, employeeIdAllowed } from '../lib/employeeAccess.js';
import { createReadSasUrl } from '../lib/blob.js';
import { writeAudit } from '../lib/audit.js';

async function restrictedFileAllowed(pool, ctx, access, file) {
  if (access.mode === 'company' || access.mode === 'system') return true;
  const record = await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), file.id)
    .query('SELECT TOP 1 employeeId FROM InstructionRecords WHERE companyId=@companyId AND certificateFileId=@id ORDER BY conductedAt DESC');
  if (record.recordset[0] && employeeIdAllowed({ ...access, targetEmployeeId: record.recordset[0].employeeId })) return true;

  const template = await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), file.id)
    .query(`SELECT TOP 1 t.id FROM Templates tpl JOIN InstructionTypes t ON t.companyId=tpl.companyId AND t.templateId=tpl.id
            WHERE tpl.companyId=@companyId AND tpl.id=@id AND tpl.active=1 AND t.active=1`);
  if (template.recordset.length) return true;

  try {
    const image = await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), file.id)
      .query(`SELECT TOP 1 s.id FROM InstructionLearningSteps s JOIN InstructionTypes t ON t.companyId=s.companyId AND t.id=s.instructionTypeId
              WHERE s.companyId=@companyId AND s.imageFileId=@id AND s.status='published' AND t.active=1`);
    if (image.recordset.length) return true;
  } catch (err) {
    if (!/Invalid object name 'InstructionLearningSteps'/i.test(String(err.message || err))) throw err;
  }
  return false;
}

app.http('files', {
  methods: ['GET'], authLevel: 'anonymous', route: 'files/{id}/download',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.EMPLOYEE]);
      const id = request.params.id;
      const pool = await getPool();
      const result = await pool.request().input('companyId', sql.NVarChar(80), ctx.companyId).input('id', sql.NVarChar(80), id)
        .query(`SELECT id,fileName,blobPath,contentType,kind,status,scanStatus,sizeBytes,createdAt,linkedEntityType,linkedEntityId
                FROM Files WHERE companyId=@companyId AND id=@id`);
      const file = result.recordset[0];
      if (!file) return notFound('Datei nicht gefunden');
      if (file.status === 'blocked' || file.scanStatus === 'quarantined' || file.scanStatus === 'blocked') return forbidden('Datei ist gesperrt oder in Quarantäne. Download nicht erlaubt.');
      const access = await resolveEmployeeAccess(pool, ctx);
      if (!(await restrictedFileAllowed(pool, ctx, access, file))) return forbidden('Keine Berechtigung für diese Datei.');
      await writeAudit(pool, ctx, 'file.downloadRequested', 'file', id, { kind: file.kind, scanStatus: file.scanStatus });
      return json({ id:file.id,fileName:file.fileName,contentType:file.contentType,kind:file.kind,sizeBytes:file.sizeBytes,scanStatus:file.scanStatus,url:createReadSasUrl(file.blobPath,10) });
    } catch (err) { return serverError(err, context); }
  }
});
