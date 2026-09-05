import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const usersApi = readFileSync('api/src/functions/users.js', 'utf8');
const usersUi = readFileSync('frontend/user-management-v19.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(usersApi, /route:\s*'users\/{id\?}'/, 'Users API muss route users/{id?} bereitstellen.');
assert.match(usersApi, /assertRole\(ctx, \[Roles\.SYSTEM_ADMIN, Roles\.COMPANY_ADMIN, Roles\.HSE\]\)/, 'GET muss System Admin, Firmen Admin und HSE erlauben.');
assert.match(usersApi, /assertRole\(ctx, \[Roles\.SYSTEM_ADMIN, Roles\.COMPANY_ADMIN\]\)/, 'POST/PATCH muss auf System Admin/Firmen Admin begrenzt sein.');
assert.match(usersApi, /canManageRole/, 'Rollenvergabe muss zentral abgesichert sein.');
assert.match(usersApi, /role === Roles\.SYSTEM_ADMIN/, 'System-Admin-Vergabe muss extra geschützt sein.');
assert.match(usersApi, /WHERE id=@id AND companyId=@companyId/, 'PATCH darf nicht mandantenübergreifend ohne companyId-Schutz schreiben.');
assert.doesNotMatch(usersApi, /OR EXISTS\(SELECT 1 FROM Users WHERE id=@id/, 'Unsichere alte mandantenübergreifende PATCH-Bedingung darf nicht vorhanden sein.');

assert.match(usersUi, /function renderUsers/, 'Frontend muss renderUsers überschreiben.');
assert.match(usersUi, /roleBadge/, 'Frontend muss Rollen sichtbar darstellen.');
assert.match(usersUi, /toggleUser/, 'Frontend muss Benutzer sperren/freischalten können.');
assert.match(usersUi, /system_admin/, 'Frontend muss System-Admin-Rolle für Betreiber unterstützen.');
assert.match(usersUi, /Microsoft und E-Mail\/Passwort verwenden dieselben hinterlegten Rollen und Firmenrechte/, 'Frontend muss die gemeinsame Rollen-/Firmenlogik beider Loginwege erklären.');
assert.match(usersUi, /Passwort-Setup-Link erstellen/, 'Frontend muss den sicheren Passwort-Erstzugang erklären und anbieten.');
assert.match(index, /user-management-v19\.js/, 'Index muss User-Management-Script laden.');

console.log('User management checks passed');
