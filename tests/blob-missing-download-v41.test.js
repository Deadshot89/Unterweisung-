import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blob = read('api/src/lib/blob.js');
const files = read('api/src/functions/files.js');
const templates = read('api/src/functions/templateFiles.js');
const app = read('frontend/app.js');

test('blob helper can verify existence without creating containers', () => {
  assert.match(blob, /export\s+async\s+function\s+blobExists\s*\(/,
    'Ein zentraler read-only Blob-Existenzcheck fehlt.');
  assert.match(blob, /get(?:Block)?BlobClient\([^)]*blobPath[^)]*\)[\s\S]{0,220}\.exists\s*\(/,
    'Der Existenzcheck muss den Azure Blob direkt prüfen.');
  const helperStart = blob.indexOf('function blobExists');
  const helperSlice = helperStart >= 0 ? blob.slice(helperStart, helperStart + 900) : '';
  assert.doesNotMatch(helperSlice, /ensureContainer\s*\(/,
    'Download-Prüfung darf fehlende Container nicht als Seiteneffekt anlegen.');
});

test('file download refuses a SAS URL when the registered blob is missing', () => {
  assert.match(files, /blobExists/);
  assert.match(files, /FILE_BLOB_MISSING/);
  assert.match(files, /im Speicher nicht vorhanden|Speicher nicht vorhanden/i);
  const existsPos = files.indexOf('blobExists');
  const sasPos = files.lastIndexOf('createReadSasUrl');
  assert.ok(existsPos >= 0 && sasPos > existsPos,
    'Der Blob muss geprüft werden, bevor ein SAS-Link erzeugt wird.');
});

test('template download refuses a SAS URL when the source blob is missing', () => {
  assert.match(templates, /blobExists/);
  assert.match(templates, /FILE_BLOB_MISSING/);
  assert.match(templates, /im Speicher nicht vorhanden|Speicher nicht vorhanden/i);
  const downloadStart = templates.indexOf("app.http('templateDownload'");
  const downloadSlice = downloadStart >= 0 ? templates.slice(downloadStart, downloadStart + 1800) : '';
  assert.ok(downloadSlice.indexOf('blobExists') >= 0 && downloadSlice.indexOf('createReadSasUrl') > downloadSlice.indexOf('blobExists'),
    'Vorlagen müssen vor der SAS-Erzeugung auf Blob-Existenz geprüft werden.');
});

test('frontend API errors surface the friendly JSON message instead of raw response markup', () => {
  assert.match(app, /await\s+res\.text\s*\(\)/,
    'Die API-Schicht muss den Response-Text einmal kontrolliert lesen.');
  assert.match(app, /JSON\.parse\s*\(/,
    'JSON-Fehlerantworten müssen geparst werden.');
  assert.match(app, /payload\?\.error|payload\.error/,
    'Die nutzerfreundliche API-Fehlermeldung muss bevorzugt werden.');
  assert.match(app, /error\.code\s*=|err\.code\s*=/,
    'Strukturierte Fehlercodes müssen für Oberflächen erhalten bleiben.');
});
