import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){ return fs.existsSync(path) ? fs.readFileSync(path,'utf8') : ''; }
const diagnosticsLib = read('api/src/lib/diagnostics.js');
const diagnosticsApi = read('api/src/functions/diagnostics.js');

test('diagnostics API classifies server errors as critical and client errors as warnings', () => {
  assert.match(diagnosticsLib, /httpStatus[\s\S]*>=\s*500[\s\S]*['"]critical['"]/);
  assert.match(diagnosticsLib, /httpStatus[\s\S]*>=\s*400[\s\S]*['"]warning['"]/);
});

test('diagnostics API exposes events, status, latest critical and sanitized export', () => {
  assert.match(diagnosticsApi, /route:\s*'diagnostics\/events'/);
  assert.match(diagnosticsApi, /route:\s*'diagnostics\/status'/);
  assert.match(diagnosticsApi, /route:\s*'diagnostics\/latest-critical'/);
  assert.match(diagnosticsApi, /route:\s*'diagnostics\/export'/);
  assert.match(diagnosticsApi, /Content-Disposition/i);
  assert.match(diagnosticsApi, /assertDiagnosticAccess/);
});

test('diagnostic intake never persists credentials, tokens, headers or request bodies', () => {
  assert.match(diagnosticsLib, /safeDiagnosticInput/);
  assert.doesNotMatch(diagnosticsLib, /requestBody|passwordHash|setupToken|sessionToken|cookie|authorization/i);
});

test('delegated diagnostic readers are forced to their own company', () => {
  assert.match(diagnosticsApi, /Roles\.SYSTEM_ADMIN/);
  assert.match(diagnosticsApi, /ctx\.companyId/);
  assert.match(diagnosticsApi, /companyId/);
});
