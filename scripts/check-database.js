import sql from 'mssql';

const connectionString = process.env.SQL_CONNECTION_STRING;
if (!connectionString) {
  console.error('SQL_CONNECTION_STRING fehlt.');
  process.exit(1);
}

const requiredTables = [
  'Companies','CompanySettings','Users','Employees','Templates','InstructionTypes','EmployeeInstructionExclusions',
  'InstructionRecords','PlannedTrainings','TrainingParticipants','ExternalInvitations','TestQuestions','TestResults','Files','AuditLog'
];
const requiredViews = ['vInstructionStatus','vManagerTrainingTimeMonthly'];

const pool = await sql.connect(connectionString);
try {
  const db = await pool.request().query('SELECT SYSUTCDATETIME() AS utcNow, DB_NAME() AS databaseName');
  const objects = await pool.request().query(`SELECT name, type_desc FROM sys.objects WHERE name IN (${[...requiredTables, ...requiredViews].map(x=>`'${x.replaceAll("'", "''")}'`).join(',')})`);
  const names = new Set(objects.recordset.map(r => r.name));
  const missingTables = requiredTables.filter(t => !names.has(t));
  const missingViews = requiredViews.filter(v => !names.has(v));
  const counts = {};
  for (const t of ['Companies','Employees','InstructionTypes','Templates','InstructionRecords']) {
    if (names.has(t)) {
      const c = await pool.request().query(`SELECT COUNT(*) AS count FROM dbo.${t}`);
      counts[t] = c.recordset[0].count;
    }
  }
  console.log(JSON.stringify({
    ok: missingTables.length === 0 && missingViews.length === 0,
    database: db.recordset[0].databaseName,
    utcNow: db.recordset[0].utcNow,
    missingTables,
    missingViews,
    counts
  }, null, 2));
  if (missingTables.length || missingViews.length) process.exit(2);
} finally {
  await pool.close();
}
