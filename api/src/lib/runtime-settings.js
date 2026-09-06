import { existsSync, readFileSync } from 'node:fs';

const ALLOWED_RUNTIME_SETTINGS = Object.freeze([
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_DEPLOYMENT',
  'SQL_CONNECTION_STRING',
  'SQL_SERVER',
  'SQL_DATABASE',
  'SQL_USER',
  'SQL_PASSWORD',
  'AZURE_STORAGE_CONNECTION_STRING',
  'AUTH_SESSION_SECRET',
  'PUBLIC_BASE_URL',
  'BLOB_CONTAINER',
  'BLOB_CONTAINER_TEMPLATES',
  'BLOB_CONTAINER_PROOFS',
  'BLOB_CONTAINER_BACKUPS',
  'BLOB_CONTAINER_EXPORTS',
  'DEFAULT_COMPANY_ID',
  'COMPANY_ID',
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'MAIL_FROM',
  'GRAPH_SENDER_ID'
]);

function runtimeSettingsLocation() {
  const explicit = String(process.env.RUNTIME_SETTINGS_FILE || '').trim();
  return explicit || new URL('../../runtime-settings.deploy.json', import.meta.url);
}

function readPackagedRuntimeSettings() {
  const location = runtimeSettingsLocation();
  if (!existsSync(location)) return {};

  const parsed = JSON.parse(readFileSync(location, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Managed API runtime settings must be a JSON object.');
  }
  return parsed;
}

export function applyPackagedRuntimeSettings() {
  const packaged = readPackagedRuntimeSettings();
  const applied = [];

  for (const name of ALLOWED_RUNTIME_SETTINGS) {
    const existing = process.env[name];
    const packagedValue = packaged[name];
    if (existing !== undefined && String(existing).length > 0) continue;
    if (typeof packagedValue !== 'string' || packagedValue.length === 0) continue;
    process.env[name] = packagedValue;
    applied.push(name);
  }

  return applied;
}

applyPackagedRuntimeSettings();
