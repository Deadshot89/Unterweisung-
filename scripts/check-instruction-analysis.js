import assert from 'node:assert/strict';
import { validateAnalysis, SAFETY_CATEGORIES } from '../api/src/lib/instruction-analysis/schema.js';
const data={topic:'Handhubwagen',device:'Modell aus der Unterlage',language:'de',readingStatus:'complete',pages:[{page:1,status:'read',note:''}],sections:[],aspects:[],questions:[],missingInformation:[]};
const evidence=[{page:1,quote:'Vor Arbeitsbeginn Sichtprüfung durchführen.'}];
for(const [id,label] of Object.entries(SAFETY_CATEGORIES)) {
  data.aspects.push({id,category:id,label,status:id==='pre_use'?'covered':'not_applicable',explanation:'Für dieses Gerät nach fachlicher Prüfung nicht zutreffend.',evidence:id==='pre_use'?evidence:[]});
}
data.sections=[{title:'Vor Beginn',body:evidence[0].quote,aspectIds:['pre_use'],sourcePages:[1]}];
data.questions=[{aspectId:'pre_use',question:'Was ist vor Arbeitsbeginn zu tun?',options:['Sichtprüfung durchführen','Ungeprüft beginnen','Prüfung später nachholen','Mängel ignorieren'],correctIndex:0,explanation:'Die Unterlage verlangt die Prüfung vor Beginn.',evidence}];
assert.equal(validateAnalysis(data,{pageCount:1,language:'de'}).publishable,true);
const missing=structuredClone(data);missing.aspects[0].status='missing';
assert.equal(validateAnalysis(missing,{pageCount:1,language:'de'}).publishable,false);
assert.equal(validateAnalysis(data,{pageCount:2,language:'de'}).publishable,false,'Never silently ignore source pages.');
const noQuestion=structuredClone(data);noQuestion.questions=[];
assert.equal(validateAnalysis(noQuestion,{pageCount:1,language:'de'}).publishable,false,'Every covered aspect needs a test question.');
const invalid=structuredClone(data);invalid.questions[0].correctIndex=4;
assert.throws(()=>validateAnalysis(invalid,{pageCount:1,language:'de'}));
console.log('Instruction analysis validation checks passed');

