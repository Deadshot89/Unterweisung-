import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const roleGuard = readFileSync('frontend/role-guard-v20.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

for (const role of ['system_admin','company_admin','hse','line_manager','employee','authenticated']) {
  assert.match(roleGuard, new RegExp(role), `Rolle ${role} muss in der UI-Rollenmatrix vorkommen.`);
}

for (const view of ['dashboard','companies','employees','instructions','status','planning','external','users','operations','security']) {
  assert.match(roleGuard, new RegExp(`${view}:`), `View ${view} muss in der Rollenmatrix vorkommen.`);
}

assert.match(roleGuard, /viewAllowed/, 'Rollenprüfung für Views fehlt.');
assert.match(roleGuard, /applyRoleVisibility/, 'Menüpunkte müssen je Rolle ausgeblendet werden.');
assert.match(roleGuard, /accessDeniedHtml/, 'Direktzugriff auf gesperrte Views muss abgefangen werden.');
assert.match(roleGuard, /setView\s*=\s*function/, 'setView muss durch Rollenprüfung geschützt werden.');
assert.match(index, /role-guard-v20\.js/, 'Index muss den Rollen-Guard laden.');
assert.match(index, /v0\.20/, 'Index muss Version v0.20 anzeigen.');

console.log('Role guard checks passed');
