import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFileSync(url(path),'utf8');

test('external sessions snapshot professional learning content',()=>{
  const api=read('api/src/functions/externalInstruction.js');
  assert.match(api,/loadPublishedLearningContent/);
  assert.match(api,/learningGoal/);
  assert.match(api,/imageCaption/);
  assert.match(api,/imageBlobPath/);
  assert.match(api,/testInstructionSnapshotJson/);
});

test('external learner uses the shared professional step, test and result renderer',()=>{
  assert.ok(existsSync(url('frontend/external/instruction-v38.js')),'instruction-v38.js fehlt');
  const html=read('frontend/external/instruction.html');
  const ui=read('frontend/external/instruction-v38.js');
  assert.match(html,/learning-experience-v38\.js[\s\S]*instruction-v38\.js/);
  assert.match(ui,/UMLearningExperience\.renderLearningStep/);
  assert.match(ui,/UMLearningExperience\.renderQuestionList/);
  assert.match(ui,/UMLearningExperience\.renderResult/);
  assert.doesNotMatch(ui,/Das solltest du mitnehmen/);
});