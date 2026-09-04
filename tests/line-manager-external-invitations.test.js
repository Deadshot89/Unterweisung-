import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const url=path=>new URL(`../${path}`,import.meta.url);
const read=path=>readFileSync(url(path),'utf8');

test('line managers can create owned account-free external online invitations',()=>{
  const invitations=read('api/src/functions/invitations.js');
  assert.match(invitations,/deliveryMode/);
  assert.match(invitations,/employeeId\s+IS\s+NULL/i);
  assert.match(invitations,/createdBy\s*=\s*@currentUserId|createdBy=@currentUserId/);
  assert.doesNotMatch(invitations,/Line Manager können externe Links nur für zugewiesene Mitarbeiter erstellen/);
  assert.match(invitations,/Praktische Unterweisungen.*extern/i);
});

test('unlinked external invitations are ownership checked for update and resend',()=>{
  const invitations=read('api/src/functions/invitations.js');
  const mail=read('api/src/functions/mail.js');
  assert.match(invitations,/createdBy/);
  assert.match(invitations,/ctx\.userId/);
  assert.match(mail,/createdBy/);
  assert.match(mail,/ctx\.userId/);
  assert.match(mail,/employeeId/);
});

test('employee role remains excluded and manager UI offers team or external recipient modes',()=>{
  const invitations=read('api/src/functions/invitations.js');
  assert.doesNotMatch(invitations,/Roles\.EMPLOYEE/);
  assert.ok(existsSync(url('frontend/external-manager-v38.js')),'external-manager-v38.js fehlt');
  const html=read('frontend/index.html');
  const ui=read('frontend/external-manager-v38.js');
  assert.match(html,/external-fix-v12\.js[\s\S]*external-manager-v38\.js/);
  assert.match(ui,/Team-Mitarbeiter/);
  assert.match(ui,/Externe Person/);
  assert.match(ui,/deliveryMode/);
});