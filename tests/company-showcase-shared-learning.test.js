import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('demo consumes the same professional learning core as production',()=>{
  const html=readFileSync('frontend/demo/index.html','utf8');
  const ui=readFileSync('frontend/demo/demo-mail-learning.js','utf8');
  const scanner=readFileSync('scripts/check-company-showcase-demo.js','utf8');
  assert.match(html,/\.\.\/learning-experience-v38\.css/);
  assert.match(html,/\.\.\/learning-experience-v38\.js/);
  assert.match(ui,/UMLearningExperience\.renderLearningStep/);
  assert.match(ui,/UMLearningExperience\.renderQuestionList/);
  assert.match(ui,/UMLearningExperience\.renderResult/);
  assert.match(scanner,/learning-experience-v38\.js/);
  assert.doesNotMatch(ui,/Das solltest du mitnehmen/);
});
