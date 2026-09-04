import { DEMO_DATA } from './demo-data.js';
import './demo-quality-data.js';
import { createEnhancedDemoStore } from './demo-mail-store.js';

const STORAGE_KEY = 'um-company-showcase-state-v1';
const store = createEnhancedDemoStore(DEMO_DATA, globalThis.localStorage);
let externalSession = null;
let decorating = false;
let lastInternalInstructionId = null;

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const employeeById = id => store.getState().employees.find(item => item.id === id);
const instructionById = id => store.getState().instructionTypes.find(item => item.id === id);
const modalRoot = () => document.getElementById('demoModalRoot');
const sharedStep = model => globalThis.UMLearningExperience.renderLearningStep(model);
const sharedQuestions = model => globalThis.UMLearningExperience.renderQuestionList(model);
const sharedResult = model => globalThis.UMLearningExperience.renderResult(model);

function requireLearningCore() {
  if (!globalThis.UMLearningExperience?.renderLearningStep || !globalThis.UMLearningExperience?.renderQuestionList || !globalThis.UMLearningExperience?.renderResult) {
    throw new Error('Die gemeinsame Lernoberfläche konnte nicht geladen werden.');
  }
  return globalThis.UMLearningExperience;
}

function persistState() {
  globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(store.getState()));
}

function visiblePlans() {
  const session = store.getSession();
  return store.getState().plannedTrainings.filter(plan => plan.status === 'planned' && (
    session.role === 'company_admin' || plan.responsibleId === session.employeeId || plan.employeeId === session.employeeId
  ));
}

function buildInstructionModel(instruction) {
  return {
    name: instruction?.name || '',
    description: instruction?.description || '',
    learningGoal: instruction?.learningGoal || instruction?.description || '',
    learningIntro: instruction?.learningIntro || instruction?.intro || '',
    keyPoints: Array.isArray(instruction?.keyPoints) ? instruction.keyPoints : []
  };
}

function buildStepModel(step) {
  return {
    title: step?.title || '',
    body: step?.body || step?.text || '',
    imageUrl: step?.imageUrl || step?.image || '',
    imageCaption: step?.imageCaption || '',
    calloutTitle: step?.calloutTitle || '',
    calloutText: step?.calloutText || ''
  };
}

