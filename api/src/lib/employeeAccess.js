import { sql } from './db.js';

export function accessModeForRoles(roles = []) {
  const set = new Set(roles || []);
  if (set.has('system_admin')) return 'system';
  if (set.has('company_admin') || set.has('hse')) return 'company';
  if (set.has('line_manager')) return 'team';
  return 'self';
}

export function employeeIdAllowed({ mode, selfEmployeeId, teamEmployeeIds = [], targetEmployeeId }) {
  if (!targetEmployeeId) return false;
  if (mode === 'system' || mode === 'company') return true;
  if (String(targetEmployeeId) === String(selfEmployeeId || '')) return true;
  return mode === 'team' && new Set(teamEmployeeIds || []).has(String(targetEmployeeId));
}

export function scopedEmployeeIds(access) {
  if (!access || access.mode === 'system' || access.mode === 'company') return null;
  return [...new Set([access.selfEmployeeId, ...(access.mode === 'team' ? access.teamEmployeeIds || [] : [])].filter(Boolean))];
}

export async function resolveEmployeeAccess(pool, ctx) {
  const mode = accessModeForRoles(ctx?.roles || []);
  if (mode === 'system' || mode === 'company') return { mode, selfEmployeeId: null, teamEmployeeIds: [] };

  const email = String(ctx?.email || '').trim().toLowerCase();
  if (!email) return { mode, selfEmployeeId: null, teamEmployeeIds: [] };
  const self = await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('email', sql.NVarChar(254), email)
    .query(`SELECT TOP 1 id FROM Employees
            WHERE companyId=@companyId AND active=1 AND email IS NOT NULL AND LOWER(email)=LOWER(@email)
            ORDER BY COALESCE(updatedAt,createdAt) DESC`);
  const selfEmployeeId = self.recordset[0]?.id || null;
  if (!selfEmployeeId || mode !== 'team') return { mode, selfEmployeeId, teamEmployeeIds: [] };

  const team = await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('lineManagerId', sql.NVarChar(80), selfEmployeeId)
    .query(`SELECT id FROM Employees
            WHERE companyId=@companyId AND active=1 AND lineManagerId=@lineManagerId
            ORDER BY name`);
  return { mode, selfEmployeeId, teamEmployeeIds: team.recordset.map(row => String(row.id)) };
}

export function bindEmployeeScope(request, access, column = 'employeeId', prefix = 'scopeEmployee') {
  const ids = scopedEmployeeIds(access);
  if (ids === null) return '1=1';
  if (!ids.length) return '1=0';
  const params = ids.map((id, index) => {
    const name = `${prefix}${index}`;
    request.input(name, sql.NVarChar(80), id);
    return `@${name}`;
  });
  return `${column} IN (${params.join(',')})`;
}

export function requireEmployeeTarget(access, employeeId) {
  if (employeeIdAllowed({ ...access, targetEmployeeId: employeeId })) return;
  const err = new Error('Keine Berechtigung für diesen Mitarbeiter.');
  err.status = 403;
  throw err;
}
