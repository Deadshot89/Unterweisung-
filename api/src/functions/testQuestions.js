import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, notFound, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { currentQuestionVersions } from '../lib/question-order.js';

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function normaliseLanguage(value) {
  const lang = String(value || 'de').trim().toLowerCase();
  return ['de', 'en', 'pl'].includes(lang) ? lang : 'de';
}

function normaliseOptions(body) {
  const raw = Array.isArray(body.options) ? body.options : [body.optionA, body.optionB, body.optionC, body.optionD];
  const options = raw.map(x => clean(x, 600)).filter(Boolean);
  if (options.length < 2) return { error: 'Mindestens zwei Antworten sind erforderlich.' };
  if (options.length > 6) return { error: 'Maximal sechs Antworten sind erlaubt.' };
  return { options };
}

function normaliseCorrectIndex(body, options) {
  const idx = Number(body.correctIndex ?? body.answerIndex ?? 0);
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
    return { error: 'Richtige Antwort ist außerhalb der Antwortliste.' };
  }
  return { correctIndex: idx };
}

async function instructionTypeExists(pool, companyId, instructionTypeId) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
    .query('SELECT TOP 1 id FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId');
  return !!result.recordset.length;
}

async function questionExists(pool, companyId, id) {
  const result = await pool.request()
    .input('companyId', sql.NVarChar(80), companyId)
    .input('id', sql.NVarChar(80), id)
    .query('SELECT TOP 1 id FROM TestQuestions WHERE companyId=@companyId AND id=@id');
  return !!result.recordset.length;
}

function mapQuestion(row) {
  let options = [];
  try { options = JSON.parse(row.optionsJson || '[]'); } catch { options = []; }
  return {
    id: row.id,
    companyId: row.companyId,
    instructionTypeId: row.instructionTypeId,
    instructionName: row.instructionName,
    language: row.language,
    question: row.question,
    options,
    correctIndex: row.correctIndex,
    active: row.active !== false && row.active !== 0,
    updatedAt: row.updatedAt || null
  };
}

