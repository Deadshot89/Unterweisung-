import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireFile = path => {
  assert.equal(fs.existsSync(path), true, `${path} fehlt.`);
  return read(path);
};

test('v040 besitzt exakt sieben primäre Desktopbereiche', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /PRIMARY_VIEWS\s*=\s*\[\s*['"]dashboard['"]\s*,\s*['"]work['"]\s*,\s*['"]learning['"]\s*,\s*['"]planning['"]\s*,\s*['"]proofs['"]\s*,\s*['"]reports['"]\s*,\s*['"]admin['"]\s*\]/s);
  const html = read('frontend/index.html');
  for (const id of ['dashboard','work','learning','planning','proofs','reports','admin']) {
    assert.match(html, new RegExp(`<section[^>]+id=["']${id}["'][^>]+class=["'][^"']*view`));
  }
  for (const oldId of ['companies','employees','instructions','status','reminders','managerReport','external','users','operations','security','diagnostics']) {
    assert.doesNotMatch(html, new RegExp(`<section[^>]+id=["']${oldId}["'][^>]+class=["'][^"']*view`));
  }
});

test('Navigation wird aus einer Rollenmatrix erzeugt und nicht periodisch am DOM nachgebessert', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /ROLE_VIEW_MATRIX/);
  assert.match(shell, /portalViewsForRoles/);
  assert.doesNotMatch(shell, /setInterval\s*\(/);
  assert.doesNotMatch(shell, /MutationObserver/);
});

test('portalNavigate ist die einzige primäre Navigation und Deep Links sind unterstützt', () => {
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(shell, /function\s+portalNavigate\s*\(/);
  assert.match(shell, /function\s+portalRouteFromLocation\s*\(/);
  assert.match(shell, /URLSearchParams/);
  assert.match(shell, /portal/);
  assert.match(shell, /status/);
  assert.match(shell, /filter|range/);
  assert.match(shell, /history\.(?:replaceState|pushState)/);
  assert.match(shell, /window\.UMPortal/);
});

test('Systemadmin-Firmenwechsel bleibt erreichbar, Diagnostik ist kein Primärtab', () => {
  const html = read('frontend/index.html');
  const shell = requireFile('frontend/portal-shell.js');
  assert.match(html, /id=["']companySwitchAction["']/);
  assert.match(shell, /companySwitchAction/);
  assert.doesNotMatch(shell, /PRIMARY_VIEWS[^;]*diagnostics/s);
  assert.match(html, /portalNavigation/);
});

test('alte Router- und Design-Wrapper werden in v040 nicht mehr geladen', () => {
  const html = read('frontend/index.html');
  for (const asset of [
    'role-guard-v20.js','tenant-context-v36.js','design-polish-v31.js','dashboard-design-v32.js',
    'table-form-design-v33.js','view-header-design-v34.js','professional-suite-v35.js','system-admin-v16.js',
    'diagnostics-entry-v37.js','view-header-design-v34.css','professional-suite-v35.css'
  ]) assert.doesNotMatch(html, new RegExp(asset.replaceAll('.', '\\.')));
  assert.match(html, /portal-v040\.css/);
  assert.match(html, /portal-shell\.js/);
  assert.match(html, /ui-dialog\.js/);
});
