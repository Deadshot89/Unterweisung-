import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const diagnosticsApi = fs.readFileSync('api/src/functions/diagnostics.js', 'utf8');
const diagnosticsHtml = fs.readFileSync('frontend/diagnostics.html', 'utf8');
const diagnosticsApp = fs.readFileSync('frontend/diagnostics-app.js', 'utf8');
const managedSettings = fs.readFileSync('scripts/prepare-managed-api-settings.js', 'utf8');
const staticWorkflow = fs.readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');

test('diagnostic status distinguishes configured mail from verified delivery readiness', () => {
  assert.match(diagnosticsApi, /mailConfigStatus/);
  assert.match(diagnosticsApi, /getVapidPublicKey/);
  assert.match(diagnosticsApi, /alerts\s*:\s*\{/);
  assert.match(diagnosticsApi, /email\s*:\s*\{[\s\S]*configured/);
  assert.match(diagnosticsApi, /deliveryVerified/);
  assert.match(diagnosticsApi, /ready\s*:/);
  assert.match(diagnosticsApi, /alertResultJson/);
  assert.match(diagnosticsApi, /email\?\.sent|email\.sent/);
  assert.match(diagnosticsApi, /push\s*:\s*\{[\s\S]*configured/);
  assert.doesNotMatch(diagnosticsApi, /GRAPH_CLIENT_SECRET\s*:/);
});

test('diagnostics PWA never calls configured-only email delivery ready', () => {
  assert.match(diagnosticsHtml, /id="statusEmail"/);
  assert.match(diagnosticsHtml, /E-Mail-Alarm/);
  assert.match(diagnosticsHtml, /id="statusPush"/);
  assert.match(diagnosticsHtml, /Handy-Push/);
  assert.match(diagnosticsApp, /statusEmail/);
  assert.match(diagnosticsApp, /statusPush/);
  assert.match(diagnosticsApp, /alerts\?\.email\?\.ready/);
  assert.match(diagnosticsApp, /VERSAND NICHT BESTÄTIGT/);
  assert.match(diagnosticsApp, /LETZTER VERSAND FEHLGESCHLAGEN/);
  assert.doesNotMatch(diagnosticsApp, /alerts\?\.email\?\.configured\s*\?\s*'BEREIT'/);
  assert.match(diagnosticsApp, /alerts\?\.push\?\.configured/);
});

test('managed API settings bridge accepts Graph mail configuration only server-side', () => {
  for (const name of ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM']) {
    assert.ok(managedSettings.includes(name), `Managed settings bridge is missing ${name}`);
    assert.ok(staticWorkflow.includes(`${name}:`), `Deployment workflow is missing ${name}`);
  }
  assert.match(managedSettings, /Graph mail settings complete/);
  assert.doesNotMatch(managedSettings, /console\.log\([^\n]*GRAPH_CLIENT_SECRET/);
  assert.doesNotMatch(staticWorkflow, /echo[^\n]*GRAPH_CLIENT_SECRET/);
});

test('packaged managed API settings reach the Graph mail runtime', () => {
  const names = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];
  const expected = {
    GRAPH_TENANT_ID: 'tenant-test',
    GRAPH_CLIENT_ID: 'client-test',
    GRAPH_CLIENT_SECRET: 'secret-test',
    MAIL_FROM: 'alerts@example.invalid'
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostics-mail-runtime-'));
  const settingsFile = path.join(dir, 'runtime-settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify(expected), 'utf8');

  const script = `
    import './api/src/lib/runtime-settings.js';
    const names = ${JSON.stringify(names)};
    process.stdout.write(JSON.stringify(Object.fromEntries(names.map(name => [name, process.env[name] || '']))));
  `;
  const env = { ...process.env, RUNTIME_SETTINGS_FILE: settingsFile };
  for (const name of names) env[name] = '';
  const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || 'runtime settings child process failed');
  assert.deepEqual(JSON.parse(run.stdout), expected);
});

test('production deployment securely falls back to existing Function App Graph settings', () => {
  assert.match(staticWorkflow, /AZURE_FUNCTIONAPP_PUBLISH_PROFILE/);
  assert.match(staticWorkflow, /\/api\/settings/);
  assert.match(staticWorkflow, /GITHUB_ENV/);
  assert.match(staticWorkflow, /::add-mask::/);
  assert.match(staticWorkflow, /GRAPH_MAIL_COMPLETE/);
  assert.doesNotMatch(staticWorkflow, /console\.log\([^\n]*(GRAPH_TENANT_ID|GRAPH_CLIENT_ID|GRAPH_CLIENT_SECRET|MAIL_FROM)[^\n]*settings\[/);
});
