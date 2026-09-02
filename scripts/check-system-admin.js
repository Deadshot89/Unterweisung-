import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync('api/src/lib/auth.js', 'utf8');
const systemApi = readFileSync('api/src/functions/systemCompanies.js', 'utf8');
const systemUi = readFileSync('frontend/system-admin-v16.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(auth, /AUTH_DEV_SYSTEM_ADMIN/, 'Auth muss einen expliziten Dev-System-Admin-Schalter unterstützen.');
assert.match(auth, /SYSTEM_ADMIN_EMAILS/, 'Auth muss Betreiber-E-Mail-Adressen als System Admin erkennen können.');
assert.match(auth, /Roles\.SYSTEM_ADMIN/, 'Auth muss System-Admin-Rolle ausgeben können.');
assert.match(auth, /selectedCompanyId/, 'Auth muss im Dev-System-Admin-Modus den gewünschten Mandanten auswählen können.');
assert.match(auth, /base\.requestedCompanyId \|\| defaultCompanyId\(\)/, 'Dev-Bypass muss x-company-id für den Firmenwechsel beachten.');

assert.match(systemApi, /route:\s*'system\/companies\/{id\?}'/, 'System-API muss system/companies bereitstellen.');
assert.match(systemApi, /assertRole\(ctx, \[Roles\.SYSTEM_ADMIN\]\)/, 'System-API muss nur System Admin erlauben.');
assert.match(systemApi, /MERGE Companies/, 'System-API muss Firmen anlegen/aktualisieren können.');
assert.match(systemApi, /company_admin/, 'System-API muss ersten Firmen-Admin anlegen können.');
assert.match(systemApi, /CompanySettings/, 'System-API muss Firmen-Einstellungen initialisieren.');
assert.match(systemApi, /copyStarterData/, 'System-API muss Starterdaten kopieren können.');
assert.match(systemApi, /InstructionTypes/, 'Starterdaten müssen Unterweisungstypen kopieren.');
assert.match(systemApi, /Templates/, 'Starterdaten müssen Vorlagen-Verweise kopieren.');
assert.match(systemApi, /TestQuestions/, 'Starterdaten müssen Testfragen kopieren.');
assert.match(systemApi, /targetCompanyId === sourceCompanyId/, 'Starterdaten dürfen nicht in dieselbe Firma zurückkopiert werden.');
assert.match(systemApi, /tenantHasStarterData/, 'Starterdaten dürfen nicht versehentlich doppelt kopiert werden.');

assert.match(systemUi, /System Admin/, 'Frontend muss System-Admin-Ansicht anzeigen.');
assert.match(systemUi, /createSystemCompany/, 'Frontend muss Firma anlegen können.');
assert.match(systemUi, /switchSystemCompany/, 'Frontend muss zwischen Firmen wechseln können.');
assert.match(systemUi, /Starterdaten übernehmen/, 'Frontend muss Starterdaten manuell übernehmen können.');
assert.match(systemUi, /copyStarterData/, 'Frontend muss Starterdaten-API aufrufen können.');
assert.match(systemUi, /copyStarterData:\s*\$\('sysCopyStarter'\)\.value === '1'/, 'Neue Firmen müssen optional direkt mit Startpaket angelegt werden können.');
assert.match(systemUi, /system\/companies/, 'Frontend muss System-Companies-API nutzen.');
assert.match(index, /system-admin-v16\.js/, 'Index muss System-Admin-Script laden.');
assert.match(index, /v0\.(1[7-9]|[2-9][0-9])/, 'Index muss mindestens Stand v0.17 anzeigen.');

console.log('System admin checks passed');
