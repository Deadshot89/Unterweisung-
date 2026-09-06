import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth = fs.readFileSync('frontend/auth-login-v42.js', 'utf8');

function functionSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Startmarker fehlt: ${startMarker}`);
  assert.ok(end > start, `Endmarker fehlt: ${endMarker}`);
  return source.slice(start, end);
}

test('Anmeldemaske startet den vorhandenen Healthcheck sofort und nicht blockierend zum SQL-Warmup', () => {
  const renderLogin = functionSlice(auth, "  function render({target,message=''}){", '\n\n  async function passwordSetup');
  assert.match(auth, /function\s+warmDatabaseForLogin\s*\(\)\s*\{[\s\S]*fetch\(['"]\/api\/health['"]/,
    'Es fehlt ein nicht-blockierendes SQL-Warmup über den vorhandenen anonymen Healthcheck.');
  assert.match(renderLogin, /warmDatabaseForLogin\s*\(\s*\)/,
    'Die normale Anmeldemaske muss das SQL-Warmup bereits beim Rendern starten.');
  assert.doesNotMatch(renderLogin, /await\s+warmDatabaseForLogin\s*\(/,
    'Das Warmup darf die Anzeige oder Bedienung der Anmeldemaske nicht blockieren.');
});
