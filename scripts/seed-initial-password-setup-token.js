import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';

const OPERATOR_EMAIL = 'unterweisungmanagment@outlook.de';
const connectionString = String(process.env.SQL_CONNECTION_STRING || '').trim();
const tokenHash = String(process.env.PASSWORD_SETUP_TOKEN_HASH || '').trim();

for (const forbidden of ['PASSWORD_SETUP_TOKEN','RAW_TOKEN','PLAINTEXT_PASSWORD','PASSWORD']) {
  if (Object.prototype.hasOwnProperty.call(process.env, forbidden) && String(process.env[forbidden] || '').length) {
    throw new Error(`Unsichere Bootstrap-Variable ist nicht erlaubt: ${forbidden}`);
  }
}

if (!connectionString) throw new Error('SQL_CONNECTION_STRING fehlt.');
if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw new Error('PASSWORD_SETUP_TOKEN_HASH muss ein 64-stelliger SHA-256-Hash in Kleinbuchstaben sein.');

let pool;
let transaction;
try {
  pool = await sql.connect(connectionString);
  transaction = new sql.Transaction(pool);
  await transaction.begin();

  const companyResult = await new sql.Request(transaction)
    .query(`SELECT TOP 1 id
            FROM dbo.Companies WITH (UPDLOCK,HOLDLOCK)
            WHERE active=1
            ORDER BY createdAt,id`);
  if (companyResult.recordset.length !== 1) throw new Error('Für den Betreiber-Bootstrap wird genau eine auswählbare aktive Startfirma benötigt.');
  const companyId = companyResult.recordset[0].id;

  const existingResult = await new sql.Request(transaction)
    .input('operatorEmail', sql.NVarChar(254), OPERATOR_EMAIL)
    .query(`SELECT id,companyId,email,role,active,passwordHash,passwordSetAt
            FROM dbo.Users WITH (UPDLOCK,HOLDLOCK)
            WHERE LOWER(email)=LOWER(@operatorEmail)`);

  if (existingResult.recordset.length > 1) throw new Error('Der Betreiber-Zugang ist mehrfach vorhanden. Bootstrap wurde abgebrochen.');

  let userId;
  if (existingResult.recordset.length === 0) {
    userId = 'user-system-admin-operator';
    await new sql.Request(transaction)
      .input('id', sql.NVarChar(120), userId)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('email', sql.NVarChar(254), OPERATOR_EMAIL)
      .input('displayName', sql.NVarChar(200), 'Systemadministrator')
      .query(`INSERT INTO dbo.Users(id,companyId,email,displayName,role,active,provider,invitedAt,createdAt,updatedAt)
              VALUES(@id,@companyId,@email,@displayName,'system_admin',1,'password',SYSUTCDATETIME(),SYSUTCDATETIME(),SYSUTCDATETIME())`);
  } else {
    const existing = existingResult.recordset[0];
    if (existing.passwordHash || existing.passwordSetAt) throw new Error('Der Betreiber-Zugang besitzt bereits ein Passwort; ein Initial-Setup ist nicht mehr zulässig.');
    userId = existing.id;
    await new sql.Request(transaction)
      .input('id', sql.NVarChar(120), userId)
      .query(`UPDATE dbo.Users
              SET role='system_admin',active=1,updatedAt=SYSUTCDATETIME()
              WHERE id=@id`);
  }

  const candidateResult = await new sql.Request(transaction)
    .input('operatorEmail', sql.NVarChar(254), OPERATOR_EMAIL)
    .query(`SELECT id,companyId
            FROM dbo.Users WITH (UPDLOCK,HOLDLOCK)
            WHERE LOWER(email)=LOWER(@operatorEmail)
              AND role='system_admin'
              AND active=1
              AND passwordHash IS NULL
              AND passwordSetAt IS NULL`);
  if (candidateResult.recordset.length !== 1) throw new Error('Der Betreiber-Bootstrap konnte nicht eindeutig vorbereitet werden.');

  const candidate = candidateResult.recordset[0];
  await new sql.Request(transaction)
    .input('userId', sql.NVarChar(120), candidate.id)
    .input('companyId', sql.NVarChar(80), candidate.companyId)
    .query(`UPDATE dbo.PasswordSetupTokens
            SET usedAt=SYSUTCDATETIME()
            WHERE userId=@userId AND companyId=@companyId AND usedAt IS NULL`);

  await new sql.Request(transaction)
    .input('id', sql.NVarChar(80), `pst-${uuidv4()}`)
    .input('userId', sql.NVarChar(120), candidate.id)
    .input('companyId', sql.NVarChar(80), candidate.companyId)
    .input('tokenHash', sql.NVarChar(128), tokenHash)
    .input('purpose', sql.NVarChar(30), 'initial_password')
    .input('createdBy', sql.NVarChar(120), 'operator-bootstrap')
    .query(`INSERT INTO dbo.PasswordSetupTokens(id,userId,companyId,tokenHash,purpose,expiresAt,createdBy)
            VALUES(@id,@userId,@companyId,@tokenHash,@purpose,DATEADD(MINUTE,30,SYSUTCDATETIME()),@createdBy)`);

  await transaction.commit();
  transaction = null;
  console.log('Initial password setup token hash seeded for one system admin.');
} catch (error) {
  if (transaction) {
    try { await transaction.rollback(); } catch {}
  }
  throw error;
} finally {
  if (pool) await pool.close();
}
