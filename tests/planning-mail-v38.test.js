import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui=readFileSync('frontend/planning-management-v24.js','utf8');
const api=readFileSync('api/src/functions/plannedTrainings.js','utf8');
const mail=readFileSync('api/src/functions/mail.js','utf8');

test('planning UI exposes save-and-mail plus resend states',()=>{
  for(const label of ['Planung speichern','Planung speichern und Mail senden','Termin per Mail senden','Erneut senden']) assert.match(ui,new RegExp(label));
  assert.match(ui,/case\s+['"]save-mail['"]/);
  assert.match(ui,/savePlannedTraining\s*\(\s*\{\s*sendMail/);
  assert.match(ui,/\/planned-trainings\/.*\/send-mail/);
});

test('planned training list exposes mail delivery counts without weakening team ownership',()=>{
  assert.match(api,/mailSentCount/);
  assert.match(api,/mailErrorCount/);
  assert.match(api,/mailSentAt/);
  assert.match(api,/mailError/);
  assert.match(mail,/training\.lineManagerId/);
  assert.match(mail,/access\.selfEmployeeId/);
});