import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');
const frontendConfig = readFileSync('frontend/config.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const apiPkg = JSON.parse(readFileSync('api/package.json', 'utf8'));
const auth = readFileSync('api/src/lib/auth.js', 'utf8');
const swaConfigPath = 'frontend/staticwebapp.config.json';

assert.equal(existsSync(swaConfigPath), true, 'Static Web Apps config muss im deployten frontend-Verzeichnis liegen.');
assert.match(frontendConfig, /window\.UM_API_BASE_URL\s*=\s*'';/, 'Frontend muss die integrierte same-origin /api verwenden.');
assert.match(workflow, /api_location:\s*["']?api["']?/, 'Static Web Apps Workflow muss api_location: api deployen.');
assert.match(index, /v0\.36\.3/, 'Sichtbare Version v0.36.3 fehlt.');
assert.equal(pkg.version, '0.36.3', 'Package-Version muss 0.36.3 sein.');

const swa = JSON.parse(readFileSync(swaConfigPath, 'utf8'));
const routes = swa.routes || [];
const anonymousAssetIndex = routes.findIndex(r => r.route === '/*.css' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('anonymous'));
const passwordApiIndex = routes.findIndex(r => r.route === '/api/auth/password/*' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('anonymous'));
const apiGatewayIndex = routes.findIndex(r => r.route === '/api/*' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('anonymous'));
const appIndex = routes.findIndex(r => r.route === '/*' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('anonymous'));

assert.notEqual(anonymousAssetIndex, -1, 'CSS Assets müssen anonym erreichbar bleiben.');
assert.notEqual(passwordApiIndex, -1, 'Passwort-Login muss vor der API-Gesamtregel anonym erreichbar sein.');
assert.notEqual(apiGatewayIndex, -1, 'API muss beide Authentifizierungsarten bis zur eigenen Autorisierungsschicht durchlassen.');
assert.notEqual(appIndex, -1, 'Login-Oberfläche muss ohne Microsoft-Sitzung erreichbar sein.');
assert.ok(passwordApiIndex < apiGatewayIndex, 'Passwort-Login-Regel muss vor der allgemeinen API-Regel stehen.');
assert.ok(apiGatewayIndex < appIndex, 'API-Regel muss vor der allgemeinen App-Regel stehen.');
assert.equal(swa.responseOverrides?.['401'], undefined, '401 darf nicht pauschal zu Microsoft umgeleitet werden, da sonst Passwort-Login unmöglich ist.');
assert.match(auth, /getAuthorizedContext/, 'Die API muss ihre eigene gemeinsame Autorisierungsschicht behalten.');
assert.match(auth, /passwordSessionFromRequest/, 'Gemeinsame Autorisierung muss Passwort-Sitzungen erkennen.');
assert.equal(swa.platform?.apiRuntime, 'node:22', 'Integrierte API muss Node 22 nutzen.');
assert.match(String(apiPkg.engines?.node || ''), /22/, 'API package engines muss Node 22 deklarieren.');

console.log('Dual-auth preview wiring checks passed');
