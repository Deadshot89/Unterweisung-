import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('api/src/functions/systemCompanies.js', 'utf8');
const getStart = source.indexOf("if (request.method === 'GET')");
const getEnd = source.indexOf('const body = await request.json()', getStart);
const getBlock = source.slice(getStart, getEnd);

test('system company list avoids cartesian joins across count tables', () => {
  assert.ok(getStart >= 0 && getEnd > getStart, 'GET block for system companies must be present');

  const directCountJoins = [
    ['Users', 'u'],
    ['Employees', 'e'],
    ['Templates', 'tpl'],
    ['InstructionTypes', 't'],
    ['TestQuestions', 'q']
  ];

  for (const [table, alias] of directCountJoins) {
    assert.doesNotMatch(
      getBlock,
      new RegExp(`LEFT\\s+JOIN\\s+${table}\\s+${alias}\\s+ON\\s+${alias}\\.companyId\\s*=\\s*c\\.id`, 'i'),
      `${table} darf für die Firmenübersicht nicht direkt in die gemeinsame Zählabfrage gejoint werden.`
    );
  }
});

test('system company list still returns all required counters', () => {
  for (const alias of [
    'userCount',
    'companyAdminCount',
    'employeeCount',
    'templateCount',
    'instructionTypeCount',
    'testQuestionCount'
  ]) {
    assert.match(getBlock, new RegExp(`\\bAS\\s+${alias}\\b`, 'i'), `Zähler ${alias} fehlt.`);
  }
});
