import { sql } from './db.js';
import { Roles } from './auth.js';

function forbidden(message = 'Kein Zugriff auf diese Mitarbeiterdaten.') {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function normalizedRoles(roles = []) {
  return new Set((Array.isArray(roles) ? roles : []).map(role => String(role || '').trim().toLowerCase()).filter(Boolean));
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function scopeModeForRoles(roles = []) {
  const set = normalizedRoles(roles);
  if (set.has(Roles.SYSTEM_ADMIN) || set.has(Roles.COMPANY_ADMIN) || set.has(Roles.HSE)) return 'company';
  if (set.has(Roles.LINE_MANAGER)) return 'team';
  if (set.has(Roles.EMPLOYEE)) return 'self';
  return null;
}

export async function resolveEmployeeScope(pool, ctx) {
  if (!pool || !ctx?.companyId) throw forbidden('Für Mitarbeiterdaten muss zuerst eine Firma ausgewählt sein.');

  const mode = scopeModeForRoles(ctx.roles);
  if (!mode) throw forbidden('Für diese Rolle ist kein Mitarbeiterzugriff freigegeben.');

  if (mode === 'company') {
    return { mode, actorEmployeeId: null, allowedEmployeeIds: null };
  }

  const email = normalizedEmail(ctx.email);
  if (!email) throw forbidden('Der angemeldete Benutzer ist keinem eindeutigen Mitarbeiter zugeordnet.');

  const actorResult = await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('email', sql.NVarChar(254), email)
    .query(`SELECT id
            FROM Employees
            WHERE companyId=@companyId AND active=1 AND LOWER(email)=LOWER(@email)`);

  const actorRows = actorResult.recordset || [];
  if (actorRows.length !== 1) {
    throw forbidden(actorRows.length ? 'Die Benutzer-/Mitarbeiter-Zuordnung ist nicht eindeutig.' : 'Der angemeldete Benutzer ist keinem aktiven Mitarbeiter zugeordnet.');
  }

  const actorEmployeeId = actorRows[0].id;
  if (mode === 'self') {
    return { mode, actorEmployeeId, allowedEmployeeIds: new Set([actorEmployeeId]) };
  }

  const teamResult = await pool.request()
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('actorEmployeeId', sql.NVarChar(80), actorEmployeeId)
    .query(`SELECT id
            FROM Employees
            WHERE companyId=@companyId AND active=1 AND lineManagerId=@actorEmployeeId`);

  const allowedEmployeeIds = new Set([actorEmployeeId]);
  for (const row of teamResult.recordset || []) {
    if (row?.id) allowedEmployeeIds.add(row.id);
  }
  return { mode, actorEmployeeId, allowedEmployeeIds };
}

export function employeeAllowed(scope, employeeId) {
  const id = String(employeeId || '').trim();
  if (!scope || !id) return false;
  if (scope.mode === 'company') return true;
  return scope.allowedEmployeeIds instanceof Set && scope.allowedEmployeeIds.has(id);
}

export function assertEmployeeAllowed(scope, employeeId) {
  if (!employeeAllowed(scope, employeeId)) throw forbidden();
  return employeeId;
}

export function assertEmployeeIdsAllowed(scope, employeeIds = []) {
  const ids = [...new Set((Array.isArray(employeeIds) ? employeeIds : []).map(id => String(id || '').trim()).filter(Boolean))];
  if (ids.some(id => !employeeAllowed(scope, id))) throw forbidden();
  return ids;
}

export function filterRowsByEmployeeScope(scope, rows = [], key = 'employeeId') {
  const list = Array.isArray(rows) ? rows : [];
  if (scope?.mode === 'company') return [...list];
  return list.filter(row => employeeAllowed(scope, row?.[key]));
}