function decorateContent() {
  if (decorating) return;
  decorating = true;
  try {
    const content = document.getElementById('demoContent');
    if (!content) return;
    const session = store.getSession();
    const header = content.querySelector('.view-header');
    const title = header?.querySelector('h1')?.textContent?.trim() || '';

    if (header && session.role !== 'employee' && (title.startsWith('Team von ') || title === 'Unterweisungen im Blick' || title === 'Geplante Unterweisungen')) {
      let actions = header.querySelector('.demo-extension-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'demo-extension-actions';
        header.appendChild(actions);
      }
      if (!actions.querySelector('[data-demo-external-invite]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn secondary';
        button.dataset.demoExternalInvite = '1';
        button.textContent = 'Externe Unterweisung senden';
        actions.prepend(button);
      }
    }

    if (title === 'Geplante Unterweisungen' && session.role !== 'employee') {
      const plans = visiblePlans();
      const rows = [...content.querySelectorAll('tbody tr')];
      rows.forEach((row, index) => {
        const plan = plans[index];
        if (!plan) return;
        const actionCell = row.lastElementChild;
        if (!actionCell || actionCell.querySelector(`[data-demo-plan-mail="${plan.id}"]`)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn secondary small demo-plan-mail';
        button.dataset.demoPlanMail = plan.id;
        button.textContent = 'Termin per Mail senden';
        actionCell.append(' ', button);
        if (plan.mailStatus === 'simulated_sent') {
          const marker = document.createElement('span');
          marker.className = 'mail-sent-marker';
          marker.textContent = 'Mail simuliert ✓';
          actionCell.append(' ', marker);
        }
      });
    }
  } finally {
    decorating = false;
  }
}

function decorateScheduleDialog() {
  const form = document.getElementById('demoScheduleForm');
  if (!form || form.dataset.mailEnhanced === 'true') return;
  form.dataset.mailEnhanced = 'true';
  const body = form.querySelector('.modal-body');
  if (!body) return;
  const option = document.createElement('label');
  option.className = 'schedule-mail-option';
  option.innerHTML = '<input type="checkbox" name="sendPlanningMail" checked><span><strong>Termin per Mail senden</strong><small>In der Demo wird nur eine lokale Mailvorschau erzeugt. Es wird keine Nachricht versendet.</small></span>';
  body.appendChild(option);
}

function decorateInternalLearningStep() {
  const modal = modalRoot()?.querySelector('.learning-modal');
  const legacyLayout = modal?.querySelector('.learning-layout');
  const body = modal?.querySelector('.modal-body');
  if (!modal || !legacyLayout || !body || body.dataset.sharedLearning === 'true') return;

  requireLearningCore();
  const instructionName = modal.querySelector('.modal-head h2')?.textContent?.trim();
  const stepTitle = legacyLayout.querySelector('.learning-copy h3')?.textContent?.trim();
  const instruction = store.getState().instructionTypes.find(item => item.name === instructionName);
  const steps = store.getState().learningSteps.filter(item => item.instructionId === instruction?.id).sort((a,b) => a.order - b.order);
  const index = Math.max(0, steps.findIndex(item => item.title === stepTitle));
  const step = steps[index];
  if (!instruction || !step) return;

  lastInternalInstructionId = instruction.id;
  const assignment = store.getState().assignments.find(item => item.employeeId === store.getSession().employeeId && item.instructionId === instruction.id);
  const completedSteps = Math.max(Number(assignment?.progress || 0), index);
  const progress = Math.min(100, Math.round((completedSteps / Math.max(1, steps.length)) * 100));
  body.dataset.sharedLearning = 'true';
  body.innerHTML = `<div class="demo-learning-progress" aria-label="Lernfortschritt"><span style="width:${progress}%"></span></div>${sharedStep({instruction:buildInstructionModel(instruction),step:buildStepModel(step),index,total:steps.length})}<div class="demo-learning-toolbar"><span>Lernziel · Praxisbezug · Wichtige Merkpunkte</span><button type="button" class="btn secondary small" data-demo-zoom="${esc(step.image || '')}">Bild vergrößern</button></div>`;
}

function wireSharedQuestionInputs(form, questions, prefix) {
  for (const question of questions) {
    const expected = `${prefix}_${question.id}`;
    form.querySelectorAll(`input[name="${expected}"]`).forEach(input => {
      input.name = question.id;
      input.required = true;
    });
  }
  const update = () => {
    const answered = new Set([...form.querySelectorAll('input[type="radio"]:checked')].map(input => input.name)).size;
    const bar = form.querySelector('.um-test-progress span');
    if (bar) bar.style.width = `${Math.round((answered / Math.max(1, questions.length)) * 100)}%`;
  };
  form.addEventListener('change', update);
  update();
}

function decorateInternalTest() {
  const form = document.getElementById('demoTrainingTest');
  const modal = form?.closest('.learning-modal');
  const body = form?.querySelector('.modal-body');
  if (!form || !modal || !body || form.dataset.sharedLearning === 'true') return;

  requireLearningCore();
  const instructionName = modal.querySelector('.modal-head h2')?.textContent?.trim();
  const instruction = store.getState().instructionTypes.find(item => item.name === instructionName) || instructionById(lastInternalInstructionId);
  const definition = store.getState().tests.find(item => item.instructionId === instruction?.id);
  if (!instruction || !definition) return;

  lastInternalInstructionId = instruction.id;
  const questions = (definition.questions || []).map(question => ({ id:question.id, question:question.text, options:question.options || [] }));
  form.dataset.sharedLearning = 'true';
  body.innerHTML = sharedQuestions({questions,passPercent:instruction.passPercent || 80,namePrefix:'demoShared'});
  wireSharedQuestionInputs(form, questions, 'demoShared');
}

function decorateInternalResult() {
  const resultBox = modalRoot()?.querySelector('.result-box');
  const modal = resultBox?.closest('.modal');
  const body = modal?.querySelector('.modal-body');
  if (!resultBox || !modal || !body || body.dataset.sharedResult === 'true') return;

  requireLearningCore();
  const passed = resultBox.classList.contains('pass');
  const scoreText = resultBox.querySelector('div')?.textContent || '';
  const score = Number.parseInt(scoreText, 10);
  const instruction = instructionById(lastInternalInstructionId);
  body.dataset.sharedResult = 'true';
  body.innerHTML = sharedResult({passed,scorePercent:Number.isFinite(score) ? score : null,passPercent:instruction?.passPercent || 80});
}

function decorateModal() {
  decorateScheduleDialog();
  decorateInternalLearningStep();
  decorateInternalTest();
  decorateInternalResult();
}

function openExternalInstructionDialog() {
  const state = store.getState();
  const online = state.instructionTypes.filter(item => item.active !== false && item.deliveryMode === 'online');
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal external-invite-modal"><div class="modal-head"><div><span class="eyebrow">Externe Teilnahme</span><h2>Externe Unterweisung senden</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><form id="demoExternalInviteForm"><div class="modal-body"><div class="demo-safety-note"><strong>DEMO-VERSAND</strong><span>Die Nachricht wird nur im Browser simuliert. Keine E-Mail verlässt diese Demo.</span></div><div class="form-grid"><label class="full">Unterweisung<select name="instructionId" required>${online.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label><label>Name des externen Teilnehmers<input name="recipientName" value="Max Mustermann" required></label><label>E-Mail-Adresse<input name="recipientEmail" type="email" value="max.mustermann@kunde.example" required></label></div><div class="external-info-card"><strong>Kein Benutzerkonto erforderlich</strong><p>Der externe Teilnehmer erhält in der echten Lösung einen persönlichen Link zur freigegebenen Online-Unterweisung. In dieser Demo wird der gesamte Ablauf lokal nachgestellt.</p></div></div><div class="modal-actions"><button class="btn ghost" type="button" data-demo-close>Abbrechen</button><button class="btn primary" type="submit">Demo-Mail senden</button></div></form></section></div>`;

  document.getElementById('demoExternalInviteForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    try {
      const invitation = store.sendExternalInstruction(store.getSession().employeeId, {
        instructionId: String(fd.get('instructionId')),
        recipientName: String(fd.get('recipientName')),
        recipientEmail: String(fd.get('recipientEmail'))
      });
      const mail = store.getDemoMailOutbox().find(item => item.id === invitation.mailId);
      openMailPreview(mail, invitation);
      decorateContent();
    } catch (error) {
      showExtensionError(error.message);
    }
  });
}

