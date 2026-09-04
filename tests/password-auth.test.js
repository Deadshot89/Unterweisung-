import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken
} from '../api/src/lib/passwordAuth.js';

test('password credentials are salted and verify only the correct password', async () => {
  const encoded = await hashPassword('Sicheres-Passwort-2026!');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(encoded.includes('Sicheres-Passwort-2026!'), false);
  assert.equal(await verifyPassword('Sicheres-Passwort-2026!', encoded), true);
  assert.equal(await verifyPassword('Falsch!', encoded), false);
});

test('signed password sessions reject tampering and expiration', () => {
  const secret = 'test-secret-with-enough-entropy-1234567890';
  const now = 1_800_000_000;
  const token = createSessionToken({ userId: 'user-1', email: 'ma@example.com', sessionVersion: 3 }, secret, { now, ttlSeconds: 3600 });
  const session = verifySessionToken(token, secret, { now: now + 60 });
  assert.equal(session.userId, 'user-1');
  assert.equal(session.email, 'ma@example.com');
  assert.equal(session.sessionVersion, 3);
  assert.equal(verifySessionToken(`${token}x`, secret, { now: now + 60 }), null);
  assert.equal(verifySessionToken(token, secret, { now: now + 4000 }), null);
});
