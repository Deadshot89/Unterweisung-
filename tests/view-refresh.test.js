import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => readFileSync(new URL('../frontend/' + name, import.meta.url), 'utf8');
const question = { id:'q-1', instructionTypeId:'type-1', instructionName:'Lagersicherheit', language:'de', question:'Synthetische Testfrage?', options:['A','B'], correctIndex:0, active:true };
const plan = { id:'plan-1', instructionTypeId:'type-1', plannedAt:'2026-09-10T10:30:00Z', durationMinutes:30, location:'Test-Raum', lineManagerId:'anna', status:'planned', employeeIds:['anna'], participantCount:1 };

async function fixture(t, view, roles=['system_admin']) {
  // Real renderers, loaders, markup, inline handlers and visual layers; only the API is simulated.
  const dom = new JSDOM('<!doctype html><body><main><nav class="primary-tabs"><button data-view="planning">Planung</button><button data-view="instructions">Unterweisungen</button></nav><section id="planning" class="view"></section><section id="instructions" class="view"></section></main></body>', {runScripts:'dangerously', url:'https://ui-test.invalid'});
  t.after(()=>dom.window.close());
  const w=dom.window;
  await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
  const requests=[], frames=[], warnings=[];
  const types=[{id:'type-1',name:'Lagersicherheit',category:'Test',active:true,description:'Vollständiger Inhalt',templateId:'tpl-1'}, {id:'type-2',name:'Erste Hilfe',category:'Test',active:true}];
  Object.assign(w, {
    state:{me:{roles},companyId:'demo',apiAvailable:true,data:{},testQuestions:[]}, API_BASE_URL:'',DEFAULT_COMPANY_ID:'demo',
    $:id=>w.document.getElementById(id),
    esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    types:()=>types, type:id=>types.find(row=>row.id===id)||{},
    employees:()=>[{id:'anna',name:'Anna Beispiel',department:'Lager',email:'anna@example.invalid'},{id:'ben',name:'Ben Muster',department:'Büro'}],
    emp:()=>({name:'Anna Beispiel'}), templates:()=>[{id:'tpl-1',title:'Testunterlage',fileName:'Test.pdf',active:true}],
    plannedTrainings:()=>w.state.data.plannedTrainings||[],
    render:id=>id==='planning'?w.renderPlanning():w.renderInstructions(),
    requestAnimationFrame:fn=>frames.push(fn),
    api:(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})),
    alert:message=>{throw new Error('Unexpected alert: '+message);}
  });
  w.console.warn=(...args)=>warnings.push(args);
  w.HTMLElement.prototype.scrollIntoView=function(){};
  for(const file of ['styles.css','professional-suite-v35.css']) {
    const style=w.document.createElement('style');style.textContent=source(file);w.document.head.append(style);
  }
  for(const file of ['template-management-v21.js','test-question-management-v22.js','instruction-type-management-v23.js','planning-management-v24.js','table-form-design-v33.js','view-header-design-v34.js','professional-suite-v35.js']) w.eval(source(file));
  const flushFrames=()=>{for(const frame of frames.splice(0)) frame();};
  const settle=async()=>{for(let i=0;i<12;i++) await Promise.resolve();flushFrames();};
  w.$(view).classList.add('active');w.render(view);flushFrames();
  const click=text=>{
    const button=Array.from(w.$(view).querySelectorAll('button')).find(b=>b.textContent.trim()===text);
    assert.ok(button,'button exists: '+text);button.click();return button;
  };
  return {w,requests,warnings,settle,click};
}

test('initial planning load preserves the focused draft and participant selection',async t=>{
  const {w,requests,settle}=await fixture(t,'planning');
  const input=w.$('planLocation'), search=w.$('planEmployeeSearch'), checkbox=w.document.querySelector('.planEmployee');
  input.value='Nicht gespeicherter Raum';checkbox.checked=true;search.value='Ben';search.dispatchEvent(new w.Event('input'));input.focus();
  requests[0].resolve([plan]);await settle();
  assert.equal(w.$('planLocation'),input,'asynchronous load must not replace the form');
  assert.equal(input.value,'Nicht gespeicherter Raum');assert.equal(w.document.activeElement,input);
  assert.equal(w.$('planEmployeeSearch'),search);assert.equal(search.value,'Ben');assert.equal(checkbox.checked,true);
  assert.match(w.$('planning').textContent,/Test-Raum/);
  assert.ok(w.$('planning').querySelector('.view-head'));
  assert.ok(w.$('planning').querySelector('button.primary.ui-button'));
  assert.equal(requests.length,1);
});

