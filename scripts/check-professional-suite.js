import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const css = fs.readFileSync('frontend/portal-v040.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Professional-Suite-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss eine sichtbare v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/portal-v040.css'), 'v0.40 Major-Design-CSS wird nicht geladen.');
assert(index.includes('/portal-shell.js'), 'v0.40 Major-Design-Shell wird nicht geladen.');
for (const oldAsset of ['/professional-suite-v35.css','/professional-suite-v35.js','/view-header-design-v34.css','/view-header-design-v34.js']) {
  assert(!index.includes(oldAsset), `${oldAsset} darf in v0.40 nicht parallel geladen werden.`);
}

assert(portal.includes("const PRIMARY_VIEWS = ['dashboard', 'work', 'learning', 'planning', 'proofs', 'reports', 'admin']"), 'Sieben v0.40 Hauptbereiche fehlen.');
assert(portal.includes('const ROLE_VIEW_MATRIX'), 'Zentrale Rollenmatrix fehlt.');
assert(portal.includes('function renderPortalNavigation'), 'Zentrale Navigationsausgabe fehlt.');
assert(portal.includes('function portalNavigate'), 'Zentraler Portalrouter fehlt.');
assert(!portal.includes('MutationObserver'), 'v0.40 Portal-Shell darf keinen MutationObserver-Reparaturlayer nutzen.');
assert(!portal.includes('setInterval('), 'v0.40 Portal-Shell darf Navigation nicht periodisch nachbessern.');

assert(css.includes('.portal-shell'), 'Portal-Shell CSS fehlt.');
assert(css.includes('grid-template-columns:var(--portal-sidebar) minmax(0,1fr)'), 'Desktop-Arbeitslayout fehlt.');
assert(css.includes('.portal-sidebar'), 'Feste Portal-Navigation fehlt.');
assert(css.includes('position:fixed'), 'Desktop-Navigation ist nicht fest verankert.');
assert(css.includes('.portal-nav-item'), 'Navigationspunkt-Styles fehlen.');
assert(css.includes('.portal-nav-item.active'), 'Aktiver Navigationszustand fehlt.');
assert(css.includes('overflow-y:auto'), 'Navigation braucht kontrolliertes vertikales Scrolling.');
assert(css.includes('.portal-user-card'), 'Benutzer-/Firmenkontext in der Navigation fehlt.');
assert(css.includes('@media(max-width:980px)'), 'Tablet-Umschaltung fehlt.');
assert(css.includes('@media(max-width:720px)'), 'Mobile Umschaltung fehlt.');
assert(!/grid-row\s*:\s*2\s*\/\s*span\s*30/.test(css), 'Navigation darf keine 30 leeren Grid-Zeilen reservieren.');
assert(!css.includes('.app-footer-v35'), 'Alter redundanter Footer darf nicht zurueckkehren.');
assert(!css.includes('localhost'), 'Kein localhost-Hinweis im Design-CSS.');

console.log('v0.40 Professional Suite regression check passed.');
