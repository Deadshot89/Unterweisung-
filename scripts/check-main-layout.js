// Main's behavior regressions, adapted to the v0.36 workspace selectors.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const source = name => readFileSync(new URL('../frontend/' + name, import.meta.url), 'utf8');
function fixture(roles = ['system_admin']) {
  const dom = new JSDOM('<!doctype html><body class="app-shell-v35"><section id="planning"></section><section id="instructions"></section></body>', {runScripts:'outside-only', pretendToBeVisual:true});
  const w=dom.window;
  for(const name of ['styles.css','professional-suite-v35.css','professional-suite-v36.css']){
    const style=w.document.createElement('style');style.textContent=source(name);w.document.head.append(style);
  }
  w.HTMLElement.prototype.scrollIntoView=function(){};
  const description='Sicherheitsinhalt mit vollständiger Erklärung. '.repeat(50)+'<img src=x onerror=alert(1)>';
  const instructionTypes=[{id:'type-1',name:'Lager & Sicherheit',category:'Sicherheit',intervalMonths:12,description,active:true}, {id:'type-2',name:'Erste Hilfe',category:'Gesundheit',description:'Kurzer Text',active:false}];
  Object.assign(w,{
    state:{me:{roles},companyId:'demo',data:{},testQuestions:[{instructionTypeId:'type-1',active:true}]},
    API_BASE_URL:'',DEFAULT_COMPANY_ID:'demo',$:id=>w.document.getElementById(id),
    esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    employees:()=>[{id:'anna',name:'Anna Beispiel',department:'Lager',email:'anna@example.invalid'}, {id:'ben',name:'Ben Muster',department:'Büro',email:'ben@example.invalid'}, {id:'inactive',name:'Inaktiv',active:false}],
    types:()=>instructionTypes,type:id=>instructionTypes.find(t=>t.id===id),
    plannedTrainings:()=>[],templateForType:t=>t.id==='type-1'?{id:'tpl-1',title:'Sicherheitsunterlage',fileName:'Handbuch.pdf'}:null,
    templateOptions:()=>'<option value=""></option>',templateUploadCard:()=>'<input id="fixtureUpload" type="file">',templateListCard:()=>'',testQuestionManagerCard:()=>'',
    openTemplate:id=>{w.openedTemplate=id;},prepareTemplateUpload:id=>{w.uploadType=id;}
  });
  // Use the actual action binders; only the external file operation is replaced.
  w.eval(source('template-management-v21.js').slice(source('template-management-v21.js').indexOf('function bindTemplateWorkspaceControls')));
  for(const file of ['planning-management-v24.js','instruction-analysis.js','instruction-type-management-v23.js','table-form-design-v33.js']) w.eval(source(file));
  w.renderPlanning();w.renderInstructions();w.applyTableFormPolish();
  return {w,dom,description};
}
const input=(w,id,value,event='input')=>{const el=w.$(id);el.value=value;el.dispatchEvent(new w.Event(event,{bubbles:true}));return el;};
const action=(w,name,id)=>{
  const el=[...w.document.querySelectorAll('[data-instruction-action]')].find(el=>el.dataset.instructionAction===name&&(!id||el.dataset.instructionId===id));
  assert.ok(el,'Missing instruction action '+name);el.click();
};

test('participant search keeps mounted selections and unrelated draft fields',()=>{
  const {w,dom}=fixture();try{
    const anna=w.document.querySelector('.planEmployee[value="anna"]');anna.checked=true;
    anna.dispatchEvent(new w.Event('change',{bubbles:true}));
    w.$('planLocation').value='Unveränderter Entwurf';
    const search=input(w,'planEmployeeSearch','Ben');
    assert.equal(w.$('planEmployeeSearch'),search);
    assert.equal(w.document.querySelectorAll('#planEmployeeList label:not([hidden])').length,1);
    assert.deepEqual(Array.from(w.selectedPlanEmployeeIds()),['anna']);
    assert.match(w.$('planEmployeeCount').textContent,/1 ausgewählt/);
    assert.equal(w.$('planLocation').value,'Unveränderter Entwurf');
    assert.equal(w.document.querySelector('.planEmployee[value="inactive"]'),null);
    assert.equal(w.getComputedStyle(anna).width,'18px');
    assert.equal(w.getComputedStyle(w.document.querySelector('.planEmployee[value="ben"]').closest('label')).display,'flex');
    assert.equal(w.getComputedStyle(w.$('planEmployeeList')).maxHeight,'320px');
    assert.equal(w.getComputedStyle(w.$('planEmployeeList')).overflowY,'auto');
    input(w,'planEmployeeSearch','Kein Treffer');assert.equal(w.$('planEmployeeEmpty').hidden,false);
    w.clearPlanningForm();assert.equal(search.value,'');assert.equal(w.selectedPlanEmployeeIds().length,0);
    assert.equal(w.document.querySelectorAll('#planEmployeeList label:not([hidden])').length,2);
  }finally{dom.window.close();}
});

