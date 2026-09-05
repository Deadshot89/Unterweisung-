import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync('frontend/auth-login-v42.js','utf8');
const passwordAuth = readFileSync('api/src/functions/passwordAuth.js','utf8');
const auth = readFileSync('api/src/lib/auth.js','utf8');

test('production login shows only email and password while Microsoft login is disabled', () => {
  assert.match(login, /<h2>Anmeldung<\/h2>/);
  assert.match(login, /E-Mail und Passwort/);
  assert.match(login, /authPasswordLogin/);
  assert.match(login, /\/api\/auth\/password\/login/);
  assert.doesNotMatch(login, /\/\.auth\/login\/aad/);
  assert.doesNotMatch(login, /Mit Microsoft anmelden/);
  assert.doesNotMatch(login, /Microsoft oder E-Mail/);
});

test('login keeps external instructions independent and setup links on the same page', () => {
  assert.match(login, /Externe Unterweisungen/);
  assert.match(login, /#passwordSetup=/);
  assert.match(login, /Passwort festlegen/);
  assert.match(login, /\/api\/auth\/password\/setup/);
  assert.match(login, /history\.replaceState/);
});

test('password auth errors refer to the current migration number', () => {
  assert.doesNotMatch(passwordAuth, /Datenbankmigration 011/);
  assert.doesNotMatch(auth, /Datenbankmigration 011/);
  assert.match(passwordAuth, /Datenbankmigration 010/);
  assert.match(auth, /Datenbankmigration 010/);
});
