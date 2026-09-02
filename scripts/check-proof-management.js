import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const roleGuard = fs.readFileSync('frontend/role-guard-v20.js', 'utf8');
const proofUi = fs.readFileSync('frontend/proof-management-v29.js', 'utf8');
const proofApi = fs.readFileSync('api/src/functions/proofFiles.js', 'utf8');
const filesApi = fs.readFileSync('api/src/functions/files.js', 'utf8');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    console.error(`Fehlt: ${label}`);
    process.exit(1);
  }
}

assertIncludes(index, 'Unterweisungsmanager Online · v0.29', 'sichtbare Version v0.29');
assertIncludes(index, 'data-view="proofs"', 'Nachweise-Reiter');
assertIncludes(index, '<section id="proofs"', 'Nachweise-Section');
assertIncludes(index, '/proof-management-v29.js', 'Nachweisverwaltung geladen');

assertIncludes(roleGuard, 'proofs:', 'Rollenmatrix fuer Nachweise');
assertIncludes(roleGuard, "'company_admin','hse','line_manager','system_admin'", 'Nachweise Rollenfreigabe');
assertIncludes(roleGuard, "'dashboard','status','proofs'", 'Nachweise in erlaubter Startreihenfolge');

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
