import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(path.join(tmpdir(), 'um-package-check-'));
const script = path.resolve('scripts/prepare-managed-api-settings.js');
const sql = 'Server=test;Database=fixture;Password=quote\"and\\slash;';
const storage = 'DefaultEndpointsProtocol=https;AccountName=fixture;AccountKey=ZmFrZQ==;EndpointSuffix=core.windows.net';
const cleanEnv = { ...process.env };
for (const name of ['SQL_CONNECTION_STRING', 'AZURE_STORAGE_CONNECTION_STRING']) delete cleanEnv[name];
const target = path.join(dir, 'api/runtime-settings.deploy.json');

try {
  mkdirSync(path.join(dir, 'api'));
  mkdirSync(path.join(dir, 'frontend'));
  const missing = spawnSync(process.execPath, [script], { cwd: dir, env: cleanEnv, encoding: 'utf8' });
  assert.notEqual(missing.status, 0, 'Missing required secrets must stop deployment');
  assert.equal(existsSync(target), false);

  const result = spawnSync(process.execPath, [script], {
    cwd: dir,
    env: { ...cleanEnv, SQL_CONNECTION_STRING: sql, AZURE_STORAGE_CONNECTION_STRING: storage, AUTH_LOCAL_DEV: 'true' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, `Packaging failed: ${result.stderr}`);
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), {
    SQL_CONNECTION_STRING: sql, AZURE_STORAGE_CONNECTION_STRING: storage
  });
  assert.equal(existsSync(path.join(dir, 'frontend/runtime-settings.deploy.json')), false);
  // Oryx copies the package as root; the runtime may use a different identity.
  assert.equal(statSync(target).mode & 0o444, 0o444, 'Packaged settings must remain readable after Oryx changes the owner');
  assert.equal(statSync(target).mode & 0o022, 0, 'Other identities must not be able to modify settings');
  assert.equal((result.stdout + result.stderr).includes(sql), false);
  assert.equal((result.stdout + result.stderr).includes(storage), false);
  console.log('Runtime packaging checks passed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
