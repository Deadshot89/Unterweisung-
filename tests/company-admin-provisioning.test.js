import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFileSync(url(path), 'utf8');

test('company-admin provisioning is a narrow transaction and never runs migrations or seeds', () => {
  assert.ok(existsSync(url('scripts/provision-company-admin.js')), 'Eng begrenztes Provisionierungs-Script fehlt.');
  assert.ok(existsSync(url('.github/workflows/provision-company-admin.yml')), 'Separater Provisionierungs-Workflow fehlt.');

  const script = read('scripts/provision-company-admin.js');
  const workflow = read('.github/workflows/provision-company-admin.yml');

  assert.match(script, /company_admin/, 'Nur die Rolle company_admin darf durch diesen Weg gesetzt werden.');
  assert.match(script, /transaction/i, 'Die Änderung muss transaktional erfolgen.');
  assert.match(script, /@companyName|companyName/, 'Die Ziel-Firma muss explizit gebunden werden.');
  assert.match(script, /LOWER\(email\).*LOWER\(@email\)/s, 'Die E-Mail muss parameterisiert eindeutig geprüft werden.');
  assert.match(script, /companyId\s*<>\s*@companyId|companyId<>@companyId/, 'Bei exklusiver Zuordnung müssen aktive Fremdmandanten-Zuordnungen derselben E-Mail entfernt/deaktiviert werden.');
  assert.match(script, /active\s*=\s*1/i, 'Die erfolgreiche Verifikation muss genau aktive Benutzer prüfen.');
  assert.match(script, /rollback/i, 'Fehler müssen einen Rollback auslösen.');

  assert.match(workflow, /company\/\*\*/, 'Der Workflow darf nur auf Firmenbranches reagieren.');
  assert.match(workflow, /operations\/company-admin-provision-request\.json/, 'Nur eine explizite Request-Datei darf den Lauf auslösen.');
  assert.match(workflow, /SQL_CONNECTION_STRING/, 'SQL-Zugang muss ausschließlich über das Repository-Secret eingebunden werden.');
  assert.doesNotMatch(workflow, /db:migrate|db:seed|seed:sql|import-startdata|apply-migrations/i,
    'Der Provisionierungs-Workflow darf weder Migrationen noch Seeds oder Imports starten.');
});
