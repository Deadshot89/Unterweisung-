import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('frontend/app.js','utf8');
const design = fs.readFileSync('frontend/design-polish-v31.js','utf8');

test('company switch rerenders the currently visible view instead of leaving stale tenant content', () => {
  assert.match(app, /function\s+renderAll\s*\(\)\s*\{[\s\S]*querySelector\(['\"]\.view\.active['\"]\)[\s\S]*render\(/,
    'Nach einem Firmenwechsel muss die aktuell sichtbare Ansicht mit den neuen Mandantendaten neu gerendert werden.');
  assert.doesNotMatch(app, /function\s+renderAll\s*\(\)\s*\{\s*render\(['\"]dashboard['\"]\)\s*\}/,
    'renderAll darf nicht nur das Dashboard rendern und alte Benutzer-/Mitarbeiteransichten stehen lassen.');
});

test('professional header derives the company from the selected tenant only', () => {
  assert.match(app, /function\s+activeCompanyName\s*\(/,
    'Es fehlt eine zentrale Ermittlung des aktuell ausgewählten Firmennamens.');
  assert.match(design, /activeCompanyName\s*\(/,
    'Die Benutzerbox muss denselben aktiven Firmenkontext wie die Systemleiste verwenden.');
  assert.doesNotMatch(design, /companiesList\[0\]/,
    'Die Benutzerbox darf nicht auf die erste Firma der geladenen Liste zurückfallen.');
});

test('late responses from a previous tenant cannot overwrite the newly selected tenant', () => {
  const block = app.slice(app.indexOf('async function loadCompanyData'), app.indexOf('async function showCompanySelection'));
  assert.match(block, /const\s+companyId\s*=\s*state\.companyId/,
    'loadCompanyData muss den Firmenkontext zu Beginn festhalten.');
  assert.match(block, /['\"]x-company-id['\"]\s*:\s*companyId/,
    'Alle Requests eines Firmen-Ladevorgangs müssen explizit an denselben Mandanten gebunden sein.');
  assert.match(block, /state\.companyId\s*!==\s*companyId[\s\S]*return\s+false/,
    'Verspätete Antworten eines alten Mandanten müssen verworfen werden.');
});
