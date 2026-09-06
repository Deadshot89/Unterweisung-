import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const proofUi = fs.readFileSync('frontend/proof-management-v29.js', 'utf8');
const proofApi = fs.readFileSync('api/src/functions/proofFiles.js', 'utf8');
const filesApi = fs.readFileSync('api/src/functions/files.js', 'utf8');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    console.error(`Fehlt: ${label}`);
    process.exit(1);
  }
}

function assertMatches(source, pattern, label) {
  if (!pattern.test(source)) {
    console.error(`Fehlt: ${label}`);
    process.exit(1);
  }
}

assertMatches(index, /Unterweisungsmanager Online · v0\./, 'sichtbare Online-Version');
assertIncludes(index, '<section id="proofs"', 'v0.40 Nachweise-Portalbereich');
assertIncludes(index, '/proof-management-v29.js', 'Nachweisverwaltung geladen');
assertIncludes(index, '/portal-shell.js', 'v0.40 Portal-Shell geladen');

assertIncludes(portal, "const PRIMARY_VIEWS = ['dashboard', 'work', 'learning', 'planning', 'proofs', 'reports', 'admin']", 'Nachweise in den sieben Primärbereichen');
assertIncludes(portal, "employee: ['dashboard','work','learning','proofs']", 'Mitarbeiterzugriff auf eigene Nachweise');
assertIncludes(portal, "line_manager: ['dashboard','work','learning','planning','proofs','reports']", 'Führungskraft-Zugriff auf Nachweise');
assertIncludes(portal, 'hse: [...PRIMARY_VIEWS]', 'HSE-Zugriff auf Nachweise');
assertIncludes(portal, 'company_admin: [...PRIMARY_VIEWS]', 'Firmenadmin-Zugriff auf Nachweise');
assertIncludes(portal, 'system_admin: [...PRIMARY_VIEWS]', 'Systemadmin-Zugriff auf Nachweise');
assertIncludes(portal, "if(view === 'proofs') { if(typeof renderProofs === 'function') renderProofs(); return; }", 'Nachweise werden über die Portal-Shell gerendert');

assertIncludes(proofUi, 'function renderProofs', 'Nachweise rendern');
assertIncludes(proofUi, 'function uploadProofFile', 'Nachweis hochladen');
assertIncludes(proofUi, "api('/proof-files'", 'Proof-Files API wird genutzt');
assertIncludes(proofUi, "'/files/' + encodeURIComponent(fileId) + '/download'", 'Datei-Download wird genutzt');
assertIncludes(proofUi, 'function setProofScanStatus', 'Pruefstatus setzen');
assertIncludes(proofUi, 'function exportProofCsv', 'CSV Export');
assertIncludes(proofUi, "proofApplyGroup')?.value === 'yes'", 'Gruppennachweis-Unterstuetzung');
assertIncludes(proofUi, 'accept="application/pdf,image/jpeg,image/png,image/webp"', 'erlaubte Dateitypen in UI');

assertIncludes(proofApi, "route: 'proof-files/{id?}'", 'Proof-Files API Route');
assertIncludes(proofApi, "methods: ['GET', 'POST', 'PATCH']", 'Proof-Files API Methoden');
assertIncludes(proofApi, 'getGroupRecords', 'Gruppennachweis API');
assertIncludes(proofApi, "assertRole(ctx, [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER])", 'Proof-Files Schreibrechte');
assertIncludes(filesApi, "route: 'files/{id}/download'", 'Datei-Download Route');
assertIncludes(filesApi, 'createReadSasUrl', 'SAS Download Link');

console.log('Proof management regression check passed.');
