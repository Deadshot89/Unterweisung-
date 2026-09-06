import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const css = fs.readFileSync('frontend/portal-v040.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Seitenkopf-Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss eine sichtbare v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/portal-shell.js'), 'Zentrale v0.40 Portal-Shell wird nicht geladen.');
assert(index.includes('/portal-v040.css'), 'Zentrales v0.40 Portal-CSS wird nicht geladen.');
assert(!index.includes('/view-header-design-v34.js'), 'Alter Seitenkopf-Wrapper darf in v0.40 nicht parallel geladen werden.');
assert(!index.includes('/view-header-design-v34.css'), 'Altes Seitenkopf-CSS darf in v0.40 nicht parallel geladen werden.');

assert(portal.includes('function portalHeader(view)'), 'Zentraler Portal-Seitenkopf fehlt.');
assert(portal.includes('portal-view-header'), 'Seitenkopf-Markup fehlt.');
assert(portal.includes('portal-eyebrow'), 'Seitenkopf-Eyebrow fehlt.');
assert(portal.includes('portal-view-context'), 'Seitenkopf-Kontext fehlt.');
assert(portal.includes('portalCompanyName()'), 'Aktiver Firmenkontext fehlt im Seitenkopf.');
assert(!portal.includes('new MutationObserver'), 'Portal-Shell darf keinen Body-MutationObserver fuer Seitenkoepfe nutzen.');
assert(!portal.includes('Azure Static Web Apps'), 'Technischer Azure-Text darf nicht im Seitenkopf stehen.');
assert(!portal.includes('Dev-Bypass'), 'Dev-Bypass darf nicht im Seitenkopf stehen.');

assert(css.includes('.portal-view-header'), 'portal-view-header CSS fehlt.');
assert(css.includes('.portal-eyebrow'), 'portal-eyebrow CSS fehlt.');
assert(css.includes('.portal-view-context'), 'portal-view-context CSS fehlt.');
assert(css.includes('@media(max-width:720px)'), 'Responsive Seitenkopf-Regel fehlt.');
assert(css.includes('.portal-view-header{align-items:flex-start;flex-direction:column'), 'Mobile Seitenkopf-Anordnung fehlt.');

console.log('v0.40 Seitenkopf-Design-Pruefung OK');
