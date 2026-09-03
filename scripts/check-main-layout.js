import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => readFileSync(new URL('../frontend/' + name, import.meta.url), 'utf8');
function fixture(roles = ['system_admin']) {
  const dom = new JSDOM('<!doctype html><body class="app-shell-v35"><nav class="tabs primary-tabs pro-navigation"><button>Dashboard</button><button>Sicherheit</button></nav><section id="planning"></section><section id="instructions"></section></body>', { runScripts:'outside-only', pretendToBeVisual:true });
  const w = dom.window;
  for(const file of ['styles.css','professional-suite-v35.css']) {
    const style = w.document.createElement('style'); style.textContent = source(file); w.document.head.append(style);
  }
  w.HTMLElement.prototype.scrollIntoView = function(){};
  const description = 'Sicherheitsinhalt mit vollständiger Erklärung. '.repeat(50) + '<img src=x onerror=alert(1)>';
  const instructionTypes = [{id:'type-1',name:'Lager & Sicherheit',category:'Sicherheit',intervalMonths:12,description,active:true}, {id:'type-2',name:'Erste Hilfe',category:'Gesundheit',description:'Kurzer Text',active:false}];
  Object.assign(w, {
    state:{me:{roles},companyId:'demo',data:{},testQuestions:[{instructionTypeId:'type-1',active:true}]},
    API_BASE_URL:'',DEFAULT_COMPANY_ID:'demo',
    $:id=>w.document.getElementById(id),
    esc:v=>String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    employees:()=>[{id:'anna',name:'Anna Beispiel',department:'Lager',email:'anna@example.invalid'}, {id:'ben',name:'Ben Muster',department:'Büro',email:'ben@example.invalid'}, ...Array.from({length:60},(_,i)=>({id:'person-'+i,name:'Person '+i,department:'Lager'})), {id:'inactive',name:'Inaktiv',active:false}],
    types:()=>instructionTypes, type:id=>instructionTypes.find(t=>t.id===id),
    plannedTrainings:()=>[], templateForType:t=>t.id==='type-1'?{id:'tpl-1',title:'Sicherheitsunterlage',fileName:'Handbuch.pdf'}:null,
    templateOptions:()=>'',templateUploadCard:()=>'',templateListCard:()=>'',testQuestionManagerCard:()=>'',
    openTemplate:id=>{w.openedTemplate=id;}, prepareTemplateUpload:id=>{w.uploadType=id;}
  });
  for(const file of ['planning-management-v24.js','instruction-type-management-v23.js','table-form-design-v33.js']) w.eval(source(file));
  w.renderPlanning(); w.renderInstructions(); w.applyTableFormPolish();
  return {w,dom,description};
}

test('desktop navigation cannot wrap into clipped columns',()=>{
  const {w,dom}=fixture();
  const style=w.getComputedStyle(w.document.querySelector('nav'));
  assert.equal(style.flexDirection,'column');
  assert.equal(style.flexWrap,'nowrap');
  assert.equal(style.overflowX,'hidden');
  assert.equal(style.overflowY,'auto');
  assert.equal(w.getComputedStyle(w.document.querySelector('nav button')).flexShrink,'0');
  dom.window.close();
});

test('participant search keeps selections and draft fields, with bounded checkbox layout',()=>{
  const {w,dom}=fixture();
  const search=w.$('planEmployeeSearch');
  assert.ok(search,'participant search must exist');
  const anna=w.document.querySelector('.planEmployee[value="anna"]');
  anna.checked=true; anna.dispatchEvent(new w.Event('change',{bubbles:true}));
  w.$('planLocation').value='Unveränderter Entwurf';
  search.value='Ben'; search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.$('planEmployeeSearch'),search);
  assert.equal(w.document.querySelectorAll('#planEmployeeList label:not([hidden])').length,1);
  assert.deepEqual(Array.from(w.selectedPlanEmployeeIds()),['anna']);
  assert.match(w.$('planEmployeeCount').textContent,/1 ausgewählt/);
  assert.equal(w.$('planLocation').value,'Unveränderter Entwurf');
  assert.equal(w.document.querySelector('.planEmployee[value="inactive"]'),null);
  assert.equal(w.getComputedStyle(anna).width,'18px');
  assert.equal(w.getComputedStyle(w.document.querySelector('.planEmployee[value="ben"]').closest('label')).display,'flex');
  assert.equal(w.getComputedStyle(w.$('planEmployeeList')).maxHeight,'320px');
  search.value='Kein Treffer'; search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.$('planEmployeeEmpty').hidden,false);
  w.clearPlanningForm();
  assert.equal(search.value,''); assert.equal(w.selectedPlanEmployeeIds().length,0);
  assert.equal(w.document.querySelectorAll('#planEmployeeList label:not([hidden])').length,62);
  dom.window.close();
});

