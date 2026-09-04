import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const invitations=readFileSync('api/src/functions/invitations.js','utf8');
const mail=readFileSync('api/src/functions/mail.js','utf8');
const ui=readFileSync('frontend/external-fix-v12.js','utf8');

test('line managers can create owned account-free external online invitations',()=>{
  assert.match(invitations,/deliveryMode/);
  assert.match(invitations,/employeeId\s+IS\s+NULL/i);
  assert.match(invitations,/createdBy\s*=\s*@currentUserId|createdBy=@currentUserId/);
  assert.doesNotMatch(invitations,/Line Manager können externe Links nur für zugewiesene Mitarbeiter erstellen/);
  assert.match(invitations,/Praktische Unterweisungen.*extern/i);
});

test('unlinked external invitations are ownership checked for update and resend',()=>{
  assert.match(invitations,/createdBy/);
  assert.match(invitations,/ctx\.userId/);
  assert.match(mail,/createdBy/);
  assert.match(mail,/ctx\.userId/);
  assert.match(mail,/employeeId/);
});

test('employee role remains excluded and manager UI offers team or external recipient modes',()=>{
  assert.doesNotMatch(invitations,/Roles\.EMPLOYEE/);
  assert.match(ui,/Team-Mitarbeiter/);
  assert.match(ui,/Externe Person/);
  assert.match(ui,/deliveryMode/);
});