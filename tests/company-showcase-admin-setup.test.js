import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_DATA } from '../frontend/demo/demo-data.js';
import { createDemoStore } from '../frontend/demo/demo-store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function memoryStorage() {
  const bag = new Map();
  return {
    getItem:key => bag.has(key) ? bag.get(key) : null,
    setItem:(key,value) => bag.set(key, String(value)),
    removeItem:key => bag.delete(key)
  };
}

test('admin and main demo modules share one store for the same browser storage', () => {
  const storage = memoryStorage();
  const mainStore = createDemoStore(DEMO_DATA, storage);
  const adminStore = createDemoStore(DEMO_DATA, storage);
  assert.equal(adminStore, mainStore);
});

test('admin setup mutations are rejected for employee role', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  store.setRole('employee', 'emp-mila-hartmann');
  assert.throws(() => store.updateCompanyProfile({ name:'Andere Demo GmbH' }), /Admin/);
  assert.throws(() => store.saveEmployee({ name:'Demo Person', email:'demo.person@musterwerk.example', department:'Produktion', jobTitle:'Montage', role:'employee' }), /Admin/);
  assert.throws(() => store.saveInstruction({ name:'Neue Unterweisung', category:'Demo', deliveryMode:'online', intervalMonths:12 }), /Admin/);
});

test('company profile changes locally and reset restores Musterwerk baseline', () => {
  const storage = memoryStorage();
  const store = createDemoStore(DEMO_DATA, storage);
  const company = store.updateCompanyProfile({ name:'Nordwerk Demo GmbH', industry:'Maschinenbau', location:'Düsseldorf' });
  assert.equal(company.name, 'Nordwerk Demo GmbH');
  assert.equal(store.getState().company.industry, 'Maschinenbau');
  store.reset();
  assert.equal(store.getState().company.name, 'Musterwerk Solutions GmbH');
});

test('employee editor creates and updates only example-domain demo identities', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  assert.throws(() => store.saveEmployee({ name:'Max Demo', email:'max@example.com', department:'Technik', jobTitle:'Techniker', role:'employee' }), /\.example/);
  const created = store.saveEmployee({ name:'Max Demo', email:'max@neufirma.example', department:'Technik', jobTitle:'Techniker', role:'employee', lineManagerId:'emp-luca-richter' });
  assert.match(created.id, /^emp-demo-/);
  assert.equal(store.getState().employees.length, 16);
  const updated = store.saveEmployee({ ...created, jobTitle:'Servicetechniker' });
  assert.equal(updated.jobTitle, 'Servicetechniker');
  assert.equal(store.getState().employees.length, 16);
});

test('online instruction editor creates three learning steps and practical mode disables tests', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  const online = store.saveInstruction({ name:'Maschinensicherheit Demo', category:'Arbeitsschutz', description:'Sicher an Maschinen arbeiten.', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12 });
  assert.match(online.id, /^ins-demo-/);
  assert.equal(store.getState().learningSteps.filter(step => step.instructionId === online.id).length, 3);
  const practical = store.saveInstruction({ name:'Leiterprüfung Demo', category:'Praxis', description:'Praktische Einweisung.', deliveryMode:'practical', testRequired:true, passPercent:90, intervalMonths:12 });
  assert.equal(practical.testRequired, false);
  assert.equal(store.getState().learningSteps.filter(step => step.instructionId === practical.id).length, 0);
});

test('learning-step editor persists title and explanation without replacing its image', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  const before = store.getState().learningSteps.find(item => item.instructionId === 'ins-arbeitsschutz');
  const saved = store.saveLearningStep('ins-arbeitsschutz', before.id, { title:'Neue Überschrift', text:'Neue Erklärung für die Demo.' });
  assert.equal(saved.title, 'Neue Überschrift');
  assert.equal(saved.text, 'Neue Erklärung für die Demo.');
  assert.equal(saved.image, before.image);
});

test('instruction assignment is idempotent across repeated employee selection', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  const before = store.getState().assignments.length;
  const first = store.assignInstruction('ins-phishing', ['emp-mila-hartmann','emp-david-sommer'], '2026-10-01');
  const afterFirst = store.getState().assignments.length;
  const second = store.assignInstruction('ins-phishing', ['emp-mila-hartmann','emp-david-sommer'], '2026-10-01');
  assert.ok(afterFirst >= before);
  assert.equal(store.getState().assignments.length, afterFirst);
  assert.ok(first.length >= 0);
  assert.equal(second.length, 0);
});

test('learning image accepts local PNG JPEG WEBP data only within 1.5 MB', () => {
  const store = createDemoStore(DEMO_DATA, memoryStorage());
  const step = store.getState().learningSteps.find(item => item.instructionId === 'ins-arbeitsschutz');
  assert.throws(() => store.setLearningStepImage('ins-arbeitsschutz', step.id, 'https://example.com/image.png', 100), /Bildformat/);
  assert.throws(() => store.setLearningStepImage('ins-arbeitsschutz', step.id, 'data:image/gif;base64,R0lGODlh', 100), /Bildformat/);
  assert.throws(() => store.setLearningStepImage('ins-arbeitsschutz', step.id, 'data:image/png;base64,AA==', 1572865), /1,5 MB/);
  const saved = store.setLearningStepImage('ins-arbeitsschutz', step.id, 'data:image/webp;base64,AA==', 128);
  assert.match(saved.image, /^data:image\/webp;base64,/);
});

test('admin setup UI exists as a focused module and is wired as an admin navigation view', () => {
  const adminPath = path.join(root, 'frontend/demo/demo-admin.js');
  assert.equal(fs.existsSync(adminPath), true, 'demo-admin.js must exist');
  const admin = fs.readFileSync(adminPath, 'utf8');
  const index = fs.readFileSync(path.join(root, 'frontend/demo/index.html'), 'utf8');
  for (const marker of ['Unternehmensprofil','Mitarbeitende','Unterweisung','Zuweisung','FileReader','accept=".png,.jpg,.jpeg,.webp"',"['setup','Einrichtung']"]) assert.match(admin, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(index, /demo-admin\.css/);
  assert.match(index, /demo-admin\.js/);
});
