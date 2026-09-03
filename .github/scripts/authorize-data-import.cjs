// Fail closed. This process validates a request; it never connects to SQL or Blob Storage.
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const requestPath = 'operations/data-import-request.json';
const git = (...args) => execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const requireCondition = (condition,message) => {if(!condition) throw new Error(message);};

try {
  requireCondition(process.env.GITHUB_EVENT_NAME === 'push','Only a separate push request is accepted.');
  requireCondition(process.env.GITHUB_REF === 'refs/heads/main','Imports are restricted to main.');
  requireCondition(process.env.GITHUB_RUN_ATTEMPT === '1','Reruns are blocked; a fresh approved request is required.');
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  requireCondition(event.ref === 'refs/heads/main' && !event.deleted && !event.forced,'Unsupported branch event.');
  const sha = /^[a-f0-9]{40}$/;
  requireCondition(sha.test(event.before) && !/^0+$/.test(event.before) && sha.test(event.after),'Invalid commit range.');
  requireCondition(event.after === process.env.GITHUB_SHA && git('rev-parse','HEAD') === event.after,'Checkout does not match the triggering revision.');
  const parents = git('show','-s','--format=%P','HEAD').split(' ');
  requireCondition(parents.length === 1 && parents[0] === event.before,'The request must be a separate single-commit push, not a merge.');
  const changed = git('diff','--name-only','--no-renames','-z',event.before,event.after,'--').split('\0').filter(Boolean);
  requireCondition(changed.length === 1 && changed[0] === requestPath,'Only the import request file may change in this push.');

  const request = JSON.parse(git('show',`${event.after}:${requestPath}`));
  requireCondition(request && !Array.isArray(request) && request.schemaVersion === 1,'Invalid request schema.');
  requireCondition(request.confirmation === 'IMPORT_START_DATA','Explicit import confirmation is missing.');
  requireCondition(request.companyId === 'company-essentra','Unexpected target company.');
  requireCondition(request.baseSha === event.before,'Request refers to a stale base revision.');
  requireCondition(typeof request.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.requestId),'A fresh UUID v4 request ID is required.');
  const requestedAt = Date.parse(request.requestedAt);
  const age = Date.now() - requestedAt;
  requireCondition(typeof request.requestedAt === 'string' && Number.isFinite(age) && age >= -5*60*1000 && age <= 60*60*1000,'Request is invalid, expired, or too far in the future.');
  if(git('ls-tree','--name-only',event.before,'--',requestPath)) {
    const previousText = git('show',`${event.before}:${requestPath}`);
    let previous;
    try { previous = JSON.parse(previousText); }
    catch { previous = null; } // Malformed JSON could never have authorized an import.
    requireCondition(previous?.requestId !== request.requestId,'This request ID has already been submitted.');
  }

  // Fixed output only, after every check passed. No untrusted text enters workflow outputs.
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'approved=true\n');
  console.log(`Explicit data import request validated: ${request.requestId}`);
} catch(error) {
  console.error('Import blocked:',error.message);
  process.exitCode = 1;
}
