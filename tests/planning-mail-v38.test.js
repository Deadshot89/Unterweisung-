import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFileSync(url(path),'utf8');

test('planning UI exposes save-and-mail plus resend states',()=>{
  assert.ok(existsSync(url('frontend/planning-mail-v38.js')),'planning-mail-v38.js fehlt');
  const html=read('frontend/index.html');
  const ui=read('frontend/planning-mail-v38.js');
  assert.match(html,/planning-management-v24\.js[\s\S]*planning-mail-v38\.js/);
  for(const label of ['Planung speichern','Planung speichern und Mail senden','Termin per Mail senden','Erneut senden']) assert.match(ui,new RegExp(label));
  assert.match(ui,/case\s+['"]save-mail['"]/);
  assert.match(ui,/savePlannedTraining\s*\(\s*\{\s*sendMail/);
  assert.match(ui,/\/planned-trainings\/.*\/send-mail/);
});

test('planned training list exposes mail delivery counts without weakening team ownership',()=>{
  const api=read('api/src/functions/plannedTrainings.js');
  const mail=read('api/src/functions/mail.js');
  assert.match(api,/mailSentCount/);
  assert.match(api,/mailErrorCount/);
  assert.match(api,/mailSentAt/);
  assert.match(api,/mailError/);
  assert.match(mail,/training\.lineManagerId/);
  assert.match(mail,/access\.selfEmployeeId/);
});