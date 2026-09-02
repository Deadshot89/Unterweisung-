import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const employeesApi = readFileSync('api/src/functions/employees.js', 'utf8');
const importApi = readFileSync('api/src/functions/employeeImport.js', 'utf8');
const ui = readFileSync('frontend/employee-management-v18.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(employeesApi, /assertRole\(ctx, \[Roles\.COMPANY_ADMIN, Roles\.HSE\]\)/, 'Mitarbeiter-Schreiben muss auf Company Admin/HSE begrenzt sein.');
assert.match(employeesApi, /employee\.created/, 'Mitarbeiteranlage muss auditiert werden.');
assert.match(employeesApi, /employee\.updated/, 'Mitarbeiteränderung muss auditiert werden.');
assert.match(employeesApi, /title/, 'Mitarbeiter-API muss Position/Titel pflegen können.');

assert.match(importApi, /route:\s*'employees\/import'/, 'Mitarbeiter-Import-Endpunkt muss registriert sein.');
assert.match(importApi, /Maximal 1000 Mitarbeiter pro Import/, 'Import muss eine Sicherheitsgrenze haben.');
assert.match(importApi, /employee\.imported/, 'Import muss auditiert werden.');
assert.match(importApi, /managersLinked/, 'Import muss Line Manager verknüpfen können.');

assert.match(ui, /Mitarbeiter aus Excel importieren/, 'Frontend muss Excel/CSV-Import anzeigen.');
assert.match(ui, /parseEmployeeImportText/, 'Frontend muss eingefügte Tabellenzeilen parsen.');
assert.match(ui, /employees\/import/, 'Frontend muss Import-API nutzen.');
assert.match(ui, /saveEmployee/, 'Frontend muss einzelne Mitarbeiter speichern können.');
assert.match(ui, /toggleEmployee/, 'Frontend muss Mitarbeiter aktivieren/deaktivieren können.');
assert.match(index, /employee-management-v18\.js/, 'Index muss Mitarbeiter-Management-Script laden.');

console.log('Employee management checks passed');
