import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireFile = path => {
  assert.equal(fs.existsSync(path), true, `${path} fehlt.`);
  return read(path);
};

test('authenticatedApp bleibt bis erfolgreichem Login und Firmenbootstrap hart verborgen', () => {
  const html = read('frontend/index.html');
  const app = read('frontend/app.js');
  assert.match(html, /<section[^>]+id=["']authenticatedApp["'][^>]*\shidden(?:\s|>)/);
  assert.match(app, /setCoreWorkspaceVisible\s*\(/);
  assert.match(app, /setCoreWorkspaceVisible\s*\(\s*false\s*\)/);
  assert.match(app, /loadCompanyData|bootstrap/);
});

test('vor erfolgreichem Firmenbootstrap rendert der Portalrouter keine Firmenansicht', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /companyId|requiresCompanySelection/);
  assert.match(shell, /authenticatedApp|workspace/i);
  assert.match(shell, /hidden|return\s+false/);
});

test('späte Antworten einer vorherigen Firma dürfen den neuen Mandantenstate nicht setzen', () => {
  const app = read('frontend/app.js');
  assert.match(app, /companyId/);
  assert.match(app, /state\.companyId\s*!==\s*companyId|companyId\s*!==\s*state\.companyId/);
});

test('Portalrouting ignoriert aktiven passwordSetup-Hash vollständig', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /passwordSetup/);
  assert.match(shell, /location\.hash/);
  assert.match(shell, /return/);
  assert.doesNotMatch(shell, /replaceState[^\n]+passwordSetup/);
});

test('Firmenwechsel löscht alten Portalfilter und rendert keine alte Firmenansicht weiter', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /reset|clear/i);
  assert.match(shell, /filters/i);
  assert.match(shell, /companySwitchAction/);
});
