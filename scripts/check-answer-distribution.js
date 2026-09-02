import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { defaultQuestionSet, legacyDefaultQuestionSet, planDefaultQuestionBalance, assertBalancedSeedReady } from './lib/default-test-questions.js';
import { balancedQuestionId, balancedPositions, placeCorrectAnswer, currentQuestionVersions } from '../api/src/lib/question-order.js';

const companyId='company-test';
const types=JSON.parse(fs.readFileSync('database/seed_essentra_data.json','utf8')).types;
for(const type of types) for(const language of ['de','en','pl']) {
  const original=legacyDefaultQuestionSet({...type,companyId},language);
  const rows=defaultQuestionSet({...type,companyId},language);
  assert.deepEqual(rows,defaultQuestionSet({...type,companyId},language),'Seed output must be stable.');
  const distribution=[0,0,0,0];
  rows.forEach((row,i)=>{
    distribution[row.correctIndex]++;
    const options=JSON.parse(row.optionsJson), previous=JSON.parse(original[i].optionsJson);
    assert.deepEqual([...options].sort(),[...previous].sort());
    assert.equal(options[row.correctIndex],previous[original[i].correctIndex]);
    assert.equal(row.question,original[i].question);assert.equal(row.language,language);
    assert.equal(row.id,balancedQuestionId(original[i].id));assert.ok(row.id.length<=80);
  });
  assert.deepEqual(distribution,[5,5,5,5],`Defaults in ${language} must distribute correct answers evenly.`);
}
const original=legacyDefaultQuestionSet({...types[0],companyId},'de').map(row=>({...row,active:true}));
const snapshot=structuredClone(original);
const plan=planDefaultQuestionBalance([types[0]],original,companyId);
assert.equal(plan.changes.length,20);assert.deepEqual(original,snapshot,'Planning cannot mutate existing answer keys.');
const customised=structuredClone(original);customised[0].question='Manually edited';customised[1].active=false;
const selective=planDefaultQuestionBalance([types[0]],customised,companyId);
assert.equal(selective.changes.length,18);assert.equal(selective.preserved,1);
assert.equal(planDefaultQuestionBalance([types[0]],original,'another-company').changes.length,0);
const after=[...original.map(row=>({...row,active:false})),...plan.changes.map(({oldId,...row})=>({...row,active:true}))];
assert.equal(planDefaultQuestionBalance([types[0]],after,companyId).changes.length,0);
after[20].question='Edited after correction';after[20].active=false;
assert.equal(planDefaultQuestionBalance([types[0]],after,companyId).changes.length,0,'Reruns must not overwrite later edits or re-enable questions.');
assert.equal(currentQuestionVersions(after).length,20,'Only replaced inactive versions are hidden.');
assert.equal(currentQuestionVersions([customised[1]]).length,1,'Ordinary inactive questions remain manageable.');
assert.throws(()=>assertBalancedSeedReady([types[0]],original,companyId),/rebalance-default-test-questions/,'Seeding must refuse active legacy defaults before writing any records.');
assert.doesNotThrow(()=>assertBalancedSeedReady([types[0]],after,companyId));
const moved=structuredClone(after);moved[20].language='en';moved[20].instructionTypeId='moved-type';
assert.equal(currentQuestionVersions(moved).length,20,'Moving a replacement must not revive its retired version.');

let manageHandler;
const managementContext=vm.createContext({
  app:{http(name,definition){manageHandler=definition.handler;}}, currentQuestionVersions,
  getAuthorizedContext:async()=>({companyId}),assertRole(){},Roles:{},URL,
  sql:{NVarChar:()=>{}},json:body=>body,serverError:error=>{throw error;},
  getPool:async()=>({request(){const inputs={};return {
    input(name,type,value){inputs[name]=value;return this;},
    async query(query){return {recordset:moved.filter(row=>row.companyId===inputs.companyId && (!query.includes('q.language=@language') || row.language===inputs.language) && (!query.includes('q.instructionTypeId=@instructionTypeId') || row.instructionTypeId===inputs.instructionTypeId))};}
  };}})
});
vm.runInContext(fs.readFileSync('api/src/functions/testQuestions.js','utf8').replace(/^import .*;\n/gm,''),managementContext);
const managed=await manageHandler({method:'GET',url:`https://example.test/api/test-questions?instructionTypeId=${encodeURIComponent(types[0].id)}&language=de`},{});
assert.equal(managed.length,19,'Filtered management must hide old versions even when their replacements moved to another type/language.');
assert.ok(managed.every(row=>row.id.startsWith('qb1-')));

// Evaluate real external API selection and grading functions with an in-memory query adapter.
const runtimeSource=fs.readFileSync('api/src/functions/externalInstruction.js','utf8').split("app.http('externalInstruction'")[0].replace(/^import .*;\n/gm,'');
const context=vm.createContext({placeCorrectAnswer,balancedPositions,Math:Object.assign(Object.create(Math),{random:()=>0}),sql:{NVarChar:()=>{}}});
vm.runInContext(runtimeSource,context);
let servedRows=original;
const pool={request(){return {input(){return this;},async query(query){return {recordset:query.includes('active=1')?servedRows.filter(row=>row.active):servedRows};}};}};
const invitation={testRequired:true,companyId,instructionTypeId:types[0].id,language:'de',passPercent:80};
for(const bank of [original,after.filter(row=>row.active)]) {
  servedRows=bank;
  const selected=await context.getRandomQuestions(pool,invitation);
  const visiblePositions=[0,0,0,0];
  const answers=[];
  for(const question of selected) {
    const source=bank.find(row=>row.id===question.id);
    const correctText=JSON.parse(source.optionsJson)[source.correctIndex];
    const position=question.options.findIndex(o=>o.text===correctText);
    visiblePositions[position]++;
    assert.equal(Object.hasOwn(question,'correctIndex'),false);
    assert.equal(question.options[position].answerIndex,source.correctIndex);
    answers.push({questionId:question.id,answerIndex:question.options[position].answerIndex});
  }
  assert.ok(Math.max(...visiblePositions)-Math.min(...visiblePositions)<=1,'Each attempt must distribute visible answer positions.');
  const correct=await context.evaluateTest(pool,invitation,{answers});
  assert.equal(correct.scorePercent,100);assert.equal(correct.passed,true);
  const wrong=await context.evaluateTest(pool,invitation,{answers:answers.map(a=>({...a,answerIndex:(a.answerIndex+1)%4}))});
  assert.equal(wrong.scorePercent,0);assert.equal(wrong.passed,false);
}
servedRows=after;
const legacyResult=await context.evaluateTest(pool,invitation,{answers:original.slice(0,7).map(row=>({questionId:row.id,answerIndex:row.correctIndex}))});
assert.equal(legacyResult.scorePercent,100,'Already-open tests must still grade against their original inactive question IDs.');
for(const count of [2,3,4,6]) {
  const positions=balancedPositions(7,count,()=>0.42);
  const counts=Array.from({length:count},(_,i)=>positions.filter(x=>x===i).length);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
}
console.log('Answer distribution, version preservation and grading checks passed');
