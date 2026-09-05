import {
  createECDH,
  createHmac,
  createPrivateKey,
  sign
} from 'node:crypto';

const VAPID_CONTEXT = 'unterweisungsmanager:vapid:v1';
const P256_ORDER = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function to32Bytes(number) {
  return Buffer.from(number.toString(16).padStart(64, '0'), 'hex');
}

function vapidSecret() {
  const secret = String(process.env.AUTH_SESSION_SECRET || '');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    const err = new Error('Web Push ist nicht verfügbar: AUTH_SESSION_SECRET fehlt oder ist zu kurz.');
    err.status = 503;
    throw err;
  }
  return secret;
}

function deriveVapidKeyPair() {
  const digest = createHmac('sha256', vapidSecret())
    .update(VAPID_CONTEXT, 'utf8')
    .digest();
  const scalar = (BigInt(`0x${digest.toString('hex')}`) % (P256_ORDER - 1n)) + 1n;
  const privateBytes = to32Bytes(scalar);

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateBytes);
  const publicBytes = ecdh.getPublicKey(null, 'uncompressed');
  const x = publicBytes.subarray(1, 33);
  const y = publicBytes.subarray(33, 65);

  const keyObject = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64url(x),
      y: base64url(y),
      d: base64url(privateBytes)
    },
    format: 'jwk'
  });

  return { publicBytes, keyObject };
}

function vapidSubject() {
  const email = String(process.env.MAIL_FROM || '').trim();
  if (email && email.includes('@')) return `mailto:${email}`;
  const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim();
  if (/^https:\/\//i.test(base)) return base;
  return 'https://localhost.invalid';
}

function createVapidToken(endpoint, keyObject) {
  const audience = new URL(endpoint).origin;
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: vapidSubject()
  }));
  const unsigned = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363'
  });
  return `${unsigned}.${base64url(signature)}`;
}

export function getVapidPublicKey() {
  return base64url(deriveVapidKeyPair().publicBytes);
}

export async function sendEmptyWebPush(endpoint, { ttl = 60, urgency = 'high' } = {}) {
  const url = new URL(String(endpoint || ''));
  if (url.protocol !== 'https:') {
    const err = new Error('Ungültiger Web-Push-Endpunkt.');
    err.status = 400;
    throw err;
  }

  const { publicBytes, keyObject } = deriveVapidKeyPair();
  const publicKey = base64url(publicBytes);
  const token = createVapidToken(url.href, keyObject);
  const response = await fetch(url.href, {
    method: 'POST',
    headers: {
      TTL: String(Math.max(0, Math.min(86400, Number(ttl) || 60))),
      Urgency: ['very-low','low','normal','high'].includes(urgency) ? urgency : 'high',
      Authorization: `vapid t=${token}, k=${publicKey}`
    }
  });

  return {
    ok: response.ok,
    status: response.status,
    expired: response.status === 404 || response.status === 410
  };
}
