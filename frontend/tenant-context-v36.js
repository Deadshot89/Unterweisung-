// v0.36: Ein einziger, konsistenter Mandantenkontext fuer Kopfzeile, Ansichten und API-Ladevorgaenge.
// Verhindert, dass alte Ansichten oder verspaetete Antworten nach einem Firmenwechsel sichtbar bleiben.

function activeCompanyName(){
  const selectedId = state.companyId || '';
  if(!selectedId) return 'Keine Firma ausgewählt';
  const selected = (state.data?.companies || []).find(company => company?.id === selectedId);
  if(selected?.name) return selected.name;
  if(state.me?.companyId === selectedId && state.me?.companyName) return state.me.companyName;
  return selectedId;
}

updateCompanyLabel = function(name=''){
  const label = $('activeCompanyLabel');
  if(label) label.textContent = name || activeCompanyName();
  const switchButton = $('companySwitchAction');
  if(switchButton) switchButton.hidden = !(state.me?.roles?.includes('system_admin') && state.companyId);
};

renderAll = function(){
  const activeView = document.querySelector('.view.active')?.id
    || document.querySelector('.tabs button.active')?.dataset?.view
    || 'dashboard';
  render(activeView);
};

loadCompanyData = async function(){
  const companyId = state.companyId;
  if(!companyId) throw new Error('Bitte zuerst eine Firma auswählen.');

  const companyHeaders = {'x-company-id': companyId};
  const scopedApi = (path) => api(path, {headers: companyHeaders});

  const data = await scopedApi('/bootstrap');
  if(state.companyId !== companyId) return false;
  state.data = data;
  state.apiAvailable = true;
  state.source = 'api';

  let statusRows;
  try { statusRows = await scopedApi('/instruction-status'); }
  catch { statusRows = buildLocalStatusRows(); }
  if(state.companyId !== companyId) return false;
  state.statusRows = statusRows;

  let mailConfig;
  try { mailConfig = await scopedApi('/mail/config'); }
  catch { mailConfig = { configured:false, missing:['mail/config nicht erreichbar'] }; }
  if(state.companyId !== companyId) return false;
  state.mailConfig = mailConfig;

  let users;
  try { users = await scopedApi('/users'); }
  catch { users = []; }
  if(state.companyId !== companyId) return false;
  state.users = users;

  const gate = $('companySelectionGate');
  if(gate){ gate.hidden = true; gate.innerHTML = ''; }
  setCoreWorkspaceVisible(true);
  updateCompanyLabel();
  renderUserInfo(true);
  renderAll();
  return true;
};

window.activeCompanyName = activeCompanyName;
