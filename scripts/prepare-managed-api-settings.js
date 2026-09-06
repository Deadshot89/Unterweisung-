import { writeFileSync, chmodSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import path from 'node:path';

// Temporary server-only bridge until SWA application settings are configured.
// Never include auth overrides, publish profiles or deployment tokens.
const names = ['SQL_CONNECTION_STRING', 'AZURE_STORAGE_CONNECTION_STRING', 'PUBLIC_BASE_URL'];
const settings = {};
for (const name of names) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Required deployment setting is missing: ${name}`);
  settings[name] = value.trim();
}

for (const name of ['AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_DEPLOYMENT']) {
  if(process.env[name]?.trim()) settings[name]=process.env[name].trim();
}
console.log('Document analysis settings complete: '+['AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_DEPLOYMENT'].every(name=>!!settings[name]));

const graphNames = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];
const optionalGraphNames = ['GRAPH_SENDER_ID'];
for (const name of [...graphNames, ...optionalGraphNames]) {
  if(process.env[name]?.trim()) settings[name]=process.env[name].trim();
}
console.log('Graph mail settings complete: '+graphNames.every(name=>!!settings[name]));
console.log('Graph sender identity explicit: '+!!settings.GRAPH_SENDER_ID);

const directSessionSecret=String(process.env.AUTH_SESSION_SECRET||'').trim();
if(directSessionSecret){
  if(directSessionSecret.length<32) throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters.');
  settings.AUTH_SESSION_SECRET=directSessionSecret;
}else{
  const sessionSeed=String(process.env.AUTH_SESSION_SEED||'').trim();
  if(!sessionSeed) throw new Error('A server-only session signing source is required.');
  settings.AUTH_SESSION_SECRET=createHmac('sha256',sessionSeed)
    .update('unterweisungsmanager/auth-session/v1','utf8')
    .digest('base64url');
}
console.log('Password session signing settings complete: true');

const target = path.resolve('api/runtime-settings.deploy.json');
// Oryx changes ownership to root. The managed runtime must still be able to
// read the API-only file; group/other identities cannot modify it.
writeFileSync(target, JSON.stringify(settings), { encoding: 'utf8', mode: 0o644 });
chmodSync(target, 0o644);
console.log('Prepared server-only managed API runtime settings.');
