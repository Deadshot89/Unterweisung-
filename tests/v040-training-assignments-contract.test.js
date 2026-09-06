import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

function requireFile(path, message) {
  assert.equal(fs.existsSync(path), true, message);
  return read(path);
}

test('TrainingAssignments Migration ist idempotent, vollständig und mandantengebunden', () => {
  const sql = requireFile('database/migrations/013_training_assignments.sql', 'Migration 013_training_assignments.sql fehlt.');
  assert.match(sql, /COL_LENGTH\('dbo\.InstructionTypes','contentJson'\)/i);
  assert.match(sql, /contentJson\s+NVARCHAR\(MAX\)\s+NULL/i);
  assert.match(sql, /OBJECT_ID\('dbo\.TrainingAssignments','U'\)/i);
  for (const field of ['companyId','employeeId','instructionTypeId']) assert.match(sql, new RegExp(`${field}\\s+NVARCHAR\\(80\\)\\s+NOT NULL`, 'i'));
  assert.match(sql, /assignedByUserId\s+NVARCHAR\(120\)\s+NULL/i);
  assert.match(sql, /dueAt\s+DATETIME2\s+NULL/i);
  assert.match(sql, /status\s+NVARCHAR\((?:30|40)\)\s+NOT NULL/i);
  assert.match(sql, /testRequired\s+BIT\s+NOT NULL/i);
  assert.match(sql, /passPercent\s+INT\s+NOT NULL/i);
  assert.match(sql, /startedAt\s+DATETIME2\s+NULL/i);
  assert.match(sql, /completedAt\s+DATETIME2\s+NULL/i);
  assert.match(sql, /linkedRecordId\s+NVARCHAR\(80\)\s+NULL/i);
  assert.match(sql, /lastReminderAt\s+DATETIME2\s+NULL/i);
  assert.match(sql, /reminderCount\s+INT\s+NOT NULL/i);
  assert.match(sql, /passPercent\s+BETWEEN\s+0\s+AND\s+100/i);
  assert.match(sql, /FK_TrainingAssignments_Company/i);
  assert.match(sql, /FK_TrainingAssignments_Employee/i);
  assert.match(sql, /FK_TrainingAssignments_Type/i);
  assert.match(sql, /FK_TrainingAssignments_(?:LinkedRecord|CompletedRecord)/i);
  assert.match(sql, /CREATE UNIQUE INDEX\s+UX_TrainingAssignments_Active/i);
  assert.match(sql, /WHERE\s+status\s+IN\s*\('assigned','in_progress'\)/i);
  assert.match(sql, /IX_TrainingAssignments_Company_Employee_Status/i);
  assert.match(sql, /IX_TrainingAssignments_Company_Type_Status/i);
});

test('Datenbankprüfung erwartet TrainingAssignments', () => {
  const check = read('scripts/check-database.js');
  assert.match(check, /TrainingAssignments/);
});

test('Assignment API nutzt Employee-Scope und erlaubt Line Managern nur ihr Team', () => {
  const api = requireFile('api/src/functions/assignments.js', 'Assignment API fehlt.');
  assert.match(api, /employeeScope\.js/);
  assert.match(api, /getEmployeeScope/);
  assert.match(api, /assertEmployeeIdsAllowed/);
  assert.match(api, /Roles\.LINE_MANAGER/);
  assert.match(api, /route:\s*'assignments\/{id\?}'/);
  assert.match(api, /methods:\s*\['GET',\s*'POST',\s*'PATCH'\]/);
  assert.match(api, /testRequired/);
  assert.match(api, /passPercent/);
});

test('Assignments werden serverseitig nach Employee-Scope gefiltert', () => {
  const api = requireFile('api/src/functions/assignments.js', 'Assignment API fehlt.');
  assert.match(api, /filterRowsByEmployeeScope/);
  assert.match(api, /employeeId/);
  assert.match(api, /companyId=@companyId/);
});

test('Abgeschlossen kann nicht direkt über die Assignment API gesetzt werden', () => {
  const api = requireFile('api/src/functions/assignments.js', 'Assignment API fehlt.');
  assert.match(api, /completed/i);
  assert.match(api, /nicht direkt|echten Unterweisungseintrag|InstructionRecord/i);
});

test('Assignment Reminder respektiert manual, outlook und graph ohne Fake-Versand', () => {
  const api = requireFile('api/src/functions/assignments.js', 'Assignment API fehlt.');
  assert.match(api, /route:\s*'assignments\/{id}\/send-reminder'/);
  assert.match(api, /manual/);
  assert.match(api, /outlook/);
  assert.match(api, /graph/);
  assert.match(api, /sendGraphMail/);
  assert.match(api, /lastReminderAt/);
  assert.match(api, /reminderCount/);
  assert.match(api, /prepared|mailDraft|draft/i);
});

test('Bootstrap liefert gescopte interne Assignments', () => {
  const bootstrap = read('api/src/functions/bootstrap.js');
  assert.match(bootstrap, /TrainingAssignments/);
  assert.match(bootstrap, /assignments/);
  assert.match(bootstrap, /filterRowsByEmployeeScope\(scope,\s*assignments\.recordset\)/);
});

test('Manuelle Unterweisung schließt passende aktive Assignments über einen zentralen Helper', () => {
  const records = read('api/src/functions/records.js');
  assert.match(records, /assignmentLifecycle\.js/);
  assert.match(records, /completeAssignmentsForRecord/);
});

test('Geplante Gruppenunterweisung schließt passende aktive Assignments', () => {
  const planned = read('api/src/functions/plannedTrainings.js');
  assert.match(planned, /assignmentLifecycle\.js/);
  assert.match(planned, /completeAssignmentsForRecord/);
});

test('Mitarbeitergebundene externe Unterweisung schließt ebenfalls passende aktive Assignments', () => {
  const external = read('api/src/functions/externalInstruction.js');
  assert.match(external, /assignmentLifecycle\.js/);
  assert.match(external, /completeAssignmentsForRecord/);
});
