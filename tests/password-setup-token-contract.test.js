import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('database/migrations/010_password_auth_and_setup_tokens.sql','utf8');
const helper = readFileSync('api/src/lib/passwordSetup.js','utf8');

test('migration adds password auth columns idempotently', () => {
  for (const name of ['passwordHash','passwordSetAt','failedLoginCount','lockedUntil','sessionVersion']) {
    assert.match(migration, new RegExp(`COL_LENGTH\\('dbo.Users','${name}'\\)`));
  }
});

test('migration creates hash-only setup token table', () => {
  assert.match(migration, /CREATE TABLE dbo\.PasswordSetupTokens/);
  assert.match(migration, /tokenHash NVARCHAR\(128\) NOT NULL/);
  assert.doesNotMatch(migration, /rawToken|plainToken/i);
});

test('helper uses randomBytes and sha256 and fragment links', () => {
  assert.match(helper, /randomBytes\(32\)/);
  assert.match(helper, /createHash\('sha256'\)/);
  assert.match(helper, /#passwordSetup=/);
  assert.doesNotMatch(helper, /\?passwordSetup=/);
});
