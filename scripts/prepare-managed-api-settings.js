import { writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';

// Temporary server-only bridge until SWA application settings are configured.
// Never include auth overrides, publish profiles or deployment tokens.
const names = ['SQL_CONNECTION_STRING', 'AZURE_STORAGE_CONNECTION_STRING'];
const settings = {};
for (const name of names) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Required deployment setting is missing: ${name}`);
  settings[name] = value;
}

for (const name of ['AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_DEPLOYMENT']) {
  if(process.env[name]?.trim()) settings[name]=process.env[name].trim();
}
console.log('Document analysis settings complete: '+['AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_DEPLOYMENT'].every(name=>!!settings[name]));

const target = path.resolve('api/runtime-settings.deploy.json');
// Oryx changes ownership to root. The managed runtime must still be able to
// read the API-only file; group/other identities cannot modify it.
writeFileSync(target, JSON.stringify(settings), { encoding: 'utf8', mode: 0o644 });
chmodSync(target, 0o644);
console.log('Prepared server-only managed API runtime settings.');
