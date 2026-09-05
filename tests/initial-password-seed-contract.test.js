import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/seed-initial-password-setup-token.js','utf8');

test('operator bootstrap accepts only a hash and never plaintext credentials', () => {
  assert.match(source, /PASSWORD_SETUP_TOKEN_HASH/);
  assert.match(source, /\^\[a-f0-9\]\{64\}\$/);
  assert.doesNotMatch(source, /process\.env\.(?:PASSWORD_SETUP_TOKEN|RAW_TOKEN|PLAINTEXT_PASSWORD|PASSWORD)(?:\b|\[)/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\([^\n]*(?:tokenHash|rawToken|passwordHash|operatorEmail)/i);
});

test('operator bootstrap is pinned to the approved system admin email', () => {
  assert.match(source, /unterweisungmanagment@outlook\.de/i);
  assert.match(source, /role='system_admin'/i);
  assert.match(source, /active=1/i);
  assert.match(source, /passwordHash IS NULL/i);
});

test('operator bootstrap can create the missing system admin in one active company', () => {
  assert.match(source, /FROM dbo\.Companies[^;]*active=1/is);
  assert.match(source, /INSERT INTO dbo\.Users/i);
  assert.match(source, /system_admin/);
  assert.match(source, /operator-bootstrap/);
});

test('operator bootstrap seeds exactly one short-lived initial password token', () => {
  assert.match(source, /recordset\.length\s*!==\s*1/);
  assert.match(source, /initial_password/);
  assert.match(source, /DATEADD\(MINUTE,30,SYSUTCDATETIME\(\)\)/i);
  assert.match(source, /PasswordSetupTokens/);
  assert.match(source, /transaction\.begin\(\)/);
  assert.match(source, /transaction\.commit\(\)/);
});
