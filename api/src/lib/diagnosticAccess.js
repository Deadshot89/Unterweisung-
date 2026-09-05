import { sql } from './db.js';
import { Roles } from './auth.js';

export const DIAGNOSTICS_VIEW_PERMISSION = 'diagnostics.view';

export async function hasDiagnosticAccess(pool, ctx) {
  if (ctx?.roles?.includes(Roles.SYSTEM_ADMIN)) return true;
  if (!pool || !ctx?.companyId || !ctx?.userId) return false;
  try {
    const result = await pool.request()
      .input('companyId', sql.NVarChar(80), ctx.companyId)
      .input('userId', sql.NVarChar(120), ctx.userId)
      .input('permissionKey', sql.NVarChar(120), DIAGNOSTICS_VIEW_PERMISSION)
      .query(`SELECT TOP 1 permissionKey
              FROM UserPermissions
              WHERE companyId=@companyId AND userId=@userId AND permissionKey=@permissionKey`);
    return !!result.recordset.length;
  } catch (err) {
    if (/Invalid object name ['"]?UserPermissions/i.test(String(err?.message || err))) return false;
    throw err;
  }
}

export async function assertDiagnosticAccess(pool, ctx) {
  if (await hasDiagnosticAccess(pool, ctx)) return;
  const err = new Error('Keine Berechtigung für die Fehlerdiagnose.');
  err.status = 403;
  throw err;
}

export async function diagnosticPermissions(pool, ctx) {
  if (ctx?.roles?.includes(Roles.SYSTEM_ADMIN)) return [DIAGNOSTICS_VIEW_PERMISSION];
  return (await hasDiagnosticAccess(pool, ctx)) ? [DIAGNOSTICS_VIEW_PERMISSION] : [];
}
