import { DEMO_DATA } from './demo-data.js';
import './demo-quality-data.js';
import { createEnhancedDemoStore } from './demo-mail-store.js';

const STORAGE_KEY = 'um-company-showcase-state-v1';
const store = createEnhancedDemoStore(DEMO_DATA, globalThis.localStorage);
let externalSession = null;
let decorating = false;

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const employeeById = id => store.getState().employees.find(item => item.id === id);
const instructionById = id => store.getState().instructionTypes.find(item => item.id === id);
const modalRoot = () => document.getElementById('demoModalRoot');

function persistState() {
  globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(store.getState()));
}

function visiblePlans() {
  const session = store.getSession();
  return store.getState().plannedTrainings.filter(plan => plan.status === 'planned' && (
    session.role === 'company_admin' || plan.responsibleId === session.employeeId || plan.employeeId === session.employeeId
  ));
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

function decorateLearningModal() {
  const root = modalRoot();
  const modal = root?.querySelector('.learning-modal');
  const layout = modal?.querySelector('.learning-layout');
  const visual = layout?.querySelector('.learning-visual');
  const copy = layout?.querySelector('.learning-copy');
  if (!modal || !layout || !visual || !copy || layout.dataset.professional === 'true') return;

  const instructionName = modal.querySelector('.modal-head h2')?.textContent?.trim();
  const stepTitle = copy.querySelector('h3')?.textContent?.trim();
  const instruction = store.getState().instructionTypes.find(item => item.name === instructionName);
  const step = store.getState().learningSteps.find(item => item.instructionId === instruction?.id && item.title === stepTitle);
  if (!instruction || !step) return;

  layout.dataset.professional = 'true';
  layout.classList.add('professional-learning-layout');
  visual.classList.add('learning-stage');

  const progress = modal.querySelector('.progress-track');
  if (progress && !modal.querySelector('.learning-goal')) {
    const context = document.createElement('section');
    context.className = 'learning-goal';
    context.innerHTML = `<div class="learning-goal-label">Lernziel</div><strong>${esc(instruction.learningGoal || instruction.description)}</strong>${instruction.intro ? `<p>${esc(instruction.intro)}</p>` : ''}`;
    progress.after(context);
  }

  if (!visual.querySelector('.learning-stage-label')) {
    const label = document.createElement('div');
    label.className = 'learning-stage-label';
    label.textContent = 'Praxisbeispiel · Lernschritt';
    visual.prepend(label);
  }
  const img = visual.querySelector('img');
  if (img && step.imageCaption) img.alt = step.imageCaption;
  if (step.imageCaption && !visual.querySelector('.learning-image-caption')) {
    const caption = document.createElement('div');
    caption.className = 'learning-image-caption';
    caption.innerHTML = `<span>Bildhinweis</span><p>${esc(step.imageCaption)}</p>`;
    visual.appendChild(caption);
  }

  const text = copy.querySelector('p');
  if (text) text.classList.add('learning-lead');
  if (step.calloutTitle && step.calloutText && !copy.querySelector('.learning-callout')) {
    const callout = document.createElement('aside');
    callout.className = 'learning-callout';
    callout.innerHTML = `<span>${esc(step.calloutTitle)}</span><p>${esc(step.calloutText)}</p>`;
    text?.after(callout);
  }

  if (Array.isArray(instruction.keyPoints) && instruction.keyPoints.length && !copy.querySelector('.learning-keypoints')) {
    const keypoints = document.createElement('div');
    keypoints.className = 'learning-keypoints';
    keypoints.innerHTML = `<strong>Das solltest du mitnehmen</strong><ul>${instruction.keyPoints.map(point => `<li>${esc(point)}</li>`).join('')}</ul>`;
    copy.appendChild(keypoints);
  }
}

function decorateModal() {
  decorateScheduleDialog();
  decorateLearningModal();
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
  const steps = state.learningSteps.filter(item => item.instructionId === instruction.id).sort((a,b) => a.order - b.order);
  externalSession = { invitationId, instruction, steps, index: 0 };
  renderExternalStep();
}

function renderExternalStep() {
  if (!externalSession) return;
  const { invitationId, instruction, steps, index } = externalSession;
  const invitation = (store.getState().externalInvitations || []).find(item => item.id === invitationId);
  const step = steps[index];
  if (!step) return;
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal external-learning-modal"><div class="modal-head"><div><span class="eyebrow">Externer Demo-Zugang · Kein Konto erforderlich</span><h2>${esc(instruction.name)}</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="external-recipient"><span>Teilnehmer</span><strong>${esc(invitation.recipientName)}</strong><small>${esc(invitation.recipientEmail)}</small></div><section class="learning-goal"><div class="learning-goal-label">Lernziel</div><strong>${esc(instruction.learningGoal || instruction.description)}</strong><p>${esc(instruction.intro || '')}</p></section><div class="external-progress"><span style="width:${Math.round(((index + 1) / steps.length) * 100)}%"></span></div><div class="professional-learning-layout"><div class="learning-stage"><div class="learning-stage-label">Schritt ${index + 1} von ${steps.length}</div><div class="external-learning-image"><img src="${esc(step.image)}" alt="${esc(step.imageCaption || step.title)}"></div><div class="learning-image-caption"><span>Bildhinweis</span><p>${esc(step.imageCaption || step.title)}</p></div></div><div class="learning-copy"><div class="eyebrow">Lerninhalt</div><h3>${esc(step.title)}</h3><p class="learning-lead">${esc(step.text)}</p>${step.calloutText ? `<aside class="learning-callout"><span>${esc(step.calloutTitle || 'Wichtig')}</span><p>${esc(step.calloutText)}</p></aside>` : ''}<div class="learning-keypoints"><strong>Das solltest du mitnehmen</strong><ul>${(instruction.keyPoints || []).map(point => `<li>${esc(point)}</li>`).join('')}</ul></div></div></div></div><div class="modal-actions"><button class="btn ghost" type="button" data-demo-external-prev ${index === 0 ? 'disabled' : ''}>Zurück</button><button class="btn primary" type="button" data-demo-external-next>${index === steps.length - 1 ? 'Demo-Unterweisung abschließen' : 'Weiter'}</button></div></section></div>`;
}

function completeExternalPreview() {
  const state = store.getState();
  const invitation = (state.externalInvitations || []).find(item => item.id === externalSession?.invitationId);
  if (invitation) {
    invitation.status = 'demo_completed';
    invitation.completedAt = state.meta.referenceDate;
    persistState();
  }
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal"><div class="modal-head"><div><span class="eyebrow">Externe Unterweisung</span><h2>Demo erfolgreich abgeschlossen</h2></div><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="result-box pass"><div class="external-success-mark">✓</div><h3>Teilnahme simuliert</h3><p>Damit kann in einer Präsentation der komplette Weg von der Einladung bis zum externen Abschluss gezeigt werden – ohne Konto und ohne echten Mailversand.</p></div></div><div class="modal-actions"><button class="btn primary" type="button" data-demo-close>Zur Demo zurück</button></div></section></div>`;
  externalSession = null;
}

function showExtensionError(message) {
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop"><section class="modal"><div class="modal-head"><h2>Demo-Aktion nicht möglich</h2><button class="btn ghost small" type="button" data-demo-close>Schließen</button></div><div class="modal-body"><div class="demo-error-box">${esc(message)}</div></div><div class="modal-actions"><button class="btn primary" type="button" data-demo-close>Verstanden</button></div></section></div>`;
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
  if (event.target.closest('[data-demo-external-next]')) {
    if (externalSession.index < externalSession.steps.length - 1) {
      externalSession.index += 1;
      renderExternalStep();
    } else {
      completeExternalPreview();
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
  if (app) observer.observe(app, { childList: true, subtree: true });
  if (root) observer.observe(root, { childList: true, subtree: true });
  decorateContent();
  decorateModal();
  handleExternalHash();
}

if (typeof document !== 'undefined') initExtension();