for(const [id,value,event] of [['instructionSearch','Erste','input'],['instructionCategoryFilter','Gesundheit','change'],['instructionStatusFilter','inactive','change'],['instructionTemplateFilter','missing','change'],['instructionQuestionFilter','missing','change']]) {
  test(id+' filters results without replacing focused controls or unsaved form data',()=>{
    const {w,dom}=fixture();try{
      action(w,'selectInstructionWorkspaceItem','type-1');action(w,'prepareInstructionTypeEdit','type-1');
      const name=w.$('itName'),description=w.$('itDescription'),upload=w.$('fixtureUpload'),filter=w.$(id);
      name.value='Nicht gespeicherter Entwurf';description.value='Neue Beschreibung';filter.focus();
      input(w,id,value,event);
      assert.equal(w.$('itName'),name);assert.equal(name.value,'Nicht gespeicherter Entwurf');
      assert.equal(w.$('itDescription'),description);assert.equal(description.value,'Neue Beschreibung');
      assert.equal(w.$('fixtureUpload'),upload);assert.equal(w.$(id),filter);assert.equal(w.document.activeElement,filter);
      assert.equal(w.document.querySelectorAll('#instructionQuestionOverview tbody tr').length,1);
      assert.match(w.$('instructionQuestionOverview').textContent,/Erste Hilfe/);
      assert.equal(w.$('itId').value,'type-1');
    }finally{dom.window.close();}
  });
}

test('instruction details retain full escaped text and correctly bound actions',()=>{
  const {w,dom,description}=fixture();try{
    action(w,'selectInstructionWorkspaceItem','type-1');
    const detail=w.document.querySelector('.instruction-detail-panel');
    assert.ok(detail.textContent.includes(description));assert.equal(w.document.querySelector('#instructions img'),null);
    assert.ok(detail.querySelector('button.ui-button'),'New detail buttons retain the shared button formatting');
    assert.ok(w.$('instructionQuestionOverview').querySelector('table.professional-table'));
    const preview=w.document.querySelector('.instruction-description-preview');
    assert.equal(w.getComputedStyle(preview).getPropertyValue('-webkit-line-clamp'),'2');
    assert.equal(w.getComputedStyle(preview).overflow,'hidden');
    const wrap=w.$('instructionQuestionOverview').querySelector('.table-wrap');
    assert.equal(w.getComputedStyle(wrap).maxHeight,'none');
    assert.equal(w.getComputedStyle(wrap).overflowX,'auto');
    detail.querySelector('[data-template-action="open"]').click();assert.equal(w.openedTemplate,'tpl-1');
    detail.querySelector('[data-template-action="prepare"]').click();assert.equal(w.uploadType,'type-1');
    action(w,'prepareInstructionTypeEdit','type-1');assert.equal(w.$('itDescription').value,description);
  }finally{dom.window.close();}
});

test('selecting details and clearing filters retain the edited form and upload control',()=>{
  const {w,dom}=fixture();try{
    input(w,'instructionStatusFilter','inactive','change');
    w.$('itName').value='Unfertiger Entwurf';const field=w.$('itName'),upload=w.$('fixtureUpload');
    action(w,'selectInstructionWorkspaceItem','type-2');
    assert.equal(w.$('itName'),field);assert.equal(field.value,'Unfertiger Entwurf');
    action(w,'clearInstructionWorkspaceFilters');
    assert.equal(w.$('itName'),field);assert.equal(w.$('fixtureUpload'),upload);assert.equal(field.value,'Unfertiger Entwurf');
    assert.equal(w.$('instructionStatusFilter').value,'');
    assert.equal(w.document.querySelectorAll('#instructionQuestionOverview tbody tr').length,2);
    action(w,'clearInstructionTypeForm');assert.equal(field.value,'','Explicit form reset still works');
  }finally{dom.window.close();}
});

test('editing a plan resets participant filtering and selects its existing members',()=>{
  const {w,dom}=fixture();try{
    w.plannedTrainings=()=>[{id:'plan-1',instructionTypeId:'type-1',employeeIds:['ben'],location:'Raum B',status:'planned'}];
    input(w,'planEmployeeSearch','Anna');w.editPlannedTraining('plan-1');
    assert.equal(w.$('planEmployeeSearch').value,'');assert.deepEqual(Array.from(w.selectedPlanEmployeeIds()),['ben']);
    assert.match(w.$('planEmployeeCount').textContent,/1 ausgewählt/);assert.equal(w.$('planLocation').value,'Raum B');
  }finally{dom.window.close();}
});

test('filtered-out participants retain the exact planning POST payload',async()=>{
  const {w,dom}=fixture();try{
    const requests=[];w.state.apiAvailable=true;
    w.api=async(path,options)=>{requests.push({path,options});return [];};w.loadData=async()=>{};w.setView=()=>{};
    w.$('planType').value='type-1';w.$('planAt').value='2026-09-10T10:30';w.$('planLocation').value='Raum C';
    w.document.querySelector('.planEmployee[value="anna"]').checked=true;input(w,'planEmployeeSearch','Ben');
    await w.savePlannedTraining();assert.equal(requests[0].path,'/planned-trainings');assert.equal(requests[0].options.method,'POST');
    assert.deepEqual(JSON.parse(requests[0].options.body),{instructionTypeId:'type-1',plannedAt:'2026-09-10T10:30',durationMinutes:30,location:'Raum C',lineManagerId:'',status:'planned',employeeIds:['anna']});
  }finally{dom.window.close();}
});

test('read-only viewers cannot see instruction or planning edit controls',()=>{
  const {w,dom}=fixture(['employee']);try{
    assert.equal(w.$('planEmployeeSearch'),null);action(w,'selectInstructionWorkspaceItem','type-1');
    const detail=w.document.querySelector('.instruction-detail-panel');
    assert.equal(detail.querySelectorAll('[data-instruction-action="prepareInstructionTypeEdit"],[data-instruction-action="toggleInstructionType"],[data-template-action="prepare"]').length,0);
    assert.ok(detail.querySelector('[data-template-action="open"]'));assert.equal(w.$('itName'),null);
  }finally{dom.window.close();}
});