function openMailPreview(mail, invitation = null) {
  if (!mail) return;
  const root = modalRoot();
  const action = invitation ? `<button type="button" class="btn primary" data-demo-external-preview="${esc(invitation.id)}">Empfängeransicht öffnen</button>` : '<button type="button" class="btn primary" data-demo-close>Fertig</button>';
  root.innerHTML = `<div class="modal-backdrop"><section class="modal mail-preview-modal"><div class="modal-head"><div><span class="eyebrow">Mailvorschau</span><h2>${mail.kind === 'planning' ? 'Terminmail simuliert' : 'Externe Einladung simuliert'}</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="demo-safety-note success"><strong>NICHT ECHT VERSENDET</strong><span>Diese Mail existiert ausschließlich im lokalen Demo-Zustand dieses Browsers.</span></div><article class="mail-preview"><div class="mail-preview-header"><span>Von</span><strong>${esc(mail.senderName)}</strong><span>An</span><strong>${esc(mail.recipientName)} · ${esc(mail.recipientEmail)}</strong><span>Betreff</span><strong>${esc(mail.subject)}</strong></div><div class="mail-preview-body">${esc(mail.body).replace(/\n/g, '<br>')}</div>${invitation ? `<div class="mail-preview-link"><span>Persönlicher Demo-Link</span><code>${esc(invitation.demoLink)}</code></div>` : ''}</article></div><div class="modal-actions"><button class="btn ghost" type="button" data-demo-close>Schließen</button>${action}</div></section></div>`;
}

function openExternalRecipient(invitationId) {
  const state = store.getState();
  const invitation = (state.externalInvitations || []).find(item => item.id === invitationId);
  if (!invitation) return showExtensionError('Externe Demo-Einladung wurde nicht gefunden.');
  const instruction = instructionById(invitation.instructionId);
  const steps = state.learningSteps.filter(item => item.instructionId === instruction?.id).sort((a,b) => a.order - b.order);
  externalSession = { invitationId, instruction, steps, index:0 };
  renderExternalStep();
}

