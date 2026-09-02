import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/src/functions/testQuestions.js', 'utf8');
const ui = readFileSync('frontend/test-question-management-v22.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(api, /route:\s*'test-questions\/\{id\?\}'/, 'Testfragen-Endpunkt muss registriert sein.');
assert.match(api, /methods:\s*\['GET', 'POST', 'PATCH'\]/, 'Testfragen-API muss GET, POST und PATCH unterstützen.');
assert.match(api, /INSERT INTO TestQuestions/, 'Testfragen-API muss neue Fragen anlegen können.');
assert.match(api, /UPDATE TestQuestions SET/, 'Testfragen-API muss Fragen bearbeiten können.');
assert.match(api, /optionsJson/, 'Testfragen-API muss Antwortoptionen als JSON speichern.');
assert.match(api, /correctIndex/, 'Testfragen-API muss richtige Antwort speichern.');
assert.match(api, /testQuestion\.created/, 'Testfragen-Anlage muss auditiert werden.');
assert.match(api, /testQuestion\.updated/, 'Testfragen-Änderung muss auditiert werden.');
assert.match(api, /Roles\.COMPANY_ADMIN, Roles\.HSE/, 'Schreiben muss auf Company Admin/HSE begrenzt sein.');

assert.match(ui, /Testfragen/, 'Frontend muss Testfragen-Bereich anzeigen.');
assert.match(ui, /loadTestQuestions/, 'Frontend muss Testfragen laden.');
assert.match(ui, /saveNewTestQuestion/, 'Frontend muss neue Testfragen speichern.');
assert.match(ui, /toggleTestQuestion/, 'Frontend muss Fragen aktivieren\/deaktivieren können.');
assert.match(ui, /editTestQuestion/, 'Frontend muss Fragen bearbeiten können.');
assert.match(ui, /Richtige Antwort/, 'Frontend muss richtige Antwort auswählbar machen.');
assert.match(index, /test-question-management-v22\.js/, 'Index muss Testfragen-Management laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Test question management checks passed');
