import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

// The four production workspaces share a real DOM. Only remote I/O and file encoding are controlled.
const scripts=['template-management-v21.js','test-question-management-v22.js','instruction-type-management-v23.js','instruction-analysis.js'].map(name=>readFileSync('frontend/'+name,'utf8'));
const job=(id,status='ready')=>({id,title:'Dokument '+id,fileName:id+'.pdf',templateId:'template-'+id,language:'de',status,pageCount:1,result:{publishable:true,blockers:[],coverage:{pagesRead:1,pageCount:1,covered:1,aspects:1,questions:1},data:{topic:'Sicherheit',device:'Gerät',aspects:[],sections:[],questions:[]}}});
async function settle(){for(let i=0;i<25;i++) await Promise.resolve();}
async function fixture(t){
  const dom=new JSDOM('<main><section id="instructions" class="view active"></section></main>',{runScripts:'outside-only',url:'https://instruction-test.invalid/'});
  t.after(()=>dom.window.close());const w=dom.window,d=w.document;
  const bank=[{id:'existing',name:'Bestehende Unterweisung',category:'Sicherheit',active:true,intervalMonths:12}];
  w.state={companyId:'A',apiAvailable:true,me:{roles:['system_admin']},data:{types:bank,templates:[]},testQuestions:[{id:'q1',companyId:'A',instructionTypeId:'existing',question:'Prüfen?',language:'de',active:true,options:['Ja','Nein'],correctIndex:0}]};
  w.API_BASE_URL='/api';w.DEFAULT_COMPANY_ID='A';w.$=id=>d.getElementById(id);
  w.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  w.types=()=>w.state.data.types;w.type=id=>w.types().find(x=>x.id===id)||{};w.templates=()=>w.state.data.templates;
  w.HTMLElement.prototype.scrollIntoView=function(){};w.confirm=()=>true;w.alert=message=>{throw Error(message);};
  w.loadData=async()=>{};w.setView=()=>w.renderInstructions();
  const calls=[],holds=[];
  const hold=predicate=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});holds.push({predicate,promise,used:false});return {resolve,reject};};
  w.api=async(path,options={})=>{
    const call={path,method:options.method||'GET',body:options.body?JSON.parse(options.body):null,companyId:w.state.companyId};calls.push(call);
    const pending=holds.find(h=>!h.used&&h.predicate(call));if(pending){pending.used=true;return pending.promise;}
    if(path==='/instruction-analyses') return {analyses:[job('A'),job('B')]};
    if(path.startsWith('/instruction-analyses/')) return job(path.split('/').pop(),call.body?.action==='publish'?'published':'ready');
    if(path==='/bootstrap') return w.state.data;
    if(path==='/test-questions') return w.state.testQuestions;
    if(path==='/instruction-types') return {id:'new'};
    if(path.startsWith('/instruction-types/')) return {ok:true};
    if(path==='/templates/upload') return {id:'new-template',fileName:call.body.fileName,sizeBytes:12};
    throw Error('Unexpected API '+path);
  };
  w.fileToBase64=async()=> 'JVBERi0=';
  scripts.forEach(source=>w.eval(source));w.renderInstructions();await settle();
  const button=(action,attr='analysis',id)=>d.querySelector(`[data-${attr}-action="${action}"]${id?`[data-${attr}-id="${id}"]`:''}`);
  const ready=async id=>{await w.openInstructionAnalysis(id);d.getElementById('analysisReviewConfirmed').checked=true;};
  const selectFile=()=>{const file=new w.File(['synthetic PDF'],'private-A.pdf',{type:'application/pdf'});Object.defineProperty(d.getElementById('tplFile'),'files',{configurable:true,value:[file]});return file;};
  return {w,d,calls,hold,button,ready,selectFile};
}

