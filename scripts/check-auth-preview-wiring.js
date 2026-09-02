import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/azure-static-web-apps.yml', 'utf8');
const frontendConfig = readFileSync('frontend/config.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const swaConfigPath = 'frontend/staticwebapp.config.json';

assert.equal(existsSync(swaConfigPath), true, 'Static Web Apps config muss im deployten frontend-Verzeichnis liegen.');
assert.match(frontendConfig, /window\.UM_API_BASE_URL\s*=\s*'';/, 'Frontend muss die integrierte same-origin /api verwenden.');
assert.match(workflow, /api_location:\s*["']?api["']?/, 'Static Web Apps Workflow muss api_location: api deployen.');
assert.match(index, /v0\.36\.1/, 'Sichtbare Version v0.36.1 fehlt.');
assert.equal(pkg.version, '0.36.1', 'Package-Version muss 0.36.1 sein.');

const swa = JSON.parse(readFileSync(swaConfigPath, 'utf8'));
const routes = swa.routes || [];
const anonymousAssetIndex = routes.findIndex(r => r.route === '/*.css' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('anonymous'));
const authenticatedApiIndex = routes.findIndex(r => r.route === '/api/*' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('authenticated'));
const authenticatedAppIndex = routes.findIndex(r => r.route === '/*' && Array.isArray(r.allowedRoles) && r.allowedRoles.includes('authenticated'));

assert.notEqual(anonymousAssetIndex, -1, 'CSS Assets müssen explizit anonym erreichbar bleiben.');
assert.notEqual(authenticatedApiIndex, -1, 'API muss authentifiziert geschützt sein.');
assert.notEqual(authenticatedAppIndex, -1, 'App muss authentifiziert geschützt sein.');
assert.ok(anonymousAssetIndex < authenticatedAppIndex, 'Asset-Regeln müssen vor der allgemeinen App-Regel stehen.');

console.log('Authenticated preview wiring checks passed');
