import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const RC = 'origin/rc991-unified-learning-portal';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
function fromRc(path) { return execFileSync('git', ['show', `${RC}:${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); }
function replaceOnce(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  return source.replace(oldValue, newValue);
}

for (const path of [
  'frontend/auth-login-v42.js',
  'api/src/lib/passwordAuth.js',
  'api/src/functions/passwordAuth.js',
  'api/src/lib/runtime-settings.js',
  'api/src/lib/db.js',
  'scripts/prepare-managed-api-settings.js',
  '.github/workflows/azure-static-web-apps.yml'
]) write(path, fromRc(path));

let auth = fromRc('api/src/lib/auth.js');
auth = replaceOnce(auth, 'if(devBypass&&!base.isAuthenticated){', 'if(devBypass&&!base.isAuthenticated&&base.isLocalDev){', 'production dev bypass guard');
write('api/src/lib/auth.js', auth);

write('api/src/functions/me.js', `import { app } from '@azure/functions';
import { getAuthorizedContext, Roles } from '../lib/auth.js';
import { json, serverError } from '../lib/http.js';
import { getPool } from '../lib/db.js';
import { writeSecurityEvent } from '../lib/securityEvents.js';

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request, context) => {
    try {
      const ctx = await getAuthorizedContext(request);
      const pool = await getPool();
      const requiresCompanySelection = ctx.roles.includes(Roles.SYSTEM_ADMIN) && !ctx.companyId;
      await writeSecurityEvent(pool, ctx, 'auth.me.loaded', 'info', { roles: ctx.roles, companyId: ctx.companyId, authMode: ctx.authMode, requiresCompanySelection });
      return json({
        authenticated: true,
        companyId: ctx.companyId,
        userId: ctx.userId,
        email: ctx.email,
        displayName: ctx.userDetails,
        roles: ctx.roles,
        isSystemAdmin: ctx.roles.includes(Roles.SYSTEM_ADMIN),
        requiresCompanySelection,
        isLocalDev: !!ctx.isLocalDev,
        authMode: ctx.authMode || (ctx.isLocalDev ? 'dev-bypass' : 'entra'),
        allowedCompanies: ctx.allowedCompanies
      });
    } catch (err) {
      return serverError(err, context);
    }
  }
});
`);

let app = read('frontend/app.js');
app = replaceOnce(
  app,
  "const state = { data: null, source: 'loading', statusRows: [], apiAvailable: false, mailConfig: null, me: null, companyId: DEFAULT_COMPANY_ID, users: [], operations: null, backups: [], healthHistory: [], securityEvents: [], auditEvents: [] };",
  "const state = { data: null, source: 'loading', statusRows: [], apiAvailable: false, mailConfig: null, me: null, companyId: null, users: [], operations: null, backups: [], healthHistory: [], securityEvents: [], auditEvents: [] };",
  'frontend company state'
);

app = replaceOnce(app, `async function api(path, options={}){
  const headers = {'Content-Type':'application/json','x-company-id': state.companyId || DEFAULT_COMPANY_ID, ...(options.headers||{})};
  const res = await fetch(apiUrl('/api' + path), {...options, headers, mode:'cors'});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
`, `async function api(path, options={}){
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if(state.companyId && !headers['x-company-id']) headers['x-company-id'] = state.companyId;
  const res = await fetch(apiUrl('/api' + path), {...options, headers, mode:'cors', credentials:'include'});
  const text = await res.text();
  let payload = null;
  if(text){ try { payload = JSON.parse(text); } catch { payload = null; } }
  if(!res.ok){
    const error = new Error(payload?.error || text || \`HTTP \${res.status}\`);
    error.status = res.status;
    throw error;
  }
  return payload ?? {};
}
`, 'frontend api helper');

const oldLoadPattern = /async function loadData\(\)\{[\s\S]*?\n\}\n\nfunction renderUserInfo\(ok=true\)\{[\s\S]*?\n\}\n/;
const oldLoadMatch = app.match(oldLoadPattern);
if (!oldLoadMatch) throw new Error('legacy load/auth block not found');

const newLoadBlock = `function setCoreWorkspaceVisible(visible){
  const nav = document.getElementById('portalNavigation') || document.querySelector('.primary-tabs');
  if(nav) nav.hidden = !visible;
  document.querySelectorAll('.view').forEach(view => { view.hidden = !visible; });
  document.body.classList.toggle('auth-pending', !visible);
}

function resetCompanyData(){
  state.data = null;
  state.statusRows = [];
  state.users = [];
  state.mailConfig = null;
  state.operations = null;
  state.backups = [];
  state.healthHistory = [];
  state.securityEvents = [];
  state.auditEvents = [];
  state.apiAvailable = false;
  state.source = 'loading';
}

function updateCompanyLabel(name=''){
  const label = $('activeCompanyLabel');
  if(label) label.textContent = name || state.companyId || 'Keine Firma ausgewählt';
  const switchButton = $('companySwitchAction');
  if(switchButton) switchButton.hidden = !(state.me?.roles?.includes('system_admin') && state.companyId);
}

function isAuthenticationError(err){
  const msg = String(err?.message || err || '').toLowerCase();
  return Number(err?.status) === 401 || Number(err?.status) === 403 || msg.includes('nicht angemeldet') || msg.includes('not authenticated') || msg.includes('freigeschaltet');
}

function renderAuthenticationRequired(message=''){
  resetCompanyData();
  state.me = null;
  state.companyId = null;
  setCoreWorkspaceVisible(false);
  updateCompanyLabel();
  const gate = $('companySelectionGate');
  if(gate) UMAuthLogin.render({target:gate,message});
  renderUserInfo(false);
}

function renderServiceUnavailable(message=''){
  resetCompanyData();
  state.companyId = null;
  setCoreWorkspaceVisible(false);
  updateCompanyLabel();
  const gate = $('companySelectionGate');
  if(gate){
    gate.hidden = false;
    gate.innerHTML = \`<section class="card login-box"><h2>Dienst vorübergehend nicht erreichbar</h2><p>Aus Sicherheitsgründen werden keine Offline- oder Firmendaten ohne erfolgreiche Anmeldung angezeigt.</p>\${message?\`<p class="muted">\${esc(message)}</p>\`:''}<button class="btn primary" type="button" id="retryApplicationLoad">Erneut laden</button></section>\`;
    $('retryApplicationLoad')?.addEventListener('click', loadData);
  }
  renderUserInfo(Boolean(state.me));
}

async function loadCompanyData(){
  if(!state.companyId) throw new Error('Bitte zuerst eine Firma auswählen.');
  state.data = await api('/bootstrap');
  state.apiAvailable = true;
  state.source = 'api';
  try { state.statusRows = await api('/instruction-status'); } catch { state.statusRows = buildLocalStatusRows(); }
  try { state.mailConfig = await api('/mail/config'); } catch { state.mailConfig = { configured:false, missing:['mail/config nicht erreichbar'] }; }
  try { state.users = await api('/users'); } catch { state.users = []; }
  const gate = $('companySelectionGate');
  if(gate){ gate.hidden = true; gate.innerHTML = ''; }
  setCoreWorkspaceVisible(true);
  updateCompanyLabel();
  renderUserInfo(true);
  renderAll();
}

async function showCompanySelection(){
  if(!state.me?.roles?.includes('system_admin')) return false;
  resetCompanyData();
  state.companyId = null;
  setCoreWorkspaceVisible(false);
  updateCompanyLabel();
  const gate = $('companySelectionGate');
  if(!gate) return false;
  gate.hidden = false;
  gate.innerHTML = '<section class="card"><h2>Firma auswählen</h2><p class="muted">Firmen werden geladen …</p></section>';
  try{
    const list = await api('/system/companies');
    const companies = (Array.isArray(list) ? list : []).filter(c => c && c.active !== false);
    gate.innerHTML = \`<section class="card"><h2>Firma auswählen</h2><p class="muted">Wähle die Firma, in der du arbeiten möchtest. Erst danach werden Firmendaten geladen.</p><div class="company-login-grid">\${companies.map(c=>\`<button type="button" class="company-login-choice" data-company-id="\${esc(c.id)}"><strong>\${esc(c.name||c.id)}</strong><span>Firma öffnen</span></button>\`).join('') || '<div class="notice warning">Keine aktive Firma verfügbar.</div>'}</div></section>\`;
    gate.querySelectorAll('[data-company-id]').forEach(button => button.addEventListener('click', async()=>{
      state.companyId = String(button.dataset.companyId || '');
      updateCompanyLabel(button.querySelector('strong')?.textContent || state.companyId);
      try { await loadCompanyData(); }
      catch(err) { state.companyId = null; await showCompanySelection(); }
    }));
    return true;
  }catch(err){
    renderServiceUnavailable(err.message||err);
    return false;
  }
}

async function leaveCompanyContext(){
  if(!state.me?.roles?.includes('system_admin')) return false;
  resetCompanyData();
  state.companyId = null;
  return showCompanySelection();
}

async function loadData(){
  try{
    state.me = await api('/me');
    renderUserInfo(true);
    if(state.me?.roles?.includes('system_admin') && (state.me?.requiresCompanySelection || !state.me?.companyId)){
      await showCompanySelection();
      return;
    }
    state.companyId = state.me?.companyId || null;
    if(!state.companyId) throw new Error('Keine Firma für diesen Benutzer zugeordnet.');
    updateCompanyLabel(state.me?.companyName || state.companyId);
    await loadCompanyData();
  }catch(err){
    if(isAuthenticationError(err)) renderAuthenticationRequired(err.message||err);
    else renderServiceUnavailable(err.message||err);
  }
}

function renderUserInfo(ok=true){
  const el = $('userInfo');
  if(!el) return;
  if(!ok || !state.me) { el.textContent = 'Nicht angemeldet'; return; }
  el.innerHTML = \`\${esc(state.me.displayName || state.me.email || 'Benutzer')} · \${esc(state.companyId || 'Keine Firma ausgewählt')} · \${(state.me.roles||[]).map(r=>\`<span class="role-pill">\${esc(r)}</span>\`).join('')}\`;
}
`;
app = app.replace(oldLoadPattern, newLoadBlock);

const loadInvocation = 'loadData();\n';
const loadIndex = app.indexOf(loadInvocation);
if (loadIndex < 0) throw new Error('loadData invocation not found');
app = app.slice(0, loadIndex) + "document.getElementById('companySwitchAction')?.addEventListener('click', leaveCompanyContext);\n" + app.slice(loadIndex);
write('frontend/app.js', app);

let index = read('frontend/index.html');
for (const [oldValue, newValue, label] of [
  ['<title>Unterweisungsmanager Online · v0.35.5</title>', '<title>Unterweisungsmanager Online · v0.35.6</title>', 'title'],
  ['  <link rel="stylesheet" href="/professional-suite-v35.css">', '  <link rel="stylesheet" href="/professional-suite-v35.css">\n  <link rel="stylesheet" href="/login-gate-v44.css">', 'login css'],
  ['<body>', '<body class="auth-pending">', 'body auth state'],
  ['      <a class="btn ghost login-action" href="/.auth/login/aad">Anmelden</a>\n      <a class="btn ghost logout-action" href="/.auth/logout">Abmelden</a>', '      <button id="companySwitchAction" class="btn ghost" type="button" hidden>Firma wechseln</button>\n      <a class="btn ghost logout-action" href="/.auth/logout">Abmelden</a>', 'top login actions'],
  ['      <span>Essentra aktiv</span>', '      <span id="activeCompanyLabel">Keine Firma ausgewählt</span>', 'company strip'],
  ['      <span>Version <span id="appVersion">v0.35.5</span></span>', '      <span>Version <span id="appVersion">v0.35.6</span></span>', 'version strip'],
  ['    <nav class="tabs primary-tabs">', '    <section id="companySelectionGate" class="company-selection-gate">\n      <div class="card auth-pending-card"><h2>Anmeldung wird geprüft …</h2><p class="muted">Firmendaten werden erst nach erfolgreicher Anmeldung geladen.</p></div>\n    </section>\n\n    <nav id="portalNavigation" class="tabs primary-tabs" hidden>', 'login gate'],
  ['  <script src="/config.js"></script>\n  <script src="/app.js"></script>', '  <script src="/config.js"></script>\n  <script src="/auth-login-v42.js"></script>\n  <script src="/app.js"></script>', 'login script']
]) index = replaceOnce(index, oldValue, newValue, label);
write('frontend/index.html', index);

write('frontend/login-gate-v44.css', `.company-selection-gate{max-width:1180px;margin:42px auto;padding:0 20px}
.auth-pending-card{text-align:center;padding:34px}
.dual-login-shell{max-width:1040px;margin:0 auto}
.dual-login-head{text-align:center;margin-bottom:20px}
.dual-login-head h2{font-size:2rem;margin:8px 0}
.dual-login-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.dual-login-card{padding:24px}
.dual-login-card h3{margin-top:0;font-size:1.25rem}
.dual-login-card .field{margin:14px 0}
.dual-login-card input{width:100%;box-sizing:border-box}
.portal-badge{display:inline-flex;padding:6px 11px;border-radius:999px;font-weight:700;background:#e8f5fa;color:#0b6279}
.employee-login-error{margin-top:12px}
.company-login-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:20px}
.company-login-choice{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:110px;padding:20px;border:1px solid #d5e2e8;border-radius:16px;background:#fff;text-align:left;cursor:pointer}
.company-login-choice:hover{box-shadow:0 10px 28px rgba(27,74,94,.12);transform:translateY(-1px)}
body.auth-pending .logout-action,body.auth-pending #companySwitchAction{display:none!important}
@media(max-width:760px){.dual-login-grid{grid-template-columns:1fr}.company-selection-gate{margin:22px auto;padding:0 12px}}
`);

console.log('Central login hotfix files prepared.');
