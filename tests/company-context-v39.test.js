import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../frontend/app.js', import.meta.url), 'utf8');
let companyContext = '';
try { companyContext = readFileSync(new URL('../frontend/company-context-v39.js', import.meta.url), 'utf8'); } catch {}

test('system admin company selector is loaded before company workspaces', () => {
  assert.match(index, /company-context-v39\.js/);
  assert.match(index, /companySelectionGate/);
  assert.match(companyContext, /showCompanySelection/);
  assert.match(companyContext, /openCompanyContext/);
  assert.match(companyContext, /leaveCompanyContext/);
  assert.match(companyContext, /resetCompanyScopedState/);
  assert.match(companyContext, /\/system\/companies/);
  assert.match(companyContext, /Firma wechseln/);
});

test('application boot does not send a default tenant for an unselected system admin', () => {
  assert.match(app, /companyId:\s*null/);
  assert.match(app, /requiresCompanySelection/);
  assert.match(app, /loadCompanyData/);
  assert.doesNotMatch(app, /'x-company-id':\s*state\.companyId\s*\|\|\s*DEFAULT_COMPANY_ID/);
});

test('company switch clears every company-scoped portal cache without discarding identity', () => {
  assert.match(companyContext, /state\.data\s*=\s*null/);
  assert.match(companyContext, /state\.statusRows\s*=\s*\[\]/);
  assert.match(companyContext, /state\.users\s*=\s*\[\]/);
  assert.match(companyContext, /state\.testQuestions\s*=\s*\[\]/);
  assert.match(companyContext, /resetEmployeePortalState/);
  assert.match(companyContext, /resetEmployeeLearningState/);
  assert.doesNotMatch(companyContext, /state\.me\s*=\s*null/);
});

test('company selection is a portal mode on the same origin and clears the current navigation', () => {
  assert.match(companyContext, /state\.portalMode\s*=\s*['"]company-selection['"]/);
  assert.match(companyContext, /UMPortalShell\.clearPortalShell\(\)/);
  assert.doesNotMatch(companyContext, /location\.(href|assign|replace)|window\.location/,
    'Firmenwechsel darf nicht auf eine andere Kunden-Website navigieren.');
});
