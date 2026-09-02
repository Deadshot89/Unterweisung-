// v0.34: Professionelle Seitenkoepfe fuer Arbeitsbereiche.
// Keine API-Aenderung: ergaenzt nur kurze Orientierung pro Reiter.

const VIEW_HEADER_DESIGN_VERSION = 'v0.34';

const VIEW_HEADERS = {
  companies: ['Firmen', 'Mandanten verwalten und Firmenstartpakete pruefen.'],
  employees: ['Mitarbeiter', 'Stammdaten, Import und Line-Manager-Zuordnung pflegen.'],
  instructions: ['Unterweisungen', 'Unterweisungstypen, Unterlagen und Testfragen verwalten.'],
  status: ['Status', 'Faellige, fehlende und abgelaufene Unterweisungen abarbeiten.'],
  reminders: ['Erinnerungen', 'Mahnlisten und Mailtexte fuer offene Unterweisungen erstellen.'],
  proofs: ['Nachweise', 'Nachweisdateien hochladen, pruefen und zuordnen.'],
  managerReport: ['Manager-Report', 'Offene Unterweisungen je Verantwortlichem auswerten.'],
  planning: ['Planung', 'Gruppentermine planen, Teilnehmer auswaehlen und abschliessen.'],
  external: ['Externe Links', 'Einmal-Links fuer externe Unterweisungen erzeugen und pruefen.'],
  users: ['Benutzer', 'Zugriff, Rollen und Freischaltung steuern.'],
  operations: ['Betrieb', 'Healthcheck, Backup, Restore-Pruefung und Protokolle.'],
  security: ['Sicherheit', 'Audit, Security-Events und rollenbasierte Sperren kontrollieren.']
};

function viewHeaderMarkup(viewId){
  const cfg = VIEW_HEADERS[viewId];
  if(!cfg) return '';
  const [title, subtitle] = cfg;
  return `<div class="view-head" data-view-head="${esc(viewId)}">
    <div>
      <span class="view-eyebrow">Arbeitsbereich</span>
      <h2>${esc(title)}</h2>
      <p>${esc(subtitle)}</p>
    </div>
  </div>`;
}

function applyViewHeaders(root = document){
  Object.keys(VIEW_HEADERS).forEach((viewId) => {
    const view = root.getElementById ? root.getElementById(viewId) : document.getElementById(viewId);
    if(!view || view.id === 'dashboard') return;
    const existing = view.querySelector(':scope > .view-head');
    if(existing) return;
    view.insertAdjacentHTML('afterbegin', viewHeaderMarkup(viewId));
  });

  const version = document.getElementById('appVersion');
  if(version) version.textContent = VIEW_HEADER_DESIGN_VERSION;
  document.body.dataset.viewHeaderDesign = VIEW_HEADER_DESIGN_VERSION;
}

if(typeof render === 'function'){
  const originalRenderForViewHeaders = render;
  render = function(id){
    const result = originalRenderForViewHeaders(id);
    window.requestAnimationFrame(() => applyViewHeaders());
    return result;
  };
}

const viewHeaderObserver = new MutationObserver((mutations) => {
  if(!mutations.some(m => m.addedNodes && m.addedNodes.length)) return;
  window.requestAnimationFrame(() => applyViewHeaders());
});

viewHeaderObserver.observe(document.body, { childList:true, subtree:true });

window.VIEW_HEADER_DESIGN_VERSION = VIEW_HEADER_DESIGN_VERSION;
window.VIEW_HEADERS = VIEW_HEADERS;
window.applyViewHeaders = applyViewHeaders;

window.requestAnimationFrame(() => applyViewHeaders());
