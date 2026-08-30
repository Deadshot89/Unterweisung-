import { app } from '@azure/functions';
import { json } from '../lib/http.js';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => json({ ok: true, service: 'unterweisungsmanager-api', version: '0.1.0' })
});
