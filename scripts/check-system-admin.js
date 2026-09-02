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
assert.match(auth, /base\.requestedCompanyId \|\| process\.env\.DEFAULT_COMPANY_ID/, 'Dev-Bypass muss x-company-id für den Firmenwechsel beachten.');

assert.match(systemApi, /route:\s*'system\/companies\/{id\?}'/, 'System-API muss system/companies bereitstellen.');
assert.match(systemApi, /assertRole\(ctx, \[Roles\.SYSTEM_ADMIN\]\)/, 'System-API muss nur System Admin erlauben.');
assert.match(systemApi, /MERGE Companies/, 'System-API muss Firmen anlegen/aktualisieren können.');
assert.match(systemApi, /company_admin/, 'System-API muss ersten Firmen-Admin anlegen können.');
assert.match(systemApi, /CompanySettings/, 'System-API muss Firmen-Einstellungen initialisieren.');

assert.match(systemUi, /System Admin/, 'Frontend muss System-Admin-Ansicht anzeigen.');
assert.match(systemUi, /createSystemCompany/, 'Frontend muss Firma anlegen können.');
assert.match(systemUi, /switchSystemCompany/, 'Frontend muss zwischen Firmen wechseln können.');
assert.match(systemUi, /system\/companies/, 'Frontend muss System-Companies-API nutzen.');
assert.match(index, /system-admin-v16\.js/, 'Index muss System-Admin-Script laden.');

console.log('System admin checks passed');
