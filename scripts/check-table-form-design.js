import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const css = fs.readFileSync('frontend/portal-v040.css', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Tabellen/Formular-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss eine sichtbare v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/portal-v040.css'), 'Zentrales Tabellen-/Formular-Design wird nicht geladen.');
assert(!index.includes('/table-form-design-v33.js'), 'Alter Tabellen-/Formular-Wrapper darf in v0.40 nicht parallel geladen werden.');

assert(css.includes('#portalWorkspace .table-wrap'), 'Zentraler Tabellen-Wrapper fehlt.');
assert(css.includes('overflow:auto'), 'Tabellen brauchen kontrolliertes Scrolling.');
assert(css.includes('#portalWorkspace table'), 'Zentrales Tabellenlayout fehlt.');
assert(css.includes('border-collapse:separate'), 'Professionelles Tabellenlayout fehlt.');
assert(css.includes('#portalWorkspace th{position:sticky'), 'Sticky Tabellenkopf fehlt.');
assert(css.includes('#portalWorkspace input,#portalWorkspace select,#portalWorkspace textarea'), 'Zentrale Formularfeld-Styles fehlen.');
assert(css.includes('#portalWorkspace input:focus,#portalWorkspace select:focus,#portalWorkspace textarea:focus'), 'Fokus-Styles fuer Eingaben fehlen.');
assert(css.includes('outline:3px solid'), 'Sichtbarer Fokusrahmen fehlt.');
assert(css.includes('#portalWorkspace button,#portalWorkspace .btn'), 'Zentrale Button-Styles fehlen.');
assert(css.includes('#portalWorkspace .toolbar'), 'Toolbar-Layout fehlt.');
assert(portal.includes('class="form-grid"'), 'Formularraster wird im Portal nicht mehr verwendet.');

console.log('v0.40 Tabellen/Formular-Design-Pruefung OK');