// Real PDF parsing and provider request construction, with no network calls or credentials.
const {createRequire}=await import('node:module');
const requireApi=createRequire(new URL('../api/package.json',import.meta.url));
const {PDFDocument}=requireApi('pdf-lib');
const {aiConfiguration,sourcePageCount,analysisRequest,providerRequest,completedAnalysis}=await import('../api/src/lib/instruction-analysis/provider.js');
const {balanceAnalysisQuestions,publishedQuestions,publicAnalysis,analysisId}=await import('../api/src/lib/instruction-analysis/store.js');
const {selectTestQuestions,balancedPositions,placeCorrectAnswer}=await import('../api/src/lib/question-order.js');
const config=aiConfiguration({AZURE_OPENAI_ENDPOINT:'https://fixture.openai.azure.com',AZURE_OPENAI_API_KEY:'secret-fixture',AZURE_OPENAI_DEPLOYMENT:'test-deployment'});
assert.equal(config.configured,true);assert.equal(aiConfiguration({}).configured,false);
for(const endpoint of ['http://fixture.openai.azure.com','https://127.0.0.1','https://fixture.openai.azure.com.attacker.test','https://user:pw@fixture.openai.azure.com','https://fixture.openai.azure.com/?key=secret']) assert.equal(aiConfiguration({AZURE_OPENAI_ENDPOINT:endpoint,AZURE_OPENAI_API_KEY:'test',AZURE_OPENAI_DEPLOYMENT:'model'}).configured,false);
const pdf=await PDFDocument.create();pdf.addPage([800,600]);pdf.addPage([400,900]);
const bytes=Buffer.from(await pdf.save());
assert.equal(await sourcePageCount(bytes,'application/pdf'),2,'Layout and page dimensions do not determine extraction.');
await assert.rejects(()=>sourcePageCount(Buffer.from('%PDF-unreadable'),'application/pdf'),{code:'source_unreadable'});
assert.equal(await sourcePageCount(Buffer.from('fixture'),'image/png'),1);
const payload=analysisRequest({buffer:bytes,fileName:'new-layout.pdf',contentType:'application/pdf',pageCount:2,title:'Untrusted title',language:'de'},config);
assert.equal(payload.background,true);assert.equal(payload.store,true);assert.equal(payload.text.format.strict,true);
assert.deepEqual(payload.tools,[]);assert.ok(payload.input[0].content[0].file_data.startsWith('data:application/pdf;base64,'));
const imagePayload=analysisRequest({buffer:Buffer.from('fixture'),fileName:'scan.png',contentType:'image/png',pageCount:1,title:'Test',language:'de'},config);
assert.equal(imagePayload.input[0].content[0].type,'input_image');
await providerRequest('responses',{method:'POST',body:payload},config,async(url,options)=>{
 assert.equal(String(url),'https://fixture.openai.azure.com/openai/v1/responses');assert.equal(options.headers['api-key'],'secret-fixture');assert.equal(options.redirect,'error');
 return {ok:true,status:200,json:async()=>({id:'response-1',status:'queued'})};
});
await assert.rejects(()=>providerRequest('responses',{},config,async()=>({ok:false,status:401,json:async()=>({error:'secret-fixture'})})),error=>error.code==='provider_http_401'&&!error.message.includes('secret-fixture'));
await assert.rejects(()=>providerRequest('https://attacker.test',{},config),/Invalid provider/);
assert.deepEqual(completedAnalysis({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]}),data);
assert.throws(()=>completedAnalysis({status:'incomplete',output:[]}),{code:'incomplete_analysis'});
assert.throws(()=>completedAnalysis({status:'completed',output:[{content:[{type:'refusal'}]}]}),{code:'analysis_refused'});
for(const mutate of [d=>{d.readingStatus='partial';},d=>{d.missingInformation=['Herstellergrenze fehlt'];},d=>{d.aspects.pop();},d=>{d.sections=[];}]){
 const broken=structuredClone(data);mutate(broken);assert.equal(validateAnalysis(broken,{pageCount:1,language:'de'}).publishable,false);
}
const many=structuredClone(data);many.questions=Array.from({length:17},(_,i)=>({...structuredClone(data.questions[0]),question:'Prüfung '+i}));
const balanced=balanceAnalysisQuestions(many),distribution=[0,0,0,0];
for(const q of balanced.questions){distribution[q.correctIndex]++;assert.equal(q.options[q.correctIndex],data.questions[0].options[0]);}
assert.ok(Math.max(...distribution)-Math.min(...distribution)<=1);
assert.ok(many.questions.every(q=>q.correctIndex===0),'Normalization must not mutate input.');
const published=publishedQuestions({id:'analysis-1'},validateAnalysis(balanced,{pageCount:1,language:'de'}));
assert.deepEqual(published,publishedQuestions({id:'analysis-1'},{data:balanced}),'Publication is stable, including reviewed answer positions.');
assert.ok(published.every((q,i)=>JSON.parse(q.optionsJson)[q.correctIndex]===balanced.questions[i].options[balanced.questions[i].correctIndex]));
const visible=publicAnalysis({id:'1',status:'processing',sourceBlobPath:'private',providerResponseId:'secret-provider',resultJson:null});
assert.equal(visible.providerResponseId,undefined);assert.equal(visible.sourceBlobPath,undefined);
assert.notEqual(analysisId({templateId:'t',sha256:'hash',instructionTypeId:'i',language:'de'},'a'),analysisId({templateId:'t',sha256:'hash',instructionTypeId:'i',language:'de'},'b'));
const bank=Array.from({length:12},(_,i)=>({id:'q'+i,sourceAnalysisId:'analysis-1',sourceAspectId:'aspect-'+i,optionsJson:'["correct","b","c","d"]',correctIndex:0}));
const selected=selectTestQuestions([...bank,...bank.map(q=>({...q,id:q.id+'extra'}))],()=>0.4);
assert.equal(selected.length,12);assert.equal(new Set(selected.map(q=>q.sourceAspectId)).size,12,'Every generated safety aspect must be tested.');
console.log('Source parsing, provider isolation, balancing and safety test coverage checks passed');

