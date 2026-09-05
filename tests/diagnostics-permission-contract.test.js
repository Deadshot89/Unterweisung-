import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('database/migrations/011_diagnostics_pwa.sql','utf8');
const access = fs.readFileSync('api/src/lib/diagnosticAccess.js','utf8');
const me = fs.readFileSync('api/src/functions/me.js','utf8');
const users = fs.readFileSync('api/src/functions/users.js','utf8');
const permissionApi = fs.readFileSync('api/src/functions/userDiagnosticPermissions.js','utf8');

test('diagnostics permission is explicit and system-admin managed', () => {
  assert.match(migration, /CREATE TABLE dbo\.UserPermissions/i);
  assert.match(migration, /permissionKey\s+NVARCHAR\(120\)/i);
  assert.match(migration, /CREATE TABLE dbo\.DiagnosticEvents/i);
  assert.match(migration, /CREATE TABLE dbo\.PushSubscriptions/i);
  assert.match(access, /diagnostics\.view/);
  assert.match(access, /Roles\.SYSTEM_ADMIN/);
  assert.match(me, /permissions/);
  assert.match(users, /diagnosticsView/);
  assert.match(permissionApi, /Roles\.SYSTEM_ADMIN/);
  assert.match(permissionApi, /permissionKey[^\n]*diagnostics\.view|diagnostics\.view[^\n]*permissionKey/i);
});

test('delegated diagnostics permission remains company-scoped', () => {
  assert.match(access, /companyId/);
  assert.match(access, /userId/);
  assert.match(permissionApi, /companyId/);
  assert.match(permissionApi, /UserPermissions/);
});
