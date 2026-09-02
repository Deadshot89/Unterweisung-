import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const script = fs.readFileSync('frontend/view-header-design-v34.js', 'utf8');
const css = fs.readFileSync('frontend/view-header-design-v34.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Seitenkopf-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss kompatible v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/view-header-design-v34.js'), 'Seitenkopf-Design-Script wird nicht geladen.');
assert(index.includes('/view-header-design-v34.css'), 'Seitenkopf-Design-CSS wird nicht geladen.');

assert(script.includes('VIEW_HEADER_DESIGN_VERSION'), 'Designversion fehlt.');
assert(script.includes('VIEW_HEADERS'), 'Seitenkopf-Konfiguration fehlt.');
assert(script.includes('applyViewHeaders'), 'applyViewHeaders fehlt.');
assert(script.includes('view-head'), 'view-head Markup fehlt.');
assert(script.includes('view-eyebrow'), 'view-eyebrow Markup fehlt.');
assert(script.includes('Mitarbeiter'), 'Mitarbeiter-Seitenkopf fehlt.');
assert(script.includes('Unterweisungen'), 'Unterweisungen-Seitenkopf fehlt.');
assert(script.includes('Status'), 'Status-Seitenkopf fehlt.');
assert(script.includes('Planung'), 'Planung-Seitenkopf fehlt.');
assert(script.includes('Nachweise'), 'Nachweise-Seitenkopf fehlt.');
assert(script.includes('MutationObserver'), 'Dynamisch gerenderte Ansichten werden nicht beobachtet.');
assert(script.includes('render = function'), 'Render-Hook fuer Seitenkoepfe fehlt.');
assert(!script.includes('Azure Static Web Apps'), 'Technischer Azure-Text darf nicht im Seitenkopf stehen.');
assert(!script.includes('Dev-Bypass'), 'Dev-Bypass darf nicht im Seitenkopf stehen.');

assert(css.includes('.view-head'), 'view-head CSS fehlt.');
assert(css.includes('.view-eyebrow'), 'view-eyebrow CSS fehlt.');
assert(css.includes('linear-gradient'), 'Professioneller Hintergrund fuer Seitenkopf fehlt.');
assert(css.includes('@media'), 'Responsive Seitenkopf-Regel fehlt.');

console.log('Seitenkopf-Design-Pruefung OK');
