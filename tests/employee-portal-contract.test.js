import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('employee portal exposes the approved work buckets and actions', () => {
  const html = read('frontend/index.html');
  const portal = read('frontend/employee-portal-v37.js');
  const css = read('frontend/employee-portal-v37.css');
  assert.match(html, /employee-portal-v37\.css/);
  assert.match(html, /employee-portal-v37\.js/);
  for (const label of ['Jetzt erledigen','Einplanung erforderlich','Geplante Termine','Bald fällig','Abgeschlossen']) assert.match(portal, new RegExp(label));
  for (const action of ['Starten','Fortsetzen','Termin anfragen','Nachweis herunterladen']) assert.match(portal, new RegExp(action));
  assert.match(portal, /learning-step-image/);
  assert.match(portal, /learning-progress/);
  assert.match(css, /employee-dashboard/);
  assert.match(css, /learning-image-modal/);
});

test('login page offers Microsoft and email/password without changing role semantics', () => {
  const html = read('frontend/index.html');
  const portal = read('frontend/employee-portal-v37.js');
  assert.match(html, /\.auth\/login\/aad/);
  assert.match(portal, /E-Mail und Passwort/);
  assert.match(portal, /\/api\/auth\/password\/login/);
  assert.match(portal, /credentials\s*:\s*['\"]include['\"]/);
});

test('database migration prepares password, learning-step and internal-attempt storage without applying it', () => {
  const migration = read('database/migrations/011_employee_portal_dual_auth.sql');
  for (const token of ['passwordHash','passwordSetAt','failedLoginCount','lockedUntil','sessionVersion','InstructionLearningSteps','InternalTrainingAttempts']) assert.match(migration, new RegExp(token));
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE\s+TABLE/i);
});

test('tenant, team and self scoping is wired into list and download APIs', () => {
  for (const path of ['api/src/functions/employees.js','api/src/functions/status.js','api/src/functions/records.js','api/src/functions/plannedTrainings.js','api/src/functions/files.js']) {
    assert.match(read(path), /employeeAccess\.js/);
  }
  assert.match(read('api/src/functions/files.js'), /employeeIdAllowed/);
  assert.match(read('api/src/functions/passwordAuth.js'), /auth\/password\/login/);
  assert.match(read('api/src/functions/employeeTraining.js'), /employee-training/);
  assert.match(read('api/src/functions/learningSteps.js'), /learning-steps/);
});
