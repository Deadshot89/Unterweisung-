import { app } from '@azure/functions';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { createReadSasUrl } from '../lib/blob.js';
import { saveCertificateHtml } from '../lib/certificate.js';
import { writeAudit } from '../lib/audit.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token || '').digest('hex');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function safeQuestion(row) {
  let options = [];
  try { options = JSON.parse(row.optionsJson || '[]'); } catch { options = []; }
  const optionObjects = options.map((text, originalIndex) => ({ text, answerIndex: originalIndex }));
  return { id: row.id, question: row.question, options: shuffle(optionObjects) };
}

function summariseTest(test) {
  const details = Array.isArray(test.details) ? test.details : [];
  const correctCount = details.filter(x => x.correct).length;
  const questionCount = details.length;
  return {
    correctCount,
    wrongCount: Math.max(0, questionCount - correctCount),
    questionCount
  };
}

async function loadInvitation(pool, tokenHash) {
  const result = await pool.request()
    .input('tokenHash', sql.NVarChar(128), tokenHash)
    .query(`SELECT TOP 1 i.*, c.name AS companyName, c.legalName, e.name AS employeeName,
                   t.name AS instructionName, t.description, t.intervalMonths,
                   tpl.title AS templateTitle, tpl.fileName AS templateFileName, tpl.blobPath AS templatePath
            FROM ExternalInvitations i
            JOIN Companies c ON c.id=i.companyId
            JOIN InstructionTypes t ON t.id=i.instructionTypeId AND t.companyId=i.companyId
            LEFT JOIN Employees e ON e.id=i.employeeId AND e.companyId=i.companyId
            LEFT JOIN Templates tpl ON tpl.id=t.templateId AND tpl.companyId=i.companyId
            WHERE i.tokenHash=@tokenHash`);
  return result.recordset[0];
}

function assertOpen(invitation) {
  if (!invitation) return { status: 404, error: 'Ungültiger Link' };
  if (new Date(invitation.expiresAt) < new Date()) return { status: 410, error: 'Link abgelaufen' };
  if (invitation.status === 'completed') return { status: 409, error: 'Unterweisung bereits abgeschlossen' };
  return null;
}

async function getRandomQuestions(pool, invitation) {
  if (!invitation.testRequired) return [];
  const qres = await pool.request()
    .input('companyId', sql.NVarChar(80), invitation.companyId)
    .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
    .input('language', sql.NVarChar(10), invitation.language || 'de')
    .query(`SELECT id, question, optionsJson
            FROM TestQuestions
            WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND active=1`);
  const poolQuestions = qres.recordset;
  const count = Math.min(poolQuestions.length, Math.max(5, Math.min(7, poolQuestions.length || 0)));
  return shuffle(poolQuestions).slice(0, count).map(safeQuestion);
}

function normaliseAnswers(body) {
  if (Array.isArray(body.answers)) return body.answers;
  if (body.answers && typeof body.answers === 'object') {
    return Object.entries(body.answers).map(([questionId, answerIndex]) => ({ questionId, answerIndex }));
  }
  return [];
}

