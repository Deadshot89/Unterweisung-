import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DATA } from '../frontend/demo/demo-data.js';

test('showcase data is entirely fictional and presentation-complete', () => {
  assert.equal(DEMO_DATA.company.name, 'Musterwerk Solutions GmbH');
  assert.equal(DEMO_DATA.employees.length, 15);
  assert.ok(DEMO_DATA.employees.every(e => e.email.endsWith('@musterwerk.example')));
  assert.equal(DEMO_DATA.instructionTypes.length, 10);
  assert.ok(DEMO_DATA.instructionTypes.filter(x => x.deliveryMode === 'online').length >= 3);
  assert.ok(DEMO_DATA.instructionTypes.filter(x => x.deliveryMode === 'practical').length >= 2);
});
