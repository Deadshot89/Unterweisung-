import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../api/src/lib/passwordAuth.js';
import { getRequestContext } from '../api/src/lib/auth.js';

function makeRequest(headers = {}) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      }
    }
  };
}

test('valid password session wins over a stale Entra principal', () => {
  const previousSecret = process.env.AUTH_SESSION_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.AUTH_SESSION_SECRET = 'test-password-session-secret-1234567890';
    process.env.NODE_ENV = 'production';

    const token = createSessionToken({
      userId: 'user-system-admin-operator',
      email: 'unterweisungmanagment@outlook.de',
      sessionVersion: 3
    }, process.env.AUTH_SESSION_SECRET, { ttlSeconds: 3600 });

    const stalePrincipal = Buffer.from(JSON.stringify({
      userId: 'stale-microsoft-object-id',
      userDetails: 'old.microsoft.login@example.com',
      userRoles: ['authenticated']
    })).toString('base64');

    const ctx = getRequestContext(makeRequest({
      cookie: `um_session=${encodeURIComponent(token)}`,
      'x-ms-client-principal': stalePrincipal
    }));

    assert.equal(ctx.authMode, 'password');
    assert.equal(ctx.userId, 'user-system-admin-operator');
    assert.equal(ctx.email, 'unterweisungmanagment@outlook.de');
    assert.ok(ctx.passwordSession);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
