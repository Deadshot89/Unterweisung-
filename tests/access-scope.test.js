import test from 'node:test';
import assert from 'node:assert/strict';
import { accessModeForRoles, employeeIdAllowed } from '../api/src/lib/employeeAccess.js';

test('employee access is self-only', () => {
  const mode = accessModeForRoles(['employee', 'authenticated']);
  assert.equal(mode, 'self');
  assert.equal(employeeIdAllowed({ mode, selfEmployeeId: 'emp-1', teamEmployeeIds: [], targetEmployeeId: 'emp-1' }), true);
  assert.equal(employeeIdAllowed({ mode, selfEmployeeId: 'emp-1', teamEmployeeIds: [], targetEmployeeId: 'emp-2' }), false);
});

test('line managers can target themselves and direct reports, but not unrelated employees', () => {
  const mode = accessModeForRoles(['line_manager', 'authenticated']);
  assert.equal(mode, 'team');
  const args = { mode, selfEmployeeId: 'mgr-1', teamEmployeeIds: ['emp-1', 'emp-2'] };
  assert.equal(employeeIdAllowed({ ...args, targetEmployeeId: 'mgr-1' }), true);
  assert.equal(employeeIdAllowed({ ...args, targetEmployeeId: 'emp-2' }), true);
  assert.equal(employeeIdAllowed({ ...args, targetEmployeeId: 'emp-9' }), false);
});

test('company responsibility roles stay company-scoped while system admin is unrestricted', () => {
  assert.equal(accessModeForRoles(['hse']), 'company');
  assert.equal(accessModeForRoles(['company_admin']), 'company');
  assert.equal(accessModeForRoles(['system_admin']), 'system');
  assert.equal(employeeIdAllowed({ mode: 'company', selfEmployeeId: null, teamEmployeeIds: [], targetEmployeeId: 'any' }), true);
  assert.equal(employeeIdAllowed({ mode: 'system', selfEmployeeId: null, teamEmployeeIds: [], targetEmployeeId: 'any' }), true);
});
