// Auth / Mandanten-Kontext für Azure Static Web Apps + Microsoft Entra + Azure Functions.
// Produktion: x-ms-client-principal kommt von Static Web Apps Auth / Entra.
// Lokale Entwicklung: x-company-id und x-dev-roles Header sind nur außerhalb NODE_ENV=production erlaubt.

import { getPool, sql } from './db.js';

export const Roles = Object.freeze({
  SYSTEM_ADMIN: 'system_admin',
  COMPANY_ADMIN: 'company_admin',
  HSE: 'hse',
  LINE_MANAGER: 'line_manager',
  EMPLOYEE: 'employee',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous'
});

const ROLE_MAP = new Map([
  ['systemadmin', Roles.SYSTEM_ADMIN], ['system_admin', Roles.SYSTEM_ADMIN], ['system admin', Roles.SYSTEM_ADMIN],
  ['unterweisungsmanager.system_admin', Roles.SYSTEM_ADMIN],
  ['admin', Roles.COMPANY_ADMIN], ['company_admin', Roles.COMPANY_ADMIN], ['companyadmin', Roles.COMPANY_ADMIN], ['firmen_admin', Roles.COMPANY_ADMIN],
  ['unterweisungsmanager.company_admin', Roles.COMPANY_ADMIN],
  ['hse', Roles.HSE], ['safety', Roles.HSE], ['unterweisungsmanager.hse', Roles.HSE],
  ['line_manager', Roles.LINE_MANAGER], ['linemanager', Roles.LINE_MANAGER], ['line manager', Roles.LINE_MANAGER], ['teamleader', Roles.LINE_MANAGER], ['team leader', Roles.LINE_MANAGER],
  ['unterweisungsmanager.line_manager', Roles.LINE_MANAGER],
  ['employee', Roles.EMPLOYEE], ['mitarbeiter', Roles.EMPLOYEE], ['unterweisungsmanager.employee', Roles.EMPLOYEE],
  ['authenticated', Roles.AUTHENTICATED], ['anonymous', Roles.ANONYMOUS]
]);