function renderExternalStep() {
  if (!externalSession) return;
  requireLearningCore();
  const { invitationId, instruction, steps, index } = externalSession;
  const invitation = (store.getState().externalInvitations || []).find(item => item.id === invitationId);
  const step = steps[index];
  if (!step || !invitation) return;
  const root = modalRoot();
  const progress = Math.round(((index + 1) / Math.max(1, steps.length)) * 100);
  root.innerHTML = `<div class="modal-backdrop"><section class="modal external-learning-modal"><div class="modal-head"><div><span class="eyebrow">Externer Demo-Zugang · Kein Konto erforderlich</span><h2>${esc(instruction.name)}</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="external-recipient"><span>Teilnehmer</span><strong>${esc(invitation.recipientName)}</strong><small>${esc(invitation.recipientEmail)}</small></div><div class="external-progress"><span style="width:${progress}%"></span></div>${sharedStep({instruction:buildInstructionModel(instruction),step:buildStepModel(step),index,total:steps.length})}<div class="demo-learning-toolbar"><span>Gemeinsamer Lernstandard</span><button type="button" class="btn secondary small" data-demo-zoom="${esc(step.image || '')}">Bild vergrößern</button></div></div><div class="modal-actions"><button class="btn ghost" type="button" data-demo-external-prev ${index === 0 ? 'disabled' : ''}>Zurück</button><button class="btn primary" type="button" data-demo-external-next>${index === steps.length - 1 ? (instruction.testRequired ? 'Zum Test' : 'Demo-Unterweisung abschließen') : 'Weiter'}</button></div></section></div>`;
}

function renderExternalTest() {
  if (!externalSession) return;
  requireLearningCore();
  const { instruction, invitationId } = externalSession;
  const invitation = (store.getState().externalInvitations || []).find(item => item.id === invitationId);
  const definition = store.getState().tests.find(item => item.instructionId === instruction.id);
  const questions = (definition?.questions || []).map(question => ({ id:question.id, question:question.text, options:question.options || [] }));
  if (!questions.length) return renderExternalResult({passed:true,score:100});
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal external-learning-modal"><div class="modal-head"><div><span class="eyebrow">Externer Demo-Zugang · Abschlusstest</span><h2>${esc(instruction.name)}</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><form id="demoExternalTrainingTest"><div class="modal-body"><div class="external-recipient"><span>Teilnehmer</span><strong>${esc(invitation?.recipientName || '')}</strong><small>${esc(invitation?.recipientEmail || '')}</small></div>${sharedQuestions({questions,passPercent:instruction.passPercent || 80,namePrefix:'externalQuestion'})}</div><div class="modal-actions"><button class="btn ghost" type="button" data-demo-external-return>Zurück zum Inhalt</button><button class="btn primary" type="submit">Test auswerten</button></div></form></section></div>`;
  const form = document.getElementById('demoExternalTrainingTest');
  for (const question of questions) form?.querySelectorAll(`input[name="externalQuestion_${question.id}"]`).forEach(input => { input.required = true; });
  form?.addEventListener('change', () => {
    const answered = new Set([...form.querySelectorAll('input[type="radio"]:checked')].map(input => input.name)).size;
    const bar = form.querySelector('.um-test-progress span');
    if (bar) bar.style.width = `${Math.round((answered / Math.max(1, questions.length)) * 100)}%`;
  });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const fd = new FormData(form);
    const sourceQuestions = definition.questions || [];
    const correct = sourceQuestions.filter(question => Number(fd.get(`externalQuestion_${question.id}`)) === Number(question.correctOption)).length;
    const score = Math.round((correct / Math.max(1, sourceQuestions.length)) * 100);
    renderExternalResult({passed:score >= Number(instruction.passPercent || 80),score});
  });
}

function renderExternalResult({passed,score}) {
  if (!externalSession) return;
  requireLearningCore();
  const { instruction, invitationId } = externalSession;
  if (passed) {
    const invitation = (store.getState().externalInvitations || []).find(item => item.id === invitationId);
    if (invitation) {
      invitation.status = 'demo_completed';
      invitation.completedAt = store.getState().meta.referenceDate;
      persistState();
    }
  }
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal external-learning-modal"><div class="modal-head"><div><span class="eyebrow">Externe Unterweisung</span><h2>${esc(instruction.name)}</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body">${sharedResult({passed,scorePercent:score,passPercent:instruction.passPercent || 80})}</div><div class="modal-actions">${passed ? '<button class="btn primary" type="button" data-demo-close>Zur Demo zurück</button>' : '<button class="btn ghost" type="button" data-demo-external-return>Lerninhalte erneut ansehen</button><button class="btn primary" type="button" data-demo-external-retry-test>Test erneut versuchen</button>'}</div></section></div>`;
}

function showExtensionError(message) {
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>Demo-Aktion nicht möglich</h2><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="demo-error-box">${esc(message)}</div></div><div class="modal-actions"><button class="btn primary" type="button" data-demo-close>Verstanden</button></div></section></div>`;
}

