import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html','utf8');
const app = fs.readFileSync('frontend/app.js','utf8');
const portal = fs.readFileSync('frontend/portal-shell.js','utf8');

test('Firmenwechsel nutzt die neue Portal-Shell und setzt alten Portalzustand sicher zurück', () => {
  assert.match(index, /portal-shell\.js/,
    'Die neue Portal-Shell muss produktiv geladen werden.');
  assert.doesNotMatch(index, /tenant-context-v36\.js/,
    'Der alte Mandantenkontext-Wrapper darf nicht parallel zur v0.40-Shell geladen werden.');
  assert.match(portal, /function\s+portalResetForCompanySwitch\s*\(/,
    'Vor dem Firmenwechsel muss der alte Portalzustand zentral zurückgesetzt werden.');
  assert.match(portal, /function\s+portalSwitchSystemCompany\s*\([\s\S]*portalResetForCompanySwitch\(\)[\s\S]*await\s+loadCompanyData\(\)[\s\S]*portalNavigate\(['\"]dashboard['\"]/,
    'Ein Systemadmin-Firmenwechsel muss erst resetten, dann neue Firmendaten laden und anschließend sicher neu navigieren.');
});

test('Portal-Kopf leitet den Firmennamen ausschließlich aus dem ausgewählten Mandanten ab', () => {
  assert.match(portal, /function\s+portalCompanyName\s*\(/,
    'Es fehlt eine zentrale Ermittlung des aktuell ausgewählten Firmennamens.');
  assert.match(portal, /find\(company\s*=>\s*company\?\.id\s*===\s*state\.companyId\)/,
    'Die Anzeige muss die tatsächlich ausgewählte companyId verwenden.');
  assert.doesNotMatch(portal, /companiesList\s*\[\s*0\s*\]/,
    'Die Benutzerbox darf nicht auf die erste Firma einer Liste zurückfallen.');
  assert.doesNotMatch(portal, /Essentra Components GmbH/,
    'Die Benutzerbox darf keinen festen Essentra-Fallback enthalten.');
});

test('späte Antworten eines vorherigen Mandanten können den neuen Firmenstate nicht überschreiben', () => {
  const start = app.indexOf('async function loadCompanyData');
  const end = app.indexOf('async function showCompanySelection', start);
  const block = app.slice(start, end);
  assert.match(block, /const\s+companyIdAtStart\s*=\s*state\.companyId/,
    'loadCompanyData muss den Firmenkontext zu Beginn festhalten.');
  assert.match(block, /await\s+bootstrapPromise[\s\S]*state\.companyId\s*!==\s*companyIdAtStart[\s\S]*return/,
    'Eine verspätete Bootstrap-Antwort des alten Mandanten muss verworfen werden.');
  assert.match(block, /await\s+secondaryPromise[\s\S]*state\.companyId\s*!==\s*companyIdAtStart[\s\S]*return/,
    'Auch verspätete sekundäre Antworten des alten Mandanten müssen verworfen werden.');
});