test('manual planning reload updates only the list and polishes new action buttons',async t=>{
  const {w,requests,settle,click}=await fixture(t,'planning');
  requests[0].resolve([]);await settle();
  const input=w.$('planLocation');input.value='Mein Entwurf';
  click('Planungen neu laden');assert.equal(requests.length,2);
  requests[1].resolve([plan]);await settle();
  assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Mein Entwurf');
  const edit=Array.from(w.$('planning').querySelectorAll('button')).find(b=>b.textContent==='Bearbeiten');
  assert.ok(edit?.classList.contains('ui-button'),'new list actions must be styled');
  edit.click();assert.equal(w.$('planLocation').value,'Test-Raum');assert.equal(w.$('planId').value,'plan-1');
});

test('initial question load retains all draft controls, upload selection node and open details',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  w.document.querySelector('[data-instruction-details="type-1"]').click();
  const fields=['itName','tplTitle','tplFile','tqQuestion','tqA'].map(id=>w.$(id));
  for(const field of fields)if(field.type!=='file')field.value='Entwurf '+field.id;
  fields[0].focus();const detail=w.$('instructionDetail');
  requests[0].resolve([question]);await settle();
  for(const field of fields){assert.equal(w.$(field.id),field,'preserve '+field.id);if(field.type!=='file')assert.equal(field.value,'Entwurf '+field.id);}
  assert.equal(w.document.activeElement,fields[0]);assert.equal(w.$('instructionDetail'),detail);assert.equal(detail.hidden,false);
  assert.match(w.$('instructionResults').textContent,/1 aktiv/);assert.match(w.$('instructions').textContent,/Synthetische Testfrage/);
});

test('asynchronously refreshed instructions keep overview styling and headers',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  requests[0].resolve([question]);await settle();
  assert.ok(w.$('instructionResults').querySelector('[data-instruction-details].ui-button'));
  assert.ok(w.$('instructionResults').querySelector('table.professional-table'));
  assert.ok(w.$('instructions').querySelector('.view-head'));
});

for(const result of ['empty','error'])test(result+' question responses stop loading without replacing drafts',async t=>{
  const {w,requests,settle,click}=await fixture(t,'instructions');
  const input=w.$('itName');input.value='Behalten';
  if(result==='empty')requests[0].resolve([]);else requests[0].reject(new Error('Synthetic unavailable'));
  await settle();
  assert.equal(requests.length,1,'no self-triggered repeat request');assert.equal(w.$('itName'),input);assert.equal(input.value,'Behalten');
  if(result==='error')assert.match(w.$('instructions').textContent,/konnten nicht geladen werden/i);
  click('Fragen neu laden');assert.equal(requests.length,2,'explicit retry remains possible');
  requests[1].resolve([question]);await settle();assert.match(w.$('instructionResults').textContent,/1 aktiv/);assert.equal(w.$('itName'),input);
});

test('repeated reload clicks share one pending question request',async t=>{
  const {requests,settle,click}=await fixture(t,'instructions');
  click('Fragen neu laden');click('Fragen neu laden');
  assert.equal(requests.length,1,'coalesce pending GETs');
  requests[0].resolve([question]);await settle();
});

test('question filters update results without erasing instruction, upload or question drafts',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  requests[0].resolve([question,{...question,id:'q-2',instructionTypeId:'type-2',instructionName:'Erste Hilfe',language:'en',question:'English question?'}]);await settle();
  const fields=['itName','tplTitle','tplFile','tqQuestion','tqA'].map(id=>w.$(id));
  for(const field of fields)if(field.type!=='file')field.value='Behalten';
  const filter=w.$('tqLangFilter');filter.value='en';filter.focus();filter.dispatchEvent(new w.Event('change'));await settle();
  for(const field of fields)assert.equal(w.$(field.id),field,'filter must preserve '+field.id);
  assert.equal(w.document.activeElement,filter);
  assert.doesNotMatch(w.$('instructions').textContent,/Synthetische Testfrage/);assert.match(w.$('instructions').textContent,/English question/);
  const typeFilter=w.$('tqTypeFilter');typeFilter.value='type-1';typeFilter.dispatchEvent(new w.Event('change'));await settle();
  assert.doesNotMatch(w.$('instructions').textContent,/English question/);assert.equal(w.$('tqQuestion').value,'Behalten');
});

