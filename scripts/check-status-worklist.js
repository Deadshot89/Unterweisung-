import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('frontend/status-worklist-v25.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');
const statusApi = readFileSync('api/src/functions/status.js', 'utf8');
const recordsApi = readFileSync('api/src/functions/records.js', 'utf8');
const invitationsApi = readFileSync('api/src/functions/invitations.js', 'utf8');

assert.match(statusApi, /route:\s*'instruction-status'/, 'Status-API muss instruction-status bereitstellen.');
assert.match(statusApi, /vInstructionStatus/, 'Status-API muss die Status-View nutzen.');
assert.match(recordsApi, /employeeIds/, 'Records-API muss Sammelabschluss mit employeeIds unterstützen.');
assert.match(recordsApi, /InstructionRecords/, 'Records-API muss echte Unterweisungseinträge erzeugen.');
assert.match(invitationsApi, /employeeId/, 'Einladungen müssen mit Mitarbeiter verknüpft werden können.');

assert.match(ui, /Unterweisungsstatus \/ Arbeitsliste/, 'Frontend muss die Status-Arbeitsliste anzeigen.');
assert.match(ui, /bulkConductSelected/, 'Frontend muss Sammelabschluss anbieten.');
assert.match(ui, /bulkCreateExternalLinks/, 'Frontend muss Sammel-Einmal-Links erzeugen können.');
assert.match(ui, /bulkMarkNotRequired/, 'Frontend muss Sammel-Nicht-erforderlich anbieten.');
assert.match(ui, /exportStatusCsv/, 'Frontend muss CSV-Export anbieten.');
assert.match(ui, /selectedStatusRows/, 'Frontend muss ausgewählte Statuszeilen lesen können.');
assert.match(ui, /createExternalInvitationFromRow/, 'Frontend muss Statuszeilen in externe Links umwandeln können.');
assert.match(index, /status-worklist-v25\.js/, 'Index muss Status-Arbeitsliste laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Status worklist checks passed');
