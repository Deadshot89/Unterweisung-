import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {parse} from 'yaml';

const workflow=parse(readFileSync(new URL('../.github/workflows/azure-static-web-apps.yml',import.meta.url),'utf8'));

// Evaluate this workflow's property/boolean expression subset, not a copy of its group formula.
// Missing GitHub context properties evaluate to an empty value, including on push events.
function expression(source,github){
  const literal=/\bgithub(?:\.[a-zA-Z_][a-zA-Z_0-9]*)+\b/g;
  const expanded=source.replace(literal,path=>JSON.stringify(path.split('.').slice(1).reduce((value,key)=>value?.[key],github)??''));
  assert.doesNotMatch(expanded,/\bgithub\b|[;{}]/,'unsupported expression syntax');
  return runInNewContext(expanded,{}, {timeout:100});
}
function group(github){
  return workflow.concurrency.group.replace(/\$\{\{(.*?)\}\}/g,(_,value)=>String(expression(value,github))).toLowerCase();
}
function actions(github){
  return Object.values(workflow.jobs).filter(job=>expression(job.if,github)).flatMap(job=>job.steps.filter(step=>step.uses==='Azure/static-web-apps-deploy@v1').map(step=>step.with.action));
}
const push={event_name:'push',ref:'refs/heads/main',event:{}};
const pr=(number,action,merged=false)=>({event_name:'pull_request',ref:merged?'refs/heads/main':`refs/pull/${number}/merge`,event:{number,action,pull_request:{number,merged}}});

test('merging and closing a preview cannot cancel the main deployment',()=>{
  assert.notEqual(group(push),group(pr(2,'closed',true)));
});
test('preview close shares the same group as its earlier uploads even after merge',()=>{
  assert.equal(group(pr(2,'opened')),group(pr(2,'closed',true)));
  assert.equal(group(pr(2,'synchronize')),group(pr(2,'closed')));
  assert.equal(group(pr(2,'reopened')),group(pr(2,'opened')));
});
test('different previews never cancel each other or the main deployment',()=>{
  for(const action of ['opened','synchronize','reopened','closed']){
    assert.notEqual(group(pr(2,action)),group(pr(3,action)));
    assert.notEqual(group(pr(2,action)),group(push));
  }
  assert.notEqual(group(pr(2,'closed',true)),group(pr(3,'closed',true)));
});
test('new main pushes still supersede older main deployments',()=>{
  assert.equal(group({...push,run_id:100}),group({...push,run_id:101}));
  assert.equal(workflow.concurrency['cancel-in-progress'],true);
});
test('main and open previews only upload, while closed previews only close',()=>{
  assert.deepEqual(actions(push),['upload']);
  for(const action of ['opened','synchronize','reopened']) assert.deepEqual(actions(pr(2,action)),['upload']);
  for(const merged of [false,true]) assert.deepEqual(actions(pr(2,'closed',merged)),['close']);
});