test('selecting another document cannot reuse the previous document review confirmation',async t=>{
  const f=await fixture(t);await f.ready('A');const old=f.button('publish');
  const next=f.hold(c=>c.path==='/instruction-analyses/B');const opening=f.w.openInstructionAnalysis('B');
  old.click();await settle();assert.equal(f.calls.filter(c=>c.body?.action==='publish').length,0);
  next.resolve(job('B'));await opening;assert.equal(f.d.getElementById('analysisReviewConfirmed').checked,false);
});
test('a same-document refresh revokes confirmation and a superseded read cannot restore it',async t=>{
  const f=await fixture(t);await f.ready('A');const old=f.button('publish');
  const first=f.hold(c=>c.path==='/instruction-analyses/A');const read1=f.w.openInstructionAnalysis('A');
  const second=f.hold(c=>c.path==='/instruction-analyses/A');const read2=f.w.openInstructionAnalysis('A');
  old.click();await settle();assert.equal(f.calls.filter(c=>c.body?.action==='publish').length,0);
  second.resolve({...job('A'),title:'Aktuelle Fassung'});await read2;
  first.resolve({...job('A'),title:'Veraltete Fassung'});await read1;
  assert.match(f.d.querySelector('.analysis-detail').textContent,/Aktuelle Fassung/);
  assert.doesNotMatch(f.d.querySelector('.analysis-detail').textContent,/Veraltete Fassung/);
});
test('a pending publication is not retargeted by selection and performs only one write',async t=>{
  const f=await fixture(t);await f.ready('A');const pending=f.hold(c=>c.body?.action==='publish');
  const publication=f.w.handleInstructionAnalysisAction(f.button('publish'));
  await f.w.openInstructionAnalysis('B');f.button('publish')?.click();await settle();
  assert.equal(f.calls.filter(c=>c.body?.action==='publish').length,1);
  assert.equal(f.calls.find(c=>c.body?.action==='publish').path,'/instruction-analyses/A');
  pending.resolve(job('A','published'));await publication;
  assert.match(f.d.querySelector('.analysis-detail').textContent,/Dokument A/);
});
test('company changes reject old analysis reads and errors even before the next panel render',async t=>{
  const f=await fixture(t);await f.ready('A');
  const pending=f.hold(c=>c.path==='/instruction-analyses/A');const opening=f.w.openInstructionAnalysis('A');
  f.w.state.companyId='B';pending.reject(Error('Private Fehlerdetails A'));await opening;
  assert.doesNotMatch(f.d.getElementById('instructionAnalysisContent').textContent,/Private Fehlerdetails A/);
  const writes=f.calls.filter(c=>c.method==='POST').length;
  f.button('publish')?.click();await settle();assert.equal(f.calls.filter(c=>c.method==='POST').length,writes);
});
test('file encoding cannot move a company A upload into company B',async t=>{
  const f=await fixture(t);f.selectFile();f.d.getElementById('tplTitle').value='Vertraulich A';
  let resolve;f.w.fileToBase64=()=>new Promise(r=>{resolve=r;});const uploading=f.w.uploadTemplateFile();
  f.w.state.companyId='B';resolve('JVBERi0=');await uploading;
  assert.equal(f.calls.filter(c=>c.path==='/templates/upload').length,0);
  assert.equal(f.w.state.templateUploadBusy,false);
});
test('upload payload is a click-time snapshot and later input is not cleared',async t=>{
  const f=await fixture(t);f.selectFile();f.d.getElementById('tplTitle').value='Erster Titel';f.d.getElementById('tplCategory').value='Erster Bereich';
  let resolve;f.w.fileToBase64=()=>new Promise(r=>{resolve=r;});const uploading=f.w.uploadTemplateFile();
  f.d.getElementById('tplTitle').value='Nächster Entwurf';f.d.getElementById('tplCategory').value='Neuer Bereich';
  resolve('JVBERi0=');await uploading;
  const sent=f.calls.find(c=>c.path==='/templates/upload');assert.equal(sent.body.category,'Erster Bereich');assert.equal(sent.body.title,'Erster Titel');
  assert.equal(f.d.getElementById('tplTitle').value,'Nächster Entwurf');
});
test('late upload success never opens or starts an analysis in a different company',async t=>{
  const f=await fixture(t);f.selectFile();const pending=f.hold(c=>c.path==='/templates/upload');const uploading=f.w.uploadTemplateFile();await settle();
  f.w.state.companyId='B';pending.resolve({fileName:'private-A.pdf',analysis:{id:'private-job'}});await uploading;
  assert.equal(f.calls.filter(c=>c.path.includes('private-job')).length,0);
  assert.equal(f.calls.filter(c=>c.companyId==='B').length,0);
});
test('new instruction clears edit identity after confirmation and saves via POST',async t=>{
  const f=await fixture(t);f.w.prepareInstructionTypeEdit('existing');f.button('newInstruction','instruction').click();
  assert.equal(f.d.getElementById('itId').value,'');assert.equal(f.d.getElementById('itName').value,'');
  f.d.getElementById('itName').value='Neue Unterweisung';f.d.getElementById('itCategory').value='Neue Kategorie';
  await f.w.saveInstructionType();assert.equal(f.calls.find(c=>c.path.startsWith('/instruction-types')).method,'POST');
});
test('declining new-instruction draft discard preserves the edit identity and content',async t=>{
  const f=await fixture(t);f.w.prepareInstructionTypeEdit('existing');f.d.getElementById('itName').value='Mein Entwurf';f.w.confirm=()=>false;
  f.button('newInstruction','instruction').click();assert.equal(f.d.getElementById('itId').value,'existing');assert.equal(f.d.getElementById('itName').value,'Mein Entwurf');
});
test('publication updates results without replacing instruction, upload or question drafts',async t=>{
  const f=await fixture(t);await f.ready('A');const file=f.selectFile();
  const name=f.d.getElementById('itName'),title=f.d.getElementById('tplTitle'),fileInput=f.d.getElementById('tplFile');
  name.value='Ungespeicherte Unterweisung';title.value='Nächste Unterlage';name.focus();
  f.button('new','question').click();f.d.getElementById('tqQuestion').value='Ungespeicherte Frage';f.d.getElementById('tqQuestion').dispatchEvent(new f.w.Event('input',{bubbles:true}));const question=f.d.getElementById('tqQuestion');
  await f.w.handleInstructionAnalysisAction(f.button('publish'));
  assert.equal(f.d.getElementById('itName'),name);assert.equal(name.value,'Ungespeicherte Unterweisung');
  assert.equal(f.d.getElementById('tplTitle'),title);assert.equal(title.value,'Nächste Unterlage');
  assert.equal(f.d.getElementById('tplFile'),fileInput);assert.equal(fileInput.files[0],file);
  assert.equal(f.d.getElementById('tqQuestion'),question);assert.equal(question.value,'Ungespeicherte Frage');
  assert.match(f.d.querySelector('.analysis-detail').textContent,/Freigegeben/);
});
test('late publication success cannot refresh data or navigate under a new company',async t=>{
  const f=await fixture(t);await f.ready('A');const pending=f.hold(c=>c.body?.action==='publish');const publishing=f.w.handleInstructionAnalysisAction(f.button('publish'));
  f.w.state.companyId='B';pending.resolve(job('A','published'));await publishing;
  assert.equal(f.calls.filter(c=>c.companyId==='B').length,0);
});

