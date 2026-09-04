import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_DATA } from '../frontend/demo/demo-data.js';
import { prepareDemoQualityData } from '../frontend/demo/demo-quality-data.js';
import { createEnhancedDemoStore } from '../frontend/demo/demo-mail-store.js';

prepareDemoQualityData(DEMO_DATA);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function freshStore() {
  return createEnhancedDemoStore(DEMO_DATA, memoryStorage());
}

test('line manager can simulate an external online instruction invitation without network delivery', () => {
  const store = freshStore();
  store.setRole('line_manager', 'emp-felix-berger');
  const invite = store.sendExternalInstruction('emp-felix-berger', {
    instructionId: 'ins-arbeitsschutz',
    recipientName: 'Max Mustermann',
    recipientEmail: 'max.mustermann@kunde.example'
  });
  assert.equal(invite.status, 'simulated_sent');
  assert.equal(invite.recipientEmail, 'max.mustermann@kunde.example');
  assert.match(invite.demoLink, /^#external-demo=/);
  assert.equal(store.getState().externalInvitations.at(-1).id, invite.id);
  assert.equal(store.getState().mailOutbox.at(-1).kind, 'external_instruction');
});

test('employee cannot send external instruction invitations and practical instructions are not externally dispatched', () => {
  const store = freshStore();
  store.setRole('employee', 'emp-nora-weiss');
  assert.throws(() => store.sendExternalInstruction('emp-nora-weiss', {
    instructionId: 'ins-arbeitsschutz', recipientName: 'Gast', recipientEmail: 'gast@kunde.example'
  }), /Führungskraft|Admin/i);

  store.setRole('line_manager', 'emp-felix-berger');
  assert.throws(() => store.sendExternalInstruction('emp-felix-berger', {
    instructionId: 'ins-stapler', recipientName: 'Gast', recipientEmail: 'gast@kunde.example'
  }), /Online/i);
});

test('planning mail can be simulated by responsible manager and is recorded in the local outbox', () => {
  const store = freshStore();
  store.setRole('line_manager', 'emp-felix-berger');
  const plan = store.schedulePractical('emp-felix-berger', 'emp-nora-weiss', 'ins-stapler', '2026-09-18T09:30');
  const mail = store.sendPlanningMail('emp-felix-berger', plan.id);
  assert.equal(mail.kind, 'planning');
  assert.equal(mail.recipientEmail, 'nora.weiss@musterwerk.example');
  assert.match(mail.subject, /Flurförderzeuge|Stapler/);
  assert.match(mail.body, /18\.09\.2026/);
  assert.match(mail.body, /09:30/);
  assert.equal(mail.status, 'simulated_sent');
  assert.equal(store.getState().plannedTrainings.find(item => item.id === plan.id)?.mailStatus, 'simulated_sent');
});

test('line manager cannot send a planning mail for a different team', () => {
  const store = freshStore();
  store.setRole('line_manager', 'emp-felix-berger');
  assert.throws(() => store.sendPlanningMail('emp-felix-berger', 'plan-01'), /Team|verantwortlich/i);
});

test('core online instructions contain presentation-ready learning goals, summaries and rich step guidance', () => {
  const featured = ['ins-arbeitsschutz', 'ins-brandschutz', 'ins-phishing'];
  for (const id of featured) {
    const instruction = DEMO_DATA.instructionTypes.find(item => item.id === id);
    assert.ok(instruction?.learningGoal?.length >= 60, `${id} needs a substantial learning goal`);
    assert.ok(instruction?.intro?.length >= 80, `${id} needs a substantial introduction`);
    assert.ok(Array.isArray(instruction?.keyPoints) && instruction.keyPoints.length >= 3, `${id} needs at least three key points`);
    const steps = DEMO_DATA.learningSteps.filter(step => step.instructionId === id);
    assert.ok(steps.length >= 3);
    for (const step of steps) {
      assert.ok(step.text.length >= 100, `${step.id} needs a fuller explanation`);
      assert.ok(step.imageCaption?.length >= 20, `${step.id} needs an image caption`);
      assert.ok(step.calloutTitle?.length >= 3 && step.calloutText?.length >= 35, `${step.id} needs a practical callout`);
    }
  }
});

test('PSA training is a fully written presentation-quality learning path', () => {
  const instruction = DEMO_DATA.instructionTypes.find(item => item.id === 'ins-psa');
  assert.ok(instruction?.learningGoal?.length >= 60);
  assert.ok(instruction?.intro?.length >= 90);
  assert.ok(Array.isArray(instruction?.keyPoints) && instruction.keyPoints.length >= 3);
  const steps = DEMO_DATA.learningSteps.filter(step => step.instructionId === 'ins-psa');
  assert.equal(steps.length, 3);
  for (const step of steps) {
    assert.ok(step.text.length >= 120, `${step.id} explanation too short`);
    assert.ok(step.imageCaption?.length >= 35, `${step.id} image caption too short`);
    assert.ok(step.calloutTitle?.length >= 3 && step.calloutText?.length >= 45, `${step.id} callout missing`);
  }
});

test('learning copy uses professional section wording instead of the rejected phrase', () => {
  const source = readFileSync(new URL('../frontend/demo/demo-mail-learning.js', import.meta.url), 'utf8')
    + readFileSync(new URL('../frontend/learning-experience-v38.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Das solltest du mitnehmen/i);
  assert.match(source, /Wichtige Merkpunkte/);
});

test('core learning illustrations are detailed presentation assets rather than minimal placeholders', () => {
  for (const name of ['work-safety.svg', 'fire-safety.svg', 'phishing.svg', 'warehouse.svg']) {
    const svg = readFileSync(new URL(`../frontend/demo/assets/${name}`, import.meta.url), 'utf8');
    assert.ok(svg.length >= 3500, `${name} is still too simple`);
    assert.match(svg, /linearGradient|radialGradient/);
    assert.match(svg, /filter|feDropShadow|feGaussianBlur/);
    assert.match(svg, /aria-label=/);
  }
});

test('demo extension exposes external invitation, planning mail and the shared professional learning core', () => {
  const ui = readFileSync(new URL('../frontend/demo/demo-mail-learning.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/demo/demo-mail-learning.css', import.meta.url), 'utf8');
  const sharedCss = readFileSync(new URL('../frontend/learning-experience-v38.css', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../frontend/demo/index.html', import.meta.url), 'utf8');
  assert.match(ui, /Externe Unterweisung senden/);
  assert.match(ui, /Termin per Mail senden/);
  assert.match(ui, /Mailvorschau/);
  assert.match(ui, /UMLearningExperience\.renderLearningStep/);
  assert.match(ui, /UMLearningExperience\.renderQuestionList/);
  assert.match(ui, /UMLearningExperience\.renderResult/);
  assert.match(sharedCss, /\.um-learning-stage/);
  assert.match(sharedCss, /\.um-learning-visual/);
  assert.match(sharedCss, /\.um-learning-callout/);
  assert.match(css, /\.mail-preview/);
  assert.match(index, /learning-experience-v38\.css/);
  assert.match(index, /learning-experience-v38\.js/);
  assert.match(index, /demo-quality-data\.js/);
  assert.match(index, /demo-mail-learning\.js/);
  assert.match(index, /demo-mail-learning\.css/);
});

test('mail simulation extension contains no real network or mail-client delivery path', () => {
  const source = readFileSync(new URL('../frontend/demo/demo-mail-learning.js', import.meta.url), 'utf8') + readFileSync(new URL('../frontend/demo/demo-mail-store.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /mailto:/i);
  assert.doesNotMatch(source, /\/api\//i);
});