app.http('testQuestions', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'test-questions/{id?}',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();

      if (request.method === 'GET') {
        assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
        const url = new URL(request.url);
        const typeId = clean(url.searchParams.get('instructionTypeId'), 80);
        const language = clean(url.searchParams.get('language'), 10);
        const req = pool.request().input('companyId', sql.NVarChar(80), ctx.companyId);
        const result = await req.query(`SELECT q.id,q.companyId,q.instructionTypeId,t.name AS instructionName,q.language,q.question,q.optionsJson,q.correctIndex,q.active,q.updatedAt
                                        FROM TestQuestions q
                                        JOIN InstructionTypes t ON t.companyId=q.companyId AND t.id=q.instructionTypeId
                                        WHERE q.companyId=@companyId
                                        ORDER BY t.name,q.language,q.active DESC,q.question`);
        // Resolve immutable replacement IDs across the company before mutable type/language filters.
        return json(currentQuestionVersions(result.recordset)
          .filter(row=>(!typeId || row.instructionTypeId===typeId) && (!language || row.language===normaliseLanguage(language)))
          .map(mapQuestion));
      }

      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN, Roles.HSE]);
      const body = await request.json();

      if (request.method === 'POST') {
        const instructionTypeId = clean(body.instructionTypeId, 80);
        const question = clean(body.question, 2000);
        if (!instructionTypeId) return badRequest('Unterweisung fehlt.');
        if (!question) return badRequest('Frage fehlt.');
        if (!(await instructionTypeExists(pool, ctx.companyId, instructionTypeId))) return notFound('Unterweisungstyp nicht gefunden.');
        const opt = normaliseOptions(body);
        if (opt.error) return badRequest(opt.error);
        const ci = normaliseCorrectIndex(body, opt.options);
        if (ci.error) return badRequest(ci.error);
        const id = clean(body.id, 80) || `q-${uuidv4()}`;
        await pool.request()
          .input('id', sql.NVarChar(80), id)
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
          .input('language', sql.NVarChar(10), normaliseLanguage(body.language))
          .input('question', sql.NVarChar(sql.MAX), question)
          .input('optionsJson', sql.NVarChar(sql.MAX), JSON.stringify(opt.options))
          .input('correctIndex', sql.Int, ci.correctIndex)
          .input('active', sql.Bit, body.active === false ? 0 : 1)
          .query(`INSERT INTO TestQuestions(id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active)
                  VALUES(@id,@companyId,@instructionTypeId,@language,@question,@optionsJson,@correctIndex,@active)`);
        await writeAudit(pool, ctx, 'testQuestion.created', 'testQuestion', id, { instructionTypeId, language: normaliseLanguage(body.language) });
        return json({ ok: true, id }, 201);
      }

      const id = request.params.id;
      if (!id) return badRequest('id is required');
      if (!(await questionExists(pool, ctx.companyId, id))) return notFound('Testfrage nicht gefunden.');

      const fields = [];
      const req = pool.request()
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .input('id', sql.NVarChar(80), id);

      if (body.instructionTypeId !== undefined) {
        const instructionTypeId = clean(body.instructionTypeId, 80);
        if (!instructionTypeId || !(await instructionTypeExists(pool, ctx.companyId, instructionTypeId))) return notFound('Unterweisungstyp nicht gefunden.');
        req.input('instructionTypeId', sql.NVarChar(80), instructionTypeId);
        fields.push('instructionTypeId=@instructionTypeId');
      }
      if (body.language !== undefined) {
        req.input('language', sql.NVarChar(10), normaliseLanguage(body.language));
        fields.push('language=@language');
      }
      if (body.question !== undefined) {
        const question = clean(body.question, 2000);
        if (!question) return badRequest('Frage fehlt.');
        req.input('question', sql.NVarChar(sql.MAX), question);
        fields.push('question=@question');
      }
      if (body.options !== undefined || body.optionA !== undefined || body.optionB !== undefined || body.optionC !== undefined || body.optionD !== undefined || body.correctIndex !== undefined || body.answerIndex !== undefined) {
        const current = await pool.request()
          .input('companyId', sql.NVarChar(80), ctx.companyId)
          .input('id', sql.NVarChar(80), id)
          .query('SELECT optionsJson, correctIndex FROM TestQuestions WHERE companyId=@companyId AND id=@id');
        let currentOptions = [];
        try { currentOptions = JSON.parse(current.recordset[0]?.optionsJson || '[]'); } catch { currentOptions = []; }
        const opt = (body.options !== undefined || body.optionA !== undefined || body.optionB !== undefined || body.optionC !== undefined || body.optionD !== undefined)
          ? normaliseOptions(body)
          : { options: currentOptions };
        if (opt.error) return badRequest(opt.error);
        const ci = normaliseCorrectIndex({ correctIndex: body.correctIndex ?? body.answerIndex ?? current.recordset[0]?.correctIndex }, opt.options);
        if (ci.error) return badRequest(ci.error);
        req.input('optionsJson', sql.NVarChar(sql.MAX), JSON.stringify(opt.options));
        req.input('correctIndex', sql.Int, ci.correctIndex);
        fields.push('optionsJson=@optionsJson', 'correctIndex=@correctIndex');
      }
      if (body.active !== undefined) {
        req.input('active', sql.Bit, body.active === false ? 0 : 1);
        fields.push('active=@active');
      }
      if (!fields.length) return badRequest('Keine Änderung angegeben.');
      fields.push('updatedAt=SYSUTCDATETIME()');
      await req.query(`UPDATE TestQuestions SET ${fields.join(', ')} WHERE companyId=@companyId AND id=@id`);
      await writeAudit(pool, ctx, 'testQuestion.updated', 'testQuestion', id, body);
      return json({ ok: true, id });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
