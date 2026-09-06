import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }
const index = read('frontend/index.html');
const portal = read('frontend/portal-shell.js');
const users = read('frontend/user-management-v19.js');
const app = read('frontend/app.js');

test('v0.40 exposes diagnostics only as permission-gated admin subview', () => {
  assert.doesNotMatch(index, /data-view="diagnostics"/);
  assert.doesNotMatch(index, /id="diagnostics" class="view"/);
  assert.doesNotMatch(index, /diagnostics-entry-v37\.js/);
  assert.match(portal, /function\s+portalCanDiagnose\s*\(/);
  assert.match(portal, /diagnostics\.view/);
  assert.match(portal, /system_admin/);
  assert.match(portal, /if\(portalCanDiagnose\(\)\)\s+rows\.push\(\['diagnostics','Fehlerdiagnose'\]\)/);
  assert.match(portal, /if\(active === 'diagnostics'\)\s+renderDiagnosticsPortal\(\)/);
  assert.match(portal, /href="\/diagnostics\.html"/);
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
