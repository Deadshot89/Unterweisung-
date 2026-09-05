import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }
const alerts = read('api/src/lib/diagnosticAlerts.js');
const push = read('api/src/lib/webPush.js');
const api = read('api/src/functions/diagnostics.js');

test('critical diagnostics notify active system admins only with ten minute deduplication', () => {
  assert.match(alerts, /role=['"]system_admin['"]/i);
  assert.match(alerts, /active=1/i);
  assert.match(alerts, /TEN_MINUTES\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  assert.match(alerts, /sendGraphMail/);
  assert.match(alerts, /sendEmptyWebPush/);
  assert.match(alerts, /alertedAt/);
});

test('web push derives a separated VAPID key and never exposes the private scalar', () => {
  assert.match(push, /AUTH_SESSION_SECRET/);
  assert.match(push, /unterweisungsmanager:vapid:v1/);
  assert.match(push, /prime256v1/);
  assert.match(push, /getVapidPublicKey/);
  assert.match(push, /Authorization/);
  assert.match(push, /vapid t=/);
  assert.doesNotMatch(push, /console\.log|console\.debug/);
});

test('push subscriptions are system-admin only', () => {
  assert.match(api, /route:\s*'diagnostics\/push\/config'/);
  assert.match(api, /route:\s*'diagnostics\/push\/subscriptions'/);
  assert.match(api, /assertRole\(ctx,\s*\[Roles\.SYSTEM_ADMIN\]\)/);
  assert.match(api, /PushSubscriptions/);
});

test('critical event intake invokes alert delivery after persistence', () => {
  assert.match(api, /notifyCriticalDiagnostic/);
  assert.match(api, /event\.severity\s*===\s*['"]critical['"]/);
});
