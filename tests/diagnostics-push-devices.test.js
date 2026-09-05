import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }

const api = read('api/src/functions/diagnostics.js');
const migration = read('database/migrations/012_diagnostics_push_devices.sql');
const html = read('frontend/diagnostics.html');
const app = read('frontend/diagnostics-app.js');

test('push device migration stores a friendly label and optional custom name without changing the endpoint contract', () => {
  assert.match(migration, /ALTER TABLE\s+dbo\.PushSubscriptions/i);
  assert.match(migration, /deviceLabel\s+NVARCHAR\(160\)/i);
  assert.match(migration, /deviceName\s+NVARCHAR\(120\)/i);
  assert.match(migration, /userAgent\s+NVARCHAR\(1000\)/i);
});

test('device management is system-admin only and scoped to the current user', () => {
  assert.match(api, /route:\s*'diagnostics\/push\/devices'/);
  assert.match(api, /route:\s*'diagnostics\/push\/devices\/\{id\}'/);
  assert.match(api, /assertRole\(ctx,\s*\[Roles\.SYSTEM_ADMIN\]\)/);
  assert.match(api, /WHERE\s+userId=@userId/i);
  assert.match(api, /WHERE\s+id=@id\s+AND\s+userId=@userId/i);
});

test('push registration stores device metadata and returns a device id while device listing does not expose endpoints', () => {
  assert.match(api, /deviceLabel/);
  assert.match(api, /deviceName/);
  assert.match(api, /user-agent/i);
  assert.match(api, /deviceId:\s*saved\.id/);
  assert.match(api, /SELECT\s+id,deviceName,deviceLabel,createdAt,updatedAt,lastSuccessAt,lastErrorAt,lastError/i);
  assert.doesNotMatch(api, /SELECT\s+id,deviceName,deviceLabel,createdAt,updatedAt,lastSuccessAt,lastErrorAt,lastError,endpoint/i);
});

test('diagnostics PWA shows registered devices and supports rename remove and current-device marking', () => {
  assert.match(html, /Registrierte Geräte/);
  assert.match(html, /diagDevices/);
  assert.match(app, /loadPushDevices/);
  assert.match(app, /diagnosticsPushDeviceId/);
  assert.match(app, /dieses Gerät/i);
  assert.match(app, /Gerät umbenennen/i);
  assert.match(app, /Gerät entfernen/i);
  assert.match(app, /method:\s*'PATCH'/);
  assert.match(app, /method:\s*'DELETE'/);
});
