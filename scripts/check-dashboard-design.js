import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const css = fs.readFileSync('frontend/portal-v040.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Dashboard-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss eine sichtbare v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('<section id="dashboard" class="view active">'), 'Dashboard-Portalbereich fehlt.');
assert(index.includes('/portal-v040.css'), 'Zentrales v0.40 Design wird nicht geladen.');
assert(index.includes('/portal-shell.js'), 'Zentrale v0.40 Portal-Shell wird nicht geladen.');
assert(!index.includes('/dashboard-design-v32.js'), 'Alter Dashboard-Override darf in v0.40 nicht parallel geladen werden.');

assert(portal.includes("dashboard: ['Übersicht','Start und Kennzahlen']"), 'Neutrale Dashboard-Bezeichnung fehlt.');
assert(portal.includes("employee: ['dashboard','work','learning','proofs']"), 'Mitarbeiter-Startbereich fehlt in der Rollenmatrix.');
assert(portal.includes("line_manager: ['dashboard','work','learning','planning','proofs','reports']"), 'Führungskraft-Startbereich fehlt in der Rollenmatrix.');
assert(portal.includes("if(view === 'dashboard') { if(typeof renderDashboard === 'function') renderDashboard(); return; }"), 'Dashboard wird nicht über die zentrale Portal-Shell gerendert.');
assert(!portal.includes('Essentra Übersicht'), 'Zentrales Portal darf keine Essentra-Ueberschrift fest verdrahten.');
assert(!portal.includes("'Essentra Components GmbH'"), 'Zentrales Portal darf keinen sichtbaren Essentra-Firmenfallback verwenden.');
assert(!portal.includes('Azure Static Web Apps'), 'Technischer Azure-Text darf nicht in der Portal-Shell stehen.');

for (const token of ['.portal-main','#portalWorkspace','#portalWorkspace .kpi','.portal-task-grid','.portal-task','@media(max-width:980px)','@media(max-width:720px)']) {
  assert(css.includes(token), `${token} fehlt im v0.40 Dashboard-/Portal-Design.`);
}

console.log('v0.40 dashboard design regression check passed.');
