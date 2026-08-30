import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sql from 'mssql';

const connectionString = process.env.SQL_CONNECTION_STRING;
const companyId = process.env.COMPANY_ID || process.env.DEFAULT_COMPANY_ID || process.argv[2] || 'company-essentra';
const outDir = process.env.BACKUP_OUT_DIR || path.resolve('backups');

if (!connectionString) {
  console.error('SQL_CONNECTION_STRING fehlt.');
  process.exit(1);
}

const tables = [
  'Companies','CompanySettings','Employees','Templates','InstructionTypes','EmployeeInstructionExclusions',
  'InstructionRecords','PlannedTrainings','TrainingParticipants','ExternalInvitations','TestQuestions','TestResults','Files','Users'
];

function whereFor(table) {
  return table === 'Companies' ? 'WHERE id=@companyId' : 'WHERE companyId=@companyId';
}

const pool = await sql.connect(connectionString);
try {
  const backup = { metadata: { companyId, createdAt: new Date().toISOString(), source: 'scripts/export-backup.js', tables }, tables: {} };
  for (const table of tables) {
    const result = await pool.request().input('companyId', sql.NVarChar(80), companyId).query(`SELECT * FROM dbo.${table} ${whereFor(table)}`);
    backup.tables[table] = result.recordset || [];
  }
  await fs.mkdir(outDir, { recursive: true });
  const json = JSON.stringify(backup, null, 2);
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  const file = path.join(outDir, `unterweisungsmanager-backup-${companyId}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  await fs.writeFile(file, json, 'utf8');
  console.log(JSON.stringify({ ok: true, file, sha256: hash, bytes: Buffer.byteLength(json), counts: Object.fromEntries(Object.entries(backup.tables).map(([k,v]) => [k, v.length])) }, null, 2));
} finally {
  await pool.close();
}