test('instruction overview stays compact; details retain full escaped content and actions',()=>{
  const {w,dom,description}=fixture();
  const table=w.$('instructionResults');
  assert.ok(table,'separate overview allows search without resetting forms');
  assert.equal(table.textContent.includes(description),false);
  const details=w.document.querySelector('[data-instruction-details="type-1"]');
  assert.ok(details); details.click();
  assert.ok(w.$('instructionDetail').textContent.includes(description));
  assert.equal(w.$('instructionDetail').querySelector('img'),null);
  assert.ok(w.$('instructionDetail').querySelector('.professional-toolbar'));
  assert.ok(w.$('instructionDetail').querySelector('button.ui-button'));
  w.$('instructionDetail').querySelector('[data-instruction-action="open"]').click();
  assert.equal(w.openedTemplate,'tpl-1');
  w.$('instructionDetail').querySelector('[data-instruction-action="edit"]').click();
  assert.equal(w.$('itDescription').value,description);
  w.$('itName').value='Nicht gespeicherter Entwurf';
  const search=w.$('instructionSearch'); search.value='Erste'; search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.$('instructionSearch'),search);
  assert.equal(w.$('itName').value,'Nicht gespeicherter Entwurf');
  assert.equal(w.$('instructionResults').querySelectorAll('tbody tr').length,1);
  w.applyTableFormPolish();
  assert.equal(w.getComputedStyle(w.$('instructionResults').querySelector('table')).minWidth,'0');
  assert.equal(w.getComputedStyle(w.$('instructionResults').querySelector('th')).whiteSpace,'normal');
  assert.equal(w.getComputedStyle(w.$('instructionResults').querySelector('.table-wrap')).maxHeight,'none');
  dom.window.close();
});

test('editing a plan clears filtering and updates existing participant selection',()=>{
  const {w,dom}=fixture();
  w.plannedTrainings=()=>[{id:'plan-1',instructionTypeId:'type-1',employeeIds:['ben'],location:'Raum B',status:'planned'}];
  w.$('planEmployeeSearch').value='Anna'; w.updatePlanningParticipants();
  w.editPlannedTraining('plan-1');
  assert.equal(w.$('planEmployeeSearch').value,'');
  assert.deepEqual(Array.from(w.selectedPlanEmployeeIds()),['ben']);
  assert.match(w.$('planEmployeeCount').textContent,/1 ausgewählt/);
  assert.equal(w.$('planLocation').value,'Raum B');
  dom.window.close();
});

test('filtered-out participants retain the existing planning save payload',async()=>{
  const {w,dom}=fixture();
  const requests=[];
  w.state.apiAvailable=true;
  w.api=async(path,options)=>{requests.push({path,options});return [];};
  w.loadData=async()=>{}; w.setView=()=>{};
  w.$('planType').value='type-1';w.$('planAt').value='2026-09-10T10:30';
  w.$('planLocation').value='Raum C';
  w.document.querySelector('.planEmployee[value="anna"]').checked=true;
  w.$('planEmployeeSearch').value='Ben';w.updatePlanningParticipants();
  await w.savePlannedTraining();
  assert.equal(requests[0].path,'/planned-trainings');
  assert.equal(requests[0].options.method,'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body),{instructionTypeId:'type-1',plannedAt:'2026-09-10T10:30',durationMinutes:30,location:'Raum C',lineManagerId:'',status:'planned',employeeIds:['anna']});
  dom.window.close();
});

test('read-only viewers cannot see layout edit controls',()=>{
  const {w,dom}=fixture(['employee']);
  assert.equal(w.$('planEmployeeSearch'),null);
  w.document.querySelector('[data-instruction-details="type-1"]').click();
  assert.equal(w.$('instructionDetail').querySelectorAll('[data-instruction-action="edit"],[data-instruction-action="upload"],[data-instruction-action="toggle"]').length,0);
  assert.ok(w.$('instructionDetail').querySelector('[data-instruction-action="open"]'));
  assert.equal(w.$('itName'),null);
  dom.window.close();
});