test('planning errors retain cached rows and drafts, with explicit recovery',async t=>{
  const {w,requests,settle,click}=await fixture(t,'planning');
  requests[0].resolve([plan]);await settle();const input=w.$('planLocation');input.value='Behalten';
  click('Planungen neu laden');requests[1].reject(new Error('Synthetic unavailable'));await settle();
  assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Behalten');assert.match(w.$('planning').textContent,/Test-Raum/);
  assert.match(w.$('planning').textContent,/konnten nicht geladen werden/i);assert.equal(requests.length,2);
  click('Planungen neu laden');requests[2].resolve([]);await settle();
  assert.doesNotMatch(w.$('planning').textContent,/Test-Raum/);assert.doesNotMatch(w.$('planning').textContent,/konnten nicht geladen werden/i);
});

test('late read-only list updates never add edit controls',async t=>{
  const {w,requests,settle}=await fixture(t,'planning',['employee']);
  requests[0].resolve([plan]);await settle();
  assert.match(w.$('planning').textContent,/Test-Raum/);assert.equal(w.$('planLocation'),null);
  assert.equal(Array.from(w.$('planning').querySelectorAll('button')).some(b=>b.textContent==='Bearbeiten'),false);
});

test('returning to planning during a pending load updates the new view without resetting it',async t=>{
  const {w,requests,settle}=await fixture(t,'planning');
  w.render('planning');await settle();
  const input=w.$('planLocation');input.value='Neuer Entwurf';
  requests[0].resolve([plan]);await settle();
  assert.equal(requests.length,1);assert.match(w.$('planning').textContent,/Test-Raum/);
  assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Neuer Entwurf');
});

test('returning to instructions during a pending load updates the new view without resetting it',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  w.render('instructions');await settle();
  const input=w.$('itName');input.value='Neuer Entwurf';
  requests[0].resolve([question]);await settle();
  assert.equal(requests.length,1);assert.match(w.$('instructionResults').textContent,/1 aktiv/);
  assert.equal(w.$('itName'),input);assert.equal(input.value,'Neuer Entwurf');
});

test('failed question reload retains cached questions until a successful explicit retry',async t=>{
  const {w,requests,settle,click}=await fixture(t,'instructions');
  requests[0].resolve([question]);await settle();
  click('Fragen neu laden');requests[1].reject(new Error('Synthetic unavailable'));await settle();
  assert.match(w.$('tqResults').textContent,/Synthetische Testfrage/);assert.match(w.$('instructionResults').textContent,/1 aktiv/);
  assert.match(w.$('tqLoadStatus').textContent,/konnten nicht geladen werden/i);
  click('Fragen neu laden');requests[2].resolve([]);await settle();
  assert.doesNotMatch(w.$('tqResults').textContent,/Synthetische Testfrage/);assert.equal(w.$('tqLoadStatus').textContent,'');
  assert.match(w.$('instructionResults').textContent,/0 aktiv/);
  w.render('instructions');await settle();assert.equal(requests.length,3,'empty successful response is cached on revisit');
});

test('saving a question preserves unrelated drafts and the existing POST payload',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  requests[0].resolve([question]);await settle();
  const instruction=w.$('itName'),upload=w.$('tplFile');instruction.value='Nicht speichern';
  w.$('tqType').value='type-1';w.$('tqQuestion').value='Neue Frage?';w.$('tqA').value='Ja';w.$('tqB').value='Nein';
  const saving=w.saveNewTestQuestion();
  assert.equal(requests[1].path,'/test-questions');assert.equal(requests[1].options.method,'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body),{instructionTypeId:'type-1',language:'de',question:'Neue Frage?',options:['Ja','Nein'],correctIndex:0,active:true});
  requests[1].resolve({id:'new-question'});await settle();
  assert.equal(requests[2].path,'/test-questions');requests[2].resolve([question]);await saving;await settle();
  assert.equal(w.$('itName'),instruction);assert.equal(instruction.value,'Nicht speichern');assert.equal(w.$('tplFile'),upload);assert.equal(w.$('tqQuestion').value,'');
});

