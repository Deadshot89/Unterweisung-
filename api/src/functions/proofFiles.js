import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { uploadBufferToBlob } from '../lib/blob.js';
import { decodeBase64Upload, validateUploadedFile, blobPathForUpload, initialScanStatus } from '../lib/uploadSecurity.js';
import { resolveEmployeeScope, employeeAllowed, assertEmployeeAllowed, assertEmployeeIdsAllowed } from '../lib/employeeScope.js';

async function getRecord(pool, companyId, recordId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('recordId', sql.NVarChar(80), recordId)
    .query(`SELECT r.id,r.companyId,r.employeeId,r.typeId,r.groupId,e.name AS employeeName,t.name AS instructionName
            FROM InstructionRecords r
            LEFT JOIN Employees e ON e.companyId=r.companyId AND e.id=r.employeeId
            JOIN InstructionTypes t ON t.companyId=r.companyId AND t.id=r.typeId
            WHERE r.companyId=@companyId AND r.id=@recordId`);
  return result.recordset[0];
}

async function getGroupRecords(pool, companyId, groupId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('groupId', sql.NVarChar(80), groupId)
    .query(`SELECT id,employeeId FROM InstructionRecords WHERE companyId=@companyId AND groupId=@groupId`);
  return result.recordset || [];
}

function groupAllowed(scope, rows) {
  if (scope.mode === 'company') return true;
  const employeeIds = [...new Set(rows.map(row => row.employeeId).filter(Boolean))];
  if (scope.mode === 'self') return employeeIds.includes(scope.actorEmployeeId);
  assertEmployeeIdsAllowed(scope, employeeIds);
  return true;
}

async function assertLinkedEntityAllowed(pool, scope, companyId, linkedEntityType, linkedEntityId) {
  if (scope.mode === 'company') return;
  if (linkedEntityType === 'instruction_record') {
    const record = await getRecord(pool, companyId, linkedEntityId);
    if (!record) {
      const error = new Error('Unterweisungseintrag nicht gefunden');
      error.status = 404;
      throw error;
    }
    assertEmployeeAllowed(scope, record.employeeId);
    return;
  }
  if (linkedEntityType === 'instruction_group') {
    const rows = await getGroupRecords(pool, companyId, linkedEntityId);
    if (!rows.length) {
      const error = new Error('Gruppenunterweisung nicht gefunden');
      error.status = 404;
      throw error;
    }
    groupAllowed(scope, rows);
    return;
  }
  const error = new Error('Kein Zugriff auf diesen Nachweis.');
  error.status = 403;
  throw error;
}

async function filterProofRows(pool, scope, companyId, rows) {
  if (scope.mode === 'company') return rows;
  const records = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .query('SELECT id,employeeId,groupId FROM InstructionRecords WHERE companyId=@companyId');
  const byId = new Map(records.recordset.map(row => [row.id, row]));
  const byGroup = new Map();
  for (const row of records.recordset) {
    if (!row.groupId) continue;
    if (!byGroup.has(row.groupId)) byGroup.set(row.groupId, []);
    byGroup.get(row.groupId).push(row);
  }
  return rows.filter(file => {
    if (file.linkedEntityType === 'instruction_record') return employeeAllowed(scope, byId.get(file.linkedEntityId)?.employeeId);
    if (file.linkedEntityType === 'instruction_group') {
      const group = byGroup.get(file.linkedEntityId) || [];
      if (scope.mode === 'self') return group.some(row => row.employeeId === scope.actorEmployeeId);
      try { return groupAllowed(scope, group); } catch { return false; }
    }
    return false;
  });
}

async function insertFile(pool, ctx, file) {
  await pool.request()
    .input('id', sql.NVarChar(80), file.id)
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('kind', sql.NVarChar(60), file.kind)
    .input('fileName', sql.NVarChar(260), file.fileName)
    .input('originalFileName', sql.NVarChar(260), file.originalFileName)
    .input('blobPath', sql.NVarChar(500), file.blobPath)
    .input('contentType', sql.NVarChar(120), file.contentType)
    .input('sizeBytes', sql.BigInt, file.sizeBytes)
    .input('sha256', sql.NVarChar(128), file.sha256)
    .input('extension', sql.NVarChar(20), file.extension)
    .input('status', sql.NVarChar(40), file.status)
    .input('scanStatus', sql.NVarChar(40), file.scanStatus)
    .input('scanProvider', sql.NVarChar(120), file.scanProvider || null)
    .input('uploadedIp', sql.NVarChar(80), ctx.ipAddress || null)
    .input('uploadedUserAgent', sql.NVarChar(500), ctx.userAgent || null)
    .input('linkedEntityType', sql.NVarChar(80), file.linkedEntityType)
    .input('linkedEntityId', sql.NVarChar(80), file.linkedEntityId)
    .input('metadataJson', sql.NVarChar(sql.MAX), file.metadataJson ? JSON.stringify(file.metadataJson) : null)
    .input('createdBy', sql.NVarChar(120), ctx.userId)
    .query(`INSERT INTO Files(id,companyId,kind,fileName,originalFileName,blobPath,contentType,sizeBytes,sha256,extension,status,scanStatus,scanProvider,uploadedIp,uploadedUserAgent,linkedEntityType,linkedEntityId,metadataJson,createdBy)
            VALUES(@id,@companyId,@kind,@fileName,@originalFileName,@blobPath,@contentType,@sizeBytes,@sha256,@extension,@status,@scanStatus,@scanProvider,@uploadedIp,@uploadedUserAgent,@linkedEntityType,@linkedEntityId,@metadataJson,@createdBy)`);
}

