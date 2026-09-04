import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('frontend/index.html');
const app = read('frontend/app.js');
const shellCss = read('frontend/company-context-v39.css');
const auth = read('api/src/lib/auth.js');

const scopedApis = [
  'api/src/functions/employees.js',
  'api/src/functions/instructionTypes.js',
  'api/src/functions/files.js',
  'api/src/functions/records.js',
  'api/src/functions/plannedTrainings.js',
  'api/src/functions/users.js'
];

test('main workspace is closed by default until authentication has been confirmed', () => {
  assert.match(index, /<body[^>]*class="[^"]*auth-pending/,
    'Die Hauptseite muss bereits im HTML geschlossen starten, damit keine Firmenoberfläche vor dem Login aufblitzt.');
  assert.match(shellCss, /body\.auth-pending[\s\S]*\.primary-tabs[\s\S]*display\s*:\s*none/,
    'Navigation und Arbeitsbereiche müssen im ungeprüften Zustand verborgen sein.');
  assert.match(app, /setAuthenticationShellState/,
    'Der Authentifizierungszustand braucht eine zentrale Shell-Umschaltung.');
  assert.match(app, /setAuthenticationShellState\(['"]authenticated['"]\)/,
    'Die Firmenoberfläche darf erst nach bestätigter Identität freigegeben werden.');
});

test('a non-system user cannot request a different company and never falls back silently', () => {
  assert.match(auth, /if\s*\(requested\s*&&\s*!selected\s*&&\s*!isSystemAdmin\)[\s\S]{0,260}status\s*=\s*403/,
    'Ein fremder x-company-id Header muss für Firmenbenutzer mit 403 enden.');
  assert.match(auth, /allowedCompanies\.length\s*===\s*1/,
    'Nicht-Systemadmins dürfen nur bei genau einer Firmenzuordnung automatisch weitergeleitet werden.');
  assert.match(auth, /allowedCompanies\.length\s*>\s*1[\s\S]{0,260}status\s*=\s*403/,
    'Mehrdeutige Firmenzuordnungen müssen blockieren statt irgendeine Firma auszuwählen.');
});

test('critical company APIs keep tenant filtering in their server-side data access', () => {
  for (const path of scopedApis) {
    const source = read(path);
    assert.match(source, /companyId/i, `${path} muss einen Firmenkontext verwenden.`);
    assert.match(source, /@companyId/, `${path} muss SQL-Zugriffe mit einem gebundenen companyId-Parameter einschränken.`);
  }
});
