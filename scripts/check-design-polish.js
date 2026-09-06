import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const css = fs.readFileSync('frontend/portal-v040.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss eine sichtbare v0-Version behalten.');
assert(index.includes('<h1>Unterweisungsmanager</h1>'), 'Professioneller Haupttitel fehlt.');
assert(index.includes('Digitales Unterweisungs- und Schulungsmanagement'), 'Professionelle Subline fehlt.');
assert(index.includes('class="system-strip"'), 'Kompakte Systemstatus-Leiste fehlt.');
assert(index.includes('Systemstatus:'), 'Systemstatus fehlt.');
assert(index.includes('Betriebsbereit'), 'Betriebsbereit-Text fehlt.');
assert(index.includes('id="companySelectionGate"'), 'Zentraler Login-/Firmenauswahlbereich fehlt.');
assert(index.includes('Keine Firma ausgewählt'), 'Vor Anmeldung darf keine Firma als aktiv dargestellt werden.');
assert(!index.includes('Essentra aktiv'), 'Essentra darf vor erfolgreicher Anmeldung nicht als aktiv angezeigt werden.');
assert(index.includes('/portal-v040.css'), 'v0.40 Portal-CSS wird nicht geladen.');
assert(index.includes('/portal-shell.js'), 'v0.40 Portal-Shell wird nicht geladen.');
assert(!index.includes('/design-polish-v31.js'), 'Alter Design-Polish-Wrapper darf in v0.40 nicht parallel geladen werden.');
assert(!index.includes('Azure Static Web Apps + Functions + SQL/Blob'), 'Technischer Azure-Text darf nicht sichtbar im Header stehen.');
assert(!index.includes('Login läuft im Dev-Bypass'), 'Dev-Bypass darf nicht sichtbar in der Hauptoberflaeche stehen.');

for (const token of ['.portal-topbar','.brand-wrap','.system-strip','.portal-sidebar','.professional-user','.portal-user-card']) {
  assert(css.includes(token), `${token} fehlt im zentralen Portal-CSS.`);
}
assert(portal.includes('function portalRoleLabel'), 'Sprechende Rollenanzeige fehlt.');
assert(portal.includes("r !== 'authenticated'"), 'Technische authenticated-Rolle muss aus der sichtbaren Rollenanzeige entfernt werden.');
assert(portal.includes('function portalCompanyName'), 'Firmenname wird nicht zentral aus dem aktiven Mandanten abgeleitet.');
assert(portal.includes('function renderPortalUserCard'), 'Zentrale Benutzerkarte fehlt.');

console.log('v0.40 design polish regression check passed.');
