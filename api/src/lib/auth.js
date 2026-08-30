// Auth / Mandanten-Kontext für Azure Static Web Apps + Azure Functions.
// Produktion: x-ms-client-principal kommt von Static Web Apps Auth / Entra.
// Lokale Entwicklung: x-company-id und x-dev-roles Header sind erlaubt.

export const Roles = Object.freeze({
  SYSTEM_ADMIN: 'system_admin',
  COMPANY_ADMIN: 'company_admin',
  HSE: 'hse',
  LINE_MANAGER: 'line_manager',
  EMPLOYEE: 'employee',
  ANONYMOUS: 'anonymous'
});

function decodePrincipal(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeRoles(roles = []) {
  const map = new Map([
    ['systemadmin', Roles.SYSTEM_ADMIN],
    ['system_admin', Roles.SYSTEM_ADMIN],
    ['admin', Roles.COMPANY_ADMIN],
    ['company_admin', Roles.COMPANY_ADMIN],
    ['firmen_admin', Roles.COMPANY_ADMIN],
    ['hse', Roles.HSE],
    ['line_manager', Roles.LINE_MANAGER],
    ['linemanager', Roles.LINE_MANAGER],
    ['employee', Roles.EMPLOYEE],
    ['mitarbeiter', Roles.EMPLOYEE],
    ['anonymous', Roles.ANONYMOUS]
  ]);
  return [...new Set((roles || []).map(r => map.get(String(r).toLowerCase()) || String(r).toLowerCase()))];
}

export function getRequestContext(request) {
  const rawPrincipal = request.headers.get('x-ms-client-principal');
  const principal = decodePrincipal(rawPrincipal);
  const devRoles = request.headers.get('x-dev-roles');
  const roles = normalizeRoles(devRoles ? devRoles.split(',') : (principal?.userRoles || [Roles.ANONYMOUS]));
  const isLocalDev = !rawPrincipal && (request.headers.get('x-company-id') || process.env.NODE_ENV !== 'production');
  if (isLocalDev && !roles.includes(Roles.SYSTEM_ADMIN)) roles.push(Roles.COMPANY_ADMIN, Roles.HSE);

  return {
    companyId: request.headers.get('x-company-id') || request.headers.get('x-company') || 'company-essentra',
    userId: principal?.userId || request.headers.get('x-dev-user-id') || 'local-dev-user',
    userDetails: principal?.userDetails || request.headers.get('x-dev-user') || 'local-dev',
    roles,
    isAuthenticated: !!principal || isLocalDev,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('client-ip') || null,
    userAgent: request.headers.get('user-agent') || null
  };
}

export function hasRole(ctx, allowedRoles = []) {
  if (!allowedRoles?.length) return true;
  if (ctx.roles?.includes(Roles.SYSTEM_ADMIN)) return true;
  return allowedRoles.some(r => ctx.roles?.includes(r));
}

export function assertRole(ctx, allowedRoles = []) {
  if (!hasRole(ctx, allowedRoles)) {
    const err = new Error('Keine Berechtigung für diese Aktion');
    err.status = 403;
    throw err;
  }
}
