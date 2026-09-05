import fs from 'node:fs';

function replaceOnce(file, before, after, label){
  const source = fs.readFileSync(file, 'utf8');
  if(source.includes(after)) return;
  if(!source.includes(before)) throw new Error(`${label}: erwarteter Codeanker fehlt in ${file}`);
  const next = source.replace(before, after);
  if(next === source) throw new Error(`${label}: keine Änderung in ${file}`);
  fs.writeFileSync(file, next);
}

// 1) Zentrale API-Fehler ohne Request-Inhalte an die Diagnose melden.
replaceOnce(
  'frontend/app.js',
  `async function api(path, options={}){\n  const headers = {'Content-Type':'application/json', ...(options.headers||{})};`,
  `function reportApiDiagnostic(path, response, payload, method='GET'){\n  const apiPath = String(path || '');\n  if(apiPath.startsWith('/diagnostics')) return;\n  if(!state.me || !response || response.ok) return;\n  const errorMessage = String(payload?.error || payload?.message || ('HTTP ' + response.status)).slice(0, 1000);\n  const diagnosticHeaders = {'Content-Type':'application/json'};\n  if(state.companyId) diagnosticHeaders['x-company-id'] = state.companyId;\n  const appVersion = String(document.getElementById('appVersion')?.textContent || '').slice(0, 80);\n  fetch(apiUrl('/api/diagnostics/events'), {\n    method: 'POST',\n    headers: diagnosticHeaders,\n    mode: 'cors',\n    credentials: 'include',\n    body: JSON.stringify({\n      area: 'frontend.api',\n      action: 'request.failed',\n      errorMessage,\n      errorCode: 'HTTP_' + response.status,\n      apiPath,\n      httpMethod: String(method || 'GET').toUpperCase().slice(0, 12),\n      httpStatus: Number(response.status || 0),\n      appVersion\n    })\n  }).catch(() => {});\n}\n\nasync function api(path, options={}){\n  const headers = {'Content-Type':'application/json', ...(options.headers||{})};`,
  'Diagnose-Reporter'
);
replaceOnce(
  'frontend/app.js',
  `  if(!res.ok){\n    const error = new Error(payload?.error || text || \`HTTP \${res.status}\`);`,
  `  if(!res.ok){\n    reportApiDiagnostic(path, res, payload, options.method || 'GET');\n    const error = new Error(payload?.error || payload?.message || text || \`HTTP \${res.status}\`);`,
  'Diagnose-Reporter-Aufruf'
);

// 2) Hauptnavigation und Diagnose-View.
replaceOnce(
  'frontend/index.html',
  `        <button data-view="security">Sicherheit</button>`,
  `        <button data-view="security">Sicherheit</button>\n        <button data-view="diagnostics">Fehlerdiagnose</button>`,
  'Diagnose-Menü'
);
replaceOnce(
  'frontend/index.html',
  `      <section id="security" class="view"></section>`,
  `      <section id="security" class="view"></section>\n      <section id="diagnostics" class="view"></section>`,
  'Diagnose-View'
);
replaceOnce(
  'frontend/index.html',
  `  <script src="/role-guard-v20.js"></script>`,
  `  <script src="/role-guard-v20.js"></script>\n  <script src="/diagnostics-entry-v37.js"></script>`,
  'Diagnose-Skript'
);

// 3) Sichtbarkeit: Systemadmin oder explizites diagnostics.view.
replaceOnce(
  'frontend/role-guard-v20.js',
  `function viewAllowed(view){\n  return hasAnyRole(ROLE_VIEW_RULES[view] || ['system_admin']);\n}`,
  `function canOpenDiagnostics(){\n  const roles = currentRoles();\n  const permissions = state.me?.permissions || [];\n  return roles.includes('system_admin') || permissions.includes('diagnostics.view');\n}\n\nfunction viewAllowed(view){\n  if(view === 'diagnostics') return canOpenDiagnostics();\n  return hasAnyRole(ROLE_VIEW_RULES[view] || ['system_admin']);\n}`,
  'Diagnose-Rollenschutz'
);
replaceOnce(
  'frontend/role-guard-v20.js',
  `const preferred = ['dashboard','status','reminders','proofs','managerReport','employees','external','companies','users','operations','security'];`,
  `const preferred = ['dashboard','status','reminders','proofs','managerReport','employees','external','companies','users','operations','security','diagnostics'];`,
  'Diagnose-Navigation'
);

// 4) Rechtevergabe im Benutzerbereich nur für Systemadmins.
replaceOnce(
  'frontend/user-management-v19.js',
  `  const setupAction=canCreatePasswordSetupLink(user)\n    ? \` <button class="small" type="button" data-password-setup-action data-user-id="\${esc(user.id)}">Passwort-Setup-Link erstellen</button>\`\n    : '';\n  return normalActions + setupAction;`,
  `  const setupAction=canCreatePasswordSetupLink(user)\n    ? \` <button class="small" type="button" data-password-setup-action data-user-id="\${esc(user.id)}">Passwort-Setup-Link erstellen</button>\`\n    : '';\n  const diagnosticsAction=state.me?.roles?.includes('system_admin') && user.role !== 'system_admin'\n    ? \` <button class="small \${user.diagnosticsView?'ghost':''}" type="button" data-diagnostics-permission data-user-id="\${esc(user.id)}" data-enabled="\${user.diagnosticsView?'true':'false'}">\${user.diagnosticsView?'Fehlerdiagnose entziehen':'Fehlerdiagnose freigeben'}</button>\`\n    : '';\n  return normalActions + setupAction + diagnosticsAction;`,
  'Diagnose-Rechteknopf'
);
replaceOnce(
  'frontend/user-management-v19.js',
  `async function saveUser(){`,
  `async function setDiagnosticPermission(id, enabled){\n  if(!state.me?.roles?.includes('system_admin')) return;\n  const user=(state.users||[]).find(item=>item.id===id);\n  if(!user) return;\n  try{\n    await api('/users/' + encodeURIComponent(id) + '/permissions/diagnostics', {\n      method: enabled ? 'DELETE' : 'PUT',\n      body: JSON.stringify({ companyId: state.companyId || DEFAULT_COMPANY_ID })\n    });\n    await refreshUsers();\n  }catch(err){\n    alert('Fehlerdiagnose-Berechtigung konnte nicht geändert werden: ' + String(err.message || err));\n  }\n}\n\nasync function saveUser(){`,
  'Diagnose-Rechtefunktion'
);
replaceOnce(
  'frontend/user-management-v19.js',
  `document.addEventListener('click',event=>{\n  const copyButton=event.target?.closest?.('[data-password-setup-copy]');`,
  `document.addEventListener('click',event=>{\n  const diagnosticsButton=event.target?.closest?.('[data-diagnostics-permission]');\n  if(diagnosticsButton){\n    event.preventDefault();\n    setDiagnosticPermission(diagnosticsButton.dataset.userId, diagnosticsButton.dataset.enabled === 'true');\n    return;\n  }\n  const copyButton=event.target?.closest?.('[data-password-setup-copy]');`,
  'Diagnose-Rechtehandler'
);

// 5) Eigener Einstieg zur bereits vorhandenen Diagnose-PWA.
const entryPath = 'frontend/diagnostics-entry-v37.js';
if(!fs.existsSync(entryPath)){
  fs.writeFileSync(entryPath, `// v0.37: Berechtigter Einstieg in die separate Fehlerdiagnose-PWA.\nfunction diagnosticsAccessAllowed(){\n  const roles = state.me?.roles || [];\n  const permissions = state.me?.permissions || [];\n  return roles.includes('system_admin') || permissions.includes('diagnostics.view');\n}\n\nfunction renderDiagnostics(){\n  const target = $('diagnostics');\n  if(!target) return;\n  if(!diagnosticsAccessAllowed()){\n    target.innerHTML = accessDeniedHtml('diagnostics');\n    return;\n  }\n  const systemAdmin = (state.me?.roles || []).includes('system_admin');\n  target.innerHTML = \`<div class="grid">\n    <div class="card span-12">\n      <div class="toolbar"><div><h2>Fehlerdiagnose</h2><p class="muted">Systemstatus, Fehlerereignisse, Diagnoseexport und kritische Alarme.</p></div><a class="btn primary" href="/diagnostics.html">Diagnose-App öffnen</a></div>\n      <div class="notice"><b>Zugriff:</b> \${systemAdmin?'Systemadmin':'Explizit freigegeben (diagnostics.view)'}. Die Diagnose-App verwendet dieselbe Anmeldung und dieselbe Firmenbegrenzung.</div>\n      \${systemAdmin?'<p>In der Diagnose-App kannst du zusätzlich Handy-Benachrichtigungen für kritische Fehler aktivieren.</p>':'<p>Push- und E-Mail-Alarme bleiben ausschließlich dem Systemadmin vorbehalten.</p>'}\n    </div>\n  </div>\`;\n}\n\n(function(){\n  const originalRender = typeof render === 'function' ? render : null;\n  if(originalRender){\n    render = function(id){\n      if(id === 'diagnostics'){ renderDiagnostics(); return; }\n      originalRender(id);\n    };\n  }\n})();\n`, 'utf8');
}

console.log('Diagnose-UI-Integration angewendet.');
