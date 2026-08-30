import { app } from '@azure/functions';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token || '').digest('hex');
}

app.http('externalInstruction', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'external/{token}',
  handler: async (request, context) => {
    try {
      const token = request.params.token;
      if (!token) return badRequest('token is required');
      const pool = await getPool();
      const tokenHash = hashToken(token);
      if (request.method === 'GET') {
        const result = await pool.request()
          .input('tokenHash', sql.NVarChar(128), tokenHash)
          .query(`SELECT TOP 1 i.id, i.email, i.employeeId, i.instructionTypeId, i.language, i.expiresAt, i.status,
                         t.name AS instructionName, t.description, t.intervalMonths, tpl.title AS templateTitle, tpl.blobPath AS templatePath
                  FROM ExternalInvitations i
                  JOIN InstructionTypes t ON t.id=i.instructionTypeId AND t.companyId=i.companyId
                  LEFT JOIN Templates tpl ON tpl.id=t.templateId AND tpl.companyId=i.companyId
                  WHERE i.tokenHash=@tokenHash`);
        const row = result.recordset[0];
        if (!row) return json({ error: 'Ungültiger Link' }, 404);
        if (new Date(row.expiresAt) < new Date()) return json({ error: 'Link abgelaufen' }, 410);
        if (row.status === 'completed') return json({ error: 'Unterweisung bereits abgeschlossen' }, 409);
        return json(row);
      }

      const body = await request.json();
      if (!body.confirmed) return badRequest('confirmed is required');
      const inv = await pool.request().input('tokenHash', sql.NVarChar(128), tokenHash)
        .query('SELECT TOP 1 * FROM ExternalInvitations WHERE tokenHash=@tokenHash');
      const invitation = inv.recordset[0];
      if (!invitation) return json({ error: 'Ungültiger Link' }, 404);
      if (new Date(invitation.expiresAt) < new Date()) return json({ error: 'Link abgelaufen' }, 410);
      if (invitation.status === 'completed') return json({ error: 'Bereits abgeschlossen' }, 409);

      const typeRes = await pool.request()
        .input('companyId', sql.NVarChar(80), invitation.companyId)
        .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
        .query('SELECT intervalMonths FROM InstructionTypes WHERE companyId=@companyId AND id=@typeId');
      const intervalMonths = typeRes.recordset[0]?.intervalMonths || 12;
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setMonth(validUntil.getMonth() + intervalMonths);

      await pool.request()
        .input('id', sql.NVarChar(80), crypto.randomUUID())
        .input('companyId', sql.NVarChar(80), invitation.companyId)
        .input('employeeId', sql.NVarChar(80), invitation.employeeId)
        .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
        .input('conductedAt', sql.DateTime2, now)
        .input('validUntil', sql.DateTime2, validUntil)
        .input('status', sql.NVarChar(40), 'completed')
        .input('source', sql.NVarChar(40), 'external_link')
        .input('durationMinutes', sql.Int, body.durationMinutes || null)
        .input('confirmationText', sql.NVarChar(sql.MAX), body.confirmationText || 'Teilnehmer hat die Unterweisung digital bestätigt.')
        .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,durationMinutes,confirmationText)
                VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source,@durationMinutes,@confirmationText)`);
      await pool.request().input('tokenHash', sql.NVarChar(128), tokenHash)
        .query("UPDATE ExternalInvitations SET status='completed', completedAt=SYSUTCDATETIME() WHERE tokenHash=@tokenHash");
      return json({ ok: true, validUntil: validUntil.toISOString().slice(0,10) });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
