import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext } from '../lib/auth.js';
import { createReadSasUrl } from '../lib/blob.js';

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
