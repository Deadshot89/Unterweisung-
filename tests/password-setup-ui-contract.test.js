import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/auth-login-v42.js','utf8');

test('central login reads setup token only from URL fragment', () => {
  assert.match(source, /new URLSearchParams\(String\(location\.hash \|\| ''\)\.replace\(\/\^#\/,''\)\)/);
  assert.match(source, /params\.get\('passwordSetup'\)/);
  assert.doesNotMatch(source, /location\.search[\s\S]{0,120}passwordSetup|\?passwordSetup=/);
});

test('setup token renders focused password creation form', () => {
  assert.match(source, /Passwort festlegen/);
  assert.match(source, /Neues Passwort/);
  assert.match(source, /Passwort bestätigen/);
  assert.match(source, /autocomplete="new-password"/);
  assert.match(source, /10 bis 256 Zeichen/);
  assert.match(source, /Passwort speichern/);
});

test('setup form posts token and clears fragment after success', () => {
  assert.match(source, /fetch\('\/api\/auth\/password\/setup'/);
  assert.match(source, /JSON\.stringify\(\{token,password,passwordConfirm\}\)/);
  assert.match(source, /history\.replaceState\(null,'',location\.pathname \+ location\.search\)/);
  assert.match(source, /Passwort wurde festgelegt\. Du kannst dich jetzt anmelden\./);
});
