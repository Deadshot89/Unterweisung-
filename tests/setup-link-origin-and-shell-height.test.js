import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const passwordSetup = read('api/src/functions/passwordSetup.js');
const runtimeSettings = read('api/src/lib/runtime-settings.js');
const prepareSettings = read('scripts/prepare-managed-api-settings.js');
const deployWorkflow = read('.github/workflows/azure-static-web-apps.yml');
const suiteScript = read('frontend/professional-suite-v35.js');
const suiteCss = read('frontend/professional-suite-v35.css');

const canonicalOrigin = 'https://delightful-sky-05dbf7603.7.azurestaticapps.net';

test('password setup links use the canonical public website instead of the request origin', () => {
  assert.doesNotMatch(
    passwordSetup,
    /setupLink\(rawToken,\s*new URL\(request\.url\)\.origin\)/,
    'Setup-Link darf nicht aus dem internen Azure-Request-Origin gebaut werden.'
  );
  assert.match(passwordSetup, /const url\s*=\s*setupLink\(rawToken\)/, 'Setup-Link muss die serverseitige PUBLIC_BASE_URL verwenden.');
  assert.match(runtimeSettings, /['"]PUBLIC_BASE_URL['"]/, 'Managed API muss PUBLIC_BASE_URL aus dem Paket übernehmen dürfen.');
  assert.match(prepareSettings, /['"]PUBLIC_BASE_URL['"]/, 'Deployment muss PUBLIC_BASE_URL in die Managed-API-Einstellungen schreiben.');
  assert.ok(deployWorkflow.includes(`PUBLIC_BASE_URL: ${canonicalOrigin}`), 'Produktionsworkflow muss die kanonische Website als PUBLIC_BASE_URL setzen.');
});

test('professional shell ends after the active workspace without footer spacer or 30-row span', () => {
  assert.doesNotMatch(suiteCss, /grid-row\s*:\s*2\s*\/\s*span\s*30/, 'Navigation darf keine 30 Grid-Zeilen reservieren.');
  assert.doesNotMatch(suiteScript, /ensureProfessionalFooter|appFooterV35/, 'Zusätzlicher Footer darf nicht mehr erzeugt werden.');
  assert.doesNotMatch(suiteScript, /Unterweisungsmanager · Arbeitsbereich|Betriebsbereit ·/, 'Unterer redundanter Statusfooter muss entfernt sein.');
  assert.doesNotMatch(suiteCss, /\.app-footer-v35|\.suite-chip/, 'Footer- und Statuschip-CSS darf keinen leeren Abschlussbereich mehr erzeugen.');
});
