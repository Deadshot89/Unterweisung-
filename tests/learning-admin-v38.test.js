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
  assert.match(ui,/UMLearningExperience\.renderLearningStep/);
});

test('rich editor remains restricted to system admin, company admin and HSE',()=>{
  assert.ok(existsSync(url('frontend/learning-admin-v38.js')),'learning-admin-v38.js fehlt');
  const ui=read('frontend/learning-admin-v38.js');
  for(const role of ['system_admin','company_admin','hse']) assert.match(ui,new RegExp(role));
  assert.doesNotMatch(ui,/\['system_admin','company_admin','hse','line_manager'\]/);
});