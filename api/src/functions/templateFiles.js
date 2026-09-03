import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { createReadSasUrl, uploadBufferToBlob } from '../lib/blob.js';
import { createAnalysisJob, publicAnalysis } from '../lib/instruction-analysis/store.js';
import { writeAudit } from '../lib/audit.js';
import { decodeBase64Upload, validateUploadedFile, sanitizeFileName, initialScanStatus } from '../lib/uploadSecurity.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function templateBlobPath({ companyId, templateId, safeName }) {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `templates/${companyId}/${yyyy}/${mm}/${templateId}_${uuidv4()}_${sanitizeFileName(safeName)}`;
}

async function instructionTypeExists(pool, companyId, instructionTypeId) {
  if (!instructionTypeId) return true;
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .query('SELECT TOP 1 id FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId');
  return !!result.recordset.length;
}

async function upsertFile(pool, ctx, file) {
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
    .input('metadataJson', sql.NVarChar(sql.MAX), JSON.stringify(file.metadataJson || {}))
    .input('createdBy', sql.NVarChar(120), ctx.userId)
    .query(`MERGE Files AS t
            USING (SELECT @id AS id, @companyId AS companyId) AS s ON t.id=s.id AND t.companyId=s.companyId
            WHEN MATCHED THEN UPDATE SET
              kind=@kind,
              fileName=@fileName,
              originalFileName=@originalFileName,
              blobPath=@blobPath,
              contentType=@contentType,
              sizeBytes=@sizeBytes,
              sha256=@sha256,
              extension=@extension,
              status=@status,
              scanStatus=@scanStatus,
              scanProvider=@scanProvider,
              uploadedIp=@uploadedIp,
              uploadedUserAgent=@uploadedUserAgent,
              linkedEntityType=@linkedEntityType,
              linkedEntityId=@linkedEntityId,
              metadataJson=@metadataJson,
              createdBy=@createdBy
            WHEN NOT MATCHED THEN INSERT(id,companyId,kind,fileName,originalFileName,blobPath,contentType,sizeBytes,sha256,extension,status,scanStatus,scanProvider,uploadedIp,uploadedUserAgent,linkedEntityType,linkedEntityId,metadataJson,createdBy)
              VALUES(@id,@companyId,@kind,@fileName,@originalFileName,@blobPath,@contentType,@sizeBytes,@sha256,@extension,@status,@scanStatus,@scanProvider,@uploadedIp,@uploadedUserAgent,@linkedEntityType,@linkedEntityId,@metadataJson,@createdBy);`);
}

app.http('templateDownload', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'templates/{id}/download',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const id = request.params.id;
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id)
        .query('SELECT id,title,fileName,blobPath FROM Templates WHERE companyId=@companyId AND id=@id AND active=1');
      const row = result.recordset[0];
      if (!row) return notFound('Vorlage nicht gefunden');
      const url = createReadSasUrl(row.blobPath, 10);
      return json({ id: row.id, title: row.title, fileName: row.fileName, url, expiresInMinutes: 10 });
    } catch (err) {
      return serverError(err, context);
    }
  }
});

