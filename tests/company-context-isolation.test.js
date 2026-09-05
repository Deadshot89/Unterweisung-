import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html','utf8');
const tenant = fs.readFileSync('frontend/tenant-context-v36.js','utf8');
const design = fs.readFileSync('frontend/design-polish-v31.js','utf8');

test('company switch rerenders the currently visible view instead of leaving stale tenant content', () => {
  assert.match(index, /tenant-context-v36\.js/,
    'Der Mandantenkontext-Schutz muss produktiv geladen werden.');
  assert.match(tenant, /renderAll\s*=\s*function\s*\(\)\s*\{[\s\S]*querySelector\(['\"]\.view\.active['\"]\)[\s\S]*render\(/,
    'Nach einem Firmenwechsel muss die aktuell sichtbare Ansicht mit den neuen Mandantendaten neu gerendert werden.');
  assert.doesNotMatch(tenant, /render\(['\"]dashboard['\"]\)\s*;?\s*\}/,
    'Der Mandantenwechsel darf alte Benutzer-/Mitarbeiteransichten nicht durch reines Dashboard-Rendering stehen lassen.');
});

test('professional header derives the company from the selected tenant only', () => {
  assert.match(tenant, /function\s+activeCompanyName\s*\(/,
    'Es fehlt eine zentrale Ermittlung des aktuell ausgewählten Firmennamens.');
  assert.match(design, /activeCompanyName\s*\(/,
    'Die Benutzerbox muss denselben aktiven Firmenkontext wie die Systemleiste verwenden.');
  assert.doesNotMatch(design, /companiesList\[0\]/,
    'Die Benutzerbox darf nicht auf die erste Firma der geladenen Liste zurückfallen.');
  assert.doesNotMatch(design, /Essentra Components GmbH/,
    'Die Benutzerbox darf keinen festen Essentra-Fallback enthalten.');
});

test('late responses from a previous tenant cannot overwrite the newly selected tenant', () => {
  const block = tenant.slice(tenant.indexOf('loadCompanyData = async function'), tenant.indexOf('window.activeCompanyName'));
  assert.match(block, /const\s+companyId\s*=\s*state\.companyId/,
    'loadCompanyData muss den Firmenkontext zu Beginn festhalten.');
  assert.match(block, /['\"]x-company-id['\"]\s*:\s*companyId/,
    'Alle Requests eines Firmen-Ladevorgangs müssen explizit an denselben Mandanten gebunden sein.');
  assert.match(block, /state\.companyId\s*!==\s*companyId[\s\S]*return\s+false/,
    'Verspätete Antworten eines alten Mandanten müssen verworfen werden.');
});
