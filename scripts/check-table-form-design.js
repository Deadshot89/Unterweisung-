import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const tableForm = fs.readFileSync('frontend/table-form-design-v33.js', 'utf8');
const design = fs.readFileSync('frontend/design-polish-v31.js', 'utf8');
const dashboard = fs.readFileSync('frontend/dashboard-design-v32.js', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Tabellen/Formular-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss kompatible v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/table-form-design-v33.js'), 'Tabellen/Formular-Design-Datei wird nicht geladen.');

assert(tableForm.includes('TABLE_FORM_DESIGN_VERSION'), 'Designversion fuer Tabellen/Formulare fehlt.');
assert(tableForm.includes('applyTableFormPolish'), 'applyTableFormPolish fehlt.');
assert(tableForm.includes('scheduleTableFormPolish'), 'Gebündelte Tabellen/Formular-Ausführung fehlt.');
assert(tableForm.includes('tableFormPolishScheduled'), 'Schutz gegen mehrfaches Planen fehlt.');
assert(tableForm.includes('tableFormPolishRunning'), 'Schutz gegen parallele Ausführung fehlt.');
assert(tableForm.includes('professional-table-wrap'), 'Tabellen-Wrapper werden nicht markiert.');
assert(tableForm.includes('professional-toolbar'), 'Toolbars werden nicht markiert.');
assert(tableForm.includes('professional-form-grid'), 'Formulare werden nicht markiert.');
assert(!tableForm.includes('new MutationObserver'), 'Tabellen/Formular-Layer darf keinen Body-MutationObserver nutzen.');
assert(tableForm.includes('render = function'), 'Render-Hook fuer nachgeladene Ansichten fehlt.');

assert(css.includes('.professional-table-wrap'), 'Professionelles Tabellen-CSS fehlt.');
assert(css.includes('position:sticky'), 'Sticky Tabellenkopf fehlt.');
assert(css.includes('tbody tr:hover'), 'Tabellen-Hover fehlt.');
assert(css.includes('.professional-toolbar'), 'Professionelle Toolbar-Styles fehlen.');
assert(css.includes('.professional-form-grid'), 'Professionelle Formular-Styles fehlen.');
assert(css.includes('.professional-field'), 'Professionelle Feld-Styles fehlen.');
assert(css.includes('.actions-cell'), 'Aktionsspalten-Styles fehlen.');
assert(css.includes(':focus'), 'Fokus-Styles fuer Eingaben fehlen.');

assert(/const DESIGN_VERSION = 'v0\.\d+(?:\.\d+)?'/.test(design), 'Header-Design muss eine v0-Version setzen.');
assert(/const DASHBOARD_DESIGN_VERSION = 'v0\.\d+(?:\.\d+)?'/.test(dashboard), 'Dashboard muss eine v0-Version setzen.');

console.log('Tabellen/Formular-Design-Pruefung OK');
