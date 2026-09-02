import { app } from '@azure/functions';
import crypto from 'node:crypto';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { createReadSasUrl } from '../lib/blob.js';
import { saveCertificateHtml } from '../lib/certificate.js';
import { writeAudit } from '../lib/audit.js';
import { instructionText, validateAnalysis } from '../lib/instruction-analysis/schema.js';
import { placeCorrectAnswer, balancedPositions, selectTestQuestions } from '../lib/question-order.js';

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

function safeQuestion(row, targetIndex) {
  let options = [];
  try { options = JSON.parse(row.optionsJson || '[]'); } catch { options = []; }
  const optionObjects = options.map((text, originalIndex) => ({ text, answerIndex: originalIndex }));
  return { id: row.id, question: row.question, options: targetIndex === undefined ? shuffle(optionObjects) : placeCorrectAnswer(options, Number(row.correctIndex), targetIndex) };
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
  const row=result.recordset[0];
  if(row?.testInstructionSnapshotJson){
    const saved=JSON.parse(row.testInstructionSnapshotJson);
    for(const key of ['instructionName','description','intervalMonths','templateTitle','templatePath']) row[key]=saved[key];
  }
  return row;
}

function assertOpen(invitation) {
  if (!invitation) return { status: 404, error: 'Ungültiger Link' };
  if (new Date(invitation.expiresAt) < new Date()) return { status: 410, error: 'Link abgelaufen' };
  if (invitation.status === 'completed') return { status: 409, error: 'Unterweisung bereits abgeschlossen' };
  return null;
}

async function questionsForSession(pool, invitation) {
  const qres = await pool.request()
    .input('companyId', sql.NVarChar(80), invitation.companyId)
    .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
    .input('language', sql.NVarChar(10), invitation.language || 'de')
    .query(`SELECT id, question, optionsJson, correctIndex, sourceAnalysisId, sourceAspectId
            FROM TestQuestions
            WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND active=1`);
  const poolQuestions = qres.recordset;
  let source={instructionName:invitation.instructionName,description:invitation.description,intervalMonths:invitation.intervalMonths,templateTitle:invitation.templateTitle,templatePath:invitation.templatePath};
  const release=await pool.request().input('companyId',sql.NVarChar(80),invitation.companyId).input('typeId',sql.NVarChar(80),invitation.instructionTypeId)
    .input('language',sql.NVarChar(10),invitation.language||'de')
    .query("SELECT TOP 1 * FROM InstructionAnalyses WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND status='published' ORDER BY publishedAt DESC");
  const published=release.recordset[0];
  if(published?.resultJson && !invitation.testInstructionSnapshotJson){
    const result=validateAnalysis(JSON.parse(published.resultJson).data,published);
    if(!result.publishable) throw new Error('Die freigegebene Sicherheitsabdeckung ist unvollständig.');
    const expected=result.data.aspects.filter(a=>a.status==='covered').map(a=>a.id);
    for(const aspect of expected) if(invitation.testRequired && !poolQuestions.some(q=>q.sourceAnalysisId===published.id && q.sourceAspectId===aspect)) throw new Error('Für einen freigegebenen Sicherheitsaspekt fehlt eine aktive, geprüfte Testfrage. Bitte die Unterweisung erneut prüfen und freigeben.');
    source={...source,description:instructionText(result.data),templateTitle:published.title,templatePath:published.sourceBlobPath};
  }
  let selected = invitation.testRequired ? selectTestQuestions(poolQuestions) : [];
  if(invitation.id) {
    if(invitation.testRequired && !selected.length && !invitation.testInstructionSnapshotJson) throw new Error('Für diese Unterweisung sind keine Testfragen verfügbar.');
    const snapshot=JSON.stringify({...source,questions:selected.map(({id,question,optionsJson,correctIndex})=>({id,question,optionsJson,correctIndex}))});
    const saved=await pool.request().input('id',sql.NVarChar(80),invitation.id).input('companyId',sql.NVarChar(80),invitation.companyId)
      .input('ids',sql.NVarChar(sql.MAX),JSON.stringify(selected.map(row=>row.id))).input('snapshot',sql.NVarChar(sql.MAX),snapshot)
      .query('UPDATE ExternalInvitations SET testQuestionIdsJson=CASE WHEN testInstructionSnapshotJson IS NULL THEN @ids ELSE testQuestionIdsJson END,testInstructionSnapshotJson=COALESCE(testInstructionSnapshotJson,@snapshot) OUTPUT INSERTED.testInstructionSnapshotJson,INSERTED.testQuestionIdsJson WHERE id=@id AND companyId=@companyId');
    const stored=saved.recordset[0];
    if(!stored?.testInstructionSnapshotJson) throw new Error('Testauswahl konnte nicht gespeichert werden.');
    const locked=JSON.parse(stored.testInstructionSnapshotJson);
    selected=locked.questions;
    if(!Array.isArray(selected) || (invitation.testRequired && !selected.length)) throw new Error('Die gespeicherte Testauswahl ist unvollständig.');
    for(const key of ['instructionName','description','intervalMonths','templateTitle','templatePath']) invitation[key]=locked[key];
    invitation.testInstructionSnapshotJson=stored.testInstructionSnapshotJson;invitation.testQuestionIdsJson=stored.testQuestionIdsJson;
  }
  const groups = new Map();
  for(const row of selected) {
    const optionCount = JSON.parse(row.optionsJson || '[]').length;
    if(!groups.has(optionCount)) groups.set(optionCount, []);
    groups.get(optionCount).push(row);
  }
  const positions = new Map();
  for(const [optionCount, questions] of groups) {
    const targets = balancedPositions(questions.length, optionCount);
    questions.forEach((row,index)=>positions.set(row.id,targets[index]));
  }
  return selected.map(row=>safeQuestion(row, positions.get(row.id)));
}

