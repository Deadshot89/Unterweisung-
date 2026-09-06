import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth = fs.readFileSync('frontend/auth-login-v42.js', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');

function functionSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Startmarker fehlt: ${startMarker}`);
  assert.ok(end > start, `Endmarker fehlt: ${endMarker}`);
  return source.slice(start, end);
}

test('erfolgreicher Passwort-Login lädt die Anwendung ohne Vollseiten-Reload weiter', () => {
  const passwordLogin = functionSlice(auth, '  async function passwordLogin(event){', '\n\n  async function logout');
  assert.doesNotMatch(passwordLogin, /location\.reload\s*\(/, 'Erfolgreiche Anmeldung darf keinen kompletten Seiten-Reload auslösen.');
  assert.match(passwordLogin, /um:password-authenticated/, 'Der Login muss den bestehenden App-Start direkt anstoßen.');
  assert.match(app, /addEventListener\(['"]um:password-authenticated['"][\s\S]{0,240}loadData\s*\(/, 'Die Hauptanwendung muss das Login-Erfolgsereignis direkt übernehmen.');
});

test('Arbeitsbereich wird nach bestätigter Sitzung sichtbar bevor Firmendaten fertig geladen sind', () => {
  const loadCompanyData = functionSlice(app, 'async function loadCompanyData(){', '\n\nasync function showCompanySelection');
  const firstAwait = loadCompanyData.indexOf('await ');
  const visible = loadCompanyData.indexOf('setCoreWorkspaceVisible(true)');
  assert.ok(firstAwait >= 0, 'loadCompanyData muss weiterhin asynchron laden.');
  assert.ok(visible >= 0 && visible < firstAwait, 'Der angemeldete Arbeitsbereich muss vor dem ersten blockierenden Daten-Await sichtbar werden.');
});

test('Firmendaten starten parallel statt seriell nach der Anmeldung', () => {
  const loadCompanyData = functionSlice(app, 'async function loadCompanyData(){', '\n\nasync function showCompanySelection');
  const firstAwait = loadCompanyData.indexOf('await ');
  for (const endpoint of ['/bootstrap', '/instruction-status', '/mail/config', '/users']) {
    const call = loadCompanyData.indexOf(`api('${endpoint}')`);
    assert.ok(call >= 0, `${endpoint} wird im Firmenstart benötigt.`);
    assert.ok(call < firstAwait, `${endpoint} muss vor dem ersten Await gestartet werden, damit die Anfragen parallel laufen.`);
  }
});
