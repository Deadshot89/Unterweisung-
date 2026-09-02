import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Manager-Report-Prüfung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

const index = read('frontend/index.html');
const ui = read('frontend/manager-report-v28.js');
const roleGuard = read('frontend/role-guard-v20.js');
const managerApi = read('api/src/functions/managerReport.js');

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Index zeigt keine sichtbare Online-Version.');
assert(index.includes('data-view="managerReport"'), 'Manager-Report-Reiter fehlt.');
assert(index.includes('<section id="managerReport"'), 'Manager-Report-Section fehlt.');
assert(index.includes('/manager-report-v28.js'), 'manager-report-v28.js wird nicht geladen.');

assert(roleGuard.includes('managerReport'), 'Rollenmatrix enthält managerReport nicht.');
assert(roleGuard.includes("['company_admin','hse','line_manager','system_admin']"), 'Manager-Report ist nicht für die richtigen Rollen freigegeben.');

assert(ui.includes('function renderManagerReport'), 'renderManagerReport fehlt.');
assert(ui.includes('loadManagerTimeReport'), 'Zeitreport-Ladefunktion fehlt.');
assert(ui.includes('/reports/manager-training-time'), 'Manager-Zeitreport-API wird nicht genutzt.');
assert(ui.includes('managerBulkComplete'), 'Sammelabschluss im Manager-Report fehlt.');
assert(ui.includes('managerBulkCreateLinks'), 'Sammel-Linkerzeugung im Manager-Report fehlt.');
assert(ui.includes('exportManagerReportCsv'), 'CSV-Export im Manager-Report fehlt.');
assert(ui.includes('jumpToStatusWorklist'), 'Sprung zur Status-Arbeitsliste fehlt.');
assert(ui.includes('ROLE_VIEW_RULES.managerReport'), 'Manager-Report erweitert Rollenmatrix nicht zusätzlich.');

assert(managerApi.includes("route: 'reports/manager-training-time'"), 'Manager-Report-API Route fehlt.');
assert(managerApi.includes('vManagerTrainingTimeMonthly'), 'Manager-Report nutzt nicht die Monatsauswertung.');

console.log('Manager-Report-Prüfung OK');
