import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/src/functions/instructionTypes.js', 'utf8');
const ui = readFileSync('frontend/instruction-type-management-v23.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(api, /route:\s*'instruction-types\/\{id\?\}'/, 'InstructionTypes API muss route instruction-types/{id?} bereitstellen.');
assert.match(api, /methods:\s*\['GET', 'POST', 'PATCH'\]/, 'InstructionTypes API muss GET, POST und PATCH unterstützen.');
assert.match(api, /Roles\.SYSTEM_ADMIN, Roles\.COMPANY_ADMIN, Roles\.HSE/, 'Schreiben muss System Admin, Company Admin und HSE erlauben.');
assert.match(api, /INSERT INTO InstructionTypes/, 'API muss neue Unterweisungstypen anlegen können.');
assert.match(api, /UPDATE InstructionTypes SET/, 'API muss Unterweisungstypen bearbeiten können.');
assert.match(api, /templateId/, 'API muss Vorlagen zuordnen können.');
assert.match(api, /instructionType\.created/, 'Anlage muss auditiert werden.');
assert.match(api, /instructionType\.updated/, 'Änderung muss auditiert werden.');

assert.match(ui, /Unterweisung anlegen \/ bearbeiten/, 'Frontend muss Anlage-/Bearbeitungsmaske anzeigen.');
assert.match(ui, /saveInstructionType/, 'Frontend muss Unterweisungstypen speichern können.');
assert.match(ui, /prepareInstructionTypeEdit/, 'Frontend muss bestehende Unterweisungen bearbeiten können.');
assert.match(ui, /toggleInstructionType/, 'Frontend muss aktivieren/deaktivieren können.');
assert.match(ui, /templateOptions/, 'Frontend muss Vorlagen zuordnen können.');
assert.match(ui, /testQuestionManagerCard/, 'Frontend muss Testfragenbereich weiter einbinden.');
assert.match(index, /instruction-type-management-v23\.js/, 'Index muss Instruction-Type-Management laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Instruction type management checks passed');
