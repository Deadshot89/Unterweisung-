import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const file = process.argv[2] || path.resolve('database/seed_essentra_data.json');
const connectionString = process.env.SQL_CONNECTION_STRING;
if (!connectionString) {
  console.error('SQL_CONNECTION_STRING fehlt. Beispiel: SQL_CONNECTION_STRING="..." node scripts/import-startdata.js');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const companyId = data.companies?.[0]?.id || 'company-essentra';

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}


function normalizeOptions(arr) {
  return JSON.stringify(arr.map(x => String(x)));
}

function defaultQuestionSet(type, lang='de') {
  const name = type.name || 'Unterweisung';
  const category = type.category || 'Unterweisung';
  const text = type.description || '';
  const base = {
    de: [
      [`Was ist das wichtigste Ziel der Unterweisung „${name}“?`, ['Sicher arbeiten und Gefahren vermeiden', 'Schneller arbeiten ohne Prüfung', 'Dokumente umgehen', 'Nur die Theorie kennen'], 0],
      [`Wann müssen festgestellte Mängel bei „${name}“ gemeldet werden?`, ['Sofort an Vorgesetzte/HSE', 'Erst am Monatsende', 'Nur wenn Zeit bleibt', 'Gar nicht'], 0],
      [`Wer darf Tätigkeiten nach dieser Unterweisung durchführen?`, ['Nur unterwiesene und berechtigte Personen', 'Jede Person im Lager', 'Nur Besucher', 'Nur externe Fahrer'], 0],
      [`Welche persönliche Schutzausrüstung ist bei Bedarf zu nutzen?`, ['Die vorgeschriebene PSA', 'Keine PSA', 'Private Kleidung reicht immer', 'Nur Handschuhe ohne weitere Prüfung'], 0],
      [`Was gilt bei Unsicherheit während der Arbeit?`, ['Arbeit stoppen und nachfragen', 'Trotzdem weitermachen', 'Kollegen ignorieren', 'Gefahr akzeptieren'], 0],
      [`Was bedeutet eine unterschriebene Bestätigung?`, ['Teilnahme und Verständnis wurden bestätigt', 'Die Unterweisung ist nicht wichtig', 'Der Test entfällt immer', 'Die Verantwortung entfällt komplett'], 0],
      [`Wie oft ist eine jährliche Unterweisung normalerweise zu erneuern?`, ['Mindestens alle 12 Monate', 'Alle 5 Jahre', 'Nur einmal im Berufsleben', 'Nur bei Kündigung'], 0],
      [`Was ist bei Notfällen wichtig?`, ['Ruhe bewahren, melden, Hilfe holen', 'Weggehen ohne Meldung', 'Erst privat telefonieren', 'Nichts dokumentieren'], 0],
      [`Was gilt für defekte Arbeitsmittel?`, ['Nicht benutzen und melden', 'Weiter benutzen', 'Selbst reparieren ohne Erlaubnis', 'Verstecken'], 0],
      [`Was muss vor Benutzung von Arbeitsmitteln geprüft werden?`, ['Sicht- und Funktionszustand', 'Nur die Farbe', 'Nur der Herstellername', 'Nichts'], 0],
      [`Warum sind Verkehrswege freizuhalten?`, ['Damit Flucht und Transport sicher möglich sind', 'Damit weniger gereinigt werden muss', 'Damit Lagerplätze verschwinden', 'Es hat keinen Grund'], 0],
      [`Was ist bei Lasten wichtig?`, ['Last sichern und Tragfähigkeit beachten', 'Last möglichst hoch und locker fahren', 'Last immer ohne Prüfung bewegen', 'Last durch Kollegen festhalten lassen'], 0],
      [`Was ist bei Alkohol, Drogen oder beeinträchtigenden Medikamenten zu beachten?`, ['Keine sicherheitsrelevante Arbeit durchführen', 'Normal weiterarbeiten', 'Nur langsamer arbeiten', 'Nichts melden'], 0],
      [`Welche Regel gilt für Sicherheits- und Not-Aus-Einrichtungen?`, ['Sie dürfen nicht manipuliert werden', 'Sie dürfen überbrückt werden', 'Sie sind nur Dekoration', 'Sie werden nur jährlich beachtet'], 0],
      [`Warum müssen Unfälle und Beinaheunfälle gemeldet werden?`, ['Damit Ursachen beseitigt werden können', 'Damit niemand davon erfährt', 'Damit nur Statistik entsteht', 'Meldungen sind unnötig'], 0],
      [`Was ist bei Brandschutz und Fluchtwegen richtig?`, ['Gekennzeichnete Wege nutzen und Sammelplatz aufsuchen', 'Aufzüge benutzen', 'Persönliche Sachen zuerst holen', 'Im Gebäude bleiben'], 0],
      [`Wie wird „${name}“ dokumentiert?`, ['Mit Datum, Teilnehmer und Nachweis', 'Gar nicht', 'Nur mündlich ohne Datum', 'Nur wenn ein Unfall passiert'], 0],
      [`Was gilt für unbefugte Benutzung von Geräten?`, ['Verhindern und Geräte sichern', 'Erlauben, wenn es schnell geht', 'Nicht kontrollieren', 'Nur Besucher prüfen'], 0],
      [`Welche Rolle hat der Line Manager/HSE bei Unterweisungen?`, ['Unterstützen, prüfen und bei Fragen helfen', 'Nur Rechnungen schreiben', 'Keine Rolle', 'Nur IT-Zugang verwalten'], 0],
      [`Was machst du, wenn Inhalte der Unterweisung unklar sind?`, ['Nachfragen, bevor die Tätigkeit ausgeführt wird', 'Unterschreiben ohne Verständnis', 'Andere arbeiten lassen', 'Das Thema ignorieren'], 0]
    ],
    en: [
      [`What is the main purpose of the instruction “${name}”?`, ['To work safely and avoid hazards', 'To work faster without checks', 'To avoid documentation', 'To know theory only'], 0],
      [`When must defects related to “${name}” be reported?`, ['Immediately to the supervisor/HSE', 'At the end of the month', 'Only when there is time', 'Never'], 0],
      [`Who may perform activities covered by this instruction?`, ['Only trained and authorised persons', 'Anyone in the warehouse', 'Visitors only', 'External drivers only'], 0],
      [`Which PPE must be used when required?`, ['The required PPE', 'No PPE', 'Private clothes are always enough', 'Only gloves without checking'], 0],
      [`What should you do when you are unsure?`, ['Stop and ask', 'Continue anyway', 'Ignore colleagues', 'Accept the hazard'], 0],
      [`What does a signed confirmation mean?`, ['Participation and understanding are confirmed', 'The instruction is not important', 'The test is always skipped', 'All responsibility disappears'], 0],
      [`How often is an annual instruction normally renewed?`, ['At least every 12 months', 'Every 5 years', 'Only once in a career', 'Only when leaving the company'], 0],
      [`What is important in an emergency?`, ['Stay calm, report, get help', 'Leave without reporting', 'Make private calls first', 'Do not document anything'], 0],
      [`What applies to defective equipment?`, ['Do not use it and report it', 'Continue using it', 'Repair it yourself without permission', 'Hide it'], 0],
      [`What should be checked before using work equipment?`, ['Visual and functional condition', 'Only the colour', 'Only the manufacturer name', 'Nothing'], 0],
      [`Why must traffic routes remain clear?`, ['For safe escape and transport', 'For less cleaning', 'To remove storage space', 'There is no reason'], 0],
      [`What is important when handling loads?`, ['Secure the load and observe capacity', 'Drive high and loose', 'Move without checks', 'Let colleagues hold the load'], 0],
      [`What applies to alcohol, drugs or impairing medication?`, ['Do not perform safety-relevant work', 'Continue as normal', 'Only work slower', 'Report nothing'], 0],
      [`What applies to safety devices and emergency stops?`, ['They must not be manipulated', 'They may be bypassed', 'They are decoration', 'They are only checked yearly'], 0],
      [`Why report accidents and near misses?`, ['So causes can be removed', 'So nobody knows', 'For statistics only', 'Reporting is unnecessary'], 0],
      [`What is correct in case of fire or evacuation?`, ['Use marked routes and go to the assembly point', 'Use lifts', 'Collect personal items first', 'Stay inside'], 0],
      [`How is “${name}” documented?`, ['With date, participant and proof', 'Not at all', 'Verbally without date', 'Only after an accident'], 0],
      [`What applies to unauthorised equipment use?`, ['Prevent it and secure equipment', 'Allow it if fast', 'Do not check it', 'Only check visitors'], 0],
      [`What is the role of the Line Manager/HSE?`, ['Support, check and help with questions', 'Only write invoices', 'No role', 'Only manage IT access'], 0],
      [`What do you do if instruction content is unclear?`, ['Ask before performing the task', 'Sign without understanding', 'Let others work', 'Ignore it'], 0]
    ],
    pl: [
      [`Jaki jest główny cel instruktażu „${name}”?`, ['Bezpieczna praca i unikanie zagrożeń', 'Szybsza praca bez kontroli', 'Ominięcie dokumentacji', 'Tylko znajomość teorii'], 0],
      [`Kiedy należy zgłaszać usterki związane z „${name}”?`, ['Natychmiast przełożonemu/HSE', 'Na koniec miesiąca', 'Tylko gdy jest czas', 'Nigdy'], 0],
      [`Kto może wykonywać czynności objęte instruktażem?`, ['Tylko przeszkolone i upoważnione osoby', 'Każda osoba w magazynie', 'Tylko goście', 'Tylko kierowcy zewnętrzni'], 0],
      [`Jakie ŚOI należy stosować w razie potrzeby?`, ['Wymagane środki ochrony osobistej', 'Żadne', 'Prywatna odzież zawsze wystarczy', 'Tylko rękawice bez kontroli'], 0],
      [`Co zrobić w razie niepewności?`, ['Przerwać pracę i zapytać', 'Kontynuować mimo wszystko', 'Ignorować kolegów', 'Zaakceptować zagrożenie'], 0],
      [`Co oznacza podpisane potwierdzenie?`, ['Udział i zrozumienie zostały potwierdzone', 'Instruktaż nie jest ważny', 'Test zawsze odpada', 'Odpowiedzialność całkowicie znika'], 0],
      [`Jak często zwykle odnawia się roczny instruktaż?`, ['Co najmniej co 12 miesięcy', 'Co 5 lat', 'Raz w życiu zawodowym', 'Tylko przy odejściu z firmy'], 0],
      [`Co jest ważne w sytuacji awaryjnej?`, ['Zachować spokój, zgłosić, wezwać pomoc', 'Odejść bez zgłoszenia', 'Najpierw dzwonić prywatnie', 'Nic nie dokumentować'], 0],
      [`Co zrobić z uszkodzonym sprzętem?`, ['Nie używać i zgłosić', 'Używać dalej', 'Naprawić samodzielnie bez zgody', 'Ukryć'], 0],
      [`Co należy sprawdzić przed użyciem sprzętu?`, ['Stan wizualny i działanie', 'Tylko kolor', 'Tylko nazwę producenta', 'Nic'], 0],
      [`Dlaczego drogi komunikacyjne muszą być wolne?`, ['Dla bezpiecznej ewakuacji i transportu', 'Aby mniej sprzątać', 'Aby usunąć miejsca składowania', 'Bez powodu'], 0],
      [`Co jest ważne przy ładunkach?`, ['Zabezpieczyć ładunek i przestrzegać nośności', 'Przewozić wysoko i luźno', 'Przenosić bez kontroli', 'Pozwolić kolegom trzymać ładunek'], 0],
      [`Co dotyczy alkoholu, narkotyków lub leków ograniczających sprawność?`, ['Nie wykonywać prac istotnych dla bezpieczeństwa', 'Pracować normalnie', 'Pracować tylko wolniej', 'Nic nie zgłaszać'], 0],
      [`Co dotyczy urządzeń bezpieczeństwa i wyłączników awaryjnych?`, ['Nie wolno ich manipulować', 'Można je obejść', 'Są dekoracją', 'Sprawdza się je tylko rocznie'], 0],
      [`Dlaczego należy zgłaszać wypadki i zdarzenia potencjalnie wypadkowe?`, ['Aby usunąć przyczyny', 'Aby nikt się nie dowiedział', 'Tylko dla statystyki', 'Zgłoszenia są zbędne'], 0],
      [`Co jest prawidłowe przy pożarze lub ewakuacji?`, ['Użyć oznaczonych dróg i iść do punktu zbiórki', 'Użyć windy', 'Najpierw zabrać rzeczy osobiste', 'Zostać w budynku'], 0],
      [`Jak dokumentuje się „${name}”?`, ['Datą, uczestnikiem i dowodem', 'Wcale', 'Ustnie bez daty', 'Tylko po wypadku'], 0],
      [`Co dotyczy nieuprawnionego użycia sprzętu?`, ['Zapobiegać i zabezpieczać sprzęt', 'Pozwalać, gdy jest szybko', 'Nie kontrolować', 'Sprawdzać tylko gości'], 0],
      [`Jaka jest rola Line Managera/HSE?`, ['Wspierać, sprawdzać i pomagać w pytaniach', 'Tylko wystawiać faktury', 'Żadna', 'Tylko zarządzać dostępem IT'], 0],
      [`Co zrobić, jeśli treść instruktażu jest niejasna?`, ['Zapytać przed wykonaniem czynności', 'Podpisać bez zrozumienia', 'Pozwolić innym pracować', 'Zignorować temat'], 0]
    ]
  };
  return (base[lang] || base.de).map((q, idx) => ({
    id: `q-${type.id}-${lang}-${String(idx+1).padStart(2,'0')}`,
    companyId: type.companyId,
    instructionTypeId: type.id,
    language: lang,
    question: q[0],
    optionsJson: normalizeOptions(q[1]),
    correctIndex: q[2]
  }));
}

