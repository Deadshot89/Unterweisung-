import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const file = process.argv[2] || path.resolve('database/seed_essentra_data.json');
const connectionString = process.env.SQL_CONNECTION_STRING;
if (!connectionString) {
  console.error('SQL_CONNECTION_STRING fehlt. Beispiel: SQL_CONNECTION_STRING="..." node scripts/import-startdata.js');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const companyId = data.companies?.[0]?.id || 'company-essentra';

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pool = await sql.connect(connectionString);
const tx = new sql.Transaction(pool);
await tx.begin();
try {
  const req = new sql.Request(tx);
  await req.input('id', sql.NVarChar(80), companyId)
    .input('name', sql.NVarChar(200), data.companies?.[0]?.name || data.settings?.companyName || 'Essentra Components GmbH')
    .query(`MERGE Companies AS t USING (SELECT @id AS id, @name AS name) AS s
            ON t.id=s.id WHEN MATCHED THEN UPDATE SET name=s.name, active=1, updatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT(id,name,active) VALUES(s.id,s.name,1);`);


  await new sql.Request(tx)
    .input('companyId', sql.NVarChar(80), companyId)
    .input('yellowWarningDays', sql.Int, Number(data.settings?.reminderDays || 60))
    .input('orangeCriticalDays', sql.Int, Number(data.settings?.criticalDays || 30))
    .input('defaultResponsibleEmail', sql.NVarChar(254), data.settings?.responsibleEmail || null)
    .input('hseEmail', sql.NVarChar(254), data.settings?.hseEmail || 'DennisJeschick@essentra.com')
    .query(`MERGE CompanySettings AS t USING (SELECT @companyId AS companyId) AS s ON t.companyId=s.companyId
            WHEN MATCHED THEN UPDATE SET yellowWarningDays=@yellowWarningDays, orangeCriticalDays=@orangeCriticalDays,
              defaultResponsibleEmail=@defaultResponsibleEmail, hseEmail=@hseEmail, updatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT(companyId,yellowWarningDays,orangeCriticalDays,defaultResponsibleEmail,hseEmail,updatedAt)
              VALUES(@companyId,@yellowWarningDays,@orangeCriticalDays,@defaultResponsibleEmail,@hseEmail,SYSUTCDATETIME());`);

  for (const tpl of data.templates || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), tpl.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('title', sql.NVarChar(240), tpl.title)
      .input('fileName', sql.NVarChar(260), tpl.fileName)
      .input('blobPath', sql.NVarChar(500), tpl.blobPath || `${companyId}/templates/${tpl.fileName}`)
      .input('category', sql.NVarChar(120), tpl.category || null)
      .input('description', sql.NVarChar(sql.MAX), tpl.description || null)
      .query(`MERGE Templates AS t USING (SELECT @id AS id) AS s ON t.id=s.id
              WHEN MATCHED THEN UPDATE SET title=@title,fileName=@fileName,blobPath=@blobPath,category=@category,description=@description,active=1
              WHEN NOT MATCHED THEN INSERT(id,companyId,title,fileName,blobPath,category,description,active)
              VALUES(@id,@companyId,@title,@fileName,@blobPath,@category,@description,1);`);
  }

  for (const e of data.employees || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), e.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('name', sql.NVarChar(200), e.name)
      .input('chipNr', sql.NVarChar(80), e.chipNr || null)
      .input('email', sql.NVarChar(254), e.email || null)
      .input('department', sql.NVarChar(120), e.department || null)
      .input('role', sql.NVarChar(60), e.role || 'Mitarbeiter')
      .input('title', sql.NVarChar(200), e.title || null)
      .input('active', sql.Bit, e.active === false ? 0 : 1)
      .query(`MERGE Employees AS t USING (SELECT @id AS id) AS s ON t.id=s.id
              WHEN MATCHED THEN UPDATE SET name=@name,chipNr=@chipNr,email=@email,department=@department,role=@role,title=@title,active=@active,updatedAt=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT(id,companyId,name,chipNr,email,department,role,title,active)
              VALUES(@id,@companyId,@name,@chipNr,@email,@department,@role,@title,@active);`);
  }
  // lineManagerId separat nach allen Employees setzen
  for (const e of data.employees || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), e.id)
      .input('lineManagerId', sql.NVarChar(80), e.shiftLeaderId || null)
      .query('UPDATE Employees SET lineManagerId=@lineManagerId WHERE id=@id');
  }

  for (const t of data.types || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), t.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('name', sql.NVarChar(200), t.name)
      .input('category', sql.NVarChar(120), t.category || 'Unterweisung')
      .input('intervalMonths', sql.Int, t.intervalMonths || 12)
      .input('description', sql.NVarChar(sql.MAX), t.description || null)
      .input('templateId', sql.NVarChar(80), t.templateId || null)
      .query(`MERGE InstructionTypes AS i USING (SELECT @id AS id) AS s ON i.id=s.id
              WHEN MATCHED THEN UPDATE SET name=@name,category=@category,intervalMonths=@intervalMonths,description=@description,templateId=@templateId,active=1,updatedAt=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT(id,companyId,name,category,intervalMonths,description,templateId,active)
              VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1);`);
  }

  for (const r of data.records || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), r.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('employeeId', sql.NVarChar(80), r.employeeId || null)
      .input('typeId', sql.NVarChar(80), r.typeId)
      .input('conductedAt', sql.DateTime2, asDate(r.date) || new Date())
      .input('validUntil', sql.DateTime2, asDate(r.nextDue))
      .input('status', sql.NVarChar(40), r.status || 'completed')
      .input('source', sql.NVarChar(40), 'import_v24')
      .query(`IF NOT EXISTS(SELECT 1 FROM InstructionRecords WHERE id=@id)
              INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source)
              VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source);`);
  }

  await tx.commit();
  console.log('Import abgeschlossen:', {
    companyId,
    employees: data.employees?.length || 0,
    types: data.types?.length || 0,
    templates: data.templates?.length || 0,
    records: data.records?.length || 0
  });
} catch (err) {
  await tx.rollback();
  console.error(err);
  process.exit(1);
} finally {
  await pool.close();
}
