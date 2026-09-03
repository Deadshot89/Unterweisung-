import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const people = [
  {id:'a', name:'Anna Müller', email:'anna@example.test', department:'Warehouse', active:true},
  {id:'b', name:'Boris Braun', email:'boris@example.test', department:'Office', active:true}
];
const inputs = people.map(p => ({value:p.id, checked:false}));
const labels = people.map((p,i) => ({dataset:{search:[p.name,p.email,p.department].join(' ').toLowerCase()}, hidden:false, querySelector:()=>inputs[i]}));
const elements = Object.fromEntries(['planEmployeeSearch','planEmployeeCount','planEmployeeEmpty','empSearch','employeeResults','employees','empName'].map(id=>[id,{value:'',textContent:'',innerHTML:'',addEventListener(type,fn){this[type]=fn;}}]));
const document = {querySelectorAll(selector){
  if(selector==='.planEmployee:checked') return inputs.filter(i=>i.checked);
  if(selector==='.planEmployee') return inputs;
  if(selector==='#planEmployeeList .checkline') return labels;
  throw new Error('Unexpected selector: '+selector);
},getElementById:id=>elements[id]};
const context = vm.createContext({document, $:id=>elements[id], state:{me:{roles:['company_admin']},companyId:'company-test'}, employees:()=>people,companies:()=>[{id:'company-test',name:'Test Company'}],emp:()=>({name:'—'}),esc:x=>String(x??''),console});
for(const file of ['planning-management-v24.js','employee-management-v18.js','external-fix-v12.js']) {
  const source=readFileSync('frontend/'+file,'utf8');
  assert.doesNotMatch(source,/\son(?:click|change|input)="/,'Workspace controls must work under the deployed script-src self CSP.');
  vm.runInContext(source, context);
}

inputs[0].checked = true;
elements.planEmployeeSearch.value = 'office';
context.updatePlanningParticipants();
assert.equal(labels[0].hidden,true);
assert.equal(labels[1].hidden,false);
assert.deepEqual(Array.from(context.selectedPlanEmployeeIds()),['a'],'Filtering must retain hidden selections for saving.');
assert.equal(elements.planEmployeeCount.textContent,'1 ausgewählt · 1 von 2 angezeigt');
elements.planEmployeeSearch.value='missing';
context.updatePlanningParticipants();
assert.equal(elements.planEmployeeEmpty.hidden,false);
elements.planEmployeeSearch.value='';
context.updatePlanningParticipants();
assert.ok(labels.every(l=>!l.hidden));
context.clearPlanningForm();
assert.equal(inputs.some(i=>i.checked),false);
assert.equal(elements.planEmployeeCount.textContent,'0 ausgewählt · 2 von 2 angezeigt');
for(const id of ['planId','planType','planAt','planDuration','planLocation','planLineManager','planStatus']) elements[id]={value:'',scrollIntoView(){}};
context.plannedTrainings=()=>[{id:'plan-1',instructionTypeId:'safety',employeeIds:['b'],status:'planned'}];
elements.planEmployeeSearch.value='Anna';
context.updatePlanningParticipants();
context.editPlannedTraining('plan-1');
assert.equal(elements.planEmployeeSearch.value,'');
assert.deepEqual(Array.from(context.selectedPlanEmployeeIds()),['b']);
assert.equal(elements.planEmployeeCount.textContent,'1 ausgewählt · 2 von 2 angezeigt');

context.renderEmployees();
const originalView = elements.employees.innerHTML;
elements.empName.value = 'Unsaved employee';
elements.empSearch.value = 'Boris';
elements.empSearch.input({target:elements.empSearch});
assert.equal(elements.employees.innerHTML,originalView,'Search must leave form and focused input mounted.');
assert.equal(elements.empName.value,'Unsaved employee');
assert.match(elements.employeeResults.innerHTML,/Boris Braun/);
assert.doesNotMatch(elements.employeeResults.innerHTML,/Anna Müller/);

context.badgeInvitation = status=>`<span>${status==='completed'?'Abgeschlossen':status}</span>`;
context.fmtDate = date=>date||'—';
const table=context.invitationTable([{email:'anna@example.test',instructionName:'Safety',status:'completed',passPercent:0,answeredQuestions:0}]);
assert.equal((table.match(/anna@example.test/g)||[]).length,1,'Email-only recipients should not appear twice.');
assert.equal((table.match(/>Abgeschlossen<\/span>/g)||[]).length,1,'Completed status should not be repeated as a test result.');
assert.match(table,/Bestehen ab 0 %/,'Zero threshold remains valid.');
assert.match(table,/0 beantwortet/,'Zero answered questions remains visible.');

// Exercise action routing without executing real API, mail or file operations.
const calls=[];
for(const name of ['editEmployee','toggleEmployee','saveEmployee','importEmployeesFromText','openFile','createInvitation','savePlannedTraining','completePlannedTraining','sendPlannedMail','cancelPlannedTraining']){
  context[name]=(...args)=>calls.push([name,...args]);
}
const click=dataset=>({target:{closest:()=>({dataset})}});
context.handleEmployeeWorkspaceClick(click({employeeAction:'edit',id:'a'}));
context.handleEmployeeWorkspaceClick(click({employeeAction:'toggle',id:'b',active:'false'}));
context.handleInvitationWorkspaceClick(click({invitationAction:'proof',id:'proof-1'}));
context.handleInvitationWorkspaceClick(click({invitationAction:'create'}));
context.handlePlanningWorkspaceClick(click({planningAction:'complete',id:'plan-1'}));
context.handlePlanningWorkspaceClick(click({planningAction:'mail',id:'plan-1'}));
assert.deepEqual(calls,[['editEmployee','a'],['toggleEmployee','b',false],['openFile','proof-1'],['createInvitation'],['completePlannedTraining','plan-1'],['sendPlannedMail','plan-1']]);
context.state.me.roles=[];
context.handleEmployeeWorkspaceClick(click({employeeAction:'save'}));
context.handlePlanningWorkspaceClick(click({planningAction:'save'}));
assert.equal(calls.length,6,'Read-only users must not trigger edit actions.');
console.log('Admin workspace behavior checks passed');
