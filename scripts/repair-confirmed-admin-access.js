import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { getPool, sql } from '../api/src/lib/db.js';

// Explicit operator repair, never called by an HTTP endpoint or ordinary login.
// Dry-run uses the same transaction and verification, then rolls everything back.
const email = String(process.env.ACCESS_REPAIR_EMAIL || '').trim().toLowerCase();
const companyId = String(process.env.ACCESS_REPAIR_COMPANY_ID || '').trim();
const displayName = String(process.env.ACCESS_REPAIR_DISPLAY_NAME || '').trim();
assert.ok(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254, 'A valid confirmed account email is required');
assert.ok(companyId && companyId.length <= 80, 'A target company is required');
assert.ok(displayName && displayName.length <= 200, 'A display name is required');
assert.ok(process.argv.length === 3 && ['--dry-run', '--apply'].includes(process.argv[2]), 'Choose --dry-run or --apply explicitly');

const apply = process.argv[2] === '--apply';
const eventType = 'user.access.repaired.v0361';
const repairKey = createHash('sha256').update(`${companyId}\n${email}`).digest('hex');
let pool;
let tx;
let transactionOpen = false;

try {
  pool = await getPool();
  tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  transactionOpen = true;
  const request = () => new sql.Request(tx)
    .input('email', sql.NVarChar(254), email)
    .input('companyId', sql.NVarChar(80), companyId)
    .input('eventType', sql.NVarChar(120), eventType)
    .input('repairKey', sql.NVarChar(64), repairKey);

  await request().input('lockName', sql.NVarChar(255), `confirmed-access-repair:${repairKey}`)
    .query(`DECLARE @lockResult INT;
      EXEC @lockResult = sys.sp_getapplock @Resource=@lockName,
        @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
      IF @lockResult < 0 THROW 51000, 'Account repair lock could not be acquired', 1;`);

  const receipt = await request().query(`SELECT TOP 1 id FROM dbo.SecurityEvents
    WHERE companyId=@companyId AND eventType=@eventType
      AND JSON_VALUE(detailsJson, '$.repairKey')=@repairKey`);
  if (receipt.recordset.length) {
    await tx.rollback();
    transactionOpen = false;
    console.log(JSON.stringify({ status: 'previously_applied', subsequentAccountChangesPreserved: true }));
  } else {
    const company = await request().query('SELECT id FROM dbo.Companies WHERE id=@companyId AND active=1');
    assert.equal(company.recordset.length, 1, 'The target company must exist and be active');

    const before = await request().query(`SELECT id, role, active FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
      WHERE companyId=@companyId AND LOWER(LTRIM(RTRIM(email)))=@email`);
    assert.ok(before.recordset.length <= 1, 'Ambiguous account records require manual resolution');
    const existing = before.recordset[0];
    const userId = existing?.id || `user-${randomUUID()}`;
    const role = existing?.role === 'system_admin' ? 'system_admin' : 'company_admin';

    const update = request()
      .input('id', sql.NVarChar(120), userId)
      .input('displayName', sql.NVarChar(200), displayName)
      .input('role', sql.NVarChar(60), role);
    if (existing) {
      await update.query(`UPDATE dbo.Users SET email=@email, displayName=@displayName,
        role=@role, active=1, updatedAt=SYSUTCDATETIME()
        WHERE id=@id AND companyId=@companyId`);
    } else {
      await update.query(`INSERT INTO dbo.Users(id, companyId, email, displayName, role, active, provider, invitedAt)
        VALUES(@id, @companyId, @email, @displayName, @role, 1, 'aad', SYSUTCDATETIME())`);
    }

    // This is the email predicate used by getAuthorizedContext; no fabricated
    // Microsoft headers or bypass flags are involved in this verification.
    const after = await request().query(`SELECT id, companyId, role, active FROM dbo.Users
      WHERE active=1 AND LOWER(email)=LOWER(@email)`);
    const matches = after.recordset.filter(row => row.companyId === companyId);
    assert.equal(matches.length, 1, 'The confirmed login must resolve to exactly one account in the target company');
    assert.equal(matches[0].id, userId);
    assert.equal(matches[0].role, role);

    await request()
      .input('actor', sql.NVarChar(120), 'github-actions-confirmed-account-repair')
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ repairKey, userId, role,
        previousRole: existing?.role || null, previousActive: existing?.active ?? null,
        runId: process.env.GITHUB_RUN_ID || null }))
      .query(`INSERT INTO dbo.SecurityEvents(companyId, actorUserId, eventType, severity, detailsJson)
        VALUES(@companyId, @actor, @eventType, 'info', @details)`);

    if (apply) await tx.commit();
    else await tx.rollback();
    transactionOpen = false;
    console.log(JSON.stringify({ status: apply ? 'applied_and_verified' : 'dry_run_verified_rolled_back',
      change: existing ? 'updated' : 'created', companyId, role, active: true }));
  }
} catch (error) {
  if (transactionOpen) await tx.rollback().catch(() => {});
  // Keep SQL connection details and account values out of public runner logs.
  console.error(`Confirmed account repair failed (${error.code || error.name || 'error'}).`);
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
