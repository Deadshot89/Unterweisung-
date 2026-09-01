import { app } from '@azure/functions';
import { json } from '../lib/http.js';
import { getPool, isDbConfigured } from '../lib/db.js';
import { ensureConfiguredContainers } from '../lib/blob.js';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    const info = {
      ok: true,
      service: 'unterweisungsmanager-api',
      version: '0.9.0',
      database: 'not_configured',
      blobStorage: 'not_configured'
    };

    if (isDbConfigured()) {
      try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS ok');
        info.database = 'ok';
      } catch (err) {
        info.ok = false;
        info.database = 'error: ' + err.message;
      }
    }

    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      try {
        const containers = await ensureConfiguredContainers();
        info.blobStorage = 'ok: ' + containers.join(',');
      } catch (err) {
        info.ok = false;
        info.blobStorage = 'error: ' + err.message;
      }
    }

    return json(info, info.ok ? 200 : 503);
  }
});
