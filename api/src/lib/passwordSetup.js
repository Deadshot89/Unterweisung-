import crypto from 'node:crypto';

export function createSetupToken(){
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSetupToken(rawToken){
  return crypto.createHash('sha256').update(String(rawToken || ''),'utf8').digest('hex');
}

export function setupLink(rawToken, baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL){
  const base = String(baseUrl || '').replace(/\/$/,'');
  if(!base) throw new Error('PUBLIC_BASE_URL oder APP_BASE_URL fehlt.');
  return `${base}/#passwordSetup=${encodeURIComponent(String(rawToken || ''))}`;
}
