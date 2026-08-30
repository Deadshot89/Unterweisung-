import fs from 'fs/promises';
import crypto from 'crypto';

const file = process.argv[2];
if (!file) {
  console.error('Bitte Backup-Datei angeben: node scripts/verify-backup.js backups/datei.json');
  process.exit(1);
}

const text = await fs.readFile(file, 'utf8');
const data = JSON.parse(text);
const requiredTables = ['Companies','Employees','InstructionTypes','InstructionRecords','Files'];
const missing = requiredTables.filter(t => !data.tables || !Array.isArray(data.tables[t]));
const sha256 = crypto.createHash('sha256').update(text).digest('hex');
const counts = data.tables ? Object.fromEntries(Object.entries(data.tables).map(([k,v]) => [k, Array.isArray(v) ? v.length : null])) : {};
console.log(JSON.stringify({ ok: missing.length === 0, file, sha256, metadata: data.metadata || null, missing, counts }, null, 2));
if (missing.length) process.exit(2);
