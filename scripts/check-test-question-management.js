import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const api = readFileSync('api/src/functions/testQuestions.js', 'utf8');
const ui = readFileSync('frontend/test-question-management-v22.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(api, /route:\s*'test-questions\/\{id\?\}'/, 'Testfragen-Endpunkt muss registriert sein.');
assert.match(api, /methods:\s*\['GET', 'POST', 'PATCH'\]/, 'Testfragen-API muss GET, POST und PATCH unterstützen.');
assert.match(api, /INSERT INTO TestQuestions/, 'Testfragen-API muss neue Fragen anlegen können.');
assert.match(api, /UPDATE TestQuestions SET/, 'Testfragen-API muss Fragen bearbeiten können.');
assert.match(api, /optionsJson/, 'Testfragen-API muss Antwortoptionen als JSON speichern.');
assert.match(api, /correctIndex/, 'Testfragen-API muss richtige Antwort speichern.');
assert.match(api, /testQuestion\.created/, 'Testfragen-Anlage muss auditiert werden.');
assert.match(api, /testQuestion\.updated/, 'Testfragen-Änderung muss auditiert werden.');
assert.match(api, /Roles\.COMPANY_ADMIN, Roles\.HSE/, 'Schreiben muss auf Company Admin/HSE begrenzt sein.');

assert.match(ui, /Testfragen/, 'Frontend muss Testfragen-Bereich anzeigen.');
assert.match(ui, /loadTestQuestions/, 'Frontend muss Testfragen laden.');
assert.match(ui, /saveNewTestQuestion/, 'Frontend muss neue Testfragen speichern.');
assert.match(ui, /toggleTestQuestion/, 'Frontend muss Fragen aktivieren\/deaktivieren können.');
assert.match(ui, /editTestQuestion/, 'Frontend muss Fragen bearbeiten können.');
assert.match(ui, /Richtige Antwort/, 'Frontend muss richtige Antwort auswählbar machen.');
assert.match(index, /test-question-management-v22\.js/, 'Index muss Testfragen-Management laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Test question management checks passed');

// A real DOM catches lost drafts and duplicate bindings; only the remote API is replaced.
const dom = new JSDOM('<main id="instructions"><input id="otherDraft" value="Keep me"><div id="questionsMount"></div></main>', {runScripts:'outside-only',url:'https://example.test/'});
const w = dom.window;
const d = w.document;
const bank = Array.from({length:63}, (_,i)=>({
  id:`q-${String(i).padStart(3,'0')}`,companyId:'company-test',instructionTypeId:i===62?'retired':'safety',
  instructionName:i===62?'Alte Unterweisung':'Sicherheit',language:i===1?'en':'de',active:i!==1,
  question:`Frage ${String(i).padStart(3,'0')}`+(i===0?' '+('Langer Quelltext '.repeat(40))+'<img src=x onerror=alert(1)>':''),
  options:i===0?['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot']:['Ja','Nein','Prüfen','Melden'],correctIndex:i===0?5:i%4
}));
w.state={companyId:'company-test',me:{roles:['company_admin']},testQuestions:structuredClone(bank),apiAvailable:true};
w.API_BASE_URL='/api';w.DEFAULT_COMPANY_ID='company-test';w.console=console;
w.$=id=>d.getElementById(id);
w.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
w.types=()=>[{id:'safety',name:'Sicherheit',active:true},{id:'retired',name:'Alte Unterweisung',active:false}];
w.type=id=>w.types().find(t=>t.id===id)||{};
w.renderInstructions=()=>{throw new Error('Question interactions must not rebuild the complete instruction view');};
w.alert=message=>{throw new Error('Use an inline message: '+message);};
let permitDiscard=true;
w.confirm=()=>permitDiscard;
w.HTMLElement.prototype.scrollIntoView=function(){};
const calls=[];
let failReads=false;
let failWrites=false;
let holdWrite=null;
w.api=async (path,options)=>{
  calls.push({path,method:options?.method||'GET',body:options?.body?JSON.parse(options.body):null});
  if(!options){if(failReads) throw new Error('Reload unavailable');return structuredClone(bank);}
  if(failWrites) throw new Error('Write unavailable');
  if(holdWrite) await holdWrite;
  const body=JSON.parse(options.body);
  if(options.method==='POST'){bank.push({...body,id:'created-question',companyId:'company-test'});return {ok:true,id:'created-question'};}
  const row=bank.find(q=>q.id===decodeURIComponent(path.split('/').pop()));
  Object.assign(row,body);return {ok:true,id:row.id};
};
w.eval(ui);
const mount=()=>{d.getElementById('questionsMount').innerHTML=w.testQuestionManagerCard();w.bindTestQuestionWorkspace?.();};
const fire=(id,value,event='input')=>{const input=d.getElementById(id);assert.ok(input,`Missing input ${id}`);input.value=value;input.dispatchEvent(new w.Event(event,{bubbles:true}));return input;};
const click=(action,id)=>{const button=[...d.querySelectorAll('[data-question-action]')].find(x=>x.dataset.questionAction===action&&(!id||x.dataset.id===id));assert.ok(button,`Missing action ${action} ${id||''}`);button.click();};
const visible=()=>[...d.querySelectorAll('#tqResults tbody tr')];
mount();
assert.ok(d.querySelectorAll('tbody tr').length<=25,'The question overview must paginate large banks instead of rendering every question.');
assert.equal(visible().length,25);
assert.equal(d.getElementById('tqQuestion'),null,'The editor is opened intentionally, not permanently placed above the list.');
assert.doesNotMatch(d.getElementById('tqResults').textContent,/Foxtrot/,'Full answer text belongs in the selected question detail.');
click('open','q-000');
assert.match(d.getElementById('tqDetail').textContent,/Foxtrot/);
assert.ok(d.getElementById('tqDetail').textContent.includes(bank[0].question),'Detail retains the complete question.');
assert.equal(d.querySelector('#tqDetail img'),null,'Question text is escaped.');
click('edit','q-000');
assert.equal(d.getElementById('tqF').value,'Foxtrot','Editing must preserve all six answers supported by the API.');
assert.equal(d.getElementById('tqCorrect').value,'5');
const draft=fire('tqQuestion','Unsaved question');draft.focus();
const search=fire('tqSearch','Foxtrot');
assert.equal(visible().length,1,'Search includes full answer text even when answers are not in the overview.');
assert.equal(d.getElementById('tqQuestion'),draft,'Filtering must keep the mounted editor.');
assert.equal(d.getElementById('otherDraft').value,'Keep me');
assert.equal(calls.length,0,'Filtering performs no requests.');
fire('tqSearch','');click('next');
assert.equal(visible().length,25);assert.equal(d.getElementById('tqQuestion'),draft);
mount();
assert.equal(d.getElementById('tqQuestion').value,'Unsaved question','A surrounding page render must restore the draft.');
assert.match(d.getElementById('tqResults').textContent,/Frage 025/,'Page selection survives a surrounding render.');
fire('tqLangFilter','en','change');
assert.equal(visible().length,1,'Changing a filter resets pagination.');
fire('tqStatusFilter','active','change');assert.equal(visible().length,0);
fire('tqStatusFilter','inactive','change');assert.equal(visible().length,1);
click('reset');
fire('tqTypeFilter','retired','change');assert.equal(visible().length,1,'Questions for inactive instruction types remain reachable.');
click('reset');
permitDiscard=false;click('new');assert.equal(d.getElementById('tqQuestion').value,'Unsaved question','An unconfirmed replacement keeps the draft.');
permitDiscard=true;click('new');
fire('tqType','safety','change');fire('tqQuestion','A new question');
fire('tqA','First');fire('tqB','Second');fire('tqC','');fire('tqD','Fourth');
assert.throws(()=>w.readQuestionForm(),/richtige Antwort/i,'New questions require an explicit answer selection.');
fire('tqCorrect','2','change');assert.throws(()=>w.readQuestionForm(),/leer/i,'Selecting an empty answer must be rejected before compacting options.');
fire('tqCorrect','3','change');
const payload=JSON.parse(JSON.stringify(w.readQuestionForm()));
assert.deepEqual(payload.options,['First','Second','Fourth']);
assert.equal(payload.correctIndex,2,'The selected answer keeps its meaning after an optional blank slot is removed.');
fire('tqA','');assert.throws(()=>w.readQuestionForm(),/A und B/);fire('tqA','First');
failWrites=true;await w.saveNewTestQuestion();
assert.equal(d.getElementById('tqQuestion').value,'A new question');
assert.match(d.getElementById('tqNotice').textContent,/Write unavailable/);
failWrites=false;calls.length=0;
let releaseWrite;holdWrite=new Promise(resolve=>{releaseWrite=resolve;});
const save=w.saveNewTestQuestion();await w.saveNewTestQuestion();
assert.equal(calls.filter(c=>c.method==='POST').length,1,'Repeated save clicks must issue only one write.');
releaseWrite();await save;holdWrite=null;
assert.equal(d.getElementById('tqQuestion'),null);
assert.equal(calls[0].body.correctIndex,2);assert.equal(calls[0].path,'/test-questions');
click('open','q-000');click('edit','q-000');
fire('tqQuestion','Updated six-answer question');await w.saveNewTestQuestion();
const patch=calls.find(c=>c.method==='PATCH');
assert.equal(patch.path,'/test-questions/q-000');assert.equal(patch.body.correctIndex,5);assert.equal(patch.body.options[5],'Foxtrot');
bank[0].question='Changed on server';bank[0].options[5]='Updated final answer';bank[0].active=false;
await w.refreshTestQuestions();
assert.match(d.getElementById('tqDetail').textContent,/Changed on server/,'A refresh updates the selected read-only detail.');
assert.match(d.getElementById('tqDetail').textContent,/Updated final answer/);
assert.equal(d.querySelector('#tqDetail [data-question-action="toggle"]').textContent,'Aktivieren');
click('edit','q-000');fire('tqQuestion','Keep through refresh');
failReads=true;await w.refreshTestQuestions();
assert.equal(d.getElementById('tqQuestion').value,'Keep through refresh');
assert.match(d.getElementById('tqNotice').textContent,/Reload unavailable/);
assert.ok(visible().length>0,'A failed refresh keeps the previously loaded list.');
failReads=false;
w.state.me.roles=[];mount();const before=calls.length;
w.editTestQuestion('q-000');await w.saveNewTestQuestion();await w.toggleTestQuestion('q-000',false);
assert.equal(calls.length,before,'Read-only users cannot trigger writes through the handlers.');
assert.equal(d.querySelector('[data-question-action="new"]'),null);
w.state.me.roles=['company_admin'];w.state.companyId='another-company';mount();
assert.equal(d.getElementById('tqQuestion'),null,'Switching company clears the previous company draft.');
assert.equal(visible().length,0,'Previous company questions are not shown after switching.');

// Exercise the real instruction-page renderer and action binder, not just the isolated card.
w.eval(readFileSync('frontend/instruction-type-management-v23.js','utf8'));
w.eval(readFileSync('frontend/instruction-analysis.js','utf8'));
w.templates=()=>[];w.templateForType=()=>null;w.templateOptions=()=>'<option value="">Keine Vorlage</option>';
w.templateUploadCard=()=>'<input id="templateDraft" value="Keep template">';
w.templateListCard=()=>'';w.instructionAnalysisCard=()=>'';w.loadInstructionAnalyses=()=>{};
w.bindTemplateWorkspaceControls=()=>{};
d.getElementById('instructions').classList.add('active');
w.state.testQuestions=[];calls.length=0;
let readActive=false;
w.api=async(path)=>{
  calls.push({path,company:w.state.companyId});
  return [{...bank[1],id:'scope-'+w.state.companyId,companyId:w.state.companyId,question:'Scope '+w.state.companyId,active:readActive}];
};
w.renderInstructions();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(visible().length,1);
click('new');fire('tqQuestion','Draft in real page');
const realEditor=d.getElementById('tqQuestion');
fire('tqLangFilter','en','change');
assert.equal(d.getElementById('tqQuestion'),realEditor,'The real owner must not attach an additional full-page filter handler.');
assert.equal(d.getElementById('templateDraft').value,'Keep template');
readActive=true;await w.refreshTestQuestions();
const instructionRow=d.querySelector('.instruction-table [data-instruction-id="safety"]').closest('tr');
assert.equal(instructionRow.cells[4].textContent,'1 aktiv','Reloading questions also updates the instruction overview count.');
assert.equal(d.getElementById('tqQuestion'),realEditor,'Refreshing question counts must retain the editor.');
w.state.companyId='last-company';w.renderInstructions();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(calls.filter(c=>c.path==='/test-questions').length,3,'The owner must load questions again after changing company.');
assert.match(d.getElementById('tqResults').textContent,/Scope last-company/);
assert.equal(d.getElementById('tqQuestion'),null);

// A GET that began before a save must not overwrite the saved question with an old snapshot.
click('open','scope-last-company');click('edit','scope-last-company');fire('tqQuestion','Saved after pending read');
let releaseRead;const slowRead=new Promise(resolve=>{releaseRead=resolve;});
const oldSnapshot=JSON.parse(JSON.stringify(w.state.testQuestions));const server=structuredClone(oldSnapshot);let reads=0;
w.api=async(path,options)=>{
  if(!options){reads++;return reads===1?slowRead:structuredClone(server);}
  Object.assign(server[0],JSON.parse(options.body));return {ok:true,id:server[0].id};
};
const refreshing=w.refreshTestQuestions();const saving=w.saveNewTestQuestion();
await new Promise(resolve=>setImmediate(resolve));releaseRead(oldSnapshot);
await Promise.all([refreshing,saving]);
assert.equal(w.state.testQuestions[0].question,'Saved after pending read','A stale read cannot win over a completed write.');

// Other instruction actions may start a question GET while PATCH is already pending.
click('edit','scope-last-company');fire('tqQuestion','Saved during overlapping read');
let completeWrite,completeRead;
const duringWrite=new Promise(resolve=>{completeWrite=resolve;});
const duringRead=new Promise(resolve=>{completeRead=resolve;});
const beforeWrite=structuredClone(server);reads=0;
w.api=async(path,options)=>{
  if(!options){reads++;return reads===1?duringRead:structuredClone(server);}
  await duringWrite;Object.assign(server[0],JSON.parse(options.body));return {ok:true,id:server[0].id};
};
const overlappingSave=w.saveNewTestQuestion();
const overlappingLoad=w.loadTestQuestions(true);
completeWrite();await new Promise(resolve=>setImmediate(resolve));completeRead(beforeWrite);
await Promise.all([overlappingSave,overlappingLoad]);
assert.equal(w.state.testQuestions[0].question,'Saved during overlapping read','A GET started during PATCH cannot replace the saved question.');
dom.window.close();
console.log('Question workspace DOM, paging, draft, authorization and answer mapping checks passed');
