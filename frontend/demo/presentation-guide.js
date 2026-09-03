const TOUR_STEPS = [
  {
    title: '1 · Unternehmensüberblick',
    text: 'Start im Firmenadmin-Dashboard: Fälligkeiten, fehlende Nachweise und Handlungsbedarf werden an einer Stelle sichtbar.',
    role: 'company_admin',
    person: 'emp-lena-hoffmann',
    view: 'dashboard'
  },
  {
    title: '2 · Status statt Excel-Suche',
    text: 'Die Statusansicht bündelt offene, bald fällige und abgeschlossene Unterweisungen. So lässt sich der nächste Handlungsbedarf direkt erkennen.',
    role: 'company_admin',
    person: 'emp-lena-hoffmann',
    view: 'status'
  },
  {
    title: '3 · Verantwortung bei der Führungskraft',
    text: 'Führungskräfte sehen nur ihr direktes Team und können praktische Unterweisungen einplanen oder bestätigen.',
    role: 'line_manager',
    person: 'emp-jonas-keller',
    view: 'planning'
  },
  {
    title: '4 · Klare Mitarbeiteransicht',
    text: 'Mitarbeitende sehen nur ihre eigenen Aufgaben: jetzt erledigen, Terminbedarf, geplante Termine, bald fällige und abgeschlossene Unterweisungen.',
    role: 'employee',
    person: 'emp-mila-hartmann',
    view: 'my-training'
  },
  {
    title: '5 · Bildgestützte Online-Unterweisung',
    text: 'Online-Unterweisungen führen Schritt für Schritt durch freigegebene Lerninhalte und können mit einem Abschlusstest enden.',
    role: 'employee',
    person: 'emp-mila-hartmann',
    view: 'my-training',
    action: 'open-learning',
    feature: 'Online-Unterweisung'
  },
  {
    title: '6 · Nachweis direkt verfügbar',
    text: 'Abgeschlossene Unterweisungen bleiben nachvollziehbar. In dieser Präsentation werden ausschließlich klar markierte DEMO-/MUSTER-Nachweise erzeugt.',
    role: 'employee',
    person: 'emp-mila-hartmann',
    view: 'proofs'
  }
];

const state = { active: false, index: 0 };
const byId = id => document.getElementById(id);

function closeAnyDemoModal() {
  const backdrop = document.querySelector('.modal-backdrop');
  if (!backdrop) return;
  const close = backdrop.querySelector('[data-close-modal], .modal-head .btn');
  if (close) close.click();
  else backdrop.remove();
}

function setPresentationRole(step) {
  const role = byId('demoRole');
  const person = byId('demoPerson');
  if (!role || !person) return;
  if (role.value !== step.role) {
    role.value = step.role;
    role.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (step.person && [...person.options].some(option => option.value === step.person) && person.value !== step.person) {
    person.value = step.person;
    person.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function selectView(view) {
  const button = document.querySelector(`#demoNav button[data-view="${view}"]`);
  if (button) button.click();
}

function performStepAction(step) {
  if (step.action !== 'open-learning') return;
  const learn = document.querySelector('[data-learn]');
  if (learn) learn.click();
}

function applyStep(step) {
  closeAnyDemoModal();
  setPresentationRole(step);
  selectView(step.view);
  performStepAction(step);
  document.querySelector('.presenter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDock() {
  const dock = byId('showcaseTourDock');
  if (!dock) return;
  const step = TOUR_STEPS[state.index];
  dock.hidden = !state.active;
  if (!state.active) return;
  dock.querySelector('[data-tour-title]').textContent = step.title;
  dock.querySelector('[data-tour-text]').textContent = step.text;
  dock.querySelector('[data-tour-count]').textContent = `${state.index + 1} / ${TOUR_STEPS.length}`;
  dock.querySelector('[data-tour-prev]').disabled = state.index === 0;
  dock.querySelector('[data-tour-next]').textContent = state.index === TOUR_STEPS.length - 1 ? 'Tour beenden' : 'Nächster Schritt';
  dock.querySelector('[data-tour-progress]').style.width = `${((state.index + 1) / TOUR_STEPS.length) * 100}%`;
}

function showStep(index) {
  state.index = Math.max(0, Math.min(index, TOUR_STEPS.length - 1));
  state.active = true;
  applyStep(TOUR_STEPS[state.index]);
  renderDock();
}

function finishTour() {
  state.active = false;
  closeAnyDemoModal();
  renderDock();
}

function initPresentationGuide() {
  const start = byId('showcaseTourStart');
  const direct = byId('showcaseDirectDemo');
  const dock = byId('showcaseTourDock');
  if (!start || !direct || !dock) return;

  start.addEventListener('click', () => showStep(0));
  direct.addEventListener('click', () => document.querySelector('.presenter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  dock.querySelector('[data-tour-prev]').addEventListener('click', () => showStep(state.index - 1));
  dock.querySelector('[data-tour-next]').addEventListener('click', () => {
    if (state.index >= TOUR_STEPS.length - 1) finishTour();
    else showStep(state.index + 1);
  });
  dock.querySelector('[data-tour-close]').addEventListener('click', finishTour);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPresentationGuide, { once: true });
else initPresentationGuide();

export { TOUR_STEPS };
