import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const scopedFiles = [
  'api/src/functions/me.js',
  'api/src/functions/bootstrap.js',
  'api/src/functions/status.js',
  'api/src/functions/employees.js',
  'api/src/functions/records.js',
  'api/src/functions/plannedTrainings.js',
  'api/src/functions/invitations.js',
  'api/src/functions/exclusions.js',
  'api/src/functions/proofFiles.js',
  'api/src/functions/files.js',
  'api/src/functions/managerReport.js',
  'api/src/functions/mail.js'
];

test('alle employee-bezogenen API-Bereiche verwenden den serverseitigen Employee-Scope', () => {
  for (const path of scopedFiles) {
    const source = read(path);
    assert.match(source, /employeeScope\.js/, `${path} muss employeeScope.js importieren.`);
    assert.match(source, /resolveEmployeeScope\s*\(/, `${path} muss resolveEmployeeScope verwenden.`);
  }
});

test('/me liefert nur den sicheren Scope-Metadatensatz und erlaubt Systemadmin-Firmenauswahl ohne Employee-Mapping', () => {
  const source = read('api/src/functions/me.js');
  assert.match(source, /employeeScope\s*:/, 'me muss employeeScope zurückgeben.');
  assert.match(source, /actorEmployeeId/, 'me muss actorEmployeeId im Scope zurückgeben.');
  assert.match(source, /requiresCompanySelection[\s\S]*employeeScope/s, 'Firmenauswahl und Employee-Scope müssen gemeinsam behandelt werden.');
});

test('Listen werden serverseitig auf Employee-IDs reduziert', () => {
  for (const path of ['api/src/functions/bootstrap.js','api/src/functions/status.js','api/src/functions/employees.js']) {
    assert.match(read(path), /filterRowsByEmployeeScope\s*\(/, `${path} muss Ergebniszeilen serverseitig filtern.`);
  }
  assert.match(read('api/src/functions/records.js'), /assertEmployeeAllowed|filterRowsByEmployeeScope/, 'Records GET muss Employee-Filter erzwingen.');
});

test('Schreibpfade validieren die vollständige Employee-Zielmenge vor Änderungen', () => {
  for (const path of ['api/src/functions/records.js','api/src/functions/plannedTrainings.js']) {
    const source = read(path);
    assert.match(source, /assertEmployeeIdsAllowed\s*\(/, `${path} muss komplette Employee-Listen prüfen.`);
  }
  for (const path of ['api/src/functions/invitations.js','api/src/functions/exclusions.js','api/src/functions/proofFiles.js']) {
    const source = read(path);
    assert.match(source, /assertEmployeeAllowed\s*\(|assertEmployeeIdsAllowed\s*\(/, `${path} muss Ziele vor Mutation prüfen.`);
  }
});

test('Planungsmails und Einladungsmails dürfen Team-Scope nicht umgehen', () => {
  const source = read('api/src/functions/mail.js');
  assert.match(source, /sendPlannedTrainingMail/, 'Planungsmail-Endpunkt fehlt.');
  assert.match(source, /assertEmployeeIdsAllowed\s*\(/, 'Planungsmails müssen alle internen Teilnehmer scope-prüfen.');
  assert.match(source, /employeeAllowed\s*\(|assertEmployeeAllowed\s*\(/, 'Mails zu employee-gebundenen Einladungen müssen den Scope prüfen.');
});

test('Dateidownloads prüfen verknüpfte Entität statt nur companyId', () => {
  const source = read('api/src/functions/files.js');
  assert.match(source, /Roles\.EMPLOYEE/, 'Mitarbeiter müssen eigene Nachweise herunterladen können.');
  assert.match(source, /linkedEntityType/, 'Download muss die verknüpfte Entität laden.');
  assert.match(source, /instruction_record/, 'Download muss Record-Verknüpfungen prüfen.');
  assert.match(source, /instruction_group/, 'Download muss Gruppen-Verknüpfungen prüfen.');
  assert.match(source, /assertEmployeeAllowed|employeeAllowed/, 'Download muss Employee-Scope erzwingen.');
});

test('Line-Manager-Report aggregiert nur erlaubte Mitarbeiter statt die komplette Firmen-View zu liefern', () => {
  const source = read('api/src/functions/managerReport.js');
  assert.match(source, /InstructionRecords/, 'Teamreport muss auf gescopten InstructionRecords basieren.');
  assert.match(source, /Employees/, 'Teamreport muss Employee-Zuordnung berücksichtigen.');
  assert.match(source, /allowedEmployeeIds|employeeId/, 'Teamreport muss Employee-Scope in der Abfrage verwenden.');
});

test('Planungen geben für eingeschränkte Rollen keine fremden Teilnehmernamen aus', () => {
  const source = read('api/src/functions/plannedTrainings.js');
  assert.match(source, /TrainingParticipants/, 'Planungen müssen Teilnehmer getrennt auswerten.');
  assert.match(source, /employeeAllowed|allowedEmployeeIds/, 'Teilnehmer müssen gegen den Scope gefiltert werden.');
  assert.match(source, /scopeRestricted|restricted/, 'Gemischte Planungen müssen als eingeschränkt erkannt werden.');
});
