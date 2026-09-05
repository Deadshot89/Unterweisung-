import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const usersApi = readFileSync('api/src/functions/users.js', 'utf8');

test('a user email cannot be created in a second company', () => {
  const postStart = usersApi.indexOf("if (request.method === 'POST')");
  const mergeStart = usersApi.indexOf('MERGE Users AS t', postStart);
  assert.ok(postStart >= 0 && mergeStart > postStart, 'POST-Benutzeranlage muss vorhanden sein.');
  const beforeMerge = usersApi.slice(postStart, mergeStart);

  assert.match(
    beforeMerge,
    /LOWER\(email\)\s*=\s*LOWER\(@email\)[\s\S]*companyId\s*<>\s*@companyId|companyId\s*<>\s*@companyId[\s\S]*LOWER\(email\)\s*=\s*LOWER\(@email\)/,
    'Vor dem MERGE muss firmenübergreifend geprüft werden, ob die E-Mail schon zu einem anderen Mandanten gehört.'
  );
  assert.match(
    beforeMerge,
    /anderen Firma|anderer Firma|anderen Mandanten|anderem Mandanten/i,
    'Eine Doppelanlage muss mit einer verständlichen Mandantenmeldung abgewiesen werden.'
  );
});
