import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('frontend/diagnostics.html', 'utf8');
const app = fs.readFileSync('frontend/diagnostics-app.js', 'utf8');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => '' },
    async text() { return payload == null ? '' : JSON.stringify(payload); },
    async blob() { return new Blob([JSON.stringify(payload ?? {})], { type: 'application/json' }); }
  };
}

function wait(ms = 30) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('Diagnose-PWA zeigt bei fehlender Sitzung ihren eigenen Login statt auf die Hauptwebsite zu verweisen', async () => {
  const dom = new JSDOM(html, { url: 'https://diagnose.example.invalid/diagnostics.html', runScripts: 'outside-only' });
  dom.window.fetch = async () => response(401, { error: 'Nicht angemeldet' });

  dom.window.eval(app);
  await wait();

  const loginPanel = dom.window.document.getElementById('diagLoginPanel');
  assert.ok(loginPanel, 'Eigener Login-Bereich der Diagnose-App fehlt');
  assert.equal(loginPanel.hidden, false, 'Login muss bei 401 sichtbar werden');
  assert.equal(dom.window.document.getElementById('diagWorkspace')?.hidden, true);
  assert.doesNotMatch(dom.window.document.body.textContent, /Bitte zuerst im Unterweisungsmanager anmelden/i);
  dom.window.close();
});

test('Diagnose-PWA meldet sich direkt per E-Mail und Passwort an und lädt danach den Diagnosebereich', async () => {
  const dom = new JSDOM(html, { url: 'https://diagnose.example.invalid/diagnostics.html', runScripts: 'outside-only' });
  let meCalls = 0;
  let loginRequest = null;

  dom.window.fetch = async (input, options = {}) => {
    const path = new URL(String(input), dom.window.location.href).pathname;
    if (path === '/api/me') {
      meCalls += 1;
      if (meCalls === 1) return response(401, { error: 'Nicht angemeldet' });
      return response(200, { displayName: 'Diagnose Admin', email: 'admin@example.invalid', roles: ['system_admin'], permissions: [] });
    }
    if (path === '/api/auth/password/login') {
      loginRequest = { path, options };
      return response(200, { ok: true });
    }
    if (path === '/api/system/companies') return response(200, []);
    if (path === '/api/diagnostics/status') return response(200, { api: 'ok', database: 'ok', alerts: { email: {}, push: {} }, counts: {} });
    if (path === '/api/diagnostics/events') return response(200, { events: [] });
    if (path === '/api/diagnostics/push/devices') return response(200, { devices: [] });
    return response(404, { error: `Unerwarteter Testpfad ${path}` });
  };

  dom.window.eval(app);
  await wait();

  const form = dom.window.document.getElementById('diagLoginForm');
  assert.ok(form, 'Login-Formular fehlt');
  dom.window.document.getElementById('diagLoginEmail').value = 'admin@example.invalid';
  dom.window.document.getElementById('diagLoginPassword').value = 'test-passwort';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(80);

  assert.ok(loginRequest, 'Direkter Passwort-Login wurde nicht aufgerufen');
  assert.equal(loginRequest.path, '/api/auth/password/login');
  assert.equal(loginRequest.options.method, 'POST');
  assert.equal(loginRequest.options.credentials, 'include');
  assert.deepEqual(JSON.parse(loginRequest.options.body), { email: 'admin@example.invalid', password: 'test-passwort' });
  assert.equal(meCalls, 2, 'Nach erfolgreichem Login muss /api/me erneut geprüft werden');
  assert.equal(dom.window.document.getElementById('diagLoginPanel').hidden, true);
  assert.equal(dom.window.document.getElementById('diagWorkspace').hidden, false);
  dom.window.close();
});
