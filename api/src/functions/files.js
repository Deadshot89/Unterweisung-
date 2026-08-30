import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, notFound, forbidden, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { createReadSasUrl } from '../lib/blob.js';
import { writeAudit } from '../lib/audit.js';

app.http('files', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'files/{id}/download',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const id = request.params.id;
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id)
        .query(`SELECT id,fileName,blobPath,contentType,kind,status,scanStatus,sizeBytes,createdAt
                FROM Files WHERE companyId=@companyId AND id=@id`);
      const file = result.recordset[0];
      if (!file) return notFound('Datei nicht gefunden');
      if (file.status === 'blocked' || file.scanStatus === 'quarantined' || file.scanStatus === 'blocked') {
        return forbidden('Datei ist gesperrt oder in Quarantäne. Download nicht erlaubt.');
      }
      await writeAudit(pool, ctx, 'file.downloadRequested', 'file', id, { kind: file.kind, scanStatus: file.scanStatus });
      return json({ id: file.id, fileName: file.fileName, contentType: file.contentType, kind: file.kind, sizeBytes: file.sizeBytes, scanStatus: file.scanStatus, url: createReadSasUrl(file.blobPath, 10) });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
