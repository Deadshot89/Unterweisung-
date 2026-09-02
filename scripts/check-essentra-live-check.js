import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('frontend/essentra-live-check-v26.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(ui, /ESSENTRA_LIVE_CHECKS/, 'Essentra-Pruefliste muss definiert sein.');
assert.match(ui, /runEssentraSmokeCheck/, 'API-Smokecheck muss vorhanden sein.');
assert.match(ui, /exportEssentraLiveCheck/, 'Pruefstand-Export muss vorhanden sein.');
assert.match(ui, /resetEssentraLiveCheck/, 'Pruefstand-Reset muss vorhanden sein.');
assert.match(ui, /Mitarbeiter-Import testen/, 'Mitarbeiter-Import muss Teil der Live-Pruefung sein.');
assert.match(ui, /Unterweisungsunterlage hochladen/, 'Vorlagen-Upload muss Teil der Live-Pruefung sein.');
assert.match(ui, /Nachweis einzeln hochladen/, 'Nachweis-Upload muss Teil der Live-Pruefung sein.');
assert.match(ui, /Externen Test abschließen/, 'Externe Unterweisung muss Teil der Live-Pruefung sein.');
assert.match(ui, /Backup exportieren/, 'Backup/Restore muss Teil der Live-Pruefung sein.');
assert.match(index, /essentra-live-check-v26\.js/, 'Index muss die Essentra-Live-Pruefkonsole laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss sichtbare Online-Version anzeigen.');

console.log('Essentra live check checks passed');
