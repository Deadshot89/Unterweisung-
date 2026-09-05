import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/user-management-v19.js','utf8');

test('user table shows password state without exposing credentials', () => {
  assert.match(source, /Passwort aktiv/);
  assert.match(source, /Kein Passwort/);
  assert.match(source, /u\.passwordEnabled/);
  assert.doesNotMatch(source, /passwordHash/);
});

test('authorized users get CSP-safe setup-link action', () => {
  assert.match(source, /function canCreatePasswordSetupLink\(user\)/);
  assert.match(source, /user\.role === 'system_admin' && !canCreateSystemAdmin\(\)/);
  assert.match(source, /data-password-setup-action/);
  assert.match(source, /data-user-id/);
  assert.doesNotMatch(source, /onclick=["'][^"']*PasswordSetup/i);
});

test('setup-link action posts to protected endpoint and displays returned URL only after click', () => {
  assert.match(source, /async function createPasswordSetupLink\(id\)/);
  assert.match(source, /api\('\/users\/' \+ encodeURIComponent\(id\) \+ '\/password-setup-link'/);
  assert.match(source, /method:'POST'/);
  assert.match(source, /result\.url/);
  assert.match(source, /passwordSetupLinkResult/);
  assert.match(source, /30 Minuten/);
});

test('delegated click handler invokes setup link generation', () => {
  assert.match(source, /closest\('\[data-password-setup-action\]'\)/);
  assert.match(source, /createPasswordSetupLink\(button\.dataset\.userId\)/);
});
