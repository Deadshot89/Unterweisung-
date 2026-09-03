const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync, execFileSync} = require('node:child_process');
const {parse} = require('yaml');

const root = path.resolve(__dirname, '..');
const validator = path.join(root, '.github/scripts/authorize-data-import.cjs');
const requestPath = 'operations/data-import-request.json';

test('only a separate main-branch import request can trigger the data workflow',()=>{
  const workflow = parse(fs.readFileSync(path.join(root,'.github/workflows/seed-database.yml'),'utf8'));
  // This boundary catches the original incident: tests/scripts/templates triggering live imports.
  assert.deepEqual(workflow.on, {push:{branches:['main'],paths:[requestPath]}});
  assert.equal(workflow.concurrency['cancel-in-progress'],false);
  assert.equal(workflow.jobs.seed.needs,'authorize');
  assert.equal(workflow.jobs.seed.if,"needs.authorize.outputs.approved == 'true' && github.run_attempt == 1");
  const authorize = workflow.jobs.authorize;
  assert.ok(authorize);
  assert.equal(authorize.outputs.approved,'${{ steps.request.outputs.approved }}');
  assert.ok(authorize.steps.some(s=>s.id==='request' && s.run==='node .github/scripts/authorize-data-import.cjs'));
  assert.equal(JSON.stringify(authorize).includes('secrets.'),false);
});

function runRequest(options={}) {
  assert.ok(fs.existsSync(validator),'import request validator must exist');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'um-import-control-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const write=(name,value)=>{fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),value);};
  try {
    git('init','-b','main');git('config','user.name','Import control test');git('config','user.email','test@example.invalid');
    write('frontend/example.txt','unchanged');
    if(options.previous || options.previousRaw) write(requestPath,options.previousRaw??JSON.stringify(options.previous));
    git('add','.');git('commit','-m','baseline');
    const before=git('rev-parse','HEAD');
    if(options.merge) git('switch','-c','request-branch');
    if(options.multipleCommits) git('commit','--allow-empty','-m','extra commit');
    const request={schemaVersion:1,requestId:'ab7145dc-86b2-42d3-a459-5e26ca3f4f72',companyId:'company-essentra',baseSha:before,requestedAt:new Date().toISOString(),confirmation:'IMPORT_START_DATA',...options.request};
    if(!options.noRequest) write(requestPath,options.raw??JSON.stringify(request));
    if(options.normalUpdate || options.noRequest) write('frontend/example.txt','layout change');
    git('add','.');git('commit','-m','fixture update');
    if(options.merge){git('switch','main');git('merge','--no-ff','request-branch','-m','merge request');}
    const after=git('rev-parse','HEAD');
    write('event.json',JSON.stringify({ref:'refs/heads/main',before,after,deleted:false,forced:false,...options.event}));
    const output=path.join(dir,'output.txt');
    const result=spawnSync(process.execPath,[validator],{cwd:dir,encoding:'utf8',env:{PATH:process.env.PATH,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_SHA:after,GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_PATH:path.join(dir,'event.json'),GITHUB_OUTPUT:output,...options.env}});
    return {status:result.status,stdout:result.stdout,stderr:result.stderr,output:fs.existsSync(output)?fs.readFileSync(output,'utf8'):''};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('explicit fresh request approves only the guarded job',()=>{
  const result=runRequest();
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.output,'approved=true\n');
});

test('a separately approved follow-up request can replace the prior request',()=>{
  const result=runRequest({previous:{requestId:'461cbb29-e05b-4489-b11c-d0dc5e577bbd'}});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.output,'approved=true\n');
});

test('a valid new request recovers after malformed JSON was previously rejected',()=>{
  const result=runRequest({previousRaw:'{broken'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.output,'approved=true\n');
});

for(const [name,options] of [
  ['normal layout update without request',{noRequest:true}],
  ['layout update with an old request still present',{noRequest:true,previous:{schemaVersion:1,requestId:'461cbb29-e05b-4489-b11c-d0dc5e577bbd',confirmation:'IMPORT_START_DATA'}}],
  ['request combined with application changes',{normalUpdate:true}],
  ['multiple pushed commits',{multipleCommits:true}],
  ['merge commit containing a request',{merge:true}],
  ['missing explicit confirmation',{request:{confirmation:''}}],
  ['different company',{request:{companyId:'company-other'}}],
  ['stale base commit',{request:{baseSha:'a'.repeat(40)}}],
  ['expired request',{request:{requestedAt:new Date(Date.now()-2*60*60*1000).toISOString()}}],
  ['future request',{request:{requestedAt:new Date(Date.now()+60*60*1000).toISOString()}}],
  ['invalid timestamp',{request:{requestedAt:'not-a-date'}}],
  ['malformed JSON',{raw:'{broken'}],
  ['missing request object',{raw:'null'}],
  ['unknown request schema',{request:{schemaVersion:2}}],
  ['invalid request id',{request:{requestId:'anything\napproved=true'}}],
  ['reused previous request id',{previous:{requestId:'ab7145dc-86b2-42d3-a459-5e26ca3f4f72'}}],
  ['rerun of an already executed attempt',{env:{GITHUB_RUN_ATTEMPT:'2'}}],
  ['manual workflow event without separate request commit',{env:{GITHUB_EVENT_NAME:'workflow_dispatch'}}],
  ['preview branch',{env:{GITHUB_REF:'refs/heads/preview'},event:{ref:'refs/heads/preview'}}],
  ['forced push',{event:{forced:true}}],
  ['deleted branch',{event:{deleted:true}}],
  ['different checkout revision',{env:{GITHUB_SHA:'b'.repeat(40)}}],
  ['malformed before SHA',{event:{before:'not-a-sha'}}]
]) test('rejects '+name,()=>{
  const result=runRequest(options);
  assert.notEqual(result.status,0,'invalid request must not approve the import');
  assert.equal(result.output,'');
});