app.http('proofFiles', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'proof-files/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const recordId = url.searchParams.get('recordId');
        const groupId = url.searchParams.get('groupId');
        if (recordId) {
          const record = await getRecord(pool, ctx.companyId, recordId);
          if (!record) return notFound('Unterweisungseintrag nicht gefunden');
          assertEmployeeAllowed(scope, record.employeeId);
        }
        if (groupId) {
          const group = await getGroupRecords(pool, ctx.companyId, groupId);
          if (!group.length) return notFound('Gruppenunterweisung nicht gefunden');
          groupAllowed(scope, group);
        }
        const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId);
        let where = `WHERE companyId=@companyId AND kind='proof'`;
        if (recordId) { req.input('recordId', sql.NVarChar(80), recordId); where += ` AND linkedEntityType='instruction_record' AND linkedEntityId=@recordId`; }
        if (groupId) { req.input('groupId', sql.NVarChar(80), groupId); where += ` AND linkedEntityType='instruction_group' AND linkedEntityId=@groupId`; }
        const result = await req.query(`SELECT TOP 200 id,fileName,originalFileName,contentType,sizeBytes,sha256,status,scanStatus,linkedEntityType,linkedEntityId,createdAt,createdBy
                                        FROM Files ${where} ORDER BY createdAt DESC`);
        return json(await filterProofRows(pool, scope, ctx.companyId, result.recordset));
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);

      if (request.method === 'PATCH') {
        const id = request.params.id;
        if (!id) return badRequest('id is required');
        const target = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('id', sql.NVarChar(80), id)
          .query(`SELECT TOP 1 id,linkedEntityType,linkedEntityId FROM Files WHERE companyId=@companyId AND id=@id AND kind='proof'`);
        const file = target.recordset[0];
        if (!file) return notFound('Nachweis nicht gefunden');
        await assertLinkedEntityAllowed(pool, scope, ctx.companyId, file.linkedEntityType, file.linkedEntityId);
        const body = await request.json();
        const allowed = new Set(['pending','clean','not_configured','quarantined','blocked']);
        const scanStatus = String(body.scanStatus || '').toLowerCase();
        if (!allowed.has(scanStatus)) return badRequest('scanStatus nicht erlaubt');
        await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('id', sql.NVarChar(80), id)
          .input('scanStatus', sql.NVarChar(40), scanStatus)
          .input('status', sql.NVarChar(40), scanStatus === 'quarantined' || scanStatus === 'blocked' ? 'blocked' : 'active')
          .input('scanProvider', sql.NVarChar(120), body.scanProvider || process.env.UPLOAD_SCAN_PROVIDER || null)
          .query(`UPDATE Files SET scanStatus=@scanStatus,status=@status,scanProvider=@scanProvider,scanCheckedAt=SYSUTCDATETIME()
                  WHERE companyId=@companyId AND id=@id`);
        await writeAudit(pool, ctx, 'file.scanStatusUpdated', 'file', id, { scanStatus });
        return json({ ok: true });
      }

      const body = await request.json();
      const recordId = body.recordId || null;
      const groupId = body.groupId || null;
      if (!recordId && !groupId) return badRequest('recordId oder groupId ist erforderlich');
      if (!body.fileName) return badRequest('fileName ist erforderlich');

      let record = null;
      let recordsToUpdate = [];
      if (recordId) {
        record = await getRecord(pool, ctx.companyId, recordId);
        if (!record) return notFound('Unterweisungseintrag nicht gefunden');
        assertEmployeeAllowed(scope, record.employeeId);
        recordsToUpdate = [{ id: record.id, employeeId: record.employeeId }];
      }
      if (groupId) {
        recordsToUpdate = await getGroupRecords(pool, ctx.companyId, groupId);
        if (!recordsToUpdate.length) return notFound('Gruppenunterweisung nicht gefunden');
        groupAllowed(scope, recordsToUpdate);
      }

      const buffer = decodeBase64Upload(body);
      const validation = validateUploadedFile({ fileName: body.fileName, contentType: body.contentType, buffer });
      const fileId = uuidv4();
      const linkedEntityType = groupId ? 'instruction_group' : 'instruction_record';
      const linkedEntityId = groupId || recordId;
      const blobPath = blobPathForUpload({ companyId: ctx.companyId, kind: 'proof', fileId, fileName: validation.safeName });
      const scanStatus = initialScanStatus();

      await uploadBufferToBlob(blobPath, buffer, validation.contentType, {
        metadata: {
          companyId: ctx.companyId,
          kind: 'proof',
          fileId,
          sha256: validation.sha256,
          uploadedBy: String(ctx.userId || '').slice(0, 100)
        },
        tags: {
          companyId: ctx.companyId.slice(0, 128),
          kind: 'proof',
          scanStatus: scanStatus.slice(0, 128)
        }
      });

      const file = {
        id: fileId,
        kind: 'proof',
        fileName: validation.safeName,
        originalFileName: body.fileName,
        blobPath,
        contentType: validation.contentType,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256,
        extension: validation.extension,
        status: 'active',
        scanStatus,
        scanProvider: process.env.UPLOAD_SCAN_PROVIDER || null,
        linkedEntityType,
        linkedEntityId,
        metadataJson: { recordId, groupId, detectedExtension: validation.detectedExtension, applyToGroup: !!groupId }
      };
      await insertFile(pool, ctx, file);

      for (const r of recordsToUpdate) {
        await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('recordId', sql.NVarChar(80), r.id)
          .input('fileId', sql.NVarChar(80), fileId)
          .query('UPDATE InstructionRecords SET certificateFileId=@fileId WHERE companyId=@companyId AND id=@recordId');
      }

      await writeAudit(pool, ctx, 'proof.uploaded', linkedEntityType, linkedEntityId, {
        fileId,
        fileName: validation.safeName,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256,
        recordsUpdated: recordsToUpdate.length,
        scanStatus
      });
      return json({ id: fileId, fileName: validation.safeName, contentType: validation.contentType, sizeBytes: validation.sizeBytes, sha256: validation.sha256, scanStatus, recordsUpdated: recordsToUpdate.length }, 201);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
