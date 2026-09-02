import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('database/migrations/008_company_mail_settings.sql', 'utf8');
const api = readFileSync('api/src/functions/companyMailSettings.js', 'utf8');
const ui = readFileSync('frontend/company-settings-v15.js', 'utf8');
const external = readFileSync('frontend/external-fix-v12.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

for (const column of ['mailMode','mailFromName','mailFromEmail','replyToEmail','mailSubjectPrefix','mailSignature','mailUpdatedAt']) {
  assert.match(migration, new RegExp(column), `Migration muss ${column} anlegen.`);
  assert.match(api, new RegExp(column), `API muss ${column} lesen/schreiben.`);
}

assert.match(api, /route:\s*'company-mail-settings'/, 'API-Endpunkt company-mail-settings muss registriert sein.');
assert.match(api, /manual.*outlook.*graph/s, 'API muss die drei Mailmodi manual, outlook und graph kennen.');
assert.match(api, /assertRole\(ctx, \[Roles\.COMPANY_ADMIN, Roles\.HSE\]\)/, 'PATCH muss auf Firmen-Admin/HSE begrenzt sein.');

assert.match(ui, /saveCompanyMailSettings/, 'Frontend muss Firmen-Mailsettings speichern können.');
assert.match(ui, /Mailprogramm \/ Outlook öffnen/, 'Frontend muss Outlook/Mailprogramm-Modus anbieten.');
assert.match(ui, /Microsoft Graph automatisch senden/, 'Frontend muss Graph-Modus als Firmenoption anbieten.');

assert.match(external, /getCompanyMailSettingsSafe/, 'Externe Links müssen Firmen-Mailsettings laden.');
assert.match(external, /mailSubjectPrefix/, 'Mailtext muss Betreff-Präfix der Firma nutzen.');
assert.match(external, /replyToEmail/, 'Mailtext muss Antwortadresse der Firma nutzen.');
assert.match(external, /openMailClient/, 'Externe Links müssen Mailprogramm öffnen können.');
assert.match(index, /company-settings-v15\.js/, 'Index muss Firmen-Mailsettings-Script laden.');

console.log('Company mail settings checks passed');
