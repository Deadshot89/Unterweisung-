import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('api/src/functions/passwordSetup.js','utf8');

test('password setup consume endpoint is anonymous and token-bound', () => {
  assert.match(source, /app\.http\('passwordSetupConsume'/);
  assert.match(source, /methods:\s*\['POST'\]/);
  assert.match(source, /authLevel:\s*'anonymous'/);
  assert.match(source, /route:\s*'auth\/password\/setup'/);
  assert.match(source, /t\.tokenHash=@tokenHash/);
  assert.match(source, /t\.usedAt IS NULL/);
  assert.match(source, /t\.expiresAt>SYSUTCDATETIME\(\)/);
  assert.match(source, /u\.active=1/);
  assert.doesNotMatch(source, /body\.(email|userId|companyId)/);
});

test('password setup consumes token and updates password atomically', () => {
  assert.match(source, /hashPassword/);
  assert.match(source, /sessionVersion=sessionVersion\+1/);
  assert.match(source, /failedLoginCount=0/);
  assert.match(source, /lockedUntil=NULL/);
  assert.match(source, /passwordSetAt=SYSUTCDATETIME\(\)/);
  assert.match(source, /PasswordSetupTokens[\s\S]*usedAt=SYSUTCDATETIME\(\)/);
  assert.match(source, /beginTransaction\(/);
  assert.match(source, /commit\(/);
  assert.match(source, /rollback\(/);
});

test('security event omits raw credentials', () => {
  assert.match(source, /auth\.password\.setupSucceeded/);
  assert.doesNotMatch(source, /writeSecurityEvent\([^;]*(token|passwordHash|password)[^;]*\)/i);
});
