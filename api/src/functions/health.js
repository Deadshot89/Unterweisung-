import { app } from '@azure/functions';
import { json } from '../lib/http.js';
import { getPool } from '../lib/db.js';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    const info = { ok: true, service: 'unterweisungsmanager-api', version: '0.2.0', database: 'not_checked' };
    if (process.env.SQL_CONNECTION_STRING) {
      try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS ok');
        info.database = 'ok';
      } catch (err) {
        info.ok = false;
        info.database = 'error: ' + err.message;
      }
    }
    return json(info, info.ok ? 200 : 503);
  }
});
