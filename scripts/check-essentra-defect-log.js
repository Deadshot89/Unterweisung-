import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('frontend/essentra-defect-log-v27.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(ui, /Essentra Fehlerprotokoll/, 'Fehlerprotokoll muss im Dashboard angezeigt werden.');
assert.match(ui, /ESSENTRA_DEFECT_KEY/, 'Fehlerprotokoll muss lokal gespeichert werden.');
assert.match(ui, /P1 Blocker/, 'Prioritaet P1 muss vorhanden sein.');
assert.match(ui, /P2 Hoch/, 'Prioritaet P2 muss vorhanden sein.');
assert.match(ui, /saveEssentraDefect/, 'Fehler muessen gespeichert werden koennen.');
assert.match(ui, /editEssentraDefect/, 'Fehler muessen bearbeitet werden koennen.');
assert.match(ui, /setEssentraDefectStatus/, 'Fehlerstatus muss geaendert werden koennen.');
assert.match(ui, /exportEssentraDefects/, 'Fehlerprotokoll muss exportierbar sein.');
assert.match(ui, /Offene Fehler exportieren/, 'Offene Fehler muessen separat exportierbar sein.');
assert.match(ui, /Design kommt erst, wenn hier keine offenen P1\/P2-Fehler mehr stehen/, 'Design-Sperre bis P1/P2 erledigt muss sichtbar sein.');
assert.match(index, /essentra-live-check-v26\.js/, 'Essentra-Pruefkonsole muss weiter geladen werden.');
assert.match(index, /essentra-defect-log-v27\.js/, 'Index muss Fehlerprotokoll laden.');
assert.match(index, /Unterweisungsmanager Online · v0\./, 'Index muss eine sichtbare Online-Version anzeigen.');

console.log('Essentra defect log checks passed');