test('publication fetches fresh questions and a pre-publication response cannot roll them back',async t=>{
  const f=await fixture(t);await f.ready('A');
  const pending=f.hold(c=>c.path==='/test-questions');const oldRead=f.w.loadTestQuestions(true);
  const fresh=[{...f.w.state.testQuestions[0],question:'Freigegebene neue Frage'}];
  const afterWrite=f.hold(c=>c.path==='/test-questions');const publishing=f.w.handleInstructionAnalysisAction(f.button('publish'));await settle();
  assert.equal(f.calls.filter(c=>c.path==='/test-questions').length,2);
  afterWrite.resolve(fresh);await publishing;pending.resolve([{...fresh[0],question:'Veraltete Frage'}]);await oldRead;
  assert.equal(f.w.state.testQuestions[0].question,'Freigegebene neue Frage');
  assert.match(f.d.getElementById('tqResults').textContent,/Freigegebene neue Frage/);
});
test('publication refresh rejects a late bootstrap response after changing company',async t=>{
  const f=await fixture(t);await f.ready('A');const pending=f.hold(c=>c.path==='/bootstrap');
  const publishing=f.w.handleInstructionAnalysisAction(f.button('publish'));await settle();
  const companyB={types:[],templates:[]};f.w.state.companyId='B';f.w.state.data=companyB;
  pending.resolve({types:[{id:'secret-A',name:'Private A'}],templates:[]});await publishing;
  assert.equal(f.w.state.data,companyB);assert.equal(f.calls.filter(c=>c.companyId==='B').length,0);
});
test('failed question reload keeps its warning while retry is pending and clears on success',async t=>{
  const f=await fixture(t);const failed=f.hold(c=>c.path==='/test-questions');const read=f.w.loadTestQuestions(true);
  failed.reject(Error('Offline'));await read;const pending=f.hold(c=>c.path==='/test-questions');const retry=f.w.loadTestQuestions(true);
  assert.match(f.d.getElementById('tqNotice').textContent,/Offline/);assert.match(f.d.getElementById('tqResults').textContent,/Prüfen/);
  pending.resolve(f.w.state.testQuestions);await retry;assert.doesNotMatch(f.d.getElementById('tqNotice').textContent,/Offline/);
});

