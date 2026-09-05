import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }
const html = read('frontend/diagnostics.html');
const app = read('frontend/diagnostics-app.js');
const sw = read('frontend/diagnostics-sw.js');
const manifest = read('frontend/diagnostics.webmanifest');

test('diagnostics page is installable and exposes German service controls', () => {
  assert.match(html, /rel="manifest" href="\/diagnostics\.webmanifest"/);
  assert.match(html, /Fehlerdiagnose/);
  assert.match(html, /Handy-Benachrichtigungen aktivieren/);
  assert.match(html, /Diagnosepaket herunterladen/);
  assert.match(manifest, /"start_url"\s*:\s*"\/diagnostics\.html"/);
  assert.match(manifest, /"display"\s*:\s*"standalone"/);
});

test('diagnostics PWA registers a service worker and subscribes only after explicit permission', () => {
  assert.match(app, /serviceWorker\.register\('\/diagnostics-sw\.js'\)/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /pushManager\.subscribe/);
  assert.match(app, /diagnostics\/push\/config/);
  assert.match(app, /diagnostics\/push\/subscriptions/);
});

test('diagnostics service worker shows a German critical notification and opens diagnostics on click', () => {
  assert.match(sw, /self\.addEventListener\('push'/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /Kritischer Fehler/);
  assert.match(sw, /diagnostics\/latest-critical/);
  assert.match(sw, /self\.addEventListener\('notificationclick'/);
  assert.match(sw, /\/diagnostics\.html/);
});
