import fs from 'node:fs';

const authPath = 'frontend/auth-login-v42.js';
let auth = fs.readFileSync(authPath, 'utf8');
const reload = '      location.reload();';
const direct = "      document.dispatchEvent(new CustomEvent('um:password-authenticated',{detail:data}));";
if (auth.includes(reload)) {
  auth = auth.replace(reload, direct);
  fs.writeFileSync(authPath, auth);
} else if (!auth.includes('um:password-authenticated')) {
  throw new Error('Login-Erfolgsanker nicht gefunden');
}

const appPath = 'frontend/app.js';
let app = fs.readFileSync(appPath, 'utf8');
const start = app.indexOf('async function loadCompanyData(){');
const end = app.indexOf('\n\nasync function showCompanySelection()', start);
if (start < 0 || end <= start) throw new Error('loadCompanyData-Block nicht gefunden');

const replacement = `async function loadCompanyData(){
  if(!state.companyId) throw new Error('Bitte zuerst eine Firma auswählen.');
  const companyIdAtStart = state.companyId;
  const bootstrapPromise = api('/bootstrap');
  const secondaryPromise = Promise.allSettled([
    api('/instruction-status'),
    api('/mail/config'),
    api('/users')
  ]);

  const gate = $('companySelectionGate');
  if(gate){
    gate.hidden = false;
    gate.innerHTML = '<section class="card"><h2>Angemeldet</h2><p class="muted">Firmendaten werden geladen …</p></section>';
  }
  setCoreWorkspaceVisible(false);
  updateCompanyLabel();
  renderUserInfo(true);

  const bootstrap = await bootstrapPromise;
  if(state.companyId !== companyIdAtStart) return;
  state.data = bootstrap;
  state.apiAvailable = true;
  state.source = 'api';
  if(gate){ gate.hidden = true; gate.innerHTML = ''; }
  setCoreWorkspaceVisible(true);
  updateCompanyLabel();
  renderUserInfo(true);
  renderAll();

  const [statusResult, mailResult, usersResult] = await secondaryPromise;
  if(state.companyId !== companyIdAtStart) return;
  state.statusRows = statusResult.status === 'fulfilled' ? statusResult.value : buildLocalStatusRows();
  state.mailConfig = mailResult.status === 'fulfilled' ? mailResult.value : { configured:false, missing:['mail/config nicht erreichbar'] };
  state.users = usersResult.status === 'fulfilled' ? usersResult.value : [];
  renderAll();
}`;

app = app.slice(0, start) + replacement + app.slice(end);

if (!app.includes("document.addEventListener('um:password-authenticated',()=>loadData());")) {
  const marker = "document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));";
  if (!app.includes(marker)) throw new Error('App-Listener-Anker nicht gefunden');
  app = app.replace(marker, "document.addEventListener('um:password-authenticated',()=>loadData());\n" + marker);
}

fs.writeFileSync(appPath, app);
