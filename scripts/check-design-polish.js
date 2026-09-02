import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const design = fs.readFileSync('frontend/design-polish-v31.js', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Design-Pruefung fehlgeschlagen: ${message}`);
    process.exit(1);
  }
}

assert(/Unterweisungsmanager Online · v0\./.test(index), 'Browser-Titel muss kompatible sichtbare Version behalten.');
assert(index.includes('<h1>Unterweisungsmanager</h1>'), 'Sichtbarer Header darf nicht mehr "Online" im Titel tragen.');
assert(index.includes('Digitales Unterweisungs- und Schulungsmanagement'), 'Professionelle Subline fehlt.');
assert(index.includes('class="system-strip"'), 'Kompakte Systemstatus-Leiste fehlt.');
assert(index.includes('Systemstatus:'), 'Systemstatus fehlt.');
assert(index.includes('Betriebsbereit'), 'Betriebsbereit-Text fehlt.');
assert(index.includes('Essentra aktiv'), 'Essentra-Aktiv-Hinweis fehlt.');
assert(index.includes('/design-polish-v31.js'), 'Design-Polish-Datei wird nicht geladen.');
assert(!index.includes('Azure Static Web Apps + Functions + SQL/Blob'), 'Technischer Azure-Text darf nicht mehr sichtbar im Header stehen.');
assert(!index.includes('Login läuft im Dev-Bypass'), 'Dev-Bypass darf nicht mehr sichtbar in der Hauptoberflaeche stehen.');
assert(!index.includes('Online-Grundstruktur v0.'), 'Langer Online-Grundstruktur-Status darf nicht mehr sichtbar sein.');

assert(css.includes('.brand-wrap'), 'Neues Header-Layout CSS fehlt.');
assert(css.includes('.system-strip'), 'Systemstrip CSS fehlt.');
assert(css.includes('.primary-tabs'), 'Moderne Navigation CSS fehlt.');
assert(css.includes('.professional-user'), 'Professionelle Benutzerkarte CSS fehlt.');
assert(css.includes('.identity-name'), 'Benutzername CSS fehlt.');
assert(css.includes('.identity-roles'), 'Rollenbereich CSS fehlt.');

assert(design.includes('FRIENDLY_ROLE_LABELS'), 'Rollen werden nicht in sprechende Labels umgewandelt.');
assert(design.includes("r !== 'authenticated'"), 'authenticated muss aus der sichtbaren Rollenanzeige entfernt werden.');
assert(design.includes('designCompanyName'), 'Firmenname muss sauber angezeigt werden.');
assert(design.includes('company-essentra') === false, 'Technische companyId darf im Designscript nicht angezeigt werden.');
assert(design.includes('login.style.display'), 'Login/Logout Anzeige muss gesteuert werden.');

console.log('Design polish regression check passed.');
