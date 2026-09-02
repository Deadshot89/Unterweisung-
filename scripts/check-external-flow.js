import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiExternal = readFileSync('api/src/functions/externalInstruction.js', 'utf8');
const apiInvitations = readFileSync('api/src/functions/invitations.js', 'utf8');
const frontendExternalFix = readFileSync('frontend/external-fix-v12.js', 'utf8');
const externalPage = readFileSync('frontend/external/instruction.html', 'utf8');

assert.match(apiExternal, /answerIndex:\s*originalIndex/, 'Antwortoptionen müssen den ursprünglichen richtigen Index behalten.');
assert.match(apiExternal, /correctCount/, 'API muss Anzahl richtiger Antworten zurückgeben.');
assert.match(apiExternal, /wrongCount/, 'API muss Anzahl falscher Antworten zurückgeben.');
assert.match(apiExternal, /questionCount/, 'API muss Anzahl der Testfragen zurückgeben.');

assert.match(apiInvitations, /OUTER APPLY/, 'Einladungsübersicht muss das letzte Testergebnis mitladen.');
assert.match(apiInvitations, /scorePercent/, 'Einladungsübersicht muss Prozent-Ergebnis enthalten.');
assert.match(apiInvitations, /passed/, 'Einladungsübersicht muss bestanden/nicht bestanden enthalten.');

assert.match(frontendExternalFix, /Nur Link \+ Mailtext erzeugen/, 'Graph darf nicht Standard für neue externe Links sein.');
assert.match(frontendExternalFix, /scoreLabel/, 'Admin-Tabelle muss Testergebnis anzeigen.');
assert.match(frontendExternalFix, /resultBadge/, 'Admin-Tabelle muss bestanden/nicht bestanden anzeigen.');

assert.match(externalPage, /Schulungsunterlage/, 'Externe Leseseite muss Schulungsunterlage deutlich darstellen.');
assert.match(externalPage, /Vor dem Abschluss prüfen/, 'Externe Leseseite muss Lesebestätigung prüfen.');
assert.match(externalPage, /correctCount/, 'Externe Ergebnisanzeige muss richtige Antworten darstellen.');
assert.match(externalPage, /wrongCount/, 'Externe Ergebnisanzeige muss falsche Antworten darstellen.');

console.log('External flow checks passed');
