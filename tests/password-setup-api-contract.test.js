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

test('invalid setup tokens are rejected before expensive password hashing', () => {
  assert.match(source, /\^\[A-Za-z0-9_\-\]\{43\}\$/);
  assert.match(source, /const preflight/);
  assert.match(source, /preflight\.recordset\.length !== 1/);
  const preflightIndex = source.indexOf('const preflight');
  const passwordHashIndex = source.indexOf('const passwordHash = await hashPassword');
  assert.ok(preflightIndex >= 0 && passwordHashIndex > preflightIndex, 'Token validity must be checked before scrypt password hashing');
});

test('password setup consumes token and updates password atomically', () => {
  assert.match(source, /hashPassword/);
  assert.match(source, /sessionVersion=sessionVersion\+1/);
  assert.match(source, /failedLoginCount=0/);
  assert.match(source, /lockedUntil=NULL/);
  assert.match(source, /passwordSetAt=SYSUTCDATETIME\(\)/);
  assert.match(source, /PasswordSetupTokens[\s\S]*usedAt=SYSUTCDATETIME\(\)/);
  assert.match(source, /new sql\.Transaction\(pool\)/);
  assert.match(source, /transaction\.begin\(\)/);
  assert.match(source, /transaction\.commit\(\)/);
  assert.match(source, /transaction\.rollback\(\)/);
});

test('security event omits raw credentials from details', () => {
  assert.match(source, /auth\.password\.setupSucceeded/);
  const eventCall = source.match(/writeSecurityEvent\([\s\S]*?'auth\.password\.setupSucceeded'[\s\S]*?\);/)?.[0] || '';
  assert.ok(eventCall);
  const details = eventCall.match(/\{\s*userId:\s*target\.userId,\s*companyId:\s*target\.companyId,\s*purpose:\s*target\.purpose\s*\}/)?.[0] || '';
  assert.ok(details);
  assert.doesNotMatch(details, /\btoken\b|tokenHash|passwordHash|\bpassword\b/i);
});
