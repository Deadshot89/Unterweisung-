import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, notFound, serverError } from '../lib/http.js';
import { getRequestContext } from '../lib/auth.js';
import { createReadSasUrl } from '../lib/blob.js';

app.http('files', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'files/{id}/download',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const id = request.params.id;
      const pool = await getPool();
      const result = await pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id)
        .query('SELECT id,fileName,blobPath,contentType,kind FROM Files WHERE companyId=@companyId AND id=@id');
      const file = result.recordset[0];
      if (!file) return notFound('Datei nicht gefunden');
      return json({ id: file.id, fileName: file.fileName, contentType: file.contentType, kind: file.kind, url: createReadSasUrl(file.blobPath, 10) });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
