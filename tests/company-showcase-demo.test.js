import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DATA } from '../frontend/demo/demo-data.js';
import { createDemoStore } from '../frontend/demo/demo-store.js';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem:key => bag.has(key) ? bag.get(key) : null,
    setItem:(key,value) => bag.set(key, String(value)),
    removeItem:key => bag.delete(key)
  };
}

test('showcase data is entirely fictional and presentation-complete', () => {
  assert.equal(DEMO_DATA.company.name, 'Musterwerk Solutions GmbH');
  assert.equal(DEMO_DATA.employees.length, 15);
  assert.ok(DEMO_DATA.employees.every(e => e.email.endsWith('@musterwerk.example')));
  assert.equal(DEMO_DATA.instructionTypes.length, 10);
  assert.ok(DEMO_DATA.instructionTypes.filter(x => x.deliveryMode === 'online').length >= 3);
  assert.ok(DEMO_DATA.instructionTypes.filter(x => x.deliveryMode === 'practical').length >= 2);
});

test('employee only sees self and line manager only direct reports', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  assert.deepEqual(store.getVisibleEmployees().map(x => x.id), ['emp-mila-hartmann']);
  store.setRole('line_manager', 'emp-jonas-keller');
  const team = store.getVisibleEmployees();
  assert.ok(team.length >= 3);
  assert.ok(team.every(x => x.lineManagerId === 'emp-jonas-keller'));
  assert.ok(!team.some(x => x.id === 'emp-nora-weiss'));
});

test('online training cannot skip learning steps or finish before passing test', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  const instructionId = 'ins-arbeitsschutz';
  assert.throws(() => store.completeOnline('emp-mila-hartmann', instructionId), /Lernschritte/);
  const stepCount = DEMO_DATA.learningSteps.filter(x => x.instructionId === instructionId).length;
  const before = store.getState().assignments.find(x => x.employeeId === 'emp-mila-hartmann' && x.instructionId === instructionId).progress;
  const after = store.advanceLearning('emp-mila-hartmann', instructionId);
  assert.equal(after.progress, Math.min(before + 1, stepCount));
  while (store.getState().assignments.find(x => x.employeeId === 'emp-mila-hartmann' && x.instructionId === instructionId).progress < stepCount) {
    store.advanceLearning('emp-mila-hartmann', instructionId);
  }
  assert.throws(() => store.completeOnline('emp-mila-hartmann', instructionId), /Test/);
  const result = store.submitTest('emp-mila-hartmann', instructionId, { 'q-as-1':1, 'q-as-2':0 });
  assert.equal(result.passed, true);
  const record = store.completeOnline('emp-mila-hartmann', instructionId);
  assert.equal(record.source, 'demo-online');
});

test('employee cannot confirm practical training and reset restores baseline', () => {
  const storage = memoryStorage();
  const store = createDemoStore(DEMO_DATA, storage);
  store.setRole('employee', 'emp-nora-weiss');
  assert.throws(() => store.confirmPractical('emp-nora-weiss', 'emp-nora-weiss', 'ins-stapler'), /Führungskraft/);
  store.reset();
  assert.equal(store.getState().company.name, 'Musterwerk Solutions GmbH');
  assert.equal(store.getState().records.length, DEMO_DATA.records.length);
});

test('line manager cannot schedule or confirm training outside direct team', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  store.setRole('line_manager', 'emp-jonas-keller');
  assert.throws(() => store.schedulePractical('emp-jonas-keller', 'emp-nora-weiss', 'ins-stapler', '2026-09-10T09:00:00'), /Team/);
  assert.throws(() => store.confirmPractical('emp-jonas-keller', 'emp-nora-weiss', 'ins-stapler'), /Team/);
});
