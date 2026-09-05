import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const staticWorkflow = fs.readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');
const functionsWorkflow = fs.readFileSync('.github/workflows/azure-functions-api.yml', 'utf8');
const migrationRunner = fs.readFileSync('scripts/apply-migrations.js', 'utf8');
const diagnosticsMigration = fs.readFileSync('database/migrations/011_diagnostics_pwa.sql', 'utf8');

function migrationStep(workflow) {
  const start = workflow.indexOf('- name: Run database migrations');
  assert.ok(start >= 0, 'Migration step is missing');
  const rest = workflow.slice(start + 1);
  const nextStepOffset = rest.indexOf('\n      - name: ');
  return nextStepOffset >= 0 ? workflow.slice(start, start + 1 + nextStepOffset) : workflow.slice(start);
}

function assertMigrationBeforeDeploy(workflow, deployStepName) {
  const migrationIndex = workflow.indexOf('name: Run database migrations');
  const deployIndex = workflow.indexOf(`name: ${deployStepName}`);
  assert.ok(migrationIndex >= 0, 'Migration step is missing');
  assert.ok(deployIndex >= 0, `Deploy step ${deployStepName} is missing`);
  assert.ok(migrationIndex < deployIndex, 'Database migrations must run before deployment');
  assert.match(workflow, /SQL_CONNECTION_STRING:\s*\$\{\{ secrets\.SQL_CONNECTION_STRING \}\}/);
  assert.match(workflow, /run:\s*npm run db:migrate/);
  assert.doesNotMatch(workflow, /run:\s*npm run db:seed/);
}

test('diagnostics schema migration is idempotent and contains all required tables', () => {
  assert.match(diagnosticsMigration, /OBJECT_ID\('dbo\.UserPermissions','U'\) IS NULL/);
  assert.match(diagnosticsMigration, /OBJECT_ID\('dbo\.DiagnosticEvents','U'\) IS NULL/);
  assert.match(diagnosticsMigration, /OBJECT_ID\('dbo\.PushSubscriptions','U'\) IS NULL/);
});

test('static web app production deployment migrates schema before publishing', () => {
  assertMigrationBeforeDeploy(staticWorkflow, 'Build And Deploy');
});

test('static web app preview deployments can never migrate the production database', () => {
  const step = migrationStep(staticWorkflow);
  assert.match(step, /if:\s*github\.event_name\s*==\s*'push'/);
});

test('standalone functions production deployment migrates schema before publishing', () => {
  assertMigrationBeforeDeploy(functionsWorkflow, 'Deploy to Azure Functions');
  assert.match(functionsWorkflow, /Install root runtime dependencies/);
  assert.match(functionsWorkflow, /npm install --omit=dev/);
});

test('migration runner serializes concurrent production deploys with a SQL application lock', () => {
  assert.match(migrationRunner, /sp_getapplock/i);
  assert.match(migrationRunner, /Unterweisungsmanager\.DbMigrations/);
  assert.match(migrationRunner, /LockMode\s*=\s*'Exclusive'/i);
  assert.match(migrationRunner, /LockOwner\s*=\s*'Transaction'/i);
  assert.match(migrationRunner, /new sql\.Transaction\(pool\)/);
  assert.match(migrationRunner, /transaction\.commit\(\)/);
  assert.match(migrationRunner, /transaction\.rollback\(\)/);
});
