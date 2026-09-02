import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const dashboard = fs.readFileSync('frontend/dashboard-design-v32.js', 'utf8');
const css = fs.readFileSync('frontend/styles.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Dashboard-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss kompatible v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/dashboard-design-v32.js'), 'Dashboard-Design-Datei wird nicht geladen.');

assert(dashboard.includes('function renderModernDashboard'), 'Modernes Dashboard-Rendering fehlt.');
assert(dashboard.includes('renderDashboard = renderModernDashboard'), 'Dashboard-Override fehlt.');
assert(dashboard.includes('Essentra Übersicht'), 'Dashboard braucht klare Essentra-Ueberschrift.');
assert(dashboard.includes('Offene Aufgaben'), 'Offene Aufgaben KPI fehlt.');
assert(dashboard.includes('Schnellzugriff'), 'Schnellzugriffsbereich fehlt.');
assert(dashboard.includes('setView(\'status\')'), 'Status-Schnellzugriff fehlt.');
assert(dashboard.includes('setView(\'reminders\')'), 'Erinnerungen-Schnellzugriff fehlt.');
assert(dashboard.includes('setView(\'planning\')'), 'Planung-Schnellzugriff fehlt.');
assert(dashboard.includes('setView(\'proofs\')'), 'Nachweise-Schnellzugriff fehlt.');
assert(!dashboard.includes('Online-Version v0.11'), 'Alte technische Dashboard-Karte darf nicht mehr sichtbar gerendert werden.');
assert(!dashboard.includes('Azure Function API'), 'Technischer API-Text darf nicht im neuen Dashboard stehen.');
assert(!dashboard.includes('Entra-Login/Rollen'), 'Technischer Entra-Text darf nicht im neuen Dashboard stehen.');

assert(css.includes('.dashboard-hero'), 'Dashboard-Hero CSS fehlt.');
assert(css.includes('.metric-card'), 'Metric-Card CSS fehlt.');
assert(css.includes('.quick-actions'), 'Schnellzugriff CSS fehlt.');
assert(css.includes('.status-list'), 'Statusliste CSS fehlt.');

console.log('Dashboard design regression check passed.');
