import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getRequestContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

app.http('invitations', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'invitations/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = getRequestContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT TOP 300 id,email,recipientName,employeeId,employeeName,instructionTypeId,instructionName,category,language,status,expiresAt,startedAt,completedAt,testRequired,passPercent,certificateFileId,certificateFileName,createdAt
                  FROM vExternalInvitations
                  WHERE companyId=@companyId
                  ORDER BY createdAt DESC`);
        return json(result.recordset);
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();

      if (request.method === 'POST') {
        if (!body.email || !body.instructionTypeId) return badRequest('email and instructionTypeId are required');
        const id = body.id || uuidv4();
        const token = makeToken();
        const publicBase = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:4280';
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + Number(body.validDays || 14) * 24 * 3600 * 1000);
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('tokenHash', sql.NVarChar(128), hashToken(token))
          .input('email', sql.NVarChar(254), body.email)
          .input('recipientName', sql.NVarChar(200), body.recipientName || body.name || null)
          .input('employeeId', sql.NVarChar(80), body.employeeId || null)
          .input('instructionTypeId', sql.NVarChar(80), body.instructionTypeId)
          .input('language', sql.NVarChar(10), body.language || 'de')
          .input('expiresAt', sql.DateTime2, expiresAt)
          .input('testRequired', sql.Bit, body.testRequired === false ? 0 : 1)
          .input('passPercent', sql.Int, Number(body.passPercent || 80))
          .input('createdBy', sql.NVarChar(120), ctx.userId)
          .query(`INSERT INTO ExternalInvitations(id,companyId,tokenHash,email,recipientName,employeeId,instructionTypeId,language,expiresAt,createdBy,status,testRequired,passPercent)
                  VALUES(@id,@companyId,@tokenHash,@email,@recipientName,@employeeId,@instructionTypeId,@language,@expiresAt,@createdBy,'sent',@testRequired,@passPercent)`);
        await writeAudit(pool, ctx, 'invitation.created', 'externalInvitation', id, { email: body.email, instructionTypeId: body.instructionTypeId });
        return json({ id, url: `${publicBase}/external/instruction.html?t=${token}`, expiresAt: expiresAt.toISOString() }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      const status = body.status || 'cancelled';
      if (!['cancelled','sent','opened','failed'].includes(status)) return badRequest('invalid status');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('status', sql.NVarChar(40), status)
        .query(`UPDATE ExternalInvitations SET status=@status WHERE id=@id AND companyId=@companyId AND status<>'completed'`);
      await writeAudit(pool, ctx, 'invitation.updated', 'externalInvitation', id, { status });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