async function evaluateTest(pool, invitation, body) {
  if (!invitation.testRequired) return { required: false, passed: true, scorePercent: null, details: [] };
  const answers = normaliseAnswers(body);
  if (!answers.length) return { required: true, passed: false, scorePercent: 0, details: [], error: 'answers required' };
  const ids = answers.map(a => String(a.questionId || '')).filter(Boolean);
  if (!ids.length) return { required: true, passed: false, scorePercent: 0, details: [], error: 'answers required' };
  const request = pool.request()
    .input('companyId', sql.NVarChar(80), invitation.companyId)
    .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
    .input('language', sql.NVarChar(10), invitation.language || 'de');
  ids.forEach((id, idx) => request.input(`id${idx}`, sql.NVarChar(80), id));
  const idList = ids.map((_, idx) => `@id${idx}`).join(',');
  const qres = await request.query(`SELECT id, question, optionsJson, correctIndex FROM TestQuestions
                                    WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND id IN (${idList})`);
  const qmap = new Map(qres.recordset.map(q => [q.id, q]));
  let correct = 0;
  const details = answers.map(a => {
    const q = qmap.get(String(a.questionId));
    const selected = Number(a.answerIndex);
    const isCorrect = q && selected === Number(q.correctIndex);
    if (isCorrect) correct++;
    return { questionId: a.questionId, selectedIndex: selected, correctIndex: q ? Number(q.correctIndex) : null, correct: !!isCorrect };
  });
  const scorePercent = answers.length ? Math.round((correct / answers.length) * 10000) / 100 : 0;
  return { required: true, passed: scorePercent >= Number(invitation.passPercent || 80), scorePercent, details, ...summariseTest({ details }) };
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
      const invitation = await loadInvitation(pool, tokenHash);
      const closed = assertOpen(invitation);
      if (closed) return json({ error: closed.error }, closed.status);

      if (request.method === 'GET') {
        await pool.request()
          .input('tokenHash', sql.NVarChar(128), tokenHash)
          .query(`UPDATE ExternalInvitations
                  SET startedAt=COALESCE(startedAt,SYSUTCDATETIME()), lastAccessedAt=SYSUTCDATETIME(),
                      status=CASE WHEN status='sent' THEN 'opened' ELSE status END
                  WHERE tokenHash=@tokenHash`);
        let templateUrl = null;
        if (invitation.templatePath) {
          try { templateUrl = createReadSasUrl(invitation.templatePath, 30); }
          catch { templateUrl = invitation.templateFileName ? `/vorlagen/${encodeURIComponent(invitation.templateFileName)}` : null; }
        }
        const questions = await getRandomQuestions(pool, invitation);
        return json({
          id: invitation.id,
          companyName: invitation.companyName,
          email: invitation.email,
          recipientName: invitation.recipientName || invitation.employeeName || invitation.email,
          employeeName: invitation.employeeName,
          instructionTypeId: invitation.instructionTypeId,
          instructionName: invitation.instructionName,
          description: invitation.description,
          intervalMonths: invitation.intervalMonths,
          language: invitation.language,
          expiresAt: invitation.expiresAt,
          testRequired: !!invitation.testRequired,
          passPercent: invitation.passPercent || 80,
          templateTitle: invitation.templateTitle,
          templateUrl,
          questions
        });
      }

      const body = await request.json();
      if (!body.confirmed) return badRequest('confirmed is required');

      const test = await evaluateTest(pool, invitation, body);
      if (test.error) return badRequest(test.error);
      const testSummary = summariseTest(test);

      const testResultId = crypto.randomUUID();
      if (test.required) {
        await pool.request()
          .input('id', sql.NVarChar(80), testResultId)
          .input('companyId', sql.NVarChar(80), invitation.companyId)
          .input('employeeId', sql.NVarChar(80), invitation.employeeId || null)
          .input('instructionTypeId', sql.NVarChar(80), invitation.instructionTypeId)
          .input('language', sql.NVarChar(10), invitation.language || 'de')
          .input('scorePercent', sql.Decimal(5,2), test.scorePercent)
          .input('passed', sql.Bit, test.passed ? 1 : 0)
          .input('answersJson', sql.NVarChar(sql.MAX), JSON.stringify(test.details))
          .input('externalInvitationId', sql.NVarChar(80), invitation.id)
          .input('createdBy', sql.NVarChar(120), `external:${invitation.email}`)
          .query(`INSERT INTO TestResults(id,companyId,employeeId,instructionTypeId,language,scorePercent,passed,answersJson,externalInvitationId,createdBy)
                  VALUES(@id,@companyId,@employeeId,@instructionTypeId,@language,@scorePercent,@passed,@answersJson,@externalInvitationId,@createdBy)`);
      }

      if (!test.passed) {
        await pool.request()
          .input('tokenHash', sql.NVarChar(128), tokenHash)
          .query("UPDATE ExternalInvitations SET status='failed', lastAccessedAt=SYSUTCDATETIME() WHERE tokenHash=@tokenHash");
        return json({
          ok: false,
          passed: false,
          scorePercent: test.scorePercent,
          passPercent: invitation.passPercent || 80,
          ...testSummary
        }, 200);
      }

      const intervalMonths = invitation.intervalMonths || 12;
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setMonth(validUntil.getMonth() + intervalMonths);
      const recordId = crypto.randomUUID();
      const ctx = {
        companyId: invitation.companyId,
        userId: `external:${invitation.email}`,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null
      };

      let certificate = null;
      try {
        certificate = await saveCertificateHtml(pool, ctx, {
          company: { name: invitation.companyName, legalName: invitation.legalName },
          employeeName: invitation.recipientName || invitation.employeeName,
          email: invitation.email,
          instructionName: invitation.instructionName,
          language: invitation.language,
          conductedAt: now,
          validUntil,
          scorePercent: test.scorePercent,
          passed: true,
          confirmationText: body.confirmationText || 'Teilnehmer hat die Unterweisung digital bestätigt.'
        });
      } catch (err) {
        context.warn?.('certificate creation skipped', err.message);
      }

      await pool.request()
        .input('id', sql.NVarChar(80), recordId)
        .input('companyId', sql.NVarChar(80), invitation.companyId)
        .input('employeeId', sql.NVarChar(80), invitation.employeeId || null)
        .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
        .input('conductedAt', sql.DateTime2, now)
        .input('validUntil', sql.DateTime2, validUntil)
        .input('status', sql.NVarChar(40), 'completed')
        .input('source', sql.NVarChar(40), 'external_link')
        .input('durationMinutes', sql.Int, body.durationMinutes || null)
        .input('confirmationText', sql.NVarChar(sql.MAX), body.confirmationText || 'Teilnehmer hat die Unterweisung digital bestätigt.')
        .input('certificateFileId', sql.NVarChar(80), certificate?.id || null)
        .input('createdBy', sql.NVarChar(120), `external:${invitation.email}`)
        .query(`INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source,durationMinutes,confirmationText,certificateFileId,createdBy)
                VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source,@durationMinutes,@confirmationText,@certificateFileId,@createdBy)`);

      if (test.required) {
        await pool.request()
          .input('id', sql.NVarChar(80), testResultId)
          .input('recordId', sql.NVarChar(80), recordId)
          .query('UPDATE TestResults SET linkedRecordId=@recordId WHERE id=@id');
      }

      await pool.request()
        .input('tokenHash', sql.NVarChar(128), tokenHash)
        .input('certificateFileId', sql.NVarChar(80), certificate?.id || null)
        .input('completedIp', sql.NVarChar(80), ctx.ipAddress)
        .input('completedUserAgent', sql.NVarChar(500), ctx.userAgent)
        .query(`UPDATE ExternalInvitations
                SET status='completed', completedAt=SYSUTCDATETIME(), certificateFileId=@certificateFileId,
                    completedIp=@completedIp, completedUserAgent=@completedUserAgent
                WHERE tokenHash=@tokenHash`);

      await writeAudit(pool, ctx, 'external.completed', 'externalInvitation', invitation.id, { recordId, scorePercent: test.scorePercent, ...testSummary });
      return json({
        ok: true,
        passed: true,
        scorePercent: test.scorePercent,
        passPercent: invitation.passPercent || 80,
        validUntil: validUntil.toISOString().slice(0,10),
        certificateFileId: certificate?.id || null,
        ...testSummary
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
