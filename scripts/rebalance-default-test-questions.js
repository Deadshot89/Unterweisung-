import assert from 'node:assert/strict';
import { getPool, sql } from '../api/src/lib/db.js';
import { planDefaultQuestionBalance } from './lib/default-test-questions.js';

const companyId=String(process.env.QUESTION_BALANCE_COMPANY_ID || '').trim();
assert.ok(companyId && companyId.length<=80,'A target company is required');
assert.ok(process.argv.length===3 && ['--dry-run','--apply'].includes(process.argv[2]),'Choose --dry-run or --apply');
const apply=process.argv[2]==='--apply';
let pool, tx, open=false, stage='connect';
const distribution=rows=>rows.reduce((counts,row)=>{if(row.active!==false && row.active!==0) counts[Number(row.correctIndex)]=(counts[Number(row.correctIndex)]||0)+1;return counts;},[0,0,0,0]);
try {
  pool=await getPool(); tx=new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); open=true;
  const request=()=>new sql.Request(tx).input('companyId',sql.NVarChar(80),companyId);
  stage='lock';
  await request().input('lockName',sql.NVarChar(255),`default-answer-balance-v1:${companyId}`).query(`DECLARE @lockResult INT;
    EXEC @lockResult=sys.sp_getapplock @Resource=@lockName,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
    IF @lockResult<0 THROW 51000,'Question balance lock unavailable',1;`);
  stage='read';
  const types=(await request().query('SELECT id,name FROM dbo.InstructionTypes WHERE companyId=@companyId')).recordset;
  const before=(await request().query('SELECT id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active FROM dbo.TestQuestions WITH (UPDLOCK,HOLDLOCK) WHERE companyId=@companyId')).recordset;
  const {changes,preserved}=planDefaultQuestionBalance(types,before,companyId);
  if(changes.length) {
    stage='replace';
    await request().input('changes',sql.NVarChar(sql.MAX),JSON.stringify(changes)).query(`
      DECLARE @items TABLE(id NVARCHAR(80),oldId NVARCHAR(80),instructionTypeId NVARCHAR(80),language NVARCHAR(10),question NVARCHAR(MAX),optionsJson NVARCHAR(MAX),correctIndex INT);
      INSERT INTO @items SELECT id,oldId,instructionTypeId,language,question,optionsJson,correctIndex
        FROM OPENJSON(@changes) WITH(id NVARCHAR(80),oldId NVARCHAR(80),instructionTypeId NVARCHAR(80),language NVARCHAR(10),question NVARCHAR(MAX),optionsJson NVARCHAR(MAX),correctIndex INT);
      INSERT INTO dbo.TestQuestions(id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active)
        SELECT id,@companyId,instructionTypeId,language,question,optionsJson,correctIndex,1 FROM @items;
      UPDATE q SET active=0,updatedAt=SYSUTCDATETIME() FROM dbo.TestQuestions q JOIN @items i ON i.oldId=q.id WHERE q.companyId=@companyId;
    `);
  }
  stage='verify';
  const after=(await request().query('SELECT id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active FROM dbo.TestQuestions WHERE companyId=@companyId')).recordset;
  const afterMap=new Map(after.map(row=>[row.id,row]));
  const beforeMap=new Map(before.map(row=>[row.id,row]));
  for(const change of changes) {
    const current=afterMap.get(change.id),old=afterMap.get(change.oldId),previous=beforeMap.get(change.oldId);
    assert.equal(current.optionsJson,change.optionsJson);assert.equal(Number(current.correctIndex),change.correctIndex);
    assert.equal(current.question,previous.question);assert.equal(current.instructionTypeId,previous.instructionTypeId);assert.equal(current.language,previous.language);
    assert.ok(current.active===true || current.active===1);
    assert.equal(old.optionsJson,previous.optionsJson);assert.equal(old.correctIndex,previous.correctIndex);assert.ok(old.active===false || old.active===0);
    assert.equal(JSON.parse(current.optionsJson)[current.correctIndex],JSON.parse(previous.optionsJson)[previous.correctIndex]);
  }
  const changedOldIds=new Set(changes.map(c=>c.oldId));
  for(const row of before) if(!changedOldIds.has(row.id)) assert.deepEqual(afterMap.get(row.id),row,'Unrelated questions must remain unchanged');
  assert.equal(after.length,before.length+changes.length);
  assert.equal(planDefaultQuestionBalance(types,after,companyId).changes.length,0,'Reruns must preserve current questions');
  const report={replaced:changes.length,customQuestionsPreserved:preserved,activeBefore:distribution(before),activeAfter:distribution(after),legacyAnswerKeysPreserved:true};
  if(changes.length) {
    stage='audit';
    await request().input('details',sql.NVarChar(sql.MAX),JSON.stringify({...report,runId:process.env.GITHUB_RUN_ID||null})).query(`INSERT INTO dbo.SecurityEvents(companyId,actorUserId,eventType,severity,detailsJson)
      VALUES(@companyId,'github-actions-question-balance','testQuestion.answers.balanced.v1','info',@details)`);
  }
  stage='commit';
  if(apply) await tx.commit(); else await tx.rollback(); open=false;
  console.log(JSON.stringify({status:apply?'applied_and_verified':'dry_run_verified_rolled_back',...report}));
} catch(error) {
  if(open) await tx.rollback().catch(()=>{});
  console.error(`Question balance failed at ${stage} (${error.code||error.name||'error'}).`);process.exitCode=1;
} finally { if(pool) await pool.close(); }
