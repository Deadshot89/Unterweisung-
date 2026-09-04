import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../frontend/app.js', import.meta.url), 'utf8');
const design = readFileSync(new URL('../frontend/design-polish-v31.js', import.meta.url), 'utf8');
const roleGuard = readFileSync(new URL('../frontend/role-guard-v20.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../frontend/dashboard-design-v32.js', import.meta.url), 'utf8');
const suite = readFileSync(new URL('../frontend/professional-suite-v35.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');

test('release version has one authoritative value and design layers never overwrite it', () => {
  assert.match(index, /v0\.36\.3/);
  assert.match(suite, /APP_RELEASE_VERSION\s*=\s*'v0\.36\.3'/);
  assert.doesNotMatch(design, /appVersion[\s\S]{0,120}DESIGN_VERSION/);
  assert.doesNotMatch(dashboard, /appVersion[\s\S]{0,120}DASHBOARD_DESIGN_VERSION/);
});

test('shell polish is event driven instead of periodic DOM rewriting', () => {
  assert.doesNotMatch(design, /setInterval\s*\(/);
  assert.doesNotMatch(roleGuard, /setInterval\s*\(/);
});

test('authentication failure never exposes Essentra seed data as a fake signed-in workspace', () => {
  assert.doesNotMatch(app, /seed\/essentra-startdata\.json/);
  assert.doesNotMatch(app, /source\s*=\s*'seed'/);
  assert.match(app, /renderAuthenticationRequired/);
  assert.match(app, /renderServiceUnavailable/);
});

test('logout remains available even when backend identity cannot be confirmed', () => {
  assert.match(index, /href="\/\.auth\/logout"/);
  assert.doesNotMatch(design, /logout\.style\.display\s*=\s*'none'/);
});

test('shared shell and dashboard do not hard-code Essentra as the active tenant', () => {
  assert.doesNotMatch(index, />Essentra aktiv</);
  assert.match(index, /id="activeCompanyLabel"/);
  assert.doesNotMatch(dashboard, /Essentra Übersicht/);
  assert.doesNotMatch(suite, /Essentra Arbeitsstand/);
});
