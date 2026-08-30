import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sql from 'mssql';

const connectionString = process.env.SQL_CONNECTION_STRING;
if (!connectionString) {
  console.error('SQL_CONNECTION_STRING fehlt. Beispiel: SQL_CONNECTION_STRING="..." npm run db:migrate');
  process.exit(1);
}

const migrationsDir = path.resolve('database/migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

function splitGoBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*$/gim)
    .map(s => s.trim())
    .filter(Boolean);
}

function checksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const pool = await sql.connect(connectionString);
try {
  await pool.request().query(`IF OBJECT_ID('dbo.DbMigrations','U') IS NULL
    CREATE TABLE dbo.DbMigrations(id NVARCHAR(180) NOT NULL PRIMARY KEY, appliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), checksum NVARCHAR(128) NULL);`);

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const text = fs.readFileSync(full, 'utf8');
    const hash = checksum(text);
    const existing = await pool.request().input('id', sql.NVarChar(180), file)
      .query('SELECT id, checksum FROM dbo.DbMigrations WHERE id=@id');
    if (existing.recordset.length) {
      console.log('✓ bereits angewendet:', file);
      continue;
    }

    console.log('→ Migration:', file);
    for (const batch of splitGoBatches(text)) {
      await pool.request().query(batch);
    }
    await pool.request()
      .input('id', sql.NVarChar(180), file)
      .input('checksum', sql.NVarChar(128), hash)
      .query('INSERT INTO dbo.DbMigrations(id, checksum) VALUES(@id, @checksum)');
    console.log('✓ angewendet:', file);
  }
  console.log('Alle Migrationen abgeschlossen.');
} catch (err) {
  console.error('Migration fehlgeschlagen:', err.message);
  throw err;
} finally {
  await pool.close();
}
