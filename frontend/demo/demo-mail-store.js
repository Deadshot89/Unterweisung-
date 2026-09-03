import { createDemoStore } from './demo-store.js';

const STORAGE_KEY = 'um-company-showcase-state-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureCollections(state) {
  if (!Array.isArray(state.externalInvitations)) state.externalInvitations = [];
  if (!Array.isArray(state.mailOutbox)) state.mailOutbox = [];
}

function validateMailAddress(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
  return email;
}

function formatPlanDate(value) {
  const raw = String(value || '');
  const [datePart, timePart = ''] = raw.split('T');
  const [year, month, day] = datePart.split('-');
  const time = timePart.slice(0, 5) || '00:00';
  return { date: `${day || '--'}.${month || '--'}.${year || '----'}`, time };
}

export function enhanceDemoStore(store, storage = globalThis.localStorage) {
  if (store.__demoMailEnhanced === true) return store;

  Object.defineProperty(store, '__demoMailEnhanced', { value: true, enumerable: false });
  const persist = () => storage?.setItem?.(STORAGE_KEY, JSON.stringify(store.getState()));

  store.sendExternalInstruction = function sendExternalInstruction(senderId, input = {}) {
    const state = store.getState();
    const session = store.getSession();
    ensureCollections(state);
    if (session.role === 'employee') throw new Error('Externe Unterweisungen können nur durch eine Führungskraft oder einen Admin versendet werden.');
    if (session.role === 'line_manager' && session.employeeId !== senderId) throw new Error('Die aktive Führungskraft stimmt nicht mit dem Absender überein.');

    const sender = state.employees.find(item => item.id === senderId);
    if (!sender) throw new Error('Demo-Absender nicht gefunden.');
    const instruction = state.instructionTypes.find(item => item.id === input.instructionId && item.active !== false);
    if (!instruction) throw new Error('Demo-Unterweisung nicht gefunden.');
    if (instruction.deliveryMode !== 'online') throw new Error('Externe Einladungen sind in der Demo nur für Online-Unterweisungen verfügbar.');

    const recipientName = String(input.recipientName || '').trim();
    if (!recipientName) throw new Error('Name des externen Teilnehmers ist erforderlich.');
    const recipientEmail = validateMailAddress(input.recipientEmail);
    const id = `external-demo-${state.externalInvitations.length + 1}`;
    const demoLink = `#external-demo=${id}`;
    const invitation = {
      id,
      senderId,
      instructionId: instruction.id,
      recipientName,
      recipientEmail,
      demoLink,
      createdAt: state.meta.referenceDate,
      status: 'simulated_sent'
    };
    state.externalInvitations.push(invitation);

    const mail = {
      id: `mail-demo-${state.mailOutbox.length + 1}`,
      kind: 'external_instruction',
      relatedId: id,
      senderName: sender.name,
      recipientName,
      recipientEmail,
      subject: `Einladung zur Unterweisung: ${instruction.name}`,
      body: `Guten Tag ${recipientName},\n\n${sender.name} lädt Sie zur Online-Unterweisung „${instruction.name}“ ein. Für die Teilnahme ist kein Benutzerkonto erforderlich.\n\nDemo-Zugang: ${demoLink}\n\nDiese Nachricht wird in der Präsentations-Demo ausschließlich lokal simuliert.`,
      status: 'simulated_sent',
      createdAt: state.meta.referenceDate
    };
    state.mailOutbox.push(mail);
    invitation.mailId = mail.id;
    persist();
    return clone(invitation);
  };

  store.sendPlanningMail = function sendPlanningMail(senderId, planId) {
    const state = store.getState();
    const session = store.getSession();
    ensureCollections(state);
    if (session.role === 'employee') throw new Error('Terminmails können nur durch eine Führungskraft oder einen Admin versendet werden.');
    if (session.role === 'line_manager' && session.employeeId !== senderId) throw new Error('Die aktive Führungskraft stimmt nicht mit dem Absender überein.');

    const plan = state.plannedTrainings.find(item => item.id === planId && item.status === 'planned');
    if (!plan) throw new Error('Geplanter Demo-Termin nicht gefunden.');
    if (session.role === 'line_manager') {
      const employee = state.employees.find(item => item.id === plan.employeeId);
      if (plan.responsibleId !== session.employeeId) throw new Error('Für diesen Termin ist eine andere Führungskraft verantwortlich.');
      if (employee?.lineManagerId !== session.employeeId) throw new Error('Der geplante Mitarbeiter gehört nicht zum direkten Team.');
    }

    const employee = state.employees.find(item => item.id === plan.employeeId);
    const instruction = state.instructionTypes.find(item => item.id === plan.instructionId);
    const responsible = state.employees.find(item => item.id === plan.responsibleId);
    if (!employee || !instruction || !responsible) throw new Error('Demo-Termin ist unvollständig.');
    const formatted = formatPlanDate(plan.date);
    const mail = {
      id: `mail-demo-${state.mailOutbox.length + 1}`,
      kind: 'planning',
      relatedId: plan.id,
      senderName: responsible.name,
      recipientName: employee.name,
      recipientEmail: employee.email,
      subject: `Termin: ${instruction.name}`,
      body: `Hallo ${employee.name},\n\nfür dich wurde die Unterweisung „${instruction.name}“ eingeplant.\n\nDatum: ${formatted.date}\nUhrzeit: ${formatted.time}\nVerantwortlich: ${responsible.name}\nOrt: Schulungsbereich / Arbeitsplatz gemäß Planung\n\nBitte halte den Termin ein und wende dich bei Rückfragen an deine Führungskraft.\n\nDiese Nachricht wird in der Präsentations-Demo ausschließlich lokal simuliert.`,
      status: 'simulated_sent',
      createdAt: state.meta.referenceDate
    };
    state.mailOutbox.push(mail);
    plan.mailStatus = 'simulated_sent';
    plan.mailSentAt = state.meta.referenceDate;
    plan.lastMailId = mail.id;
    persist();
    return clone(mail);
  };

  store.getDemoMailOutbox = function getDemoMailOutbox() {
    const state = store.getState();
    ensureCollections(state);
    return clone(state.mailOutbox);
  };

  return store;
}

export function createEnhancedDemoStore(baseData, storage = globalThis.localStorage) {
  return enhanceDemoStore(createDemoStore(baseData, storage), storage);
}
