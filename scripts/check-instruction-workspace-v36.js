import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const cssPath = 'frontend/professional-suite-v36.css';
assert.equal(existsSync(cssPath), true, 'v0.36 Workspace-Stylesheet fehlt.');

const ui = readFileSync('frontend/instruction-type-management-v23.js', 'utf8');
const css = readFileSync(cssPath, 'utf8');
const index = readFileSync('frontend/index.html', 'utf8');
const suite = readFileSync('frontend/professional-suite-v35.js', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(ui, /instructionWorkspaceFilters/, 'Unterweisungsfilter fehlen.');
assert.match(ui, /instructionWorkspaceMetrics/, 'Unterweisungskennzahlen fehlen.');
assert.match(ui, /selectInstructionWorkspaceItem/, 'Detailauswahl fehlt.');
assert.match(ui, /instruction-detail-panel/, 'Detailbereich fehlt.');
assert.match(ui, /instruction-description-preview/, 'Kompakte Beschreibungsvorschau fehlt.');
assert.match(ui, /prepareInstructionTypeEdit/, 'Bearbeiten muss erhalten bleiben.');
assert.match(ui, /toggleInstructionType/, 'Aktivieren\/Deaktivieren muss erhalten bleiben.');
assert.match(ui, /templateUploadCard/, 'Vorlagenverwaltung muss erhalten bleiben.');
assert.match(ui, /testQuestionManagerCard/, 'Testfragenverwaltung muss erhalten bleiben.');
assert.doesNotMatch(ui, /MutationObserver/, 'v0.36 darf keinen MutationObserver einführen.');
assert.doesNotMatch(ui, /setInterval\s*\(/, 'v0.36 darf keinen Render-Polling-Timer einführen.');

assert.match(css, /\.instruction-workspace/, 'Workspace-CSS fehlt.');
assert.match(css, /\.instruction-description-preview/, 'Description-Clamp-CSS fehlt.');
assert.match(css, /overflow-x:\s*auto/, 'Responsive Tabellen-Scroll fehlt.');

assert.match(index, /professional-suite-v36\.css/, 'v0.36 Stylesheet muss geladen werden.');
assert.match(index, /v0\.36\.0/, 'Sichtbare Version v0.36.0 fehlt.');
assert.match(suite, /const APP_RELEASE_VERSION = 'v0\.36\.0'/, 'Professional Suite muss v0.36.0 als sichtbare Release-Version führen.');
assert.match(suite, /version\.textContent = APP_RELEASE_VERSION/, 'Professional Suite darf die sichtbare Version nicht auf v0.35.x zurücksetzen.');
assert.equal(pkg.version, '0.36.0');

console.log('Instruction workspace v0.36 checks passed');
