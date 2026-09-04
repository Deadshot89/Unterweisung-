const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {parse} = require('yaml');
const {JSDOM} = require('jsdom');

const read = name => readFileSync(resolve(__dirname, '..', name), 'utf8');
const workflow = parse(read('.github/workflows/azure-static-web-apps.yml'));
const steps = Object.values(workflow.jobs).flatMap(job => job.steps || []);

test('deployment exposes data credentials only to server-only settings packaging', () => {
  // Reintroducing schema/administrator/question maintenance with SQL secrets must fail.
  const isDataCredential = value => /secrets\.(SQL_CONNECTION_STRING|AZURE_STORAGE_CONNECTION_STRING)/.test(String(value)) && !/^\$\{\{ secrets\.(SQL_CONNECTION_STRING|AZURE_STORAGE_CONNECTION_STRING) != '' \}\}$/.test(String(value));
  assert.equal(Object.values(workflow.env || {}).some(isDataCredential), false);
  for (const job of Object.values(workflow.jobs)) {
    assert.equal(Object.values(job.env || {}).some(isDataCredential), false);
  }
  const recipients = steps.filter(step => Object.values(step.env || {}).some(isDataCredential));
  assert.deepEqual(recipients.map(step => step.run?.trim()), ['node scripts/prepare-managed-api-settings.js']);
});

test('deployment does not invoke repository maintenance scripts or mutating health probes', () => {
  // A new direct maintenance invocation must be reviewed rather than silently shipped.
  const commands = steps.map(step => step.run || '').join('\n');
  const entrypoints = [...commands.matchAll(/\bnode\s+(?:\.\/)?((?:scripts|api)\/[^\s;]+)/g)].map(match => match[1]);
  assert.deepEqual(entrypoints, ['scripts/prepare-managed-api-settings.js']);
  const npmCommands = [...commands.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)].map(match => match[1]);
  assert.deepEqual(npmCommands, []);
  // /api/health currently calls ensureConfiguredContainers: it is not read-only.
  assert.equal(commands.includes('/api/health'), false, 'Deployment must not initialize storage through a health probe');
});

test('deployment retains application checks, API packaging and stylesheet verification', () => {
  const deployment = steps.find(step => String(step.uses || '').startsWith('Azure/static-web-apps-deploy@') && step.with?.action === 'upload');
  assert.ok(deployment);
  assert.equal(deployment.with.app_location, 'frontend');
  assert.equal(deployment.with.api_location, 'api');
  assert.ok(steps.some(step => step.run === 'npm test'));
  assert.ok(steps.some(step => step.name === 'Verify deployed stylesheets'));
  assert.ok(steps.some(step => step.if === 'always()' && step.run?.includes('runtime-settings.deploy.json')));
  assert.ok(workflow.on.pull_request.types.includes('synchronize'));
});

test('preview desktop menu remains a single scrollable column with unshrunk controls', () => {
  const dom = new JSDOM('<!doctype html><body class="app-shell-v35"><nav class="tabs primary-tabs pro-navigation"><div class="nav-group-title">Administration</div><button>Sicherheit und Verwaltung</button></nav></body>');
  try {
    for (const name of ['styles.css', 'professional-suite-v35.css']) {
      const style = dom.window.document.createElement('style');
      style.textContent = read('frontend/' + name);
      dom.window.document.head.append(style);
    }
    const css = selector => dom.window.getComputedStyle(dom.window.document.querySelector(selector));
    assert.equal(css('nav').flexDirection, 'column');
    assert.equal(css('nav').flexWrap, 'nowrap');
    assert.equal(css('nav').overflowX, 'hidden');
    assert.equal(css('nav').overflowY, 'auto');
    assert.equal(css('button').flexShrink, '0');
    assert.equal(css('.nav-group-title').flexShrink, '0');
  } finally { dom.window.close(); }
});