function buildQuestions(data, companyId) {
  const existing = Array.isArray(data.tests) ? data.tests : [];
  if (existing.length) return existing;
  const questions = [];
  for (const t of data.types || []) {
    for (const lang of ['de','en','pl']) questions.push(...defaultQuestionSet({...t, companyId}, lang));
  }
  return questions;
}

const pool = await sql.connect(connectionString);
const tx = new sql.Transaction(pool);
await tx.begin();
try {
  const req = new sql.Request(tx);
  await req.input('id', sql.NVarChar(80), companyId)
    .input('name', sql.NVarChar(200), data.companies?.[0]?.name || data.settings?.companyName || 'Essentra Components GmbH')
    .query(`MERGE Companies AS t USING (SELECT @id AS id, @name AS name) AS s
            ON t.id=s.id WHEN MATCHED THEN UPDATE SET name=s.name, active=1, updatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT(id,name,active) VALUES(s.id,s.name,1);`);


  await new sql.Request(tx)
    .input('companyId', sql.NVarChar(80), companyId)
    .input('yellowWarningDays', sql.Int, Number(data.settings?.reminderDays || 60))
    .input('orangeCriticalDays', sql.Int, Number(data.settings?.criticalDays || 30))
    .input('defaultResponsibleEmail', sql.NVarChar(254), data.settings?.responsibleEmail || null)
    .input('hseEmail', sql.NVarChar(254), data.settings?.hseEmail || 'DennisJeschick@essentra.com')
    .query(`MERGE CompanySettings AS t USING (SELECT @companyId AS companyId) AS s ON t.companyId=s.companyId
            WHEN MATCHED THEN UPDATE SET yellowWarningDays=@yellowWarningDays, orangeCriticalDays=@orangeCriticalDays,
              defaultResponsibleEmail=@defaultResponsibleEmail, hseEmail=@hseEmail, updatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT(companyId,yellowWarningDays,orangeCriticalDays,defaultResponsibleEmail,hseEmail,updatedAt)
              VALUES(@companyId,@yellowWarningDays,@orangeCriticalDays,@defaultResponsibleEmail,@hseEmail,SYSUTCDATETIME());`);

  for (const tpl of data.templates || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), tpl.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('title', sql.NVarChar(240), tpl.title)
      .input('fileName', sql.NVarChar(260), tpl.fileName)
      .input('blobPath', sql.NVarChar(500), tpl.blobPath || `${companyId}/templates/${tpl.fileName}`)
      .input('category', sql.NVarChar(120), tpl.category || null)
      .input('description', sql.NVarChar(sql.MAX), tpl.description || null)
      .query(`MERGE Templates AS t USING (SELECT @id AS id) AS s ON t.id=s.id
              WHEN MATCHED THEN UPDATE SET title=@title,fileName=@fileName,blobPath=@blobPath,category=@category,description=@description,active=1
              WHEN NOT MATCHED THEN INSERT(id,companyId,title,fileName,blobPath,category,description,active)
              VALUES(@id,@companyId,@title,@fileName,@blobPath,@category,@description,1);`);
  }

  for (const e of data.employees || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), e.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('name', sql.NVarChar(200), e.name)
      .input('chipNr', sql.NVarChar(80), e.chipNr || null)
      .input('email', sql.NVarChar(254), e.email || null)
      .input('department', sql.NVarChar(120), e.department || null)
      .input('role', sql.NVarChar(60), e.role || 'Mitarbeiter')
      .input('title', sql.NVarChar(200), e.title || null)
      .input('active', sql.Bit, e.active === false ? 0 : 1)
      .query(`MERGE Employees AS t USING (SELECT @id AS id) AS s ON t.id=s.id
              WHEN MATCHED THEN UPDATE SET name=@name,chipNr=@chipNr,email=@email,department=@department,role=@role,title=@title,active=@active,updatedAt=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT(id,companyId,name,chipNr,email,department,role,title,active)
              VALUES(@id,@companyId,@name,@chipNr,@email,@department,@role,@title,@active);`);
  }
  // lineManagerId separat nach allen Employees setzen
  for (const e of data.employees || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), e.id)
      .input('lineManagerId', sql.NVarChar(80), e.shiftLeaderId || null)
      .query('UPDATE Employees SET lineManagerId=@lineManagerId WHERE id=@id');
  }

  for (const t of data.types || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), t.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('name', sql.NVarChar(200), t.name)
      .input('category', sql.NVarChar(120), t.category || 'Unterweisung')
      .input('intervalMonths', sql.Int, t.intervalMonths || 12)
      .input('description', sql.NVarChar(sql.MAX), t.description || null)
      .input('templateId', sql.NVarChar(80), t.templateId || null)
      .query(`MERGE InstructionTypes AS i USING (SELECT @id AS id) AS s ON i.id=s.id
              WHEN MATCHED THEN UPDATE SET name=@name,category=@category,intervalMonths=@intervalMonths,description=@description,templateId=@templateId,active=1,updatedAt=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT(id,companyId,name,category,intervalMonths,description,templateId,active)
              VALUES(@id,@companyId,@name,@category,@intervalMonths,@description,@templateId,1);`);
  }



  const questions = buildQuestions(data, companyId);
  for (const q of questions) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), q.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('instructionTypeId', sql.NVarChar(80), q.instructionTypeId || q.typeId)
      .input('language', sql.NVarChar(10), q.language || 'de')
      .input('question', sql.NVarChar(sql.MAX), q.question)
      .input('optionsJson', sql.NVarChar(sql.MAX), q.optionsJson || JSON.stringify(q.options || []))
      .input('correctIndex', sql.Int, Number.isFinite(Number(q.correctIndex)) ? Number(q.correctIndex) : Number(q.answerIndex || 0))
      .query(`MERGE TestQuestions AS t USING (SELECT @id AS id) AS s ON t.id=s.id
              WHEN MATCHED THEN UPDATE SET question=@question,optionsJson=@optionsJson,correctIndex=@correctIndex,active=1
              WHEN NOT MATCHED THEN INSERT(id,companyId,instructionTypeId,language,question,optionsJson,correctIndex,active)
              VALUES(@id,@companyId,@instructionTypeId,@language,@question,@optionsJson,@correctIndex,1);`);
  }

  for (const r of data.records || []) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar(80), r.id)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('employeeId', sql.NVarChar(80), r.employeeId || null)
      .input('typeId', sql.NVarChar(80), r.typeId)
      .input('conductedAt', sql.DateTime2, asDate(r.date) || new Date())
      .input('validUntil', sql.DateTime2, asDate(r.nextDue))
      .input('status', sql.NVarChar(40), r.status || 'completed')
      .input('source', sql.NVarChar(40), 'import_v24')
      .query(`IF NOT EXISTS(SELECT 1 FROM InstructionRecords WHERE id=@id)
              INSERT INTO InstructionRecords(id,companyId,employeeId,typeId,conductedAt,validUntil,status,source)
              VALUES(@id,@companyId,@employeeId,@typeId,@conductedAt,@validUntil,@status,@source);`);
  }

  await tx.commit();
  console.log('Import abgeschlossen:', {
    companyId,
    employees: data.employees?.length || 0,
    types: data.types?.length || 0,
    templates: data.templates?.length || 0,
    records: data.records?.length || 0,
    questions: buildQuestions(data, companyId).length
  });
} catch (err) {
  await tx.rollback();
  console.error(err);
  process.exit(1);
} finally {
  await pool.close();
}
