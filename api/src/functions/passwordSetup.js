import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { hashPassword } from '../lib/passwordAuth.js';
import { hashSetupToken } from '../lib/passwordSetup.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

const INVALID_SETUP = 'Setup-Link ist ungültig oder abgelaufen.';

function requestMeta(request, user = null) {
  return {
    companyId: user?.companyId || null,
    userId: user?.userId || null,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('client-ip') || null,
    userAgent: request.headers.get('user-agent') || null
  };
}

app.http('passwordSetupConsume', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/password/setup',
  handler: async (request, context) => {
    let transaction;
    try {
      const body = await request.json().catch(() => ({}));
      const token = String(body.token || '');
      const password = String(body.password || '');
      const passwordConfirm = String(body.passwordConfirm || '');
      if (!token || token.length < 32) return badRequest(INVALID_SETUP);
      if (password !== passwordConfirm) return badRequest('Die Passwörter stimmen nicht überein.');
      if (password.length < 10 || password.length > 256) return badRequest('Passwort muss zwischen 10 und 256 Zeichen lang sein.');

      const tokenHash = hashSetupToken(token);
      const passwordHash = await hashPassword(password);
      const pool = await getPool();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      const lookup = await new sql.Request(transaction)
        .input('tokenHash', sql.NVarChar(128), tokenHash)
        .query(`SELECT TOP 2 t.id,t.userId,t.companyId,t.purpose,u.passwordHash,u.passwordSetAt
                FROM dbo.PasswordSetupTokens t WITH (UPDLOCK,HOLDLOCK)
                JOIN dbo.Users u WITH (UPDLOCK,HOLDLOCK)
                  ON u.id=t.userId AND u.companyId=t.companyId
                WHERE t.tokenHash=@tokenHash
                  AND t.usedAt IS NULL
                  AND t.expiresAt>SYSUTCDATETIME()
                  AND u.active=1`);

      if (lookup.recordset.length !== 1) {
        await transaction.rollback();
        transaction = null;
        return badRequest(INVALID_SETUP);
      }

      const target = lookup.recordset[0];
      if (target.purpose === 'initial_password' && (target.passwordHash || target.passwordSetAt)) {
        await transaction.rollback();
        transaction = null;
        return badRequest(INVALID_SETUP);
      }

      await new sql.Request(transaction)
        .input('userId', sql.NVarChar(120), target.userId)
        .input('companyId', sql.NVarChar(80), target.companyId)
        .input('passwordHash', sql.NVarChar(600), passwordHash)
        .query(`UPDATE dbo.Users
                SET passwordHash=@passwordHash,
                    passwordSetAt=SYSUTCDATETIME(),
                    failedLoginCount=0,
                    lockedUntil=NULL,
                    sessionVersion=sessionVersion+1,
                    provider=CASE WHEN provider='aad' THEN 'dual' WHEN provider IS NULL THEN 'password' ELSE provider END,
                    updatedAt=SYSUTCDATETIME()
                WHERE id=@userId AND companyId=@companyId;

                UPDATE dbo.PasswordSetupTokens
                SET usedAt=SYSUTCDATETIME()
                WHERE companyId=@companyId AND userId=@userId AND usedAt IS NULL;`);

      await transaction.commit();
      transaction = null;

      await writeSecurityEvent(
        pool,
        requestMeta(request, { companyId: target.companyId, userId: target.userId }),
        'auth.password.setupSucceeded',
        'info',
        { userId: target.userId, companyId: target.companyId, purpose: target.purpose }
      );
      return json({ ok: true });
    } catch (err) {
      if (transaction) {
        try { await transaction.rollback(); } catch {}
      }
      return serverError(err, context);
    }
  }
});