function openZoom(src) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  overlay.innerHTML = `<button class="btn ghost zoom-close" type="button">Schließen</button><img src="${esc(src)}" alt="Vergrößerte Demo-Illustration">`;
  const close = () => overlay.remove();
  overlay.querySelector('button')?.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
}

function handleClick(event) {
  const external = event.target.closest('[data-demo-external-invite]');
  if (external) {
    event.preventDefault();
    openExternalInstructionDialog();
    return;
  }
  const planMail = event.target.closest('[data-demo-plan-mail]');
  if (planMail) {
    event.preventDefault();
    try {
      const mail = store.sendPlanningMail(store.getSession().employeeId, planMail.dataset.demoPlanMail);
      openMailPreview(mail);
      decorateContent();
    } catch (error) {
      showExtensionError(error.message);
    }
    return;
  }
  const preview = event.target.closest('[data-demo-external-preview]');
  if (preview) {
    event.preventDefault();
    openExternalRecipient(preview.dataset.demoExternalPreview);
    return;
  }
  const zoom = event.target.closest('[data-demo-zoom]');
  if (zoom) {
    event.preventDefault();
    openZoom(zoom.dataset.demoZoom);
    return;
  }
  if (event.target.closest('[data-demo-close]')) {
    event.preventDefault();
    modalRoot().innerHTML = '';
    externalSession = null;
    return;
  }
  if (event.target.closest('[data-demo-external-prev]')) {
    externalSession.index = Math.max(0, externalSession.index - 1);
    renderExternalStep();
    return;
  }
  if (event.target.closest('[data-demo-external-return]')) {
    externalSession.index = Math.max(0, externalSession.steps.length - 1);
    renderExternalStep();
    return;
  }
  if (event.target.closest('[data-demo-external-retry-test]')) {
    renderExternalTest();
    return;
  }
  if (event.target.closest('[data-demo-external-next]')) {
    if (externalSession.index < externalSession.steps.length - 1) {
      externalSession.index += 1;
      renderExternalStep();
    } else if (externalSession.instruction.testRequired) {
      renderExternalTest();
    } else {
      renderExternalResult({passed:true,score:100});
    }
  }
}

function handleScheduleSubmit(event) {
  const form = event.target;
  if (form?.id !== 'demoScheduleForm') return;
  const fd = new FormData(form);
  if (fd.get('sendPlanningMail') !== 'on') return;
  const beforeIds = new Set(store.getState().plannedTrainings.map(item => item.id));
  const employeeId = String(fd.get('employeeId'));
  const instructionId = String(fd.get('instructionId'));
  const date = String(fd.get('date'));
  setTimeout(() => {
    const plan = store.getState().plannedTrainings.find(item => !beforeIds.has(item.id) && item.employeeId === employeeId && item.instructionId === instructionId && String(item.date) === date);
    if (!plan) return;
    try {
      const mail = store.sendPlanningMail(store.getSession().employeeId, plan.id);
      openMailPreview(mail);
    } catch (error) {
      showExtensionError(error.message);
    }
  }, 0);
}

function handleExternalHash() {
  const match = globalThis.location?.hash?.match(/^#external-demo=(.+)$/);
  if (match) openExternalRecipient(decodeURIComponent(match[1]));
}

function initExtension() {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleScheduleSubmit, true);
  document.getElementById('demoRole')?.addEventListener('change', () => setTimeout(decorateContent, 0));
  document.getElementById('demoPerson')?.addEventListener('change', () => setTimeout(decorateContent, 0));
  globalThis.addEventListener?.('hashchange', handleExternalHash);

  const observer = new MutationObserver(() => {
    decorateContent();
    decorateModal();
  });
  const app = document.getElementById('demoApp');
  const root = modalRoot();
  if (app) observer.observe(app, { childList:true, subtree:true });
  if (root) observer.observe(root, { childList:true, subtree:true });
  decorateContent();
  decorateModal();
  handleExternalHash();
}

if (typeof document !== 'undefined') initExtension();
