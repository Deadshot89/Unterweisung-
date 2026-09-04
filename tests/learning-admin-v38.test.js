import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFileSync(url(path),'utf8');

test('Admin/HSE rich editor exposes all approved professional content fields',()=>{
  assert.ok(existsSync(url('frontend/learning-admin-v38.js')),'learning-admin-v38.js fehlt');
  const html=read('frontend/index.html');
  const ui=read('frontend/learning-admin-v38.js');
  assert.match(html,/employee-portal-v37\.js[\s\S]*learning-admin-v38\.js/);
  for(const label of ['Lernziel','Einleitung','Wichtige Merkpunkte','Praxisbezug / Bildunterschrift','Hinweis-Titel','Hinweis-Text','Vorschau']) assert.match(ui,new RegExp(label));
  for(const field of ['learningGoal','learningIntro','keyPoints','imageCaption','calloutTitle','calloutText']) assert.match(ui,new RegExp(field));
  assert.match(ui,/renderer\s*=\s*globalThis\.UMLearningExperience/);
  assert.match(ui,/renderer\.renderLearningStep/);
});

test('rich editor remains restricted to system admin, company admin and HSE',()=>{
  assert.ok(existsSync(url('frontend/learning-admin-v38.js')),'learning-admin-v38.js fehlt');
  const ui=read('frontend/learning-admin-v38.js');
  for(const role of ['system_admin','company_admin','hse']) assert.match(ui,new RegExp(role));
  assert.doesNotMatch(ui,/\['system_admin','company_admin','hse','line_manager'\]/);
});

test('admin table Open action launches a CSP-safe read-only learner-style instruction preview',()=>{
  const ui=read('frontend/learning-admin-v38.js');
  const workspace=read('frontend/instruction-type-management-v23.js');
  const binder=read('frontend/instruction-analysis.js');
  assert.match(ui,/v38OpenInstructionPreview/,'Eine echte Admin-Unterweisungsvorschau fehlt.');
  assert.match(workspace,/instruction-row-action[\s\S]{0,320}data-instruction-action="selectInstructionWorkspaceItem"[\s\S]{0,220}>Öffnen</,
    'Der Tabellenknopf Öffnen muss im vorhandenen delegierten Aktionssystem bleiben.');
  assert.doesNotMatch(workspace,/onclick=/,
    'Der Unterweisungs-Workspace darf wegen der CSP keine Inline-Eventhandler enthalten.');
  assert.match(binder,/instruction-row-action[\s\S]{0,700}v38OpenInstructionFromTable|v38OpenInstructionFromTable[\s\S]{0,700}instruction-row-action/,
    'Die delegierte Aktionsbindung muss den Öffnen-Knopf gezielt an die Admin-Vorschau weitergeben.');
  assert.match(ui,/\/learning-steps\?instructionTypeId=/,
    'Die Vorschau muss die vorhandenen Lernschritte der ausgewählten Unterweisung laden.');
  assert.match(ui,/\/files\/.*\/download/,
    'Vorhandene Lernbilder müssen über den geschützten Datei-Download geladen werden.');
  assert.match(ui,/\/templates\/.*\/download/,
    'Die Originalunterlage muss geschützt geladen werden.');
  assert.match(ui,/renderer\.renderLearningStep/,
    'Die Vorschau muss dieselbe professionelle Lernschritt-Darstellung wie Mitarbeitende verwenden.');
  assert.match(ui,/renderer\.renderQuestionList/,
    'Testfragen müssen in derselben professionellen Darstellung sichtbar sein.');
  assert.match(ui,/Nur Vorschau|Vorschau.*kein.*Abschluss|keinen.*Lernfortschritt/is,
    'Die Oberfläche muss deutlich machen, dass die Admin-Vorschau keinen Abschluss erzeugt.');
  const previewStart=ui.indexOf('async function v38OpenInstructionPreview');
  const previewSlice=previewStart>=0?ui.slice(previewStart,previewStart+9000):'';
  assert.doesNotMatch(previewSlice,/employee-training|attemptId|currentStep\s*:|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i,
    'Die Admin-Vorschau darf keine Lern-, Test-, Abschluss- oder Nachweis-Schreiboperation verwenden.');
  assert.doesNotMatch(previewSlice,/\sonclick\s*=/i,
    'Die Vorschau-Steuerelemente müssen wegen script-src self ohne Inline-Eventhandler auskommen.');
  assert.match(previewSlice,/data-v38-preview-action/,
    'Die Vorschau braucht CSP-sichere deklarative Aktionen für Schließen und Originalunterlage.');
});
