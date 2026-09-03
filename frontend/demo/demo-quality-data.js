import { DEMO_DATA } from './demo-data.js';

const INSTRUCTION_CONTENT = {
  'ins-arbeitsschutz': {
    description: 'Praxisnahe Grundunterweisung für einen sicheren Arbeitsbeginn, den konsequenten Einsatz von Schutzmaßnahmen und den richtigen Umgang mit erkannten Gefährdungen.',
    learningGoal: 'Nach dieser Unterweisung kannst du typische Gefährdungen vor Arbeitsbeginn erkennen, geeignete Schutzmaßnahmen anwenden und unsichere Zustände richtig stoppen und melden.',
    intro: 'Sicheres Arbeiten beginnt vor dem ersten Handgriff. Diese Unterweisung zeigt dir, wie du deinen Arbeitsbereich systematisch prüfst, vorhandene Schutzmaßnahmen richtig nutzt und bei Abweichungen so reagierst, dass weder du noch andere Personen gefährdet werden.',
    keyPoints: ['Arbeitsbereich vor Beginn bewusst prüfen', 'Schutzmaßnahmen und Freigaben konsequent einhalten', 'Unsichere Situationen stoppen und unverzüglich melden']
  },
  'ins-brandschutz': {
    description: 'Strukturierte Unterweisung zu Alarmierung, Evakuierung, Fluchtwegen, Sammelplatz und sicherem Verhalten bei Rauch- oder Brandereignissen.',
    learningGoal: 'Nach dieser Unterweisung kennst du die richtige Reaktion auf einen Brandalarm, kannst einen Bereich sicher verlassen und weißt, welches Verhalten am Sammelplatz erforderlich ist.',
    intro: 'Bei einem Brand zählen Orientierung, Geschwindigkeit und ein ruhiges Vorgehen. Du lernst, welche Handlungen im Alarmfall Priorität haben, warum Fluchtwege freigehalten werden müssen und wie die Anwesenheitskontrolle am Sammelplatz unterstützt wird.',
    keyPoints: ['Alarm ernst nehmen und Tätigkeit geordnet beenden', 'Gekennzeichnete Fluchtwege ohne Umwege nutzen', 'Am Sammelplatz bleiben und weitere Anweisungen abwarten']
  },
  'ins-phishing': {
    description: 'Alltagsnahe Sensibilisierung für Phishing, manipulierte Links, gefälschte Anmeldeseiten und die korrekte interne Meldung verdächtiger Nachrichten.',
    learningGoal: 'Nach dieser Unterweisung kannst du typische Merkmale von Phishing erkennen, Links und Anmeldeseiten kritisch prüfen und einen Verdachtsfall ohne zusätzliche Risiken korrekt melden.',
    intro: 'Angriffe per E-Mail oder Nachricht wirken oft glaubwürdig und erzeugen bewusst Zeitdruck. Diese Unterweisung hilft dir, Auffälligkeiten früh zu erkennen, nicht vorschnell zu klicken und verdächtige Inhalte so zu melden, dass die IT-Sicherheit reagieren kann.',
    keyPoints: ['Absender, Kontext und Dringlichkeit auf Plausibilität prüfen', 'Links und Anhänge nicht aus Zeitdruck öffnen', 'Verdachtsfälle über den vorgesehenen Meldeweg weitergeben']
  },
  'ins-psa': {
    description: 'Unterweisung zur Auswahl, Sichtprüfung, korrekten Verwendung und zum Austausch persönlicher Schutzausrüstung passend zur jeweiligen Tätigkeit.'
  },
  'ins-gefahrstoffe': {
    description: 'Sicherer Umgang mit Gefahrstoffen: Kennzeichnung verstehen, freigegebene Lagerorte nutzen und bei Leckagen oder unbeabsichtigtem Austritt richtig reagieren.'
  },
  'ins-stapler': {
    description: 'Praktische Einweisung in Fahrzeugkontrolle, Verkehrswege, Sichtverhältnisse, Lastaufnahme und den sicheren Betrieb von Flurförderzeugen.'
  },
  'ins-ladungssicherung': {
    description: 'Praktische Unterweisung zur Auswahl geeigneter Sicherungsmittel, form- und kraftschlüssiger Sicherung sowie Kontrolle vor der Abfahrt.'
  },
  'ins-datenschutz': {
    description: 'Praxisorientierter Umgang mit personenbezogenen Daten, Datenminimierung, vertraulicher Weitergabe und sicheren Ablagewegen im Arbeitsalltag.'
  },
  'ins-ergonomie': {
    description: 'Gesunde Gestaltung des Bildschirmarbeitsplatzes mit passender Sitzposition, Bildschirmhöhe, Eingabegeräten und sinnvoller Belastungsunterbrechung.'
  },
  'ins-unfall': {
    description: 'Klare Handlungskette bei Arbeitsunfällen: Eigenschutz, Absicherung, Erste Hilfe, Alarmierung, Meldung und nachvollziehbare Dokumentation.'
  }
};

const STEP_CONTENT = {
  'step-as-1': {
    title: 'Arbeitsbereich vor Beginn beurteilen',
    text: 'Nimm dir vor Arbeitsbeginn einen kurzen Moment für eine bewusste Sichtprüfung. Achte auf blockierte Verkehrswege, beschädigte Arbeitsmittel, ausgetretene Flüssigkeiten, fehlende Abdeckungen oder andere Veränderungen. Beginne erst, wenn der Arbeitsplatz sicher ist oder eine festgestellte Abweichung geklärt wurde.',
    imageCaption: 'Beispielhafte Sichtprüfung eines Produktionsarbeitsplatzes vor Tätigkeitsbeginn.',
    calloutTitle: 'Praxischeck',
    calloutText: 'Frage dich vor dem Start: Ist der Weg frei, das Arbeitsmittel unbeschädigt und die vorgesehene Schutzmaßnahme wirksam?'
  },
  'step-as-2': {
    title: 'Schutzmaßnahmen konsequent anwenden',
    text: 'Nutze Schutzvorrichtungen, persönliche Schutzausrüstung und festgelegte Arbeitsverfahren so, wie sie für die Tätigkeit vorgesehen sind. Schutzmaßnahmen dürfen nicht umgangen oder außer Funktion gesetzt werden. Wenn eine Maßnahme fehlt oder nicht wirksam ist, wird die Tätigkeit nicht improvisiert fortgesetzt.',
    imageCaption: 'Schutzmaßnahmen werden vor und während der Tätigkeit sichtbar und konsequent angewendet.',
    calloutTitle: 'Merksatz',
    calloutText: 'Zeitdruck ist kein Grund, eine Schutzmaßnahme zu überspringen. Eine sichere Arbeitsweise hat immer Vorrang.'
  },
  'step-as-3': {
    title: 'Gefährdungen stoppen und melden',
    text: 'Erkennst du eine akute oder nicht beherrschte Gefahr, unterbrich die Tätigkeit und sichere den Bereich nur soweit dies ohne Eigengefährdung möglich ist. Informiere die zuständige Führungskraft und beschreibe möglichst konkret, was du festgestellt hast. Erst nach Klärung oder Freigabe wird weitergearbeitet.',
    imageCaption: 'Erkannte Gefährdungen werden nicht hingenommen, sondern gestoppt, abgesichert und gemeldet.',
    calloutTitle: 'Wichtig',
    calloutText: 'Eine schnelle, klare Meldung schützt Kolleginnen und Kollegen und verhindert, dass derselbe unsichere Zustand erneut übersehen wird.'
  },
  'step-bs-1': {
    title: 'Alarmierung richtig einordnen',
    text: 'Behandle einen Brandalarm immer als reale Situation. Beende die Tätigkeit geordnet, stelle Arbeitsmittel nur dann sicher ab, wenn dies ohne Zeitverlust und Eigengefährdung möglich ist, und orientiere dich sofort an den betrieblichen Alarm- und Evakuierungsvorgaben. Persönliche Gegenstände haben keine Priorität.',
    imageCaption: 'Der Alarm löst eine klare Handlungskette aus: Tätigkeit beenden, orientieren und den Bereich verlassen.',
    calloutTitle: 'Priorität',
    calloutText: 'Im Alarmfall geht es zuerst um Menschen. Verzögere die Evakuierung nicht, um Material oder persönliche Gegenstände zu holen.'
  },
  'step-bs-2': {
    title: 'Sicher über Fluchtwege räumen',
    text: 'Nutze ausschließlich die gekennzeichneten und freigehaltenen Flucht- und Rettungswege. Gehe zügig, aber ohne zu drängeln, und benutze keine Aufzüge. Unterstütze andere Personen nur, wenn du dich dadurch nicht selbst gefährdest. Türen können – soweit vorgesehen – beim Verlassen geschlossen werden, um die Rauchausbreitung zu begrenzen.',
    imageCaption: 'Gekennzeichnete Fluchtwege führen Personen ohne Umwege aus dem Gefahrenbereich.',
    calloutTitle: 'Nicht zurückgehen',
    calloutText: 'Ein bereits geräumter Bereich wird nicht erneut betreten, bis eine ausdrücklich befugte Stelle die Freigabe erteilt.'
  },
  'step-bs-3': {
    title: 'Am Sammelplatz Vollständigkeit sichern',
    text: 'Gehe nach dem Verlassen des Gebäudes direkt zum festgelegten Sammelplatz. Bleibe dort, melde dich entsprechend der betrieblichen Regelung und halte Zufahrten für Feuerwehr und Rettungsdienst frei. Verlasse den Sammelplatz erst, wenn die verantwortliche Person dies freigibt.',
    imageCaption: 'Der Sammelplatz ermöglicht eine geordnete Anwesenheitskontrolle außerhalb des Gefahrenbereichs.',
    calloutTitle: 'Anwesenheit zählt',
    calloutText: 'Wer den Sammelplatz ohne Rückmeldung verlässt, erschwert die Vollständigkeitskontrolle und kann unnötige Suchmaßnahmen auslösen.'
  },
  'step-ph-1': {
    title: 'Absender und Kontext plausibilisieren',
    text: 'Prüfe nicht nur den angezeigten Absendernamen, sondern auch die tatsächliche Adresse, den Inhalt und den erwartbaren Kontext. Ungewöhnliche Schreibweisen, unerwartete Rechnungen, spontane Passwortaufforderungen oder künstlicher Zeitdruck sind typische Warnzeichen. Bei Unsicherheit wird über einen bekannten Kontaktweg nachgefragt.',
    imageCaption: 'Eine verdächtige Nachricht wird anhand von Absender, Kontext und auffälliger Dringlichkeit geprüft.',
    calloutTitle: 'Denkpause',
    calloutText: 'Je stärker eine Nachricht zu sofortigem Handeln drängt, desto wichtiger ist eine kurze unabhängige Plausibilitätsprüfung.'
  },
  'step-ph-2': {
    title: 'Links, Anhänge und Anmeldeseiten verifizieren',
    text: 'Öffne verdächtige Links oder Anhänge nicht direkt. Prüfe das Linkziel und rufe bekannte Portale im Zweifel über ein gespeichertes Lesezeichen oder durch manuelle Eingabe auf. Zugangsdaten werden nur auf eindeutig bekannten Anmeldeseiten eingegeben. Unerwartete Dateianhänge werden nicht aus Neugier geöffnet.',
    imageCaption: 'Vor dem Klick wird geprüft, ob Linkziel und Anmeldeseite tatsächlich zum erwarteten Dienst gehören.',
    calloutTitle: 'Sicherer Weg',
    calloutText: 'Öffne wichtige Dienste lieber selbst über den bekannten Einstieg, statt einer unerwarteten Nachricht direkt zu vertrauen.'
  },
  'step-ph-3': {
    title: 'Verdachtsfälle richtig melden',
    text: 'Melde eine verdächtige Nachricht über den vorgesehenen internen Meldeweg und gib die relevanten Informationen weiter, ohne schädliche Inhalte unnötig zu verbreiten. Wenn du bereits geklickt oder Daten eingegeben hast, melde auch das sofort und vollständig. Schnelle Transparenz ermöglicht eine gezielte technische Reaktion.',
    imageCaption: 'Eine schnelle interne Meldung gibt der IT-Sicherheit die Informationen für weitere Schutzmaßnahmen.',
    calloutTitle: 'Keine Scheu',
    calloutText: 'Auch nach einem versehentlichen Klick ist eine sofortige Meldung hilfreicher als der Versuch, den Vorfall selbst zu verbergen oder zu lösen.'
  }
};

export function prepareDemoQualityData(data = DEMO_DATA) {
  for (const instruction of data.instructionTypes || []) {
    const patch = INSTRUCTION_CONTENT[instruction.id];
    if (patch) Object.assign(instruction, patch);
  }
  for (const step of data.learningSteps || []) {
    const patch = STEP_CONTENT[step.id];
    if (patch) Object.assign(step, patch);
  }
  return data;
}

prepareDemoQualityData(DEMO_DATA);
