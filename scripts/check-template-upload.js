import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/src/functions/templateFiles.js', 'utf8');
const ui = readFileSync('frontend/template-management-v21.js', 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');

assert.match(api, /route:\s*'templates\/upload'/, 'Template-Upload-Endpunkt muss registriert sein.');
assert.match(api, /assertRole\(ctx, \[Roles\.COMPANY_ADMIN, Roles\.HSE\]\)/, 'Template-Upload muss auf Company Admin/HSE begrenzt sein.');
assert.match(api, /validateUploadedFile/, 'Template-Upload muss Dateityp, Inhalt und Größe prüfen.');
assert.match(api, /uploadBufferToBlob/, 'Template-Upload muss in Azure Blob Storage schreiben.');
assert.match(api, /kind:\s*'template'/, 'Template-Dateien müssen als kind=template gespeichert werden.');
assert.match(api, /MERGE Templates/, 'Template-Upload muss die Templates-Tabelle aktualisieren.');
assert.match(api, /UPDATE InstructionTypes SET templateId=@templateId/, 'Template-Upload muss Unterweisungstypen zuordnen können.');
assert.match(api, /template\.uploaded/, 'Template-Upload muss auditiert werden.');
assert.match(api, /route:\s*'templates\/\{id\}\/download'/, 'Template-Download muss weiter vorhanden sein.');

assert.match(ui, /Unterweisungsunterlage hochladen/, 'Frontend muss Upload-Maske anzeigen.');
assert.match(ui, /uploadTemplateFile/, 'Frontend muss Upload-Funktion bereitstellen.');
assert.match(ui, /fileToBase64/, 'Frontend muss Datei in Base64 für API umwandeln.');
assert.match(ui, /templates\/upload/, 'Frontend muss Template-Upload-API nutzen.');
assert.match(ui, /openTemplate/, 'Frontend muss Unterlagen öffnen können.');
assert.match(ui, /prepareTemplateReplace/, 'Frontend muss bestehende Vorlagen ersetzen können.');
assert.match(index, /template-management-v21\.js/, 'Index muss Template-Management-Script laden.');
assert.match(index, /v0\.21/, 'Index muss Version v0.21 anzeigen.');

console.log('Template upload checks passed');
