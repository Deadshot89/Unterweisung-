import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext } from '../lib/auth.js';

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

app.http('invitations', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invitations',
  handler: async (request, context) => {
    try {
      const { companyId, userId } = getRequestContext(request);
      const body = await request.json();
      if (!body.email || !body.instructionTypeId) return badRequest('email and instructionTypeId are required');
      const pool = await getPool();
      const id = uuidv4();
      const token = makeToken();
      const publicBase = process.env.PUBLIC_BASE_URL || 'http://localhost:4280';
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), companyId)
        .input('tokenHash', sql.NVarChar(128), crypto.createHash('sha256').update(token).digest('hex'))
        .input('email', sql.NVarChar(254), body.email)
        .input('employeeId', sql.NVarChar(80), body.employeeId || null)
        .input('instructionTypeId', sql.NVarChar(80), body.instructionTypeId)
        .input('language', sql.NVarChar(10), body.language || 'de')
        .input('expiresAt', sql.DateTime2, body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 14*24*3600*1000))
        .input('createdBy', sql.NVarChar(120), userId)
        .query(`INSERT INTO ExternalInvitations(id,companyId,tokenHash,email,employeeId,instructionTypeId,language,expiresAt,createdBy,status)
                VALUES(@id,@companyId,@tokenHash,@email,@employeeId,@instructionTypeId,@language,@expiresAt,@createdBy,'sent')`);
      return json({ id, url: `${publicBase}/external/instruction.html?t=${token}` }, 201);
    } catch (err) {
      return serverError(err, context);
    }
  }
});
