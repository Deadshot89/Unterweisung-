import { createHash } from 'node:crypto';
import { balancedQuestionId, placeCorrectAnswer } from '../../api/src/lib/question-order.js';

function normalizeOptions(arr) {
  return JSON.stringify(arr.map(x => String(x)));
}

export function legacyDefaultQuestionSet(type, lang='de') {
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


export function defaultQuestionSet(type, lang='de') {
  const legacy = legacyDefaultQuestionSet(type, lang);
  const ordered = [...legacy].sort((a,b)=>hash(a.id).localeCompare(hash(b.id), 'en'));
  const targets = new Map(ordered.map((row,index)=>[row.id,index % 4]));
  return legacy.map(row=>{
    const correctIndex = targets.get(row.id);
    // Deterministic seed output; repeated imports cannot change the answer key.
    const options = placeCorrectAnswer(JSON.parse(row.optionsJson), row.correctIndex, correctIndex, () => parseInt(hash(row.id).slice(0,8),16)/0x100000000);
    return {...row,id:balancedQuestionId(row.id),optionsJson:JSON.stringify(options.map(o=>o.text)),correctIndex};
  });
}

function hash(value) { return createHash('sha256').update(value).digest('hex'); }

export function assertBalancedSeedReady(types, rows, companyId) {
  const legacyIds=new Set(types.flatMap(type=>['de','en','pl'].flatMap(lang=>legacyDefaultQuestionSet({...type,companyId},lang).map(row=>row.id))));
  if(rows.some(row=>row.companyId===companyId && row.active!==false && row.active!==0 && legacyIds.has(row.id))) {
    throw new Error('Active legacy defaults exist. Run scripts/rebalance-default-test-questions.js --dry-run then --apply for this company before seeding; review any preserved custom legacy questions separately. No seed records were written.');
  }
}

export function planDefaultQuestionBalance(types, rows, companyId) {
  const byId = new Map(rows.map(row=>[row.id,row]));
  const changes=[];
  let preserved=0;
  for(const type of types) for(const lang of ['de','en','pl']) {
    const original = legacyDefaultQuestionSet({...type,companyId},lang);
    const balanced = defaultQuestionSet({...type,companyId},lang);
    for(let i=0;i<original.length;i++) {
      const expected=original[i], current=byId.get(expected.id), replacement=balanced[i];
      if(!current || current.active === false || current.active === 0) continue;
      let options;
      try { options=JSON.parse(current.optionsJson); } catch { preserved++; continue; }
      if(current.companyId!==companyId || current.instructionTypeId!==expected.instructionTypeId || current.language!==lang || current.question!==expected.question || Number(current.correctIndex)!==expected.correctIndex || JSON.stringify(options)!==expected.optionsJson) { preserved++; continue; }
      if(byId.has(replacement.id)) throw new Error('Replacement ID already exists for an active legacy question');
      changes.push({...replacement,oldId:current.id});
    }
  }
  return {changes,preserved};
}
