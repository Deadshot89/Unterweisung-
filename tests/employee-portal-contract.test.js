import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFileSync(url(path), 'utf8');

test('employee portal exposes the approved work buckets and actions', () => {
  const html = read('frontend/index.html');
  const portal = read('frontend/employee-portal-v37.js');
  const css = read('frontend/employee-portal-v37.css');
  assert.match(html, /employee-portal-v37\.css/);
  assert.match(html, /employee-portal-v37\.js/);
  assert.match(html, /learning-experience-v38\.css/);
  assert.match(html, /learning-experience-v38\.js/);
  for (const label of ['Jetzt erledigen','Einplanung erforderlich','Geplante Termine','Bald fällig','Abgeschlossen']) assert.match(portal, new RegExp(label));
  for (const action of ['Starten','Fortsetzen','Termin anfragen','Nachweis herunterladen']) assert.match(portal, new RegExp(action));
  assert.match(css, /employee-dashboard/);
  assert.match(css, /learning-image-modal/);
});

test('employee and manager experience is selected only by the central portal mode', () => {
  const portal = read('frontend/employee-portal-v37.js');
  assert.match(portal, /state\.portalMode\s*===\s*['"]employee-portal['"]/);
  assert.match(portal, /state\.portalMode\s*===\s*['"]employee-manager-portal['"]/);
});

test('employee portal and learning caches expose explicit company-switch resets', () => {
  const portal = read('frontend/employee-portal-v37.js');
  const learning = read('frontend/employee-learning-v38.js');
  assert.match(portal, /function\s+resetEmployeePortalState\(\)/);
  assert.match(portal, /portalState\.adminCache\.clear\(\)/);
  assert.match(portal, /window\.resetEmployeePortalState\s*=\s*resetEmployeePortalState/);
  assert.match(learning, /function\s+resetEmployeeLearningState\(\)/);
  assert.match(learning, /portalState\.imageUrls\.clear\(\)/);
  assert.match(learning, /resetEmployeeLearningState/);
});

test('employee learning uses a focused shared-renderer module for steps, tests and results', () => {
  assert.ok(existsSync(url('frontend/employee-learning-v38.js')), 'employee-learning-v38.js fehlt');
  const html = read('frontend/index.html');
  const learning = read('frontend/employee-learning-v38.js');
  assert.match(html, /employee-portal-v37\.js[\s\S]*employee-learning-v38\.js/);
  assert.match(learning, /renderer\s*=\s*globalThis\.UMLearningExperience/);
  assert.match(learning, /renderer\.renderLearningStep/);
  assert.match(learning, /renderer\.renderQuestionList/);
  assert.match(learning, /renderer\.renderResult/);
  assert.match(learning, /learningGoal/);
  assert.match(learning, /learningIntro/);
  assert.match(learning, /keyPoints/);
  assert.match(learning, /imageCaption/);
  assert.match(learning, /calloutTitle/);
  assert.match(learning, /calloutText/);
  assert.doesNotMatch(learning, /Das solltest du mitnehmen/);
});

test('employee learning keeps server-owned progression and answer submission contracts', () => {
  assert.ok(existsSync(url('frontend/employee-learning-v38.js')), 'employee-learning-v38.js fehlt');
  const learning = read('frontend/employee-learning-v38.js');
  assert.match(learning, /attemptId\s*:\s*data\.attemptId/);
  assert.match(learning, /currentStep\s*:\s*portalState\.stepIndex/);
  assert.match(learning, /namePrefix\s*:\s*['"]portalQuestion['"]/);
  assert.match(learning, /questionId\s*:\s*q\.id/);
  assert.match(learning, /answerIndex/);
});

test('login page offers Microsoft and email/password without changing role semantics', () => {
  const html = read('frontend/index.html');
  const login = read('frontend/auth-login-v42.js');
  assert.match(html, /auth-login-v42\.js/);
  assert.match(login, /E-Mail und Passwort/);
  assert.match(login, /\.auth\/login\/aad/);
  assert.match(login, /\/api\/auth\/password\/login/);
  assert.match(login, /credentials\s*:\s*['\"]include['\"]/);
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

test('online completion is rejected server-side until every published learning step was traversed', () => {
  const trainingApi = read('api/src/functions/employeeTraining.js');
  assert.match(trainingApi, /attempt\.currentStep\s*<\s*steps\.length/,
    'Abschluss muss den serverseitig gespeicherten Lernfortschritt gegen die veröffentlichten Schritte prüfen.');
  assert.match(trainingApi, /Lernschritte.*vollständig/i,
    'Ein übersprungener Lernablauf muss mit einer verständlichen Fehlermeldung abgewiesen werden.');
});