import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendGraphMail } from '../api/src/lib/graphMail.js';

function withGraphEnv(overrides, fn) {
  const names = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM','GRAPH_SENDER_ID'];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const beforeFetch = globalThis.fetch;
  Object.assign(process.env, {
    GRAPH_TENANT_ID: 'tenant-test',
    GRAPH_CLIENT_ID: 'client-test',
    GRAPH_CLIENT_SECRET: 'secret-test',
    MAIL_FROM: 'alerts@example.invalid'
  }, overrides);
  if (overrides.GRAPH_SENDER_ID === undefined) delete process.env.GRAPH_SENDER_ID;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = beforeFetch;
      for (const name of names) {
        if (before[name] === undefined) delete process.env[name];
        else process.env[name] = before[name];
      }
    });
}

test('Graph-Mail nutzt GRAPH_SENDER_ID technisch und behält MAIL_FROM als Absenderkonfiguration', async () => {
  await withGraphEnv({ GRAPH_SENDER_ID: '00000000-1111-2222-3333-444444444444' }, async () => {
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/oauth2/v2.0/token')) {
        return { ok: true, json: async () => ({ access_token: 'token-test' }) };
      }
      return { ok: true, text: async () => '' };
    };

    const result = await sendGraphMail({
      to: 'recipient@example.invalid',
      subject: 'Test',
      text: 'Test'
    });

    const sendCall = calls.find(call => call.url.includes('graph.microsoft.com/v1.0/users/'));
    assert.ok(sendCall, 'sendMail-Aufruf fehlt');
    assert.equal(
      sendCall.url,
      'https://graph.microsoft.com/v1.0/users/00000000-1111-2222-3333-444444444444/sendMail'
    );
    assert.equal(result.from, 'alerts@example.invalid');
  });
});

test('ohne GRAPH_SENDER_ID bleibt MAIL_FROM der sichere Fallback für bestehende Installationen', async () => {
  await withGraphEnv({}, async () => {
    let sendUrl = '';
    globalThis.fetch = async (url) => {
      const value = String(url);
      if (value.includes('/oauth2/v2.0/token')) {
        return { ok: true, json: async () => ({ access_token: 'token-test' }) };
      }
      sendUrl = value;
      return { ok: true, text: async () => '' };
    };

    await sendGraphMail({ to: 'recipient@example.invalid', subject: 'Test', text: 'Test' });
    assert.equal(sendUrl, 'https://graph.microsoft.com/v1.0/users/alerts%40example.invalid/sendMail');
  });
});

test('GRAPH_SENDER_ID wird serverseitig durch Deployment und Runtime transportiert, ohne Pflichtfeld zu werden', () => {
  const prepare = readFileSync(new URL('../scripts/prepare-managed-api-settings.js', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../api/src/lib/runtime-settings.js', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/azure-static-web-apps.yml', import.meta.url), 'utf8');

  assert.match(prepare, /GRAPH_SENDER_ID/);
  assert.match(runtime, /GRAPH_SENDER_ID/);
  assert.match(workflow, /GRAPH_SENDER_ID/);
  assert.doesNotMatch(
    prepare,
    /const graphNames = \[[^\]]*GRAPH_SENDER_ID[^\]]*\][\s\S]*graphNames\.every/,
    'GRAPH_SENDER_ID darf die bestehende Graph-Konfiguration nicht zu einem Pflichtfeld machen'
  );
});
