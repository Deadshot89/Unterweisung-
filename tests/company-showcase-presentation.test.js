import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const demo = name => path.join(root, 'frontend', 'demo', name);

test('showcase opens with a decision-maker intro and guided tour entry', () => {
  const html = fs.readFileSync(demo('index.html'), 'utf8');
  assert.match(html, /id="showcaseIntro"/);
  assert.match(html, /Warum Unterweisungsmanager\?/);
  assert.match(html, /Geführte Tour starten/);
  assert.match(html, /Vom Überblick bis zum Nachweis/);
});

test('guided tour stays inside the local demo and covers the key presentation roles', () => {
  const file = demo('presentation-guide.js');
  assert.equal(fs.existsSync(file), true, 'presentation-guide.js fehlt');
  const guide = fs.readFileSync(file, 'utf8');
  for (const marker of ['company_admin','line_manager','employee','dashboard','planning','proofs','Online-Unterweisung']) {
    assert.match(guide, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(guide, /fetch\s*\(|XMLHttpRequest|\/api\/|\.auth\//);
});

test('business value copy avoids fabricated savings claims', () => {
  const html = fs.readFileSync(demo('index.html'), 'utf8');
  assert.doesNotMatch(html, /\b\d+\s*%\s*(?:Ersparnis|weniger Aufwand|Zeitersparnis)/i);
  assert.doesNotMatch(html, /\b\d+[\d.,]*\s*€\s*(?:Ersparnis|sparen|gespart)/i);
});
