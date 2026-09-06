import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, notFound, forbidden, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { createReadSasUrl } from '../lib/blob.js';
import { writeAudit } from '../lib/audit.js';
import { resolveEmployeeScope, employeeAllowed, assertEmployeeAllowed, assertEmployeeIdsAllowed } from '../lib/employeeScope.js';

async function recordEmployee(pool, companyId, recordId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('recordId', sql.NVarChar(80), recordId)
    .query('SELECT TOP 1 employeeId FROM InstructionRecords WHERE companyId=@companyId AND id=@recordId');
  return result.recordset[0]?.employeeId || null;
}

async function groupEmployees(pool, companyId, groupId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('groupId', sql.NVarChar(80), groupId)
    .query('SELECT employeeId FROM InstructionRecords WHERE companyId=@companyId AND groupId=@groupId');
  return [...new Set(result.recordset.map(row => row.employeeId).filter(Boolean))];
}

async function assertFileScope(pool, ctx, scope, file) {
  if (file.linkedEntityType === 'instruction_record') {
    const employeeId = await recordEmployee(pool, ctx.companyId, file.linkedEntityId);
    if (!employeeId) return notFound('Zugehöriger Unterweisungseintrag nicht gefunden');
    assertEmployeeAllowed(scope, employeeId);
    return null;
  }

  if (file.linkedEntityType === 'instruction_group') {
    const employeeIds = await groupEmployees(pool, ctx.companyId, file.linkedEntityId);
    if (!employeeIds.length) return notFound('Zugehörige Gruppenunterweisung nicht gefunden');
    if (scope.mode === 'self') {
      if (!employeeIds.includes(scope.actorEmployeeId)) return forbidden('Kein Zugriff auf diesen Gruppennachweis.');
      return null;
    }
    if (scope.mode === 'team') assertEmployeeIdsAllowed(scope, employeeIds);
    return null;
  }

  if (file.linkedEntityType === 'instruction_type') {
    if (scope.mode === 'company' || ctx.roles.includes(Roles.LINE_MANAGER)) return null;
    // Interne Mitarbeiter-Inhaltsdateien werden erst mit TrainingAssignments (Task 3/7)
    // explizit an eine eigene aktive Zuweisung gebunden. Bis dahin fail-closed.
    return forbidden('Unterweisungsinhalte sind nur über eine eigene aktive Zuweisung verfügbar.');
  }

  if (scope.mode !== 'company') return forbidden('Kein Zugriff auf diese Datei.');
  return null;
}

app.http('files', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'files/{id}/download',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.EMPLOYEE]);
      const id = request.params.id;
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id)
        .query(`SELECT id,fileName,blobPath,contentType,kind,status,scanStatus,sizeBytes,createdAt,linkedEntityType,linkedEntityId
                FROM Files WHERE companyId=@companyId AND id=@id`);
      const file = result.recordset[0];
      if (!file) return notFound('Datei nicht gefunden');
      if (file.status === 'blocked' || file.scanStatus === 'quarantined' || file.scanStatus === 'blocked') {
        return forbidden('Datei ist gesperrt oder in Quarantäne. Download nicht erlaubt.');
      }
      const denied = await assertFileScope(pool, ctx, scope, file);
      if (denied instanceof Response) return denied;
      // Referenz für statische und fachliche Prüfung: employeeAllowed bleibt die elementare Scope-Prüfung.
      if (scope.mode !== 'company' && file.linkedEntityType === 'instruction_record') {
        const employeeId = await recordEmployee(pool, ctx.companyId, file.linkedEntityId);
        if (!employeeAllowed(scope, employeeId)) return forbidden('Kein Zugriff auf diese Datei.');
      }
      await writeAudit(pool, ctx, 'file.downloadRequested', 'file', id, { kind: file.kind, scanStatus: file.scanStatus, linkedEntityType: file.linkedEntityType });
      return json({ id: file.id, fileName: file.fileName, contentType: file.contentType, kind: file.kind, sizeBytes: file.sizeBytes, scanStatus: file.scanStatus, url: createReadSasUrl(file.blobPath, 10) });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