// Exercise the actual publication controller against a transaction adapter.
const {readFileSync}=await import('node:fs');
const vm=await import('node:vm');
const {createHash,randomUUID}=await import('node:crypto');
const {instructionText}=await import('../api/src/lib/instruction-analysis/schema.js');
let committed=0,rolledBack=0,writes=[],currentSource=true;
let job={id:'analysis-1',companyId:'tenant-a',instructionTypeId:'type-a',templateId:'template-a',status:'ready',pageCount:1,language:'de',resultJson:JSON.stringify(validateAnalysis(data,{pageCount:1,language:'de'}))};
const dbQuery=async(query,params)=>{
 assert.equal(params.companyId,'tenant-a','Every job query carries the authorized company.');
 if(query.startsWith('SELECT a.id')) return {recordset:currentSource?[{id:job.id}]:[]};
 if(query.includes('UPDATE dbo.TestQuestions')){writes.push({query,params});return {recordset:[]};}
 return {recordset:job?[job]:[]};
};
class TestRequest{constructor(){this.params={};}input(name,type,value){this.params[name]=value;return this;}query(query){return dbQuery(query,this.params);}}
class TestTransaction{async begin(level){assert.equal(level,'SERIALIZABLE');}async commit(){committed++;}async rollback(){rolledBack++;}}
const fakeSql={NVarChar:()=>{},Int:'int',Request:TestRequest,Transaction:TestTransaction,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'}};
const storeContext=vm.createContext({sql:fakeSql,createHash,randomUUID,balancedPositions,placeCorrectAnswer,validateAnalysis,instructionText,Date,console});
vm.runInContext(readFileSync('api/src/lib/instruction-analysis/store.js','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),storeContext);
const dbPool={request:()=>new TestRequest()},ctx={companyId:'tenant-a',userId:'reviewer'};
await assert.rejects(()=>storeContext.publishAnalysis(dbPool,ctx,job.id,false),{status:400});
currentSource=false;await assert.rejects(()=>storeContext.publishAnalysis(dbPool,ctx,job.id,true),{status:409});assert.equal(writes.length,0);assert.equal(rolledBack,1);
currentSource=true;const fullJob=job;job={...job,resultJson:JSON.stringify(validateAnalysis(missing,{pageCount:1,language:'de'}))};
await assert.rejects(()=>storeContext.publishAnalysis(dbPool,ctx,job.id,true),{status:409});assert.equal(writes.length,0);
job=null;await assert.rejects(()=>storeContext.publishAnalysis(dbPool,ctx,'another-tenant-job',true),{status:404});
job=fullJob;await storeContext.publishAnalysis(dbPool,ctx,job.id,true);assert.equal(committed,1);assert.equal(writes.length,1);
assert.equal(writes[0].params.description,instructionText(data));assert.equal(JSON.parse(writes[0].params.questions).length,1);
assert.match(writes[0].query,/sourceAnalysisId IS NOT NULL AND sourceAspectId IS NOT NULL/,'Automatic replacement preserves manually owned questions.');
job={...job,status:'published'};await storeContext.publishAnalysis(dbPool,ctx,job.id,true);assert.equal(writes.length,1,'Retrying publication must not generate new writes.');
console.log('Publication review, tenant scope, stale source, gap blocking and idempotency checks passed');

// Test session keeps full language-specific content and answer keys after subsequent edits.
const externalSource=readFileSync('api/src/functions/externalInstruction.js','utf8').split("app.http('externalInstruction'")[0].replace(/^import .*;\n/gm,'');
const external=vm.createContext({sql:fakeSql,balancedPositions,placeCorrectAnswer,selectTestQuestions,instructionText,validateAnalysis,Math,Date});
vm.runInContext(externalSource,external);
const released={...fullJob,sourceBlobPath:'templates/german-version.pdf',title:'Deutsche Quelle'};
let activeQuestions=[{...bank[0],sourceAspectId:'pre_use'}],savedSession=null;
const sessionPool={request(){const params={};return {input(name,type,value){params[name]=value;return this;},async query(query){
 assert.equal(params.companyId,'tenant-a');
 if(query.includes('FROM InstructionAnalyses')){assert.equal(params.language,'de');return {recordset:[released]};}
 if(query.startsWith('UPDATE ExternalInvitations')){savedSession ||= {testInstructionSnapshotJson:params.snapshot,testQuestionIdsJson:params.ids};return {recordset:[savedSession]};}
 return {recordset:activeQuestions};
}};}};
const invitation={id:'inv-1',testRequired:true,companyId:'tenant-a',instructionTypeId:'type-a',language:'de',testSnapshotRequired:true,description:'English current shared description',templatePath:'english-source.pdf'};
const unopened=await external.evaluateTest(sessionPool,invitation,{answers:[{questionId:'q0',answerIndex:0}]});assert.equal(unopened.passed,false);assert.ok(unopened.error);
const served=await external.questionsForSession(sessionPool,invitation);
assert.equal(invitation.description,instructionText(data));assert.equal(invitation.templatePath,released.sourceBlobPath,'Language-specific source is bound to its own test.');
assert.ok(served.every(q=>q.correctIndex===undefined));
activeQuestions=[];
const revisited=await external.questionsForSession(sessionPool,invitation);
assert.equal(revisited.length,served.length,'An open test remains available after question deactivation.');
assert.equal((await external.evaluateTest(sessionPool,invitation,{answers:[{questionId:'q0',answerIndex:0}]})).passed,true,'Stored answer key survives database edits and retirement.');
assert.equal((await external.evaluateTest(sessionPool,invitation,{answers:[{questionId:'unknown',answerIndex:0}]})).passed,false);
assert.equal((await external.evaluateTest(sessionPool,invitation,{answers:[{questionId:'q0',answerIndex:0},{questionId:'q0',answerIndex:0}]})).passed,false);
await assert.rejects(()=>external.questionsForSession(sessionPool,{...invitation,id:'inv-2',testInstructionSnapshotJson:null}),/Sicherheitsaspekt/,'Disabling the only question cannot silently omit a reviewed safety aspect.');
const fullSnapshot={...invitation,testQuestionIdsJson:JSON.stringify(bank.map(q=>q.id)),testInstructionSnapshotJson:JSON.stringify({questions:bank})};
assert.equal((await external.evaluateTest(sessionPool,fullSnapshot,{answers:[{questionId:'q0',answerIndex:0}]})).passed,false,'A subset of a safety test cannot pass.');
assert.equal((await external.evaluateTest(sessionPool,fullSnapshot,{answers:bank.map(q=>({questionId:q.id,answerIndex:q.correctIndex}))})).passed,true);
console.log('Full test snapshot, language source, edits, coverage and grading checks passed');

// Actual learner renderer retains the last safety rule and escapes document markup.
const learner=readFileSync('frontend/external/instruction.js','utf8');
const renderer=learner.slice(learner.indexOf('    function buildContentHtml'),learner.indexOf('    async function load'));
const renderContext=vm.createContext({esc:text=>String(text).replaceAll('<','&lt;').replaceAll('>','&gt;')});vm.runInContext(renderer,renderContext);
const longText=Array.from({length:45},(_,i)=>'Sicherheitsregel '+i).join('\n');
assert.ok(renderContext.buildContentHtml(longText).includes('Sicherheitsregel 44'));
assert.ok(renderContext.buildContentHtml('<script>alert(1)</script>').includes('&lt;script&gt;'));
assert.doesNotMatch(learner,/on(?:click|change)\s*=/);
assert.doesNotMatch(readFileSync('frontend/external/instruction.html','utf8'),/<script\s*>/,'Participant code must work with script-src self.');
let updatedDescription;
const {assertRole,Roles}=await import('../api/src/lib/auth.js');
let typeHandler;
const typeContext=vm.createContext({app:{http(name,definition){typeHandler=definition.handler;}},getPool:async()=>({request(){const params={};return {input(name,type,value){params[name]=value;return this;},async query(query){if(query.startsWith('UPDATE')) updatedDescription=params.description;return {recordset:[{id:'type-a'}]};}};}}),sql:fakeSql,getAuthorizedContext:async()=>({...ctx,isAuthenticated:true,roles:[Roles.COMPANY_ADMIN]}),assertRole,Roles,json:value=>value,badRequest:message=>({error:message}),serverError:error=>{throw error;},writeAudit:async()=>{}});
vm.runInContext(readFileSync('api/src/functions/instructionTypes.js','utf8').replace(/^import .*;\n/gm,''),typeContext);
const largeDescription='Vollständige Sicherheitsregel. '.repeat(300);
await typeHandler({method:'PATCH',params:{id:'type-a'},json:async()=>({name:'Umbenannt',description:largeDescription})},{});
assert.equal(updatedDescription,largeDescription.trim(),'Editing metadata must not truncate generated instructions.');
let analysisHandler,authorizedRole=Roles.LINE_MANAGER,readCalls=0;
const routeContext=vm.createContext({app:{http(name,definition){analysisHandler=definition.handler;}},getAuthorizedContext:async()=>({...ctx,isAuthenticated:true,roles:[authorizedRole]}),assertRole,Roles,getPool:async()=>{readCalls++;return dbPool;},sql:fakeSql,serverError:error=>({status:error.status}),json:value=>value});
vm.runInContext(readFileSync('api/src/functions/instructionAnalyses.js','utf8').replace(/^import .*;\n/gm,''),routeContext);
assert.equal((await analysisHandler({method:'POST',params:{id:'analysis-1'},json:async()=>({action:'publish',reviewConfirmed:true})},{})).status,403);assert.equal(readCalls,0,'Unauthorized role cannot reach job or publication queries.');
console.log('Learner content, CSP, edit preservation and authorization checks passed');

// New and formerly unopened invitations remain protected if their first GET fails.
const failedFirstOpen={id:'old-unopened',companyId:'tenant-a',testRequired:true,startedAt:new Date(),testSnapshotRequired:true};
assert.equal((await external.evaluateTest(sessionPool,failedFirstOpen,{answers:[{questionId:'q0',answerIndex:0}]})).passed,false);
const migration=readFileSync('database/migrations/010_instruction_analysis.sql','utf8');
assert.match(migration,/SET testSnapshotRequired=1 WHERE testSnapshotRequired IS NULL AND startedAt IS NULL/);
// Source language is also resolved when only the reading confirmation is required.
savedSession=null;
const confirmationOnly={...invitation,id:'confirmation-only',testRequired:false,testInstructionSnapshotJson:null,testQuestionIdsJson:null,description:'English shared text',templatePath:'english-source.pdf'};
assert.equal((await external.questionsForSession(sessionPool,confirmationOnly)).length,0);
assert.equal(confirmationOnly.description,instructionText(data));assert.equal(confirmationOnly.templatePath,released.sourceBlobPath);
assert.doesNotMatch(readFileSync('frontend/instruction-type-management-v23.js','utf8'),/onclick=/);
assert.doesNotMatch(readFileSync('frontend/test-question-management-v22.js','utf8'),/\son(?:click|change|input)\s*=\s*["']/,'HTML event attributes are blocked by CSP; assigning JavaScript handlers is permitted.');
console.log('Legacy invitation migration and confirmation-only source checks passed');

const missingLanguagePool={request(){return {input(){return this;},async query(query){return {recordset:query.includes('FROM InstructionAnalyses')?[released]:bank};}};}};
await assert.rejects(()=>external.questionsForSession(missingLanguagePool,{...confirmationOnly,id:'missing-language',language:'pl',testInstructionSnapshotJson:null}),/gewählte Sprache/,'Never combine another language release with legacy questions.');
console.log('Unavailable language release is blocked instead of silently mixing sources.');
