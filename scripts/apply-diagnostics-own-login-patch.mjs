import fs from 'node:fs';

const htmlPath = 'frontend/diagnostics.html';
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('id="diagLoginPanel"')) {
  const anchor = '    <section id="diagAccessMessage" class="message info">Diagnosezugriff wird geprüft …</section>\n\n';
  const login = `    <section id="diagLoginPanel" class="diag-login-panel" hidden aria-labelledby="diagLoginTitle">
      <div class="diag-login-card">
        <p class="eyebrow">Service-App</p>
        <h1 id="diagLoginTitle">Anmelden</h1>
        <p>Mit demselben E-Mail-/Passwort-Zugang wie im Unterweisungsmanager. Die Diagnose-App bleibt danach über die sichere Sitzung angemeldet.</p>
        <form id="diagLoginForm" class="diag-login-form">
          <label>E-Mail
            <input id="diagLoginEmail" type="email" autocomplete="username" inputmode="email" required>
          </label>
          <label>Passwort
            <input id="diagLoginPassword" type="password" autocomplete="current-password" required>
          </label>
          <button id="diagLoginSubmit" type="submit" class="button">Anmelden</button>
          <p id="diagLoginMessage" class="message error" hidden></p>
        </form>
      </div>
    </section>

`;
  if (!html.includes(anchor)) throw new Error('HTML-Anker für Diagnose-Login nicht gefunden');
  html = html.replace(anchor, anchor + login);
  fs.writeFileSync(htmlPath, html);
}

const cssPath = 'frontend/diagnostics.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.diag-login-panel')) {
  css += `
.diag-login-panel{min-height:calc(100vh - 120px);display:grid;place-items:center;padding:30px 0}
.diag-login-panel[hidden]{display:none}
.diag-login-card{width:min(460px,100%);background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(15,23,42,.10);padding:28px}
.diag-login-card h1{margin:4px 0 8px;font-size:30px;letter-spacing:-.03em}.diag-login-card>p:not(.eyebrow){margin:0 0 20px;color:#475467;line-height:1.55}
.diag-login-form{display:grid;gap:15px}.diag-login-form label{display:grid;gap:6px;font-size:13px;font-weight:700;color:#344054}.diag-login-form input{width:100%;border:1px solid #cfd8e3;border-radius:10px;padding:11px 12px;background:#fff;color:#1d2939;outline:none}.diag-login-form input:focus{border-color:#8098b5;box-shadow:0 0 0 3px rgba(37,99,235,.08)}.diag-login-form .message{margin:0}.diag-login-form .button{width:100%}
`;
  fs.writeFileSync(cssPath, css);
}

const appPath = 'frontend/diagnostics-app.js';
let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes('async function submitLogin')) {
  const replacement = `  function setLoginMessage(text, kind = 'error') {
    const el = $('diagLoginMessage');
    if (!el) return;
    el.className = \`message \${kind}\`;
    el.textContent = text;
    el.hidden = !text;
  }

  function showLogin(message = '') {
    state.me = null;
    if ($('diagWorkspace')) $('diagWorkspace').hidden = true;
    if ($('diagLoginPanel')) $('diagLoginPanel').hidden = false;
    if ($('diagUser')) $('diagUser').textContent = 'Nicht angemeldet';
    setMessage('');
    setLoginMessage(message, message ? 'error' : 'info');
    setTimeout(() => $('diagLoginEmail')?.focus(), 0);
  }

  function hideLogin() {
    if ($('diagLoginPanel')) $('diagLoginPanel').hidden = true;
    if ($('diagLoginPassword')) $('diagLoginPassword').value = '';
    setLoginMessage('');
  }

  async function loadAuthenticatedDiagnostics() {
    state.me = await api('/me');
    $('diagUser').textContent = \`\${state.me.displayName || state.me.email || 'Benutzer'} · \${(state.me.roles || []).includes('system_admin') ? 'System Admin' : 'Diagnosezugriff'}\`;
    hideLogin();
    if (!hasDiagnosticAccess()) {
      if ($('diagWorkspace')) $('diagWorkspace').hidden = true;
      setMessage('Für dieses Benutzerkonto ist die Fehlerdiagnose nicht freigegeben.', 'error');
      return;
    }
    $('diagWorkspace').hidden = false;
    setMessage('');
    await loadCompanies();
    await Promise.all([loadDiagnostics(), updatePushState()]);
  }

  async function submitLogin(event) {
    event.preventDefault();
    const email = $('diagLoginEmail')?.value.trim() || '';
    const password = $('diagLoginPassword')?.value || '';
    const button = $('diagLoginSubmit');
    if (button) button.disabled = true;
    setLoginMessage('Anmeldung wird geprüft …', 'info');
    try {
      const response = await fetch(apiUrl('/auth/password/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        mode: 'cors',
        cache: 'no-store',
        body: JSON.stringify({ email, password })
      });
      const text = await response.text();
      let payload = {};
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = {}; }
      }
      if (!response.ok) throw new Error(payload?.error || text || \`Anmeldung fehlgeschlagen (HTTP \${response.status}).\`);
      await loadAuthenticatedDiagnostics();
    } catch (err) {
      showLogin(err.message || String(err));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function initialize() {
    bindInstallPrompt();
    try {
      await loadAuthenticatedDiagnostics();
    } catch (err) {
      if (Number(err?.status) === 401) {
        showLogin();
        return;
      }
      $('diagUser').textContent = 'Nicht angemeldet';
      setMessage(\`Fehlerdiagnose konnte nicht gestartet werden: \${err.message || err}\`, 'error');
    }
  }

`;
  const pattern = /  async function initialize\(\) \{[\s\S]*?\n  \}\n\n(?=  \$\('diagRefresh'\))/;
  if (!pattern.test(app)) throw new Error('Initialize-Block für Diagnose-Login nicht gefunden');
  app = app.replace(pattern, replacement);
  const listenerAnchor = "  $('diagRefresh')?.addEventListener('click', loadDiagnostics);";
  if (!app.includes(listenerAnchor)) throw new Error('Listener-Anker für Diagnose-Login nicht gefunden');
  app = app.replace(listenerAnchor, "  $('diagLoginForm')?.addEventListener('submit', submitLogin);\n" + listenerAnchor);
  fs.writeFileSync(appPath, app);
}