test('an older upload bootstrap cannot replace the newer publication snapshot',async t=>{
  const f=await fixture(t);const first=f.hold(c=>c.path==='/bootstrap');const read1=f.w.refreshInstructionWorkspaceData('A');
  const second=f.hold(c=>c.path==='/bootstrap');const read2=f.w.refreshInstructionWorkspaceData('A');
  second.resolve({types:[{id:'existing',name:'Freigegebene Fassung',active:true}],templates:[]});await read2;
  first.resolve({types:[{id:'existing',name:'Veraltete Fassung',active:false}],templates:[]});await read1;
  assert.equal(f.w.state.data.types[0].name,'Freigegebene Fassung');
  assert.match(f.d.getElementById('instructionQuestionOverview').textContent,/Freigegebene Fassung/);
});
test('a failed processing poll retries and later displays the ready result',async t=>{
  const f=await fixture(t);const timers=new Map();let timerId=0;
  f.w.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};f.w.clearTimeout=id=>timers.delete(id);
  const initial=f.hold(c=>c.path==='/instruction-analyses/A');const opening=f.w.openInstructionAnalysis('A');initial.resolve(job('A','processing'));await opening;
  assert.equal(timers.size,1);const [id,callback]=timers.entries().next().value;timers.delete(id);
  const failed=f.hold(c=>c.path==='/instruction-analyses/A');callback();failed.reject(Error('Kurz offline'));await settle();
  assert.equal(timers.size,1,'Transient processing errors must schedule another poll');
  assert.match(f.d.getElementById('instructionAnalysisContent').textContent,/Kurz offline/);
  const [nextId,retry]=timers.entries().next().value;timers.delete(nextId);retry();await settle();
  assert.match(f.d.querySelector('.analysis-detail').textContent,/Entwurf prüfen/);assert.equal(timers.size,0);
  assert.equal(f.d.getElementById('analysisReviewConfirmed').checked,false);
});
test('newly published instruction options reach a mounted question editor without changing its draft',async t=>{
  const f=await fixture(t);f.button('new','question').click();const editor=f.d.getElementById('tqType');editor.value='existing';editor.dispatchEvent(new f.w.Event('change',{bubbles:true}));
  const question=f.d.getElementById('tqQuestion');question.value='Mein Fragenentwurf';question.dispatchEvent(new f.w.Event('input',{bubbles:true}));
  const bootstrap=f.hold(c=>c.path==='/bootstrap');const updating=f.w.refreshInstructionWorkspaceData('A');
  bootstrap.resolve({types:[...f.w.state.data.types,{id:'published-new',name:'Neue veröffentlichte Unterweisung',active:true}],templates:[]});await updating;
  assert.equal(f.d.getElementById('tqType'),editor);assert.equal(editor.value,'existing');
  assert.ok([...editor.options].some(o=>o.value==='published-new'));assert.equal(f.d.getElementById('tqQuestion'),question);assert.equal(question.value,'Mein Fragenentwurf');
});

for(const action of ['save','toggle']) test(`instruction ${action} supersedes a pre-write question read`,async t=>{
  const f=await fixture(t);const before=f.hold(c=>c.path==='/test-questions');const oldRead=f.w.loadTestQuestions(true);
  f.d.getElementById('itName').value='Neu';f.d.getElementById('itCategory').value='Sicherheit';
  const after=f.hold(c=>c.path==='/test-questions');const write=action==='save'?f.w.saveInstructionType():f.w.toggleInstructionType('existing',false);await settle();
  assert.equal(f.calls.filter(c=>c.path==='/test-questions').length,2);
  const fresh=[{...f.w.state.testQuestions[0],question:'Nach Änderung'}];after.resolve(fresh);await write;
  before.resolve([]);await oldRead;assert.equal(f.w.state.testQuestions[0].question,'Nach Änderung');
});
