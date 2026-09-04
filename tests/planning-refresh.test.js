import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const source=name=>readFileSync(new URL('../frontend/'+name,import.meta.url),'utf8');
const plan={id:'plan-1',instructionTypeId:'type-1',plannedAt:'2026-09-10T10:30:00Z',durationMinutes:30,location:'Raum A',status:'planned',employeeIds:['anna'],participantCount:1};
async function fixture(t,roles=['system_admin']){
  const dom=new JSDOM('<!doctype html><body><main><section id="planning" class="view active"></section></main></body>',{runScripts:'dangerously',url:'https://planning-test.invalid'});
  t.after(()=>dom.window.close());const w=dom.window;
  await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
  const requests=[],frames=[];
  Object.assign(w,{
    state:{companyId:'demo',apiAvailable:true,me:{roles},data:{}},API_BASE_URL:'',
    $:id=>w.document.getElementById(id),esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    employees:()=>[{id:'anna',name:'Anna Beispiel',department:'Lager',email:'anna@example.invalid'},{id:'ben',name:'Ben Muster',department:'Büro'}],
    emp:()=>({name:'Anna Beispiel'}),types:()=>[{id:'type-1',name:'Sicherheit',active:true}],type:()=>({name:'Sicherheit'}),
    plannedTrainings:()=>w.state.data?.plannedTrainings||[],render:()=>w.renderPlanning(),
    requestAnimationFrame:fn=>frames.push(fn),
    api:(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,companyId:w.state.companyId,resolve,reject})),
    alert:message=>{throw new Error('Unexpected alert: '+message);}
  });
  w.console.warn=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
  for(const name of ['planning-management-v24.js','table-form-design-v33.js','view-header-design-v34.js','professional-suite-v35.js'])w.eval(source(name));
  const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();for(const fn of frames.splice(0))fn();};
  w.render();await settle();
  const click=action=>{const button=w.document.querySelector(`[data-planning-action="${action}"]`);assert.ok(button);button.click();};
  return {w,requests,settle,click};
}

test('preview initial planning load preserves the focused draft, search and selected participants',async t=>{
  const {w,requests,settle}=await fixture(t);
  const input=w.$('planLocation'),search=w.$('planEmployeeSearch'),checkbox=w.document.querySelector('.planEmployee');
  input.value='Mein Entwurf';search.value='Ben';search.dispatchEvent(new w.Event('input'));checkbox.checked=true;input.focus();
  requests[0].resolve([plan]);await settle();
  assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Mein Entwurf');assert.equal(w.document.activeElement,input);
  assert.equal(w.$('planEmployeeSearch'),search);assert.equal(search.value,'Ben');assert.equal(checkbox.checked,true);
  assert.match(w.$('planning').textContent,/Raum A/);assert.ok(w.document.querySelector('[data-planning-action="edit"].ui-button'));
});
test('manual planning refresh uses delegated actions and preserves the mounted form',async t=>{
  const {w,requests,settle,click}=await fixture(t);requests[0].resolve([]);await settle();
  const input=w.$('planLocation');input.value='Nicht verlieren';click('refresh');requests[1].resolve([plan]);await settle();
  assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Nicht verlieren');click('edit');assert.equal(input.value,'Raum A');
});
test('multiple planning refresh clicks share one pending request',async t=>{
  const {requests,settle,click}=await fixture(t);click('refresh');click('refresh');assert.equal(requests.length,1);
  requests[0].resolve([]);await settle();
});
test('revisiting planning while loading updates only the new results',async t=>{
  const {w,requests,settle}=await fixture(t);w.render();await settle();
  const input=w.$('planLocation');input.value='Neuer Entwurf';requests[0].resolve([plan]);await settle();
  assert.equal(requests.length,1);assert.equal(w.$('planLocation'),input);assert.equal(input.value,'Neuer Entwurf');assert.match(w.$('planning').textContent,/Raum A/);
});
test('failed planning reload keeps rows and notice through revisit and pending recovery',async t=>{
  const {w,requests,settle,click}=await fixture(t);requests[0].resolve([plan]);await settle();
  click('refresh');requests[1].reject(new Error('Unavailable'));await settle();w.render();await settle();
  assert.match(w.$('planning').textContent,/konnten nicht geladen werden/i);assert.match(w.$('planning').textContent,/Raum A/);
  click('refresh');w.render();await settle();assert.match(w.$('planning').textContent,/konnten nicht geladen werden/i);
  requests[2].resolve([]);await settle();assert.doesNotMatch(w.$('planning').textContent,/konnten nicht geladen werden/i);
  assert.doesNotMatch(w.$('planning').textContent,/Raum A/);assert.equal(requests.length,3);
});
test('company switches neither accept foreign planning responses nor foreign errors',async t=>{
  const {w,requests,settle,click}=await fixture(t);
  w.state.companyId='second';w.state.data={};w.render();await settle();assert.equal(requests.length,2);
  requests[0].resolve([{...plan,location:'Fremde Firma'}]);await settle();assert.doesNotMatch(w.$('planning').textContent,/Fremde Firma/);
  click('refresh');assert.equal(requests.length,2);requests[1].reject(new Error('Unavailable'));await settle();
  assert.match(w.$('planning').textContent,/konnten nicht geladen werden/i);
  w.state.companyId='third';w.state.data={};w.render();await settle();assert.doesNotMatch(w.$('planning').textContent,/konnten nicht geladen werden/i);
  requests[2].resolve([]);await settle();
});
test('A-B-A navigation reuses the original company request without duplicate reads',async t=>{
  const {w,requests,settle}=await fixture(t);
  w.state.companyId='second';w.state.data={};w.render();await settle();
  w.state.companyId='demo';w.state.data={};w.render();await settle();assert.equal(requests.length,2);
  requests[1].resolve([{...plan,location:'Fremde Firma'}]);requests[0].resolve([plan]);await settle();
  assert.match(w.$('planning').textContent,/Raum A/);assert.doesNotMatch(w.$('planning').textContent,/Fremde Firma/);
});
test('read-only users gain no edit actions after asynchronous planning updates',async t=>{
  const {w,requests,settle}=await fixture(t,['employee']);requests[0].resolve([plan]);await settle();
  assert.match(w.$('planning').textContent,/Raum A/);assert.equal(w.$('planLocation'),null);
  assert.equal(w.document.querySelector('[data-planning-action="edit"]'),null);
});
test('a successful save requests fresh plans and rejects the older pre-save response',async t=>{
  const {w,requests,settle}=await fixture(t);
  w.loadData=async()=>{};w.setView=()=>w.render();
  w.$('planType').value='type-1';w.$('planAt').value='2026-09-10T10:30';w.document.querySelector('.planEmployee').checked=true;
  const saving=w.savePlannedTraining();assert.equal(requests[1].options.method,'POST');
  requests[1].resolve({id:'new'});await settle();assert.equal(requests.length,3);
  requests[2].resolve([{...plan,location:'Gespeicherter Raum'}]);await saving;await settle();
  requests[0].resolve([plan]);await settle();assert.equal(w.state.data.plannedTrainings[0].location,'Gespeicherter Raum');
});
