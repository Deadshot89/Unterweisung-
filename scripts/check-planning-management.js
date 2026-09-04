import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/src/functions/plannedTrainings.js', 'utf8');
const ui = readFileSync('frontend/planning-management-v24.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(api, /route:\s*'planned-trainings\/\{id\?\}'/, 'Planungs-API muss planned-trainings/{id?} bereitstellen.');
assert.match(api, /methods:\s*\['GET',\s*'POST',\s*'PATCH'\]/, 'Planungs-API muss GET, POST und PATCH unterstützen.');
assert.match(api, /Roles\.SYSTEM_ADMIN,\s*Roles\.COMPANY_ADMIN,\s*Roles\.HSE,\s*Roles\.LINE_MANAGER/, 'Planung muss für passende Rollen erlaubt sein.');
assert.match(api, /TrainingParticipants/, 'Planungs-API muss Teilnehmer speichern/lesen.');
assert.match(api, /replaceParticipants/, 'Planungs-API muss Teilnehmerlisten ersetzen können.');
assert.match(api, /completeTraining/, 'Planungs-API muss geplante Unterweisungen abschließen können.');
assert.match(api, /INSERT INTO InstructionRecords/, 'Abschluss muss echte Unterweisungseinträge erzeugen.');
assert.match(api, /planned_group/, 'Abschluss aus Planung muss als planned_group erkennbar sein.');
assert.match(api, /training\.completed/, 'Abschluss muss auditiert werden.');
assert.match(api, /employeeAccess\.js/, 'Planung muss Self-/Team-Grenzen serverseitig anwenden.');
assert.match(api, /requireEmployeeTarget/, 'Line Manager dürfen nur zugewiesene Mitarbeiter einplanen.');

assert.match(ui, /Unterweisung planen \/ zuweisen/, 'Frontend muss Planungsmaske anzeigen.');
assert.match(ui, /planningEmployeeCheckboxes/, 'Frontend muss Mitarbeiter als Teilnehmer auswählbar machen.');
assert.match(ui, /savePlannedTraining/, 'Frontend muss Planungen speichern können.');
assert.match(ui, /editPlannedTraining/, 'Frontend muss Planungen bearbeiten können.');
assert.match(ui, /completePlannedTraining/, 'Frontend muss Planungen abschließen können.');
assert.match(ui, /cancelPlannedTraining/, 'Frontend muss Planungen stornieren können.');
assert.match(ui, /sendPlannedMail/, 'Frontend muss geplante Termine weiter per Outlook senden können.');
assert.match(index, /planning-management-v24\.js/, 'Index muss planning-management-v24.js laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Planning management checks passed');
