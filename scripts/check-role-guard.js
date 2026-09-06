import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync('frontend/portal-shell.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

for (const role of ['system_admin','company_admin','hse','line_manager','employee','authenticated']) {
  assert.match(portal, new RegExp(`${role}:`), `Rolle ${role} muss in der v0.40 UI-Rollenmatrix vorkommen.`);
}

for (const view of ['dashboard','work','learning','planning','proofs','reports','admin']) {
  assert.match(portal, new RegExp(`['"]${view}['"]`), `Primärbereich ${view} muss in der v0.40 Portal-Shell vorkommen.`);
}

for (const legacyView of ['companies','employees','instructions','status','external','users','operations','security','diagnostics']) {
  assert.match(portal, new RegExp(`${legacyView}:\\s*\\{view:`), `Legacy-Route ${legacyView} muss sicher auf die neue Portalstruktur abgebildet werden.`);
}

assert.match(portal, /ROLE_VIEW_MATRIX/, 'Zentrale Rollenmatrix fehlt.');
assert.match(portal, /portalViewsForRoles/, 'Rollenprüfung für Primärbereiche fehlt.');
assert.match(portal, /function\s+renderPortalNavigation\s*\(/, 'Navigation muss aus den erlaubten Rollenbereichen erzeugt werden.');
assert.match(portal, /if\(!PRIMARY_VIEWS\.includes\(view\) \|\| !allowed\.includes\(view\)\) view = portalFirstAllowedView\(\)/, 'Direktzugriff auf gesperrte Primärbereiche muss abgefangen werden.');
assert.match(portal, /function\s+portalNavigate\s*\(/, 'Primäre Navigation muss durch portalNavigate geschützt werden.');
assert.match(index, /portal-shell\.js/, 'Index muss die v0.40 Portal-Shell laden.');
assert.doesNotMatch(index, /role-guard-v20\.js/, 'v0.40 darf den alten Rollen-Guard nicht parallel laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Role guard checks passed');