function decodePrincipal(raw) {
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  catch { return null; }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRoles(roles = []) {
  return [...new Set((roles || [])
    .map(r => ROLE_MAP.get(String(r || '').toLowerCase().trim()) || String(r || '').toLowerCase().trim())
    .filter(Boolean))];
}

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function parseCompanyHeader(request) {
  return request.headers.get('x-company-id') || request.headers.get('x-company') || null;
}

export function getRequestContext(request) {
  const rawPrincipal = request.headers.get('x-ms-client-principal');
  const principal = decodePrincipal(rawPrincipal);
  const localDev = !isProduction() && !rawPrincipal;
  const devRoles = localDev ? request.headers.get('x-dev-roles') : null;
  const requestedCompanyId = localDev ? parseCompanyHeader(request) : parseCompanyHeader(request); // später nur nach DB-Prüfung nutzbar
  const principalRoles = normalizeRoles(devRoles ? devRoles.split(',') : (principal?.userRoles || []));
  const userDetails = principal?.userDetails || (localDev ? request.headers.get('x-dev-user') : null) || '';
  const userId = principal?.userId || (localDev ? request.headers.get('x-dev-user-id') : null) || userDetails || 'anonymous';

  let roles = principalRoles.length ? principalRoles : [principal ? Roles.AUTHENTICATED : Roles.ANONYMOUS];
  if (localDev) {
    roles = normalizeRoles([...roles, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER]);
  }

  return {
    companyId: localDev ? (requestedCompanyId || process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || 'company-essentra') : (requestedCompanyId || null),
    requestedCompanyId,
    userId,
    userDetails,
    email: normalizeEmail(userDetails),
    roles,
    isAuthenticated: !!principal || localDev,
    isLocalDev: localDev,
    principal,
    allowedCompanies: [],
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('client-ip') || null,
    userAgent: request.headers.get('user-agent') || null
  };
}

function dbRoleToRole(role) {
  return ROLE_MAP.get(String(role || '').toLowerCase().trim()) || String(role || '').toLowerCase().trim();
}

export async function getAuthorizedContext(request) {
  const base = getRequestContext(request);

  // DEV/Pilot-Bypass: nur für Aufbau/Testbetrieb.
  // Wenn AUTH_DEV_BYPASS=true gesetzt ist, darf die API ohne Microsoft/Entra-Login laden.
  // Vor Produktivbetrieb muss diese Einstellung wieder entfernt/deaktiviert werden.
  const devBypass = String(process.env.AUTH_DEV_BYPASS || '').toLowerCase() === 'true';
  const requireDbUser = String(process.env.AUTH_REQUIRE_DB_USER || (isProduction() ? 'true' : 'false')).toLowerCase() === 'true';
  if (devBypass && !base.isAuthenticated) {
    return {
      ...base,
      companyId: process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || 'company-essentra',
      userId: process.env.DEV_USER_ID || 'dev-admin',
      userDetails: process.env.DEV_USER_NAME || 'Pilot Admin',
      email: normalizeEmail(process.env.DEV_USER_EMAIL || 'pilot-admin@local'),
      roles: [Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.AUTHENTICATED],
      allowedCompanies: [{
        companyId: process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || 'company-essentra',
        role: Roles.COMPANY_ADMIN,
        userId: process.env.DEV_USER_ID || 'dev-admin',
        email: normalizeEmail(process.env.DEV_USER_EMAIL || 'pilot-admin@local'),
        displayName: process.env.DEV_USER_NAME || 'Pilot Admin'
      }],
      isAuthenticated: true,
      isLocalDev: true
    };
  }

  if (!base.isAuthenticated) {
    const err = new Error('Nicht angemeldet');
    err.status = 401;
    throw err;
  }

  // Lokale Entwicklung darf ohne SQL-Rollendatensatz starten, damit das Projekt sofort testbar bleibt.
  let pool;
  try { pool = await getPool(); }
  catch (err) {
    if (!requireDbUser && base.isLocalDev) return base;
    throw err;
  }

  const email = normalizeEmail(base.email || base.userDetails);
  const userId = String(base.userId || '');
  const res = await pool.request()
    .input('email', sql.NVarChar(254), email || null)
    .input('userId', sql.NVarChar(120), userId || null)
    .query(`SELECT id, companyId, email, displayName, role, active, entraObjectId
            FROM Users
            WHERE active=1 AND (
              LOWER(email)=LOWER(@email)
              OR id=@userId
              OR entraObjectId=@userId
            )`);

  const dbUsers = res.recordset || [];
  const principalRoles = normalizeRoles(base.roles);
  const isSystemAdminByPrincipal = principalRoles.includes(Roles.SYSTEM_ADMIN);

  if (!dbUsers.length && !requireDbUser && base.isLocalDev) {
    return {
      ...base,
      companyId: base.companyId || process.env.DEFAULT_COMPANY_ID || 'company-essentra',
      roles: normalizeRoles([...base.roles, Roles.COMPANY_ADMIN, Roles.HSE, Roles.LINE_MANAGER, Roles.AUTHENTICATED]),
      allowedCompanies: [{ companyId: base.companyId || process.env.DEFAULT_COMPANY_ID || 'company-essentra', role: Roles.COMPANY_ADMIN, userId: base.userId, email: base.email, displayName: base.userDetails || 'Lokaler Testbenutzer' }],
      isAuthenticated: true
    };
  }

  if (!dbUsers.length && requireDbUser && !isSystemAdminByPrincipal) {
    const err = new Error('Benutzer ist nicht im Unterweisungsmanager freigeschaltet');
    err.status = 403;
    throw err;
  }

  const allowedCompanies = dbUsers.map(u => ({ companyId: u.companyId, role: dbRoleToRole(u.role), userId: u.id, email: u.email, displayName: u.displayName }));
  const requested = base.requestedCompanyId;
  let selected = null;

  if (requested) selected = allowedCompanies.find(c => c.companyId === requested) || null;
  if (!selected && allowedCompanies.length) selected = allowedCompanies[0];

  if (isSystemAdminByPrincipal && requested) {
    selected = selected || { companyId: requested, role: Roles.SYSTEM_ADMIN, userId: base.userId, email: base.email, displayName: base.userDetails };
  }
  if (isSystemAdminByPrincipal && !selected) {
    selected = { companyId: process.env.DEFAULT_COMPANY_ID || 'company-essentra', role: Roles.SYSTEM_ADMIN, userId: base.userId, email: base.email, displayName: base.userDetails };
  }

  if (!selected) {
    const err = new Error('Keine Firma für diesen Benutzer zugeordnet');
    err.status = 403;
    throw err;
  }

  const selectedRoles = normalizeRoles([selected.role, ...principalRoles.filter(r => r === Roles.SYSTEM_ADMIN)]);
  if (!selectedRoles.includes(Roles.AUTHENTICATED)) selectedRoles.push(Roles.AUTHENTICATED);

  // Last-Seen nicht blockierend aktualisieren.
  pool.request()
    .input('id', sql.NVarChar(120), selected.userId)
    .query('UPDATE Users SET lastSeenAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME() WHERE id=@id')
    .catch(err => console.warn('lastSeenAt update failed', err.message));

  return {
    ...base,
    companyId: selected.companyId,
    userId: selected.userId || base.userId,
    userDetails: selected.displayName || base.userDetails,
    email: normalizeEmail(selected.email || base.email),
    roles: selectedRoles,
    allowedCompanies,
    isAuthenticated: true
  };
}

export function hasRole(ctx, allowedRoles = []) {
  if (!allowedRoles?.length) return true;
  if (ctx.roles?.includes(Roles.SYSTEM_ADMIN)) return true;
  return allowedRoles.some(r => ctx.roles?.includes(r));
}

export function assertAuthenticated(ctx) {
  if (!ctx?.isAuthenticated || ctx.roles?.includes(Roles.ANONYMOUS)) {
    const err = new Error('Nicht angemeldet');
    err.status = 401;
    throw err;
  }
}

export function assertRole(ctx, allowedRoles = []) {
  assertAuthenticated(ctx);
  if (!hasRole(ctx, allowedRoles)) {
    const err = new Error('Keine Berechtigung für diese Aktion');
    err.status = 403;
    throw err;
  }
}
