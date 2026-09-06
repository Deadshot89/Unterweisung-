import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { sendGraphMail, buildExternalInvitationMail } from '../lib/graphMail.js';
import { writeMailLog } from '../lib/mailLog.js';
import { resolveEmployeeScope, employeeAllowed, assertEmployeeAllowed } from '../lib/employeeScope.js';

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:4280').replace(/\/$/, '');
}

function forbidden(message = 'Keine Berechtigung für diese Einladung.') {
  const error = new Error(message);
  error.status = 403;
  throw error;
}

function invitationAllowed(scope, ctx, row) {
  if (scope.mode === 'company') return true;
  if (row?.employeeId) return employeeAllowed(scope, row.employeeId);
  return scope.mode === 'team' && row?.createdBy === ctx.userId;
}

app.http('invitations', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'invitations/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const scope = await resolveEmployeeScope(pool, ctx);

      if (request.method === 'GET') {
        const result = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .query(`SELECT TOP 300
                    vi.id,
                    vi.email,
                    vi.recipientName,
                    vi.employeeId,
                    vi.employeeName,
                    vi.instructionTypeId,
                    vi.instructionName,
                    vi.category,
                    vi.language,
                    vi.status,
                    vi.expiresAt,
                    vi.startedAt,
                    vi.completedAt,
                    vi.testRequired,
                    vi.passPercent,
                    vi.certificateFileId,
                    vi.certificateFileName,
                    vi.createdAt,
                    vi.createdBy,
                    tr.id AS testResultId,
                    tr.scorePercent,
                    tr.passed,
                    tr.createdAt AS testCompletedAt,
                    tr.linkedRecordId,
                    CASE
                      WHEN tr.answersJson IS NULL THEN NULL
                      ELSE (LEN(tr.answersJson) - LEN(REPLACE(tr.answersJson, '"questionId"', ''))) / LEN('"questionId"')
                    END AS answeredQuestions
                  FROM vExternalInvitations vi
                  OUTER APPLY (
                    SELECT TOP 1 id, scorePercent, passed, createdAt, linkedRecordId, answersJson
                    FROM TestResults tr
                    WHERE tr.companyId=vi.companyId AND tr.externalInvitationId=vi.id
                    ORDER BY tr.createdAt DESC
                  ) tr
                  WHERE vi.companyId=@companyId
                  ORDER BY vi.createdAt DESC`);
        return json(result.recordset.filter(row => invitationAllowed(scope, ctx, row)));
      }

      assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
      const body = await request.json();

      if (request.method === 'POST') {
        if (!body.email || !body.instructionTypeId) return badRequest('email and instructionTypeId are required');
        if (body.employeeId) assertEmployeeAllowed(scope, body.employeeId);
        const id = body.id || uuidv4();
        const token = makeToken();
        const publicBase = publicBaseUrl();
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + Number(body.validDays || 14) * 24 * 3600 * 1000);
        if (Number.isNaN(expiresAt.getTime())) return badRequest('expiresAt ist ungültig');
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
        await writeAudit(pool, ctx, 'invitation.created', 'externalInvitation', id, { employeeId: body.employeeId || null, instructionTypeId: body.instructionTypeId });
        const url = `${publicBase}/external/instruction.html?t=${token}`;
        let mail = null;
        if (body.sendMail === true || body.sendMail === 'true') {
          const detail = await pool.request()
            .input('companyId', sql.NVarChar(80), ctx.companyId)
            .input('typeId', sql.NVarChar(80), body.instructionTypeId)
            .input('employeeId', sql.NVarChar(80), body.employeeId || null)
            .query(`SELECT c.name AS companyName, c.legalName, t.name AS instructionName, e.name AS employeeName
                    FROM Companies c
                    JOIN InstructionTypes t ON t.companyId=c.id AND t.id=@typeId
                    LEFT JOIN Employees e ON e.companyId=c.id AND e.id=@employeeId
                    WHERE c.id=@companyId`);
          const d = detail.recordset[0] || {};
          const message = buildExternalInvitationMail({
            companyName: d.companyName || d.legalName,
            recipientName: body.recipientName || body.name || d.employeeName,
            instructionName: d.instructionName,
            language: body.language || 'de',
            url,
            expiresAt,
            testRequired: body.testRequired === false ? false : true,
            passPercent: Number(body.passPercent || 80)
          });
          try {
            const sent = await sendGraphMail({ to: body.email, cc: process.env.MAIL_HSE_CC || '', subject: message.subject, html: message.html, text: message.text });
            await pool.request()
              .input('id', sql.NVarChar(80), id)
              .input('companyId', sql.NVarChar(80), ctx.companyId)
              .query('UPDATE ExternalInvitations SET mailSentAt=SYSUTCDATETIME(), mailError=NULL WHERE id=@id AND companyId=@companyId');
            await writeMailLog(pool, ctx, { companyId: ctx.companyId, relatedEntityType: 'externalInvitation', relatedEntityId: id, fromEmail: sent.from, to: sent.to, cc: sent.cc, subject: message.subject, bodyPreview: message.text, status: 'sent' });
            mail = { sent: true };
          } catch (mailErr) {
            await pool.request()
              .input('id', sql.NVarChar(80), id)
              .input('companyId', sql.NVarChar(80), ctx.companyId)
              .input('mailError', sql.NVarChar(1000), String(mailErr.message || mailErr).slice(0, 1000))
              .query('UPDATE ExternalInvitations SET mailError=@mailError WHERE id=@id AND companyId=@companyId');
            await writeMailLog(pool, ctx, { companyId: ctx.companyId, relatedEntityType: 'externalInvitation', relatedEntityId: id, to: body.email, subject: message.subject, bodyPreview: message.text, status: 'failed', errorMessage: mailErr.message || String(mailErr) });
            mail = { sent: false, error: mailErr.message };
          }
        }
        return json({ id, url, expiresAt: expiresAt.toISOString(), mail }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      const target = await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query('SELECT TOP 1 id,employeeId,createdBy,status FROM ExternalInvitations WHERE id=@id AND companyId=@companyId');
      const targetRow = target.recordset[0];
      if (!targetRow) return notFound('Einladung nicht gefunden.');
      if (!invitationAllowed(scope, ctx, targetRow)) forbidden();
      const status = body.status || 'cancelled';
      if (!['cancelled','sent','opened','failed'].includes(status)) return badRequest('invalid status');
      await pool.request()
        .input('id', sql.NVarChar(80), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('status', sql.NVarChar(40), status)
        .query(`UPDATE ExternalInvitations SET status=@status WHERE id=@id AND companyId=@companyId AND status<>'completed'`);
      await writeAudit(pool, ctx, 'invitation.updated', 'externalInvitation', id, { status, employeeId: targetRow.employeeId || null });
      return json({ ok: true });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
