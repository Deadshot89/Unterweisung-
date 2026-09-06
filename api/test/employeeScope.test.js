import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

const moduleUrl = new URL('../src/lib/employeeScope.js', import.meta.url);

async function subject() {
  assert.ok(existsSync(moduleUrl), 'employeeScope.js muss vor der Implementierung dieses Vertrags fehlen.');
  return import(moduleUrl.href);
}

function fakePool({ actorRows = [], teamRows = [] } = {}) {
  const queries = [];
  return {
    queries,
    request() {
      const inputs = {};
      return {
        input(name, _type, value) {
          inputs[name] = value;
          return this;
        },
        async query(text) {
          queries.push({ text, inputs: { ...inputs } });
          if (/LOWER\(email\)\s*=\s*LOWER\(@email\)/i.test(text)) return { recordset: actorRows };
          if (/lineManagerId\s*=\s*@actorEmployeeId/i.test(text)) return { recordset: teamRows };
          throw new Error(`Unerwartete Testabfrage: ${text}`);
        }
      };
    }
  };
}

function ctx(overrides = {}) {
  return {
    companyId: 'company-a',
    email: 'manager@example.com',
    roles: ['employee'],
    ...overrides
  };
}

test('Rollen werden auf company, team und self Scope abgebildet', async () => {
  const { scopeModeForRoles } = await subject();
  assert.equal(scopeModeForRoles(['company_admin']), 'company');
  assert.equal(scopeModeForRoles(['hse']), 'company');
  assert.equal(scopeModeForRoles(['system_admin']), 'company');
  assert.equal(scopeModeForRoles(['line_manager']), 'team');
  assert.equal(scopeModeForRoles(['employee']), 'self');
});

test('Company Admin erhält Firmen-Scope ohne Employee-Liste', async () => {
  const { resolveEmployeeScope } = await subject();
  const pool = fakePool();
  const scope = await resolveEmployeeScope(pool, ctx({ roles: ['company_admin'] }));
  assert.equal(scope.mode, 'company');
  assert.equal(scope.actorEmployeeId, null);
  assert.equal(scope.allowedEmployeeIds, null);
  assert.equal(pool.queries.length, 0);
});

test('Employee wird ausschließlich per E-Mail innerhalb der aktiven Firma auf sich selbst begrenzt', async () => {
  const { resolveEmployeeScope } = await subject();
  const pool = fakePool({ actorRows: [{ id: 'emp-self' }] });
  const scope = await resolveEmployeeScope(pool, ctx({ email: 'SELF@EXAMPLE.COM', roles: ['employee'] }));
  assert.equal(scope.mode, 'self');
  assert.equal(scope.actorEmployeeId, 'emp-self');
  assert.deepEqual([...scope.allowedEmployeeIds], ['emp-self']);
  assert.equal(pool.queries[0].inputs.companyId, 'company-a');
  assert.equal(pool.queries[0].inputs.email, 'self@example.com');
  assert.match(pool.queries[0].text, /companyId=@companyId/i);
  assert.match(pool.queries[0].text, /active=1/i);
});

test('Line Manager erhält nur sich selbst und direkte aktive Teammitglieder', async () => {
  const { resolveEmployeeScope } = await subject();
  const pool = fakePool({
    actorRows: [{ id: 'manager-1' }],
    teamRows: [{ id: 'team-1' }, { id: 'team-2' }]
  });
  const scope = await resolveEmployeeScope(pool, ctx({ roles: ['line_manager'] }));
  assert.equal(scope.mode, 'team');
  assert.equal(scope.actorEmployeeId, 'manager-1');
  assert.deepEqual([...scope.allowedEmployeeIds].sort(), ['manager-1', 'team-1', 'team-2']);
  assert.match(pool.queries[1].text, /companyId=@companyId/i);
  assert.match(pool.queries[1].text, /active=1/i);
  assert.match(pool.queries[1].text, /lineManagerId=@actorEmployeeId/i);
});

test('Fehlende oder doppelte Employee-Zuordnung wird fail-closed mit 403 abgelehnt', async () => {
  const { resolveEmployeeScope } = await subject();
  await assert.rejects(
    () => resolveEmployeeScope(fakePool({ actorRows: [] }), ctx()),
    error => error?.status === 403
  );
  await assert.rejects(
    () => resolveEmployeeScope(fakePool({ actorRows: [{ id: 'a' }, { id: 'b' }] }), ctx()),
    error => error?.status === 403
  );
});

test('Systemadmin ohne ausgewählte Firma wird nicht auf einen beliebigen Employee gemappt', async () => {
  const { resolveEmployeeScope } = await subject();
  await assert.rejects(
    () => resolveEmployeeScope(fakePool({ actorRows: [{ id: 'wrong' }] }), ctx({ companyId: null, roles: ['system_admin'] })),
    error => error?.status === 403
  );
});

test('Gemischte erlaubte und unerlaubte Employee-IDs werden vollständig abgelehnt', async () => {
  const { assertEmployeeIdsAllowed, employeeAllowed, filterRowsByEmployeeScope } = await subject();
  const scope = { mode: 'team', actorEmployeeId: 'manager-1', allowedEmployeeIds: new Set(['manager-1', 'team-1']) };
  assert.equal(employeeAllowed(scope, 'team-1'), true);
  assert.equal(employeeAllowed(scope, 'foreign-1'), false);
  assert.throws(() => assertEmployeeIdsAllowed(scope, ['team-1', 'foreign-1']), error => error?.status === 403);
  assert.deepEqual(filterRowsByEmployeeScope(scope, [{ employeeId: 'team-1' }, { employeeId: 'foreign-1' }]), [{ employeeId: 'team-1' }]);
});