app.http('templateUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'templates/upload',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE]);
      const pool = await getPool();
      const body = await request.json();

      if (!body.fileName) return badRequest('fileName ist erforderlich');
      const title = clean(body.title, 240) || clean(body.fileName, 240);
      if (!title) return badRequest('Titel ist erforderlich');
      const category = clean(body.category, 120) || 'Allgemein';
      const description = clean(body.description, 4000);
      let instructionTypeId = clean(body.instructionTypeId, 80);
      const createInstruction = body.createInstruction === true;
      const analyse = body.analyse === true || createInstruction;
      const language = String(body.language || 'de').toLowerCase();
      if (analyse && !['de','en','pl'].includes(language)) return badRequest('Analysesprache ungültig.');
      if (analyse && !createInstruction && !instructionTypeId) return badRequest('Unterweisung für die Analyse fehlt.');
      if (!(await instructionTypeExists(pool, ctx.companyId, instructionTypeId))) return notFound('Unterweisungstyp nicht gefunden');

      const buffer = decodeBase64Upload(body);
      const validation = validateUploadedFile({ fileName: body.fileName, contentType: body.contentType, buffer });
      const templateId = (analyse ? null : clean(body.templateId, 80)) || `tpl-${uuidv4()}`;
      const blobPath = templateBlobPath({ companyId: ctx.companyId, templateId, safeName: validation.safeName });
      const scanStatus = initialScanStatus();

      await uploadBufferToBlob(blobPath, buffer, validation.contentType, {
        kind: 'template',
        metadata: {
          companyId: ctx.companyId,
          kind: 'template',
          templateId,
          sha256: validation.sha256,
          uploadedBy: String(ctx.userId || '').slice(0, 100)
        },
        tags: {
          companyId: ctx.companyId.slice(0, 128),
          kind: 'template',
          scanStatus: scanStatus.slice(0, 128)
        }
      });

      await pool.request()
        .input('id', sql.NVarChar(80), templateId)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('title', sql.NVarChar(240), title)
        .input('fileName', sql.NVarChar(260), validation.safeName)
        .input('blobPath', sql.NVarChar(500), blobPath)
        .input('category', sql.NVarChar(120), category)
        .input('description', sql.NVarChar(sql.MAX), description)
        .query(`MERGE Templates AS t
                USING (SELECT @id AS id, @companyId AS companyId) AS s ON t.id=s.id AND t.companyId=s.companyId
                WHEN MATCHED THEN UPDATE SET title=@title,fileName=@fileName,blobPath=@blobPath,category=@category,description=@description,active=1
                WHEN NOT MATCHED THEN INSERT(id,companyId,title,fileName,blobPath,category,description,active)
                  VALUES(@id,@companyId,@title,@fileName,@blobPath,@category,@description,1);`);

      await upsertFile(pool, ctx, {
        id: templateId,
        kind: 'template',
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
        linkedEntityType: instructionTypeId ? 'instruction_type' : 'template',
        linkedEntityId: instructionTypeId || templateId,
        metadataJson: { instructionTypeId, detectedExtension: validation.detectedExtension }
      });

      if (createInstruction) {
        instructionTypeId = `type-${uuidv4()}`;
        await pool.request().input('id', sql.NVarChar(80), instructionTypeId).input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('name', sql.NVarChar(200), title.slice(0,200)).input('category', sql.NVarChar(120), category)
          .query('INSERT INTO InstructionTypes(id,companyId,name,category,intervalMonths,active) VALUES(@id,@companyId,@name,@category,12,0)');
      }
      // Analysed uploads get a new private source version; publication links it atomically.
      if (instructionTypeId && !analyse) {
        await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
          .input('templateId', sql.NVarChar(80), templateId)
          .query('UPDATE InstructionTypes SET templateId=@templateId, updatedAt=SYSUTCDATETIME() WHERE companyId=@companyId AND id=@instructionTypeId');
      }

      await writeAudit(pool, ctx, 'template.uploaded', 'template', templateId, {
        title,
        category,
        instructionTypeId,
        fileName: validation.safeName,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256,
        scanStatus
      });

      let analysis = null;
      let analysisError = null;
      if (analyse) {
        try { analysis = publicAnalysis(await createAnalysisJob(pool, ctx, { templateId, instructionTypeId, sha256: validation.sha256, blobPath, fileName: validation.safeName, contentType: validation.contentType, title, language }, buffer)); }
        catch { analysisError = 'Die Unterlage wurde gespeichert, der Analyseauftrag konnte jedoch nicht angelegt werden. Bitte erneut zu dieser Unterweisung hochladen.'; }
      }
      return json({
        ok: true, analysis, analysisError,
        id: templateId,
        templateId,
        title,
        fileName: validation.safeName,
        blobPath,
        contentType: validation.contentType,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256,
        scanStatus,
        instructionTypeId: instructionTypeId || null
      }, 201);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
