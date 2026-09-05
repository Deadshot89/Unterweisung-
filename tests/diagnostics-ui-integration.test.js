import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }
const index = read('frontend/index.html');
const entry = read('frontend/diagnostics-entry-v37.js');
const users = read('frontend/user-management-v19.js');
const app = read('frontend/app.js');
const guard = read('frontend/role-guard-v20.js');

test('main UI exposes diagnostics only with systemadmin or diagnostics.view permission', () => {
  assert.match(index, /data-view="diagnostics"/);
  assert.match(index, /id="diagnostics" class="view"/);
  assert.match(index, /diagnostics-entry-v37\.js/);
  assert.match(entry, /diagnostics\.view/);
  assert.match(entry, /system_admin/);
  assert.match(guard, /canOpenDiagnostics/);
});

test('systemadmin can grant and revoke diagnostics access per company user', () => {
  assert.match(users, /permissions\/diagnostics/);
  assert.match(users, /diagnosticsView/);
  assert.match(users, /Fehlerdiagnose freigeben|Diagnose freigeben/);
  assert.match(users, /Fehlerdiagnose entziehen|Diagnose entziehen/);
  assert.match(users, /system_admin/);
});

test('central API helper reports failed requests without forwarding original request contents', () => {
  assert.match(app, /function\s+reportApiDiagnostic/);
  assert.match(app, /diagnostics\/events/);
  assert.match(app, /httpStatus/);
  assert.match(app, /apiPath/);
  assert.doesNotMatch(app, /body\s*:\s*options\.body/);
  assert.doesNotMatch(app, /headers\s*:\s*options\.headers/);
});

test('diagnostic reporting cannot recurse into diagnostics endpoints', () => {
  assert.match(app, /startsWith\(['"]\/diagnostics['"]\)/);
});
