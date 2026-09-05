import { app } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { getAuthorizedContext, assertRole, Roles } from '../lib/auth.js';
import { hashPassword } from '../lib/passwordAuth.js';
import { createSetupToken, hashSetupToken, setupLink } from '../lib/passwordSetup.js';
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
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return badRequest(INVALID_SETUP);
      if (password !== passwordConfirm) return badRequest('Die Passwörter stimmen nicht überein.');
      if (password.length < 10 || password.length > 256) return badRequest('Passwort muss zwischen 10 und 256 Zeichen lang sein.');

      const tokenHash = hashSetupToken(token);
      const pool = await getPool();
      const preflight = await pool.request()
        .input('tokenHash', sql.NVarChar(128), tokenHash)
        .query(`SELECT TOP 2 t.id
                FROM dbo.PasswordSetupTokens t
                JOIN dbo.Users u ON u.id=t.userId AND u.companyId=t.companyId
                WHERE t.tokenHash=@tokenHash
                  AND t.usedAt IS NULL
                  AND t.expiresAt>SYSUTCDATETIME()
                  AND u.active=1`);
      if (preflight.recordset.length !== 1) return badRequest(INVALID_SETUP);

      const passwordHash = await hashPassword(password);
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

app.http('passwordSetupLinkCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users/{id}/password-setup-link',
  handler: async (request, context) => {
    let transaction;
    try {
      const ctx = await getAuthorizedContext(request);
      assertRole(ctx, [Roles.SYSTEM_ADMIN, Roles.COMPANY_ADMIN]);
      if (!ctx.companyId) return badRequest('Bitte zuerst eine Firma auswählen.');
      const id = String(request.params.id || '').trim().slice(0, 120);
      if (!id) return badRequest('id is required');

      const pool = await getPool();
      const targetResult = await pool.request()
        .input('id', sql.NVarChar(120), id)
        .input('companyId', sql.NVarChar(80), ctx.companyId)
        .query(`SELECT TOP 1 id,companyId,role,active,passwordHash
                FROM Users WHERE id=@id AND companyId=@companyId`);
      const target = targetResult.recordset[0];
      if (!target || !target.active) {
        const err = new Error('Benutzer nicht gefunden oder nicht aktiv.');
        err.status = 404;
        throw err;
      }
      if (target.role===Roles.SYSTEM_ADMIN && !ctx.roles.includes(Roles.SYSTEM_ADMIN)) {
        const err = new Error('Keine Berechtigung für Systemadmin-Zugang');
        err.status = 403;
        throw err;
      }

      const rawToken = createSetupToken();
      const tokenHash = hashSetupToken(rawToken);
      const purpose = target.passwordHash ? 'password_reset' : 'initial_password';
      const tokenId = `pst-${uuidv4()}`;

      transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        await new sql.Request(transaction)
          .input('id', sql.NVarChar(80), tokenId)
          .input('userId', sql.NVarChar(120), target.id)
          .input('companyId', sql.NVarChar(80), target.companyId)
          .input('tokenHash', sql.NVarChar(128), tokenHash)
          .input('purpose', sql.NVarChar(30), purpose)
          .input('createdBy', sql.NVarChar(120), ctx.userId || null)
          .query(`UPDATE dbo.PasswordSetupTokens
                  SET usedAt=SYSUTCDATETIME()
                  WHERE companyId=@companyId AND userId=@userId AND usedAt IS NULL;

                  INSERT INTO dbo.PasswordSetupTokens(id,userId,companyId,tokenHash,purpose,expiresAt,createdBy)
                  VALUES(@id,@userId,@companyId,@tokenHash,@purpose,DATEADD(MINUTE,30,SYSUTCDATETIME()),@createdBy);`);
        await transaction.commit();
        transaction = null;
      } catch (err) {
        await transaction.rollback();
        transaction = null;
        throw err;
      }

      await writeSecurityEvent(
        pool,
        ctx,
        'auth.password.setupLinkCreated',
        'info',
        { targetUserId: target.id, companyId: target.companyId, purpose }
      );
      const url = setupLink(rawToken, new URL(request.url).origin);
      return json({ ok: true, url, expiresInMinutes: 30, purpose });
    } catch (err) {
      if (transaction) {
        try { await transaction.rollback(); } catch {}
      }
      return serverError(err, context);
    }
  }
});
