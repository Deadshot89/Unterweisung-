import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const modulePath = path.resolve('api/src/lib/runtime-settings.js');
assert.equal(
  existsSync(modulePath),
  true,
  'Managed API benötigt einen serverseitigen Runtime-Settings-Loader für deployte Secrets.'
);

const dbSource = readFileSync('api/src/lib/db.js', 'utf8');
const blobSource = readFileSync('api/src/lib/blob.js', 'utf8');
const runtimeSource = readFileSync('api/src/lib/runtime-settings.js', 'utf8');
const prepareSource = readFileSync('scripts/prepare-managed-api-settings.js', 'utf8');
const workflow = readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');
const gitignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';

assert.match(dbSource, /runtime-settings\.js/, 'SQL-Layer muss Runtime-Settings vor dem Zugriff auf process.env laden.');
assert.match(blobSource, /runtime-settings\.js/, 'Blob-Layer muss Runtime-Settings vor dem Zugriff auf process.env laden.');
assert.match(workflow, /Prepare managed API runtime settings/, 'Deployment muss die serverseitige Runtime-Settings-Datei aus GitHub Secrets erzeugen.');
assert.match(workflow, /runtime-settings\.deploy\.json/, 'Deployment muss die Runtime-Settings-Datei nur im API-Verzeichnis erzeugen.');
assert.match(gitignore, /api\/runtime-settings\.deploy\.json/, 'Generierte Runtime-Secrets dürfen niemals committed werden.');
assert.match(runtimeSource, /AUTH_SESSION_SECRET/, 'Der API-Runtime-Loader muss den Session-Signierschlüssel serverseitig laden dürfen.');
assert.match(prepareSource, /AUTH_SESSION_SECRET/, 'Der Deployment-Bridge muss einen Session-Signierschlüssel ausschließlich im API-Paket vorbereiten.');
assert.match(workflow, /AUTH_SESSION_(?:SECRET|SEED)/, 'Der Deploy-Workflow muss eine serverseitige Quelle für den Session-Signierschlüssel bereitstellen.');

const dir = mkdtempSync(path.join(tmpdir(), 'um-runtime-settings-'));
const settingsFile = path.join(dir, 'runtime-settings.deploy.json');
writeFileSync(settingsFile, JSON.stringify({
  SQL_CONNECTION_STRING: 'Server=test-sql;Database=test-db;',
  AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;EndpointSuffix=core.windows.net;',
  AUTH_SESSION_SECRET: 'test-session-secret-with-more-than-thirty-two-characters',
  AUTH_LOCAL_DEV: 'true'
}), 'utf8');

const childCode = `
  import assert from 'node:assert/strict';
  delete process.env.SQL_CONNECTION_STRING;
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  delete process.env.AUTH_SESSION_SECRET;
  process.env.RUNTIME_SETTINGS_FILE = ${JSON.stringify(settingsFile)};
  await import(${JSON.stringify(pathToFileURL(modulePath).href)});
  assert.equal(process.env.SQL_CONNECTION_STRING, 'Server=test-sql;Database=test-db;');
  assert.equal(process.env.AZURE_STORAGE_CONNECTION_STRING, 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;EndpointSuffix=core.windows.net;');
  assert.equal(process.env.AUTH_SESSION_SECRET, 'test-session-secret-with-more-than-thirty-two-characters');
`;

try {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', childCode], {
    encoding: 'utf8',
    env: { ...process.env }
  });

  assert.equal(
    result.status,
    0,
    `Runtime-Settings-Loader hat die serverseitigen Einstellungen nicht geladen.\n${result.stderr || result.stdout}`
  );
  for (const [module, check] of [
    ['db.js', "assert.equal(lib.getSqlConnectionString(), 'Server=test-sql;Database=test-db;'); assert.equal(lib.isDbConfigured(), true);"],
    ['blob.js', "assert.equal(lib.getBlobServiceClient().accountName, 'test');"]
  ]) {
    const integration = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      delete process.env.SQL_CONNECTION_STRING;
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AUTH_SESSION_SECRET;
      delete process.env.AUTH_LOCAL_DEV;
      process.env.RUNTIME_SETTINGS_FILE = ${JSON.stringify(settingsFile)};
      const lib = await import(${JSON.stringify(pathToFileURL(path.resolve('api/src/lib')).href)} + '/' + ${JSON.stringify(module)});
      ${check}
      assert.equal(process.env.AUTH_SESSION_SECRET, 'test-session-secret-with-more-than-thirty-two-characters');
      assert.equal(process.env.AUTH_LOCAL_DEV, undefined, 'Packaged data must not enable auth bypass');
      process.env.SQL_CONNECTION_STRING = 'Server=azure-setting;Database=real;';
      const { applyPackagedRuntimeSettings } = await import(${JSON.stringify(pathToFileURL(modulePath).href)});
      applyPackagedRuntimeSettings();
      assert.equal(process.env.SQL_CONNECTION_STRING, 'Server=azure-setting;Database=real;', 'Azure settings take precedence');
    `], { encoding: 'utf8', env: { ...process.env } });
    assert.equal(integration.status, 0, `${module} did not load runtime settings: ${integration.stderr}`);
  }
  console.log('Managed API runtime settings checks passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
