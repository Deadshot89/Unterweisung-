const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const rendererPath = 'frontend/learning-experience-v38.js';
const cssPath = 'frontend/learning-experience-v38.css';

function loadRenderer() {
  assert.ok(fs.existsSync(rendererPath), 'shared learning renderer file must exist');
  const source = fs.readFileSync(rendererPath, 'utf8');
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return { api: context.globalThis.UMLearningExperience, source };
}

test('shared learning renderer is pure and uses the approved professional structure', () => {
  const { api, source } = loadRenderer();
  assert.ok(api, 'UMLearningExperience global must be exposed');
  for (const forbidden of [/fetch\s*\(/, /\/api\//, /\.auth\//, /sendGraphMail/, /blob\.core\.windows\.net/i]) {
    assert.doesNotMatch(source, forbidden);
  }
  const html = api.renderLearningStep({
    instruction: {
      name: 'PSA',
      learningGoal: 'PSA sicher auswählen.',
      learningIntro: 'Vor Arbeitsbeginn prüfen.',
      keyPoints: ['Passende PSA tragen.']
    },
    step: {
      title: 'Mängel melden',
      body: 'Beschädigte PSA sofort aussondern.',
      imageUrl: '/assets/psa.svg',
      imageCaption: 'Defekte PSA nicht weiterverwenden.',
      calloutTitle: 'Praxischeck',
      calloutText: 'Mangel melden und Ersatz beschaffen.'
    },
    index: 1,
    total: 3
  });
  assert.match(html, /um-learning-stage/);
  assert.match(html, /Lernziel/);
  assert.match(html, /Praxisbezug/);
  assert.match(html, /Wichtige Merkpunkte/);
  assert.doesNotMatch(html, /Das solltest du mitnehmen/);
});

test('shared learning stylesheet provides full-width image, answer and result stages', () => {
  assert.ok(fs.existsSync(cssPath), 'shared learning stylesheet must exist');
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const selector of ['.um-learning-stage', '.um-learning-visual', '.um-learning-image', '.um-question-card', '.um-answer-card', '.um-result-panel']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(css, /aspect-ratio\s*:\s*16\s*\/\s*9/);
  assert.match(css, /object-fit\s*:\s*cover/);
});
