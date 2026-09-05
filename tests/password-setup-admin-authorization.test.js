import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const setup = readFileSync('api/src/functions/passwordSetup.js','utf8');
const users = readFileSync('api/src/functions/users.js','utf8');

test('authenticated admins can create tenant-bound setup links', () => {
  assert.match(setup, /app\.http\('passwordSetupLinkCreate'/);
  assert.match(setup, /route:\s*'users\/\{id\}\/password-setup-link'/);
  assert.match(setup, /getAuthorizedContext\(request\)/);
  assert.match(setup, /assertRole\(ctx,\s*\[Roles\.SYSTEM_ADMIN,\s*Roles\.COMPANY_ADMIN\]\)/);
  assert.match(setup, /WHERE id=@id AND companyId=@companyId/);
  assert.match(setup, /createSetupToken\(\)/);
  assert.match(setup, /hashSetupToken\(rawToken\)/);
  assert.match(setup, /DATEADD\(MINUTE,30,SYSUTCDATETIME\(\)\)/);
  assert.match(setup, /setupLink\(rawToken,/);
});

test('company admin can never create setup link for system admin', () => {
  assert.match(setup, /target\.role===Roles\.SYSTEM_ADMIN\s*&&\s*!ctx\.roles\.includes\(Roles\.SYSTEM_ADMIN\)/);
  assert.match(setup, /Keine Berechtigung für Systemadmin-Zugang/);
});

test('user list exposes passwordEnabled but never password hash', () => {
  assert.match(users, /CASE WHEN passwordHash IS NULL THEN CAST\(0 AS BIT\) ELSE CAST\(1 AS BIT\) END AS passwordEnabled/i);
  const getSelect = users.match(/SELECT id,companyId,email[\s\S]*?FROM Users WHERE companyId=@companyId/)?.[0] || '';
  assert.ok(getSelect);
  assert.doesNotMatch(getSelect, /,passwordHash(?:,|\s+FROM)/i);
});

test('company admin cannot patch or upsert an existing system admin', () => {
  assert.match(users, /SELECT TOP 1 id,companyId,role FROM Users WHERE id=@id AND companyId=@companyId/);
  assert.match(users, /target\.role===Roles\.SYSTEM_ADMIN\s*&&\s*!ctx\.roles\.includes\(Roles\.SYSTEM_ADMIN\)/);
  assert.match(users, /SELECT TOP 1 id,role FROM Users WHERE companyId=@companyId AND LOWER\(email\)=LOWER\(@email\)/);
  assert.match(users, /existing\.role===Roles\.SYSTEM_ADMIN\s*&&\s*!ctx\.roles\.includes\(Roles\.SYSTEM_ADMIN\)/);
});
