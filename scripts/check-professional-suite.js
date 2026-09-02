import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const script = fs.readFileSync('frontend/professional-suite-v35.js', 'utf8');
const css = fs.readFileSync('frontend/professional-suite-v35.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Professional-Suite-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss kompatible v0-Version behalten.');
assert(/Version <span id="appVersion">v0\.\d+(?:\.\d+)?<\/span>/.test(index), 'Systemleiste muss eine sichtbare v0-Version zeigen.');
assert(index.includes('/professional-suite-v35.css'), 'Major-Design-CSS wird nicht geladen.');
assert(index.includes('/professional-suite-v35.js'), 'Major-Design-Script wird nicht geladen.');
assert(index.includes('/view-header-design-v34.css'), 'Seitenkopf-CSS muss weiterhin geladen bleiben.');

assert(script.includes('PROFESSIONAL_SUITE_VERSION'), 'Suite-Version fehlt.');
assert(/const PROFESSIONAL_SUITE_VERSION = 'v0\.35\.\d+'/.test(script), 'Freeze-Hotfix-Version v0.35.x fehlt.');
assert(script.includes('NAV_GROUPS'), 'Navigationsgruppen fehlen.');
assert(script.includes('NAV_META'), 'Navigations-Metadaten fehlen.');
assert(script.includes('applyProfessionalSuite'), 'applyProfessionalSuite fehlt.');
assert(script.includes('scheduleProfessionalSuite'), 'Gebündelte Design-Ausführung fehlt.');
assert(script.includes('professionalSuiteScheduled'), 'Schutz gegen mehrfaches Planen fehlt.');
assert(script.includes('professionalSuiteApplying'), 'Schutz gegen parallele Ausführung fehlt.');
assert(script.includes('updateNavigationGroups'), 'Navigation wird nicht gruppiert.');
assert(script.includes('ensureProfessionalFooter'), 'Footer/Standanzeige fehlt.');
assert(script.includes('app-shell-v35'), 'App-Shell-Klasse fehlt.');
assert(script.includes('pro-shell-grid'), 'Shell-Grid-Klasse fehlt.');
assert(!script.includes('new MutationObserver'), 'Major-Design-Script darf keinen Body-MutationObserver mehr nutzen.');
assert(script.includes('setView = function'), 'setView Hook fehlt.');
assert(script.includes('render = function'), 'render Hook fehlt.');
assert(!script.includes('Azure Static Web Apps'), 'Technischer Azure-Text darf nicht im Major-Design-Script stehen.');
assert(!script.includes('Dev-Bypass'), 'Dev-Bypass darf nicht im Major-Design-Script stehen.');

assert(css.includes('body.app-shell-v35'), 'App-Shell CSS fehlt.');
assert(css.includes('grid-template-columns:272px minmax(0,1fr)'), 'Desktop-Arbeitslayout fehlt.');
assert(css.includes('.primary-tabs.pro-navigation'), 'Professionelle Navigation fehlt.');
assert(css.includes('.nav-group-title'), 'Navigationsgruppen-CSS fehlt.');
assert(css.includes('Arbeitsbereiche'), 'Navigationsueberschrift fehlt.');
assert(css.includes('.app-footer-v35'), 'Footer CSS fehlt.');
assert(css.includes('.suite-chip'), 'Suite-Statuschip fehlt.');
assert(css.includes('@media(max-width:1180px)'), 'Tablet/mobile Umschaltung fehlt.');
assert(css.includes('@media(max-width:720px)'), 'Mobile Feinabstimmung fehlt.');
assert(!css.includes('localhost'), 'Kein localhost-Hinweis im Design-CSS.');

console.log('Professional Suite v0.35.x regression check passed.');
