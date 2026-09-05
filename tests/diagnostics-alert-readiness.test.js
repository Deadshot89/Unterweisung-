import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnosticsApi = fs.readFileSync('api/src/functions/diagnostics.js', 'utf8');
const diagnosticsHtml = fs.readFileSync('frontend/diagnostics.html', 'utf8');
const diagnosticsApp = fs.readFileSync('frontend/diagnostics-app.js', 'utf8');
const managedSettings = fs.readFileSync('scripts/prepare-managed-api-settings.js', 'utf8');
const staticWorkflow = fs.readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');

test('diagnostic status reports safe email and push alert readiness', () => {
  assert.match(diagnosticsApi, /mailConfigStatus/);
  assert.match(diagnosticsApi, /getVapidPublicKey/);
  assert.match(diagnosticsApi, /alerts\s*:\s*\{/);
  assert.match(diagnosticsApi, /email\s*:\s*\{[\s\S]*configured/);
  assert.match(diagnosticsApi, /push\s*:\s*\{[\s\S]*configured/);
  assert.doesNotMatch(diagnosticsApi, /GRAPH_CLIENT_SECRET\s*:/);
});

test('diagnostics PWA visibly shows email and phone push readiness', () => {
  assert.match(diagnosticsHtml, /id="statusEmail"/);
  assert.match(diagnosticsHtml, /E-Mail-Alarm/);
  assert.match(diagnosticsHtml, /id="statusPush"/);
  assert.match(diagnosticsHtml, /Handy-Push/);
  assert.match(diagnosticsApp, /statusEmail/);
  assert.match(diagnosticsApp, /statusPush/);
  assert.match(diagnosticsApp, /alerts\?\.email\?\.configured/);
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
