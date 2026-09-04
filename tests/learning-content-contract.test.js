import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = 'database/migrations/012_learning_experience_content.sql';
const helperPath = 'api/src/lib/learningContent.js';

function source(path) {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, 'utf8');
}

test('migration 012 is additive and defines professional learning metadata', () => {
  const migration = source(migrationPath);
  for (const name of ['learningGoal','learningIntro','keyPointsJson','imageCaption','calloutTitle','calloutText']) {
    assert.match(migration, new RegExp(name));
  }
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b/i);
});

test('learning content helper owns schema readiness, key points and published rich steps', () => {
  const helper = source(helperPath);
  assert.match(helper, /learningContentSchemaReady/);
  assert.match(helper, /parseKeyPoints/);
  assert.match(helper, /loadPublishedLearningContent/);
  assert.match(helper, /status='published'/);
  assert.match(helper, /imageBlobPath/);
});

test('instruction, bootstrap, step and employee APIs expose professional learning metadata', () => {
  const types = source('api/src/functions/instructionTypes.js');
  const bootstrap = source('api/src/functions/bootstrap.js');
  const steps = source('api/src/functions/learningSteps.js');
  const employee = source('api/src/functions/employeeTraining.js');
  for (const text of [types, bootstrap]) {
    assert.match(text, /learningGoal/);
    assert.match(text, /learningIntro/);
    assert.match(text, /keyPoints/);
  }
  for (const field of ['imageCaption','calloutTitle','calloutText']) assert.match(steps, new RegExp(field));
  assert.match(employee, /loadPublishedLearningContent/);
  assert.match(employee, /learningGoal/);
  assert.match(employee, /keyPoints/);
});

test('new rich content writes are guarded by the centralized migration 012 readiness helper', () => {
  const helper = source(helperPath);
  const types = source('api/src/functions/instructionTypes.js');
  const steps = source('api/src/functions/learningSteps.js');
  assert.match(helper, /Datenbankmigration 012/);
  assert.match(helper, /requireLearningContentSchema/);
  assert.match(types, /requireLearningContentSchema/);
  assert.match(steps, /requireLearningContentSchema/);
});