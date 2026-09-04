import { app } from '@azure/functions';
import { getPool, sql } from '../lib/db.js';
import { json, badRequest, serverError } from '../lib/http.js';
import { verifyPassword, createSessionToken, sessionCookie, clearSessionCookie, sessionSecret } from '../lib/passwordAuth.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

function normEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function requestMeta(request) {
  return {
    companyId: null,
    userId: null,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('client-ip') || null,
    userAgent: request.headers.get('user-agent') || null
  };
}

function responseWithCookie(body, cookie, status = 200) {
  const response = json(body, status);
  response.headers = { ...(response.headers || {}), 'set-cookie': cookie };
  return response;
}

app.http('passwordAuthLogin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/password/login',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const email = normEmail(body.email);
      const password = String(body.password || '');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('Gültige E-Mail-Adresse fehlt.');
      if (!password) return badRequest('Passwort fehlt.');
      const secret = sessionSecret();
      if (!secret) {
        const err = new Error('Passwort-Anmeldung ist noch nicht für diese Umgebung freigeschaltet.');
        err.status = 503;
        throw err;
      }

      const pool = await getPool();
      const requestedCompanyId = String(body.companyId || request.headers.get('x-company-id') || '').trim().slice(0, 80);
      const req = pool.request().input('email', sql.NVarChar(254), email);
      let companyFilter = '';
      if (requestedCompanyId) {
        req.input('companyId', sql.NVarChar(80), requestedCompanyId);
        companyFilter = ' AND companyId=@companyId';
      }
      const result = await req.query(`SELECT id,companyId,email,displayName,role,active,passwordHash,failedLoginCount,lockedUntil,sessionVersion
                                      FROM Users
                                      WHERE active=1 AND LOWER(email)=LOWER(@email)${companyFilter}
                                      ORDER BY CASE WHEN role='system_admin' THEN 0 ELSE 1 END, companyId`);
      const candidates = result.recordset || [];
      let user = candidates[0] || null;
      if (!requestedCompanyId && candidates.length > 1 && !candidates.some(row => row.role === 'system_admin')) {
        await writeSecurityEvent(pool, requestMeta(request), 'auth.password.ambiguousCompany', 'warning', { email, companies: candidates.length });
        return json({ error: 'Für diese E-Mail sind mehrere Firmen hinterlegt. Bitte Firma auswählen.' }, 409);
      }
      if (!user || !user.passwordHash) {
        await writeSecurityEvent(pool, requestMeta(request), 'auth.password.failed', 'warning', { email, reason: 'credentials' });
        return json({ error: 'E-Mail oder Passwort ist nicht korrekt.' }, 401);
      }

      const now = new Date();
      if (user.lockedUntil && new Date(user.lockedUntil) > now) {
        await writeSecurityEvent(pool, { ...requestMeta(request), companyId: user.companyId, userId: user.id }, 'auth.password.locked', 'warning', { email });
        return json({ error: 'Anmeldung vorübergehend gesperrt. Bitte später erneut versuchen.' }, 423);
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        const failures = Number(user.failedLoginCount || 0) + 1;
        const lock = failures >= 5;
        await pool.request()
          .input('id', sql.NVarChar(120), user.id)
          .input('companyId', sql.NVarChar(80), user.companyId)
          .input('failedLoginCount', sql.Int, failures)
          .input('lock', sql.Bit, lock ? 1 : 0)
          .query(`UPDATE Users SET failedLoginCount=@failedLoginCount,
                  lockedUntil=CASE WHEN @lock=1 THEN DATEADD(MINUTE,30,SYSUTCDATETIME()) ELSE lockedUntil END,
                  updatedAt=SYSUTCDATETIME()
                  WHERE id=@id AND companyId=@companyId`);
        await writeSecurityEvent(pool, { ...requestMeta(request), companyId: user.companyId, userId: user.id }, 'auth.password.failed', lock ? 'error' : 'warning', { email, failures, locked: lock });
        return json({ error: lock ? 'Zu viele Fehlversuche. Anmeldung für 30 Minuten gesperrt.' : 'E-Mail oder Passwort ist nicht korrekt.' }, 401);
      }

      await pool.request()
        .input('id', sql.NVarChar(120), user.id)
        .input('companyId', sql.NVarChar(80), user.companyId)
        .query(`UPDATE Users SET failedLoginCount=0,lockedUntil=NULL,lastSeenAt=SYSUTCDATETIME(),updatedAt=SYSUTCDATETIME()
                WHERE id=@id AND companyId=@companyId`);

      const ttlSeconds = Math.max(900, Math.min(Number(process.env.AUTH_SESSION_TTL_SECONDS || 8 * 60 * 60), 7 * 24 * 60 * 60));
      const token = createSessionToken({ userId: user.id, email: user.email, sessionVersion: Number(user.sessionVersion || 1) }, secret, { ttlSeconds });
      await writeSecurityEvent(pool, { ...requestMeta(request), companyId: user.companyId, userId: user.id }, 'auth.password.succeeded', 'info', { email, role: user.role });
      return responseWithCookie({ ok: true, companyId: user.companyId, displayName: user.displayName, role: user.role }, sessionCookie(token, { maxAge: ttlSeconds, secure: String(process.env.NODE_ENV || '').toLowerCase() !== 'development' }));
    } catch (err) {
      if (/Invalid column name 'passwordHash'|Invalid column name 'failedLoginCount'|Invalid column name 'sessionVersion'/i.test(String(err.message || err))) {
        err = Object.assign(new Error('Passwort-Anmeldung ist vorbereitet, benötigt aber noch die freizugebende Datenbankmigration 011.'), { status: 503 });
      }
      return serverError(err, context);
    }
  }
});

app.http('passwordAuthLogout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/password/logout',
  handler: async () => responseWithCookie({ ok: true }, clearSessionCookie({ secure: String(process.env.NODE_ENV || '').toLowerCase() !== 'development' }))
});