async function getRandomQuestions(pool, invitation) {
  if(!invitation.id) return questionsForSession(pool,invitation);
  // Hold one consistent source/question version while the first session snapshot is issued.
  const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let open=true;
  try {
    const sessionPool={request:()=>new sql.Request(tx)};
    await sessionPool.request().input('companyId',sql.NVarChar(80),invitation.companyId).input('id',sql.NVarChar(80),invitation.id)
      .query('SELECT id FROM ExternalInvitations WITH (UPDLOCK,HOLDLOCK) WHERE companyId=@companyId AND id=@id');
    // Match publication lock order: analysis before source/type and questions.
    await sessionPool.request().input('companyId',sql.NVarChar(80),invitation.companyId).input('typeId',sql.NVarChar(80),invitation.instructionTypeId)
      .query('SELECT id FROM InstructionAnalyses WITH (UPDLOCK,HOLDLOCK) WHERE companyId=@companyId AND instructionTypeId=@typeId');
    const fresh=await loadInvitation(sessionPool,invitation.tokenHash);
    const closed=assertOpen(fresh);if(closed) throw Object.assign(new Error(closed.error),{status:closed.status});
    Object.assign(invitation,fresh);
    const questions=await questionsForSession(sessionPool,invitation);
    await tx.commit();open=false;return questions;
  }catch(error){if(open) await tx.rollback().catch(()=>{});throw error;}
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
  if(invitation.id && !invitation.testInstructionSnapshotJson && (invitation.testSnapshotRequired || !invitation.startedAt)) return {required:true,passed:false,details:[],error:'Bitte den bereitgestellten Test zuerst öffnen.'};
  const answers = normaliseAnswers(body);
  if (!answers.length) return { required: true, passed: false, scorePercent: 0, details: [], error: 'answers required' };
  const ids = answers.map(a => String(a.questionId || '')).filter(Boolean);
  if (new Set(ids).size!==answers.length || answers.length>200 || answers.some(a=>a.answerIndex===null || a.answerIndex==='' || !Number.isInteger(Number(a.answerIndex)))) return {required:true,passed:false,details:[],error:'Bitte jede Testfrage genau einmal beantworten.'};
  if(invitation.testQuestionIdsJson){
    const expected=JSON.parse(invitation.testQuestionIdsJson);
    if(ids.length!==expected.length || expected.some(id=>!ids.includes(id))) return {required:true,passed:false,details:[],error:'Bitte alle Fragen des bereitgestellten Tests beantworten.'};
  }
  if (!ids.length) return { required: true, passed: false, scorePercent: 0, details: [], error: 'answers required' };
  let qres;
  if(invitation.testInstructionSnapshotJson){
    qres={recordset:JSON.parse(invitation.testInstructionSnapshotJson).questions};
  }else{
  const request = pool.request()
    .input('companyId', sql.NVarChar(80), invitation.companyId)
    .input('typeId', sql.NVarChar(80), invitation.instructionTypeId)
    .input('language', sql.NVarChar(10), invitation.language || 'de');
  ids.forEach((id, idx) => request.input(`id${idx}`, sql.NVarChar(80), id));
  const idList = ids.map((_, idx) => `@id${idx}`).join(',');
  qres = await request.query(`SELECT id, question, optionsJson, correctIndex FROM TestQuestions
                                    WHERE companyId=@companyId AND instructionTypeId=@typeId AND language=@language AND id IN (${idList})`);
  }
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
        const questions = await getRandomQuestions(pool, invitation);
        let templateUrl = null;
        if (invitation.templatePath) {
          try { templateUrl = createReadSasUrl(invitation.templatePath, 30); }
          catch { templateUrl = invitation.templateFileName ? `/vorlagen/${encodeURIComponent(invitation.templateFileName)}` : null; }
        }
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
