import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SESSION_COOKIE = 'um_session';

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function scrypt(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  const value = String(password || '');
  if (value.length < 10 || value.length > 256) throw new Error('Passwort muss zwischen 10 und 256 Zeichen lang sein.');
  const salt = crypto.randomBytes(24);
  const derived = await scrypt(value, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const parts = String(encoded || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 1024 || N > 131072 || r < 1 || r > 32 || p < 1 || p > 16) return false;
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length < 16 || expected.length < 32 || expected.length > 128) return false;
    const actual = await scrypt(String(password || ''), salt, expected.length, { N, r, p, maxmem: 128 * 1024 * 1024 });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function signPayload(encodedPayload, secret) {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createSessionToken(payload, secret, options = {}) {
  if (!secret || String(secret).length < 24) throw new Error('Session-Schlüssel ist nicht ausreichend konfiguriert.');
  const now = Number(options.now ?? Math.floor(Date.now() / 1000));
  const ttlSeconds = Math.max(60, Math.min(Number(options.ttlSeconds ?? 8 * 60 * 60), 7 * 24 * 60 * 60));
  const body = {
    userId: String(payload?.userId || ''),
    email: String(payload?.email || '').trim().toLowerCase(),
    sessionVersion: Number(payload?.sessionVersion || 1),
    iat: now,
    exp: now + ttlSeconds
  };
  if (!body.userId || !body.email) throw new Error('Sitzungsdaten sind unvollständig.');
  const encodedPayload = b64url(JSON.stringify(body));
  return `${encodedPayload}.${signPayload(encodedPayload, String(secret))}`;
}

export function verifySessionToken(token, secret, options = {}) {
  try {
    if (!token || !secret || String(secret).length < 24) return null;
    const [encodedPayload, signature, extra] = String(token).split('.');
    if (!encodedPayload || !signature || extra !== undefined) return null;
    const expected = signPayload(encodedPayload, String(secret));
    if (!safeEqual(signature, expected)) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Number(options.now ?? Math.floor(Date.now() / 1000));
    if (!payload?.userId || !payload?.email || !Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) return null;
    if (Number(payload.iat || 0) > now + 60) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email).trim().toLowerCase(),
      sessionVersion: Number(payload.sessionVersion || 1),
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp)
    };
  } catch {
    return null;
  }
}

export function sessionSecret() {
  const secret = String(process.env.AUTH_SESSION_SECRET || '');
  const local = ['development', 'test'].includes(String(process.env.NODE_ENV || '').toLowerCase()) || String(process.env.AUTH_LOCAL_DEV || '').toLowerCase() === 'true';
  if (secret.length >= 32) return secret;
  if (local) return 'unterweisungsmanager-local-session-secret-only-for-tests';
  return null;
}

export function passwordSessionFromRequest(request) {
  const cookieHeader = request?.headers?.get?.('cookie') || '';
  const cookie = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  return verifySessionToken(decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)), secret);
}

export function sessionCookie(token, options = {}) {
  const secure = options.secure !== false;
  const maxAge = Math.max(60, Math.min(Number(options.maxAge ?? 8 * 60 * 60), 7 * 24 * 60 * 60));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(options = {}) {
  const secure = options.secure !== false;
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}