for(const view of ['planning','instructions'])test(view+' reloads are coalesced only within the same company',async t=>{
  const {w,requests,settle,click}=await fixture(t,view);
  w.state.companyId='second-company';w.state.data={};
  w.render(view);await settle();
  const reload=view==='planning'?'Planungen neu laden':'Fragen neu laden';click(reload);
  assert.equal(requests.length,2,'new company needs its own request');
  requests[0].resolve(view==='planning'?[{...plan,location:'Wrong company'}]:[{...question,question:'Wrong company'}]);await settle();
  assert.doesNotMatch(w.$(view).textContent,/Wrong company/);
  click(reload);assert.equal(requests.length,2,'old completion must not clear the newer pending request');
  requests[1].resolve(view==='planning'?[plan]:[question]);await settle();
  assert.match(w.$(view).textContent,view==='planning'?/Test-Raum/:/Synthetische Testfrage/);
});

test('switching company clears previously loaded question rows and counts before rendering',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  requests[0].resolve([question]);await settle();
  w.state.companyId='second-company';w.state.data={};w.render('instructions');await settle();
  assert.doesNotMatch(w.$('instructions').textContent,/Synthetische Testfrage/);
  assert.match(w.$('instructionResults').textContent,/0 aktiv/);assert.equal(requests.length,2);
  requests[1].resolve([]);await settle();
});

for(const view of ['planning','instructions'])test(view+' retains one request per company across A-B-A navigation',async t=>{
  const {w,requests,settle,click}=await fixture(t,view);
  w.state.companyId='second-company';w.state.data={};w.render(view);await settle();
  click(view==='planning'?'Planungen neu laden':'Fragen neu laden');
  w.state.companyId='demo';w.state.data={};w.render(view);await settle();
  assert.equal(requests.length,2,'reuse original pending A request');
  requests[1].resolve(view==='planning'?[{...plan,location:'Wrong company'}]:[{...question,question:'Wrong company'}]);await settle();
  requests[0].resolve(view==='planning'?[plan]:[question]);await settle();
  assert.doesNotMatch(w.$(view).textContent,/Wrong company/);
  assert.match(w.$(view).textContent,view==='planning'?/Test-Raum/:/Synthetische Testfrage/);
});

test('saving during an older question read forces a new read and ignores the old response',async t=>{
  const {w,requests,settle}=await fixture(t,'instructions');
  w.$('tqType').value='type-1';w.$('tqQuestion').value='Neue Frage?';w.$('tqA').value='Ja';w.$('tqB').value='Nein';
  const saving=w.saveNewTestQuestion();requests[1].resolve({id:'new-question'});await settle();
  assert.equal(requests.length,3,'post-save read must not reuse a pre-save request');
  requests[2].resolve([{...question,question:'Neue gespeicherte Frage'}]);await saving;await settle();
  requests[0].resolve([question]);await settle();
  assert.match(w.$('tqResults').textContent,/Neue gespeicherte Frage/);assert.doesNotMatch(w.$('tqResults').textContent,/Synthetische Testfrage/);
});

test('saving during an older planning read forces a new read and ignores the old response',async t=>{
  const {w,requests,settle}=await fixture(t,'planning');
  w.loadData=async()=>{w.state.data.plannedTrainings=[{...plan,location:'Fresh bootstrap'}];};
  w.setView=id=>w.render(id);
  w.$('planType').value='type-1';w.$('planAt').value='2026-09-10T10:30';w.document.querySelector('.planEmployee').checked=true;
  const saving=w.savePlannedTraining();requests[1].resolve({id:'new-plan'});await settle();
  assert.equal(requests.length,3,'post-save read must not reuse a pre-save request');
  requests[2].resolve([{...plan,location:'Fresh saved plan'}]);await saving;await settle();
  requests[0].resolve([plan]);await settle();
  assert.equal(w.state.data.plannedTrainings[0].location,'Fresh saved plan');assert.match(w.$('planning').textContent,/Fresh saved plan/);
});
