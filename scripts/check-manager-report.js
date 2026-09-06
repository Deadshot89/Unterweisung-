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
const portal = read('frontend/portal-shell.js');
const ui = read('frontend/manager-report-v28.js');
const managerApi = read('api/src/functions/managerReport.js');

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Index zeigt keine sichtbare Online-Version.');
assert(index.includes('<section id="reports"'), 'v0.40-Auswertungsbereich fehlt.');
assert(index.includes('/manager-report-v28.js'), 'manager-report-v28.js wird nicht geladen.');
assert(index.includes('/portal-shell.js'), 'v0.40 Portal-Shell wird nicht geladen.');

assert(portal.includes("managerReport: {view:'reports', tab:'managerReport'}"), 'Legacy-Route managerReport wird nicht sicher auf Auswertung abgebildet.');
assert(portal.includes("line_manager: ['dashboard','work','learning','planning','proofs','reports']"), 'Führungskräfte erhalten keinen Auswertungszugriff.');
assert(portal.includes('hse: [...PRIMARY_VIEWS]'), 'HSE erhält keinen Auswertungszugriff.');
assert(portal.includes('company_admin: [...PRIMARY_VIEWS]'), 'Firmenadmin erhält keinen Auswertungszugriff.');
assert(portal.includes('system_admin: [...PRIMARY_VIEWS]'), 'Systemadmin erhält keinen Auswertungszugriff.');
assert(portal.includes('function renderReportsPortal'), 'v0.40 Auswertungsrenderer fehlt.');
assert(portal.includes('portalState.tab = \'managerReport\''), 'Manager-Report ist nicht die Auswertungs-Subansicht.');
assert(portal.includes('<div id="managerReport" class="portal-subview"></div>'), 'Manager-Report-Zielcontainer fehlt.');
assert(portal.includes("if(typeof renderManagerReport === 'function') renderManagerReport()"), 'Manager-Report wird in der Auswertung nicht gerendert.');

assert(ui.includes('function renderManagerReport'), 'renderManagerReport fehlt.');
assert(ui.includes('loadManagerTimeReport'), 'Zeitreport-Ladefunktion fehlt.');
assert(ui.includes('/reports/manager-training-time'), 'Manager-Zeitreport-API wird nicht genutzt.');
assert(ui.includes('managerBulkComplete'), 'Sammelabschluss im Manager-Report fehlt.');
assert(ui.includes('managerBulkCreateLinks'), 'Sammel-Linkerzeugung im Manager-Report fehlt.');
assert(ui.includes('exportManagerReportCsv'), 'CSV-Export im Manager-Report fehlt.');
assert(ui.includes('jumpToStatusWorklist'), 'Sprung zur Status-Arbeitsliste fehlt.');

assert(managerApi.includes("route: 'reports/manager-training-time'"), 'Manager-Report-API Route fehlt.');
assert(managerApi.includes('vManagerTrainingTimeMonthly'), 'Manager-Report nutzt nicht die Monatsauswertung.');

console.log('Manager-Report-Prüfung OK');
