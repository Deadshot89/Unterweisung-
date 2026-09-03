const STORAGE_KEY = 'um-company-showcase-state-v1';
const ALLOWED_ROLES = new Set(['company_admin', 'line_manager', 'employee']);
const MAX_IMAGE_BYTES = 1572864;
const STORE_CACHE = new WeakMap();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState(baseData, storage) {
  const saved = storage?.getItem?.(STORAGE_KEY);
  if (!saved) return clone(baseData);
  try {
    const parsed = JSON.parse(saved);
    return parsed?.meta?.demo === true ? parsed : clone(baseData);
  } catch {
    return clone(baseData);
  }
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function nextDemoId(rows, prefix) {
  const numbers = rows
    .map(row => String(row.id || '').match(new RegExp(`^${prefix}(\\d+)$`)))
    .filter(Boolean)
    .map(match => Number(match[1]));
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

export function createDemoStore(baseData, storage = globalThis.localStorage) {
  const cacheableStorage = storage && (typeof storage === 'object' || typeof storage === 'function');
  if (cacheableStorage && STORE_CACHE.has(storage)) return STORE_CACHE.get(storage);

  let state = loadState(baseData, storage);
  let session = { role: 'company_admin', employeeId: 'emp-lena-hoffmann' };

  const employeeById = id => state.employees.find(x => x.id === id);
  const instructionById = id => state.instructionTypes.find(x => x.id === id);
  const stepsFor = id => state.learningSteps.filter(x => x.instructionId === id).sort((a,b) => a.order - b.order);
  const testFor = id => state.tests.find(x => x.instructionId === id);
  const assignmentFor = (employeeId, instructionId) => state.assignments.find(x => x.employeeId === employeeId && x.instructionId === instructionId);

  function persist() {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(state));
  }

  function assertAdmin() {
    if (session.role !== 'company_admin') throw new Error('Diese Demo-Aktion ist nur für Admins verfügbar.');
  }

  function setRole(role, employeeId) {
    if (!ALLOWED_ROLES.has(role)) throw new Error('Unbekannte Demo-Rolle.');
    const employee = employeeById(employeeId);
    if (!employee) throw new Error('Demo-Mitarbeiter nicht gefunden.');
    if (role === 'line_manager' && employee.role !== 'line_manager' && employee.role !== 'company_admin') {
      throw new Error('Für die Führungskraft-Ansicht ist eine Führungskraft erforderlich.');
    }
    session = { role, employeeId };
    return getSession();
  }

  function getSession() {
    return { ...session };
  }

  function getVisibleEmployees() {
    if (session.role === 'company_admin') return state.employees.filter(x => x.active !== false);
    if (session.role === 'line_manager') return state.employees.filter(x => x.active !== false && x.lineManagerId === session.employeeId);
    return state.employees.filter(x => x.active !== false && x.id === session.employeeId);
  }

  function canManage(employeeId) {
    if (session.role === 'company_admin') return true;
    if (session.role !== 'line_manager') return false;
    return employeeById(employeeId)?.lineManagerId === session.employeeId;
  }

  function assertSelfAction(employeeId) {
    if (session.role !== 'employee' || session.employeeId !== employeeId) {
      throw new Error('Diese Demo-Aktion ist nur in der eigenen Mitarbeiteransicht möglich.');
    }
  }

  function updateCompanyProfile(patch = {}) {
    assertAdmin();
    const name = cleanText(patch.name ?? state.company.name);
    const industry = cleanText(patch.industry ?? state.company.industry);
    const location = cleanText(patch.location ?? state.company.location);
    if (!name || !industry || !location) throw new Error('Firmenname, Branche und Standort sind erforderlich.');
    state.company = { ...state.company, name, industry, location };
    persist();
    return clone(state.company);
  }

  function saveEmployee(input = {}) {
    assertAdmin();
    const name = cleanText(input.name);
    const email = cleanText(input.email).toLowerCase();
    const department = cleanText(input.department);
    const jobTitle = cleanText(input.jobTitle);
    const role = cleanText(input.role || 'employee');
    if (!name || !email || !department || !jobTitle) throw new Error('Name, Demo-E-Mail, Abteilung und Funktion sind erforderlich.');
    if (!/^[^@\s]+@[^@\s]+\.example$/i.test(email)) throw new Error('Demo-E-Mail muss auf .example enden.');
    if (!ALLOWED_ROLES.has(role)) throw new Error('Unbekannte Demo-Rolle.');
    const lineManagerId = cleanText(input.lineManagerId) || undefined;
    if (lineManagerId && !employeeById(lineManagerId)) throw new Error('Ausgewählte Demo-Führungskraft wurde nicht gefunden.');

    if (input.id) {
      const existing = employeeById(input.id);
      if (!existing) throw new Error('Demo-Mitarbeiter nicht gefunden.');
      Object.assign(existing, { name, email, department, jobTitle, role, active: input.active !== false });
      if (lineManagerId) existing.lineManagerId = lineManagerId;
      else delete existing.lineManagerId;
      persist();
      return clone(existing);
    }

    const employee = {
      id: nextDemoId(state.employees, 'emp-demo-'),
      name,
      email,
      department,
      jobTitle,
      role,
      active: input.active !== false
    };
    if (lineManagerId) employee.lineManagerId = lineManagerId;
    state.employees.push(employee);
    persist();
    return clone(employee);
  }

  function ensureDefaultLearningSteps(instructionId) {
    if (stepsFor(instructionId).length) return;
    const defaults = [
      ['./assets/work-safety.svg', 'Lernschritt 1'],
      ['./assets/warehouse.svg', 'Lernschritt 2'],
      ['./assets/fire-safety.svg', 'Lernschritt 3']
    ];
    defaults.forEach(([image, title], index) => {
      state.learningSteps.push({
        id: `step-${instructionId}-${index + 1}`,
        instructionId,
        order: index + 1,
        title,
        text: 'Inhalt für die Präsentation ergänzen.',
        image
      });
    });
  }

  function saveInstruction(input = {}) {
    assertAdmin();
    const name = cleanText(input.name);
    const category = cleanText(input.category);
    const description = cleanText(input.description);
    const deliveryMode = cleanText(input.deliveryMode || 'online');
    const intervalMonths = Number(input.intervalMonths || 12);
    if (!name || !category) throw new Error('Titel und Kategorie sind erforderlich.');
    if (!['online','practical'].includes(deliveryMode)) throw new Error('Unterweisungsart muss Online oder Praktisch sein.');
    if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) throw new Error('Intervall muss größer als 0 sein.');
    const testRequired = deliveryMode === 'online' ? Boolean(input.testRequired) : false;
    const passPercent = testRequired ? Number(input.passPercent ?? 80) : 0;
    if (testRequired && (!Number.isFinite(passPercent) || passPercent < 0 || passPercent > 100)) throw new Error('Bestehensgrenze muss zwischen 0 und 100 liegen.');

    let instruction;
    if (input.id) {
      instruction = instructionById(input.id);
      if (!instruction) throw new Error('Demo-Unterweisung nicht gefunden.');
      Object.assign(instruction, { name, category, description, deliveryMode, testRequired, passPercent, intervalMonths, active: input.active !== false });
    } else {
      instruction = {
        id: nextDemoId(state.instructionTypes, 'ins-demo-'),
        name,
        category,
        description,
        deliveryMode,
        testRequired,
        passPercent,
        intervalMonths,
        active: input.active !== false
      };
      state.instructionTypes.push(instruction);
    }

    if (deliveryMode === 'online') ensureDefaultLearningSteps(instruction.id);
    else {
      state.learningSteps = state.learningSteps.filter(step => step.instructionId !== instruction.id);
      state.tests = state.tests.filter(test => test.instructionId !== instruction.id);
    }
    persist();
    return clone(instruction);
  }

  function saveLearningStep(instructionId, stepId, patch = {}) {
    assertAdmin();
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'online') throw new Error('Online-Unterweisung wurde nicht gefunden.');
    const step = state.learningSteps.find(item => item.id === stepId && item.instructionId === instructionId);
    if (!step) throw new Error('Lernschritt wurde nicht gefunden.');
    const title = cleanText(patch.title ?? step.title);
    const text = cleanText(patch.text ?? step.text);
    if (!title || !text) throw new Error('Titel und Erklärung des Lernschritts sind erforderlich.');
    step.title = title;
    step.text = text;
    persist();
    return clone(step);
  }

  function setLearningStepImage(instructionId, stepId, dataUrl, byteSize) {
    assertAdmin();
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'online') throw new Error('Online-Unterweisung wurde nicht gefunden.');
    const step = state.learningSteps.find(item => item.id === stepId && item.instructionId === instructionId);
    if (!step) throw new Error('Lernschritt wurde nicht gefunden.');
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(dataUrl || ''))) throw new Error('Bildformat nicht erlaubt. Bitte PNG, JPEG oder WEBP verwenden.');
    if (!Number.isFinite(Number(byteSize)) || Number(byteSize) < 0 || Number(byteSize) > MAX_IMAGE_BYTES) throw new Error('Bild darf maximal 1,5 MB groß sein.');
    step.image = String(dataUrl);
    persist();
    return clone(step);
  }

  function assignInstruction(instructionId, employeeIds = [], dueDate = state.meta.referenceDate) {
    assertAdmin();
    if (!instructionById(instructionId)) throw new Error('Demo-Unterweisung nicht gefunden.');
    const selectedIds = [...new Set(Array.isArray(employeeIds) ? employeeIds : [])];
    const created = [];
    for (const employeeId of selectedIds) {
      if (!employeeById(employeeId)) throw new Error('Demo-Mitarbeiter nicht gefunden.');
      if (assignmentFor(employeeId, instructionId)) continue;
      const assignment = {
        id: `asg-demo-${state.assignments.length + 1}`,
        employeeId,
        instructionId,
        status: 'missing',
        dueDate: cleanText(dueDate) || state.meta.referenceDate,
        progress: 0
      };
      state.assignments.push(assignment);
      created.push(clone(assignment));
    }
    if (created.length) persist();
    return created;
  }

  function getEmployeeBuckets(employeeId) {
    if (session.role === 'employee' && session.employeeId !== employeeId) throw new Error('Kein Zugriff auf diesen Demo-Mitarbeiter.');
    if (session.role === 'line_manager' && !canManage(employeeId)) throw new Error('Mitarbeiter gehört nicht zum direkten Team.');
    const assignments = state.assignments.filter(x => x.employeeId === employeeId).map(x => ({ ...x, instruction: instructionById(x.instructionId) }));
    const planned = state.plannedTrainings.filter(x => x.employeeId === employeeId && x.status === 'planned').map(x => ({ ...x, instruction: instructionById(x.instructionId) }));
    const completed = state.records.filter(x => x.employeeId === employeeId).map(x => ({ ...x, instruction: instructionById(x.instructionId) }));
    return {
      now: assignments.filter(x => ['missing','critical','expired','in_progress'].includes(x.status) && x.instruction?.deliveryMode === 'online'),
      scheduling: assignments.filter(x => ['practical_pending'].includes(x.status) || (x.instruction?.deliveryMode === 'practical' && !['valid','planned'].includes(x.status))),
      planned,
      soon: assignments.filter(x => x.status === 'soon'),
      completed
    };
  }

  function ensureAssignment(employeeId, instructionId) {
    let assignment = assignmentFor(employeeId, instructionId);
    if (!assignment) {
      assignment = {
        id: `asg-demo-${state.assignments.length + 1}`,
        employeeId,
        instructionId,
        status: 'missing',
        dueDate: state.meta.referenceDate,
        progress: 0
      };
      state.assignments.push(assignment);
    }
    return assignment;
  }

  function advanceLearning(employeeId, instructionId) {
    assertSelfAction(employeeId);
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'online') throw new Error('Keine Online-Unterweisung.');
    const stepCount = stepsFor(instructionId).length;
    if (!stepCount) throw new Error('Keine Lernschritte vorhanden.');
    const assignment = ensureAssignment(employeeId, instructionId);
    assignment.progress = Math.min(Number(assignment.progress || 0) + 1, stepCount);
    assignment.status = 'in_progress';
    persist();
    return clone(assignment);
  }

  function submitTest(employeeId, instructionId, answers = {}) {
    assertSelfAction(employeeId);
    const instruction = instructionById(instructionId);
    const assignment = ensureAssignment(employeeId, instructionId);
    const stepCount = stepsFor(instructionId).length;
    if (Number(assignment.progress || 0) < stepCount) throw new Error('Bitte zuerst alle Lernschritte durchlaufen.');
    const testDefinition = testFor(instructionId);
    if (!instruction?.testRequired) {
      assignment.testResult = { score: 100, passed: true, submittedAt: state.meta.referenceDate };
      persist();
      return clone(assignment.testResult);
    }
    if (!testDefinition?.questions?.length) throw new Error('Für diese Demo-Unterweisung ist kein Test hinterlegt.');
    const correct = testDefinition.questions.reduce((sum, q) => sum + (Number(answers[q.id]) === q.correctOption ? 1 : 0), 0);
    const score = Math.round((correct / testDefinition.questions.length) * 100);
    assignment.testResult = { score, passed: score >= Number(instruction.passPercent || 0), submittedAt: state.meta.referenceDate };
    persist();
    return clone(assignment.testResult);
  }

  function completeOnline(employeeId, instructionId) {
    assertSelfAction(employeeId);
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'online') throw new Error('Keine Online-Unterweisung.');
    const assignment = ensureAssignment(employeeId, instructionId);
    const stepCount = stepsFor(instructionId).length;
    if (Number(assignment.progress || 0) < stepCount) throw new Error('Bitte alle Lernschritte vollständig durchlaufen.');
    if (instruction.testRequired && assignment.testResult?.passed !== true) throw new Error('Der Test muss bestanden sein.');
    assignment.status = 'valid';
    assignment.completedAt = state.meta.referenceDate;
    const record = {
      id: `rec-demo-${state.records.length + 1}`,
      employeeId,
      instructionId,
      completedAt: state.meta.referenceDate,
      source: 'demo-online',
      score: assignment.testResult?.score ?? null
    };
    state.records.push(record);
    persist();
    return clone(record);
  }

  function assertManagerAction(managerId, employeeId) {
    if (session.role === 'employee') throw new Error('Diese Aktion muss durch eine Führungskraft bestätigt werden.');
    if (session.employeeId !== managerId && session.role !== 'company_admin') throw new Error('Führungskraft stimmt nicht mit der aktiven Demo-Rolle überein.');
    if (session.role === 'line_manager' && !canManage(employeeId)) throw new Error('Mitarbeiter gehört nicht zum direkten Team.');
  }

  function schedulePractical(managerId, employeeId, instructionId, date) {
    assertManagerAction(managerId, employeeId);
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'practical') throw new Error('Nur praktische Unterweisungen können hier eingeplant werden.');
    if (!employeeById(employeeId)) throw new Error('Demo-Mitarbeiter nicht gefunden.');
    const plan = {
      id: `plan-demo-${state.plannedTrainings.length + 1}`,
      employeeId,
      instructionId,
      date,
      responsibleId: managerId,
      status: 'planned'
    };
    state.plannedTrainings.push(plan);
    const assignment = ensureAssignment(employeeId, instructionId);
    assignment.status = 'planned';
    assignment.dueDate = String(date).slice(0,10);
    persist();
    return clone(plan);
  }

  function confirmPractical(managerId, employeeId, instructionId) {
    assertManagerAction(managerId, employeeId);
    const instruction = instructionById(instructionId);
    if (!instruction || instruction.deliveryMode !== 'practical') throw new Error('Keine praktische Unterweisung.');
    const assignment = ensureAssignment(employeeId, instructionId);
    assignment.status = 'valid';
    assignment.completedAt = state.meta.referenceDate;
    state.plannedTrainings.filter(x => x.employeeId === employeeId && x.instructionId === instructionId && x.status === 'planned').forEach(x => { x.status = 'completed'; });
    const record = {
      id: `rec-demo-${state.records.length + 1}`,
      employeeId,
      instructionId,
      completedAt: state.meta.referenceDate,
      source: 'demo-practical',
      confirmedBy: managerId
    };
    state.records.push(record);
    persist();
    return clone(record);
  }

  function reset() {
    storage?.removeItem?.(STORAGE_KEY);
    state = clone(baseData);
    session = { role: 'company_admin', employeeId: 'emp-lena-hoffmann' };
    return clone(state);
  }

  const api = {
    getState: () => state,
    getSession,
    setRole,
    getVisibleEmployees,
    getEmployeeBuckets,
    updateCompanyProfile,
    saveEmployee,
    saveInstruction,
    saveLearningStep,
    setLearningStepImage,
    assignInstruction,
    advanceLearning,
    submitTest,
    completeOnline,
    schedulePractical,
    confirmPractical,
    reset
  };

  if (cacheableStorage) STORE_CACHE.set(storage, api);
  return api;
}
