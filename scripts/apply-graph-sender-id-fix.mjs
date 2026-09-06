import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Patch-Anker fehlt in ${path}: ${from.slice(0, 80)}`);
    text = text.replace(from, to);
  }
  writeFileSync(path, text, 'utf8');
}

patch('api/src/lib/graphMail.js', [
  [
    "  const fromEmail = from || cfg('MAIL_FROM');\n  const toList = splitEmails(to);",
    "  const fromEmail = from || cfg('MAIL_FROM');\n  const graphSenderId = from || cfg('GRAPH_SENDER_ID') || fromEmail;\n  const toList = splitEmails(to);"
  ],
  [
    "https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail",
    "https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graphSenderId)}/sendMail"
  ]
]);

patch('api/src/lib/runtime-settings.js', [[
  "  'GRAPH_CLIENT_SECRET',\n  'MAIL_FROM'\n]);",
  "  'GRAPH_CLIENT_SECRET',\n  'MAIL_FROM',\n  'GRAPH_SENDER_ID'\n]);"
]]);

patch('scripts/prepare-managed-api-settings.js', [[
  "const graphNames = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];\nfor (const name of graphNames) {\n  if(process.env[name]?.trim()) settings[name]=process.env[name].trim();\n}\nconsole.log('Graph mail settings complete: '+graphNames.every(name=>!!settings[name]));",
  "const graphNames = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];\nconst optionalGraphNames = ['GRAPH_SENDER_ID'];\nfor (const name of [...graphNames, ...optionalGraphNames]) {\n  if(process.env[name]?.trim()) settings[name]=process.env[name].trim();\n}\nconsole.log('Graph mail settings complete: '+graphNames.every(name=>!!settings[name]));\nconsole.log('Graph sender identity explicit: '+!!settings.GRAPH_SENDER_ID);"
]]);

patch('.github/workflows/azure-static-web-apps.yml', [
  [
    "          GRAPH_CLIENT_SECRET: ${{ secrets.GRAPH_CLIENT_SECRET }}\n          MAIL_FROM: ${{ secrets.MAIL_FROM || vars.MAIL_FROM }}",
    "          GRAPH_CLIENT_SECRET: ${{ secrets.GRAPH_CLIENT_SECRET }}\n          MAIL_FROM: ${{ secrets.MAIL_FROM || vars.MAIL_FROM }}\n          GRAPH_SENDER_ID: ${{ secrets.GRAPH_SENDER_ID || vars.GRAPH_SENDER_ID }}"
  ],
  [
    "          const keys = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];\n          const settings = Object.fromEntries(keys.map(key => [key, String(process.env[key] || '')]));\n          const complete = () => keys.every(key => !!settings[key]);\n\n          if (!complete()) {\n            const xml = String(process.env.FUNCTION_PUBLISH_PROFILE || '');\n            if (!xml) throw new Error('Graph-Mail ist unvollständig und das Function-Publish-Profil fehlt.');",
    "          const requiredKeys = ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET','MAIL_FROM'];\n          const optionalKeys = ['GRAPH_SENDER_ID'];\n          const keys = [...requiredKeys, ...optionalKeys];\n          const settings = Object.fromEntries(keys.map(key => [key, String(process.env[key] || '')]));\n          const complete = () => requiredKeys.every(key => !!settings[key]);\n\n          const xml = String(process.env.FUNCTION_PUBLISH_PROFILE || '');\n          if (keys.some(key => !settings[key]) && xml) {"
  ],
  [
    "          if (!complete()) throw new Error('Microsoft-Graph-Mailkonfiguration ist weiterhin unvollständig.');\n          for (const key of keys) {\n            const value = settings[key];\n            if (/\\r|\\n/.test(value)) throw new Error(`Ungültige mehrzeilige Konfiguration für ${key}.`);\n            console.log(`::add-mask::${value}`);\n            appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\\n`, 'utf8');\n          }\n          console.log('GRAPH_MAIL_COMPLETE: ja');",
    "          if (!complete()) {\n            if (!xml) throw new Error('Graph-Mail ist unvollständig und das Function-Publish-Profil fehlt.');\n            throw new Error('Microsoft-Graph-Mailkonfiguration ist weiterhin unvollständig.');\n          }\n          for (const key of keys) {\n            const value = settings[key];\n            if (!value) continue;\n            if (/\\r|\\n/.test(value)) throw new Error(`Ungültige mehrzeilige Konfiguration für ${key}.`);\n            console.log(`::add-mask::${value}`);\n            appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\\n`, 'utf8');\n          }\n          console.log('GRAPH_MAIL_COMPLETE: ja');\n          console.log(`GRAPH_SENDER_ID_PRESENT: ${settings.GRAPH_SENDER_ID ? 'ja' : 'nein (MAIL_FROM-Fallback)'}`);"
  ]
]);

patch('package.json', [[
  "tests/diagnostics-push-devices.test.js tests/users-layout-navigation-focus.test.js\"",
  "tests/diagnostics-push-devices.test.js tests/users-layout-navigation-focus.test.js tests/graph-sender-id.test.js\""
]]);

console.log('Graph-Sender-ID-Patch angewendet.');
