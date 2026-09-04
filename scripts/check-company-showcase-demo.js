import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoRoot = path.join(root, 'frontend', 'demo');
const sharedLearningCore = path.join(root, 'frontend', 'learning-experience-v38.js');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = [
  ...walk(demoRoot).filter(file => /\.(?:html|js|css|svg)$/i.test(file)),
  sharedLearningCore
];
const forbidden = [
  ['network request', /fetch\s*\(/],
  ['XHR request', /XMLHttpRequest/],
  ['API route', /\/api\//],
  ['auth route', /\.auth\//],
  ['Azure Blob endpoint', /blob\.core\.windows\.net/i],
  ['production company id', /company-essentra/i],
  ['production company reference', /essentra/i],
  ['real mail provider domain', /@(gmail|outlook|hotmail)\./i]
];

const failures = [];
for (const file of files) {
  if (!fs.existsSync(file)) {
    failures.push(`${path.relative(root,file)}: Datei fehlt`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) failures.push(`${path.relative(root,file)}: ${label}`);
  }
}

const index = fs.readFileSync(path.join(demoRoot, 'index.html'), 'utf8');
if (!index.includes('DEMO – ausschließlich Beispieldaten')) failures.push('index.html: Demo-Hinweis fehlt');
if (!index.includes('Musterwerk Solutions GmbH')) failures.push('index.html: Demo-Firma fehlt');
if (!index.includes('../learning-experience-v38.js')) failures.push('index.html: gemeinsamer Lernkern fehlt');
if (!index.includes('../learning-experience-v38.css')) failures.push('index.html: gemeinsames Lernstylesheet fehlt');

if (failures.length) {
  console.error('Company showcase demo check FAILED');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`Company showcase demo check OK (${files.length} Dateien, keine Netzwerk-/Echtdaten-Verbindung)`);
