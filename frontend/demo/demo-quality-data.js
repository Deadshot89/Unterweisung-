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
    description: 'Praxisorientierte Unterweisung zur Auswahl, Sichtprüfung, richtigen Verwendung und konsequenten Aussonderung persönlicher Schutzausrüstung.',
    learningGoal: 'Nach dieser Unterweisung kannst du die für deine Tätigkeit vorgesehene persönliche Schutzausrüstung auswählen, ihren Zustand vor der Nutzung beurteilen und beschädigte oder ungeeignete PSA sicher aus dem Einsatz nehmen.',
    intro: 'Persönliche Schutzausrüstung wirkt nur, wenn sie zur Gefährdung passt, korrekt getragen wird und technisch in Ordnung ist. Diese Lernstrecke zeigt dir, worauf du vor der Nutzung achten musst, wie ein sicherer Sitz geprüft wird und wie du mit beschädigter oder ungeeigneter PSA richtig umgehst.',
    keyPoints: ['Nur die für Tätigkeit und Gefährdung vorgesehene PSA verwenden', 'PSA vor jeder Nutzung auf Zustand, Passform und Funktion prüfen', 'Beschädigte oder ungeeignete PSA sofort aussondern und melden']
  },
  'ins-gefahrstoffe': {
    description: 'Sicherer Umgang mit Gefahrstoffen: Kennzeichnung verstehen, freigegebene Lagerorte nutzen und bei Leckagen oder unbeabsichtigtem Austritt richtig reagieren.',
    learningGoal: 'Nach dieser Unterweisung kannst du Gefahrstoffkennzeichnungen einordnen, betriebliche Schutzmaßnahmen beachten und bei einem unbeabsichtigten Austritt richtig reagieren.',
    intro: 'Gefahrstoffe können bereits bei falscher Lagerung, ungeeigneter Schutzausrüstung oder unbemerktem Austritt zu erheblichen Risiken führen. Entscheidend ist, Kennzeichnungen ernst zu nehmen, nur freigegebene Arbeitsweisen zu nutzen und Abweichungen frühzeitig zu melden.',
    keyPoints: ['Kennzeichnung und betriebliche Hinweise vor der Verwendung beachten', 'Gefahrstoffe ausschließlich in freigegebenen Bereichen lagern und verwenden', 'Bei Austritt Abstand halten, Bereich sichern und festgelegten Meldeweg nutzen']
  },
  'ins-datenschutz': {
    description: 'Praxisorientierter Umgang mit personenbezogenen Daten, Datenminimierung, vertraulicher Weitergabe und sicheren Ablagewegen im Arbeitsalltag.',
    learningGoal: 'Nach dieser Unterweisung kannst du personenbezogene Daten im Arbeitsalltag erkennen, nur im notwendigen Umfang verarbeiten und sie vor unberechtigter Einsicht oder Weitergabe schützen.',
    intro: 'Datenschutz ist kein Spezialthema nur für die Verwaltung. Namen, Kontaktdaten, Personalinformationen, Kundenangaben oder sensible Dokumente begegnen uns in vielen Prozessen. Entscheidend ist, diese Informationen bewusst und nur für den vorgesehenen Zweck zu verwenden.',
    keyPoints: ['Nur die Daten verwenden, die für die konkrete Aufgabe erforderlich sind', 'Bildschirm, Ausdrucke und Dateien vor unberechtigter Einsicht schützen', 'Personenbezogene Daten nur über freigegebene Wege weitergeben']
  },
  'ins-ergonomie': {
    description: 'Gesunde Gestaltung des Bildschirmarbeitsplatzes mit passender Sitzposition, Bildschirmhöhe, Eingabegeräten und sinnvoller Belastungsunterbrechung.',
    learningGoal: 'Nach dieser Unterweisung kannst du deinen Bildschirmarbeitsplatz so einstellen, dass unnötige Belastungen reduziert werden und regelmäßige Haltungswechsel im Arbeitsalltag unterstützt werden.',
    intro: 'Eine ungünstige Sitzposition oder dauerhaft gleiche Haltung fällt oft erst auf, wenn Beschwerden entstehen. Kleine Anpassungen an Stuhl, Bildschirm, Tastatur und Arbeitsrhythmus können helfen, Belastungen deutlich zu reduzieren und konzentriert zu arbeiten.',
    keyPoints: ['Sitzhöhe und Rückenlehne passend einstellen', 'Bildschirm so positionieren, dass Kopf und Nacken möglichst entspannt bleiben', 'Regelmäßig Haltung wechseln und kurze Bewegungsphasen einbauen']
  },
  'ins-unfall': {
    description: 'Klare Handlungskette bei Arbeitsunfällen: Eigenschutz, Absicherung, Erste Hilfe, Alarmierung, Meldung und nachvollziehbare Dokumentation.',
    learningGoal: 'Nach dieser Unterweisung kennst du die richtige Reihenfolge nach einem Arbeitsunfall und kannst Hilfe organisieren, ohne dich oder andere Personen zusätzlich zu gefährden.',
    intro: 'Nach einem Unfall zählt eine ruhige und klare Reihenfolge. Zuerst wird die Situation beurteilt und weiterer Schaden verhindert. Danach werden Ersthelfer oder Rettungsdienst eingebunden und der Vorfall über die vorgesehenen betrieblichen Wege gemeldet und dokumentiert.',
    keyPoints: ['Eigenschutz und Absicherung stehen an erster Stelle', 'Erste Hilfe und Alarmierung schnell und eindeutig organisieren', 'Arbeitsunfälle vollständig melden und nach betrieblicher Vorgabe dokumentieren']
  },
  'ins-stapler': {
    description: 'Praktische Einweisung in Fahrzeugkontrolle, Verkehrswege, Sichtverhältnisse, Lastaufnahme und den sicheren Betrieb von Flurförderzeugen.'
  },
  'ins-ladungssicherung': {
    description: 'Praktische Unterweisung zur Auswahl geeigneter Sicherungsmittel, form- und kraftschlüssiger Sicherung sowie Kontrolle vor der Abfahrt.'
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
  },
  'step-psa-1': {
    title: 'Passende PSA für die Tätigkeit auswählen',
    text: 'Verwende nur die persönliche Schutzausrüstung, die für die konkrete Tätigkeit und die dabei vorhandenen Gefährdungen vorgesehen ist. Prüfe Kennzeichnung, Größe und Einsatzbereich und stelle sicher, dass sich einzelne Schutzausrüstungen nicht gegenseitig in ihrer Wirkung beeinträchtigen. Eine Schutzbrille, die nicht zur Gefährdung passt, schützt trotz korrektem Sitz nicht ausreichend.',
    imageCaption: 'Die dargestellte PSA wird passend zur Tätigkeit ausgewählt und vor dem Einsatz vollständig bereitgelegt.',
    calloutTitle: 'Vor Arbeitsbeginn',
    calloutText: 'Kläre Unsicherheiten zur vorgeschriebenen PSA vor Beginn der Tätigkeit mit der zuständigen Führungskraft und improvisiere keinen Ersatz.'
  },
  'step-psa-2': {
    title: 'Zustand, Passform und Funktion prüfen',
    text: 'Kontrolliere die PSA vor jeder Nutzung auf sichtbare Schäden, Verschleiß, Verformungen, Verschmutzungen und einen sicheren Sitz. Bei Schutzbrillen gehören Gläser, Bügel und Seitenschutz dazu; bei Handschuhen Material, Nähte und Beschichtung. Nur unbeschädigte und funktionsfähige PSA kann ihre vorgesehene Schutzwirkung zuverlässig erfüllen.',
    imageCaption: 'Vor der Nutzung werden Zustand, Passform und Funktion der Schutzausrüstung gezielt kontrolliert.',
    calloutTitle: 'Sichtprüfung reicht oft weit',
    calloutText: 'Risse, starke Kratzer, lockere Teile oder eine deutlich veränderte Passform sind Gründe, die PSA nicht weiterzuverwenden.'
  },
  'step-psa-3': {
    title: 'Beschädigte PSA sofort aussondern und melden',
    text: 'Beschädigte, ungeeignete oder nicht mehr sicher verwendbare PSA wird nicht weitergetragen und auch nicht für den nächsten Einsatz zurückgelegt. Nimm sie aus dem Gebrauch, kennzeichne oder separiere sie nach betrieblicher Regelung und melde den Mangel an die zuständige Stelle. Ersatz wird organisiert, bevor die gefährdende Tätigkeit wieder aufgenommen wird.',
    imageCaption: 'Beschädigte Schutzbrille wird erkannt, aus dem Einsatz genommen und getrennt zur weiteren Bearbeitung abgelegt.',
    calloutTitle: 'Deine Verantwortung',
    calloutText: 'Eine sofortige Mängelmeldung schützt nicht nur dich, sondern verhindert auch, dass beschädigte PSA versehentlich von anderen Personen weiterverwendet wird.'
  },
  'step-gs-1': {
    title: 'Kennzeichnung vor der Verwendung verstehen',
    text: 'Prüfe vor dem Umgang mit einem Gefahrstoff die vorhandene Kennzeichnung und die für deinen Arbeitsplatz vorgesehenen Informationen. Gefahrensymbole, Signalwörter und betriebliche Hinweise geben dir wichtige Informationen zu Gesundheits-, Brand- oder Umweltgefahren. Beginne die Tätigkeit erst, wenn die vorgesehenen Schutzmaßnahmen klar sind.',
    imageCaption: 'Kennzeichnung und betriebliche Hinweise werden vor dem Umgang mit dem Stoff bewusst geprüft.',
    calloutTitle: 'Nicht aus Gewohnheit handeln',
    calloutText: 'Auch bekannte Produkte können andere Konzentrationen oder neue Gefährdungen aufweisen. Die aktuelle Kennzeichnung ist maßgeblich.'
  },
  'step-gs-2': {
    title: 'Gefahrstoffe sicher verwenden und lagern',
    text: 'Verwende Gefahrstoffe nur an freigegebenen Arbeitsplätzen und halte Behälter soweit möglich geschlossen. Lagere Stoffe ausschließlich in den vorgesehenen Bereichen und beachte Trenn- oder Auffangvorgaben. Umfüllen in ungekennzeichnete Behälter oder das Abstellen in Pausen- und Verkehrsbereichen ist nicht zulässig.',
    imageCaption: 'Freigegebener Lagerbereich mit geordneten Behältern und klarer Trennung von Verkehrsflächen.',
    calloutTitle: 'Ordnung ist Schutz',
    calloutText: 'Ein korrekt gekennzeichneter und vorgesehener Lagerplatz reduziert Verwechslungen und begrenzt Folgen bei einem unbeabsichtigten Austritt.'
  },
  'step-gs-3': {
    title: 'Bei Austritt oder Leckage richtig reagieren',
    text: 'Tritt ein Stoff unbeabsichtigt aus, halte Abstand und verhindere weitere Exposition. Sichere den Bereich nur, wenn dies ohne Eigengefährdung möglich ist, und informiere sofort die zuständige Stelle. Verwende Bindemittel oder Notfallausrüstung nur entsprechend der betrieblichen Vorgabe und nur, wenn du dafür eingewiesen bist.',
    imageCaption: 'Ein abgesicherter Bereich und eine schnelle Meldung haben Vorrang vor unkoordinierten Reinigungsversuchen.',
    calloutTitle: 'Eigenschutz zuerst',
    calloutText: 'Eine Leckage wird nicht spontan mit ungeeigneten Mitteln beseitigt. Abstand, Absicherung und der vorgesehene Meldeweg haben Priorität.'
  },
  'step-ds-1': {
    title: 'Nur erforderliche Daten verwenden',
    text: 'Verarbeite personenbezogene Daten nur, wenn du sie für deine konkrete Arbeitsaufgabe tatsächlich benötigst. Öffne keine Personal-, Kunden- oder Kontaktdaten aus reiner Neugier und kopiere Informationen nicht vorsorglich in private Notizen oder zusätzliche Dateien. Weniger unnötige Kopien bedeuten weniger Risiko.',
    imageCaption: 'Nur die für den Arbeitsprozess erforderlichen personenbezogenen Daten werden geöffnet und verwendet.',
    calloutTitle: 'Datenminimierung',
    calloutText: 'Wenn du eine Information für deine Aufgabe nicht benötigst, sollte sie auch nicht zusätzlich verarbeitet, gespeichert oder weitergegeben werden.'
  },
  'step-ergo-1': {
    title: 'Arbeitsplatz passend einstellen',
    text: 'Stelle Sitzhöhe, Rückenlehne und Arbeitsfläche so ein, dass die Füße sicher aufstehen und Schultern sowie Unterarme möglichst entspannt bleiben. Bildschirm, Tastatur und Maus sollten ohne dauerhaftes Vorbeugen oder Verdrehen erreichbar sein. Kleine Anpassungen können unnötige statische Belastungen deutlich reduzieren.',
    imageCaption: 'Ein passend eingestellter Bildschirmarbeitsplatz unterstützt eine entspannte und wechselnde Arbeitshaltung.',
    calloutTitle: 'Individuell einstellen',
    calloutText: 'Ein Arbeitsplatz ist nicht automatisch passend, nur weil die Person davor damit gearbeitet hat. Stelle ihn für dich selbst neu ein.'
  },
  'step-unfall-1': {
    title: 'Situation beurteilen und absichern',
    text: 'Achte zuerst auf deinen eigenen Schutz und verschaffe dir einen kurzen Überblick über die Situation. Stoppe gefährliche Prozesse nur, wenn das sicher möglich ist, und verhindere weitere Gefährdungen durch Verkehr, Maschinen, Energie oder ausgetretene Stoffe. Erst dann wird gezielt Hilfe organisiert.',
    imageCaption: 'Vor der Hilfeleistung wird die Unfallstelle beurteilt und gegen weitere Gefährdungen abgesichert.',
    calloutTitle: 'Eigenschutz',
    calloutText: 'Eine zusätzliche verletzte Person hilft niemandem. Betritt einen Gefahrenbereich nur, wenn du dich dabei nicht selbst gefährdest.'
  }
};

const EXTRA_STEPS = [
  { id:'step-ds-2', instructionId:'ins-datenschutz', order:2, title:'Daten vor Einsicht schützen', text:'Sperre deinen Bildschirm, wenn du den Arbeitsplatz verlässt, und lasse Ausdrucke mit personenbezogenen Daten nicht offen liegen. Nutze die vorgesehenen Ablageorte und achte besonders in gemeinsam genutzten Räumen darauf, dass Informationen nicht unbeabsichtigt für Dritte sichtbar werden.', image:'./assets/phishing.svg', imageCaption:'Bildschirm und Unterlagen werden so geschützt, dass unberechtigte Personen keine Einsicht erhalten.', calloutTitle:'Clean Desk', calloutText:'Vertrauliche Informationen gehören nach der Nutzung zurück in die vorgesehene digitale oder physische Ablage und nicht offen auf den Arbeitsplatz.' },
  { id:'step-ds-3', instructionId:'ins-datenschutz', order:3, title:'Daten nur über freigegebene Wege weitergeben', text:'Versende personenbezogene Daten ausschließlich an berechtigte Empfänger und über die dafür vorgesehenen Systeme. Prüfe Empfängeradressen vor dem Senden und vermeide private Messenger, persönliche Cloudspeicher oder andere nicht freigegebene Wege. Bei Unsicherheit wird die Weitergabe vorab geklärt.', image:'./assets/phishing.svg', imageCaption:'Vor der Weitergabe werden Empfänger, Berechtigung und der freigegebene Übertragungsweg geprüft.', calloutTitle:'Vor dem Senden prüfen', calloutText:'Eine falsch adressierte Nachricht lässt sich häufig nicht zurückholen. Eine kurze Empfängerprüfung vor dem Versand verhindert vermeidbare Datenschutzvorfälle.' },
  { id:'step-ergo-2', instructionId:'ins-ergonomie', order:2, title:'Bildschirm und Eingabegeräte sinnvoll positionieren', text:'Positioniere den Bildschirm in angenehmer Sehdistanz und möglichst so, dass die oberste relevante Zeile nicht deutlich über Augenhöhe liegt. Tastatur und Maus sollten nah genug liegen, damit Schultern und Arme nicht dauerhaft nach vorne gezogen werden. Spiegelungen und starke Helligkeitsunterschiede sollten vermieden werden.', image:'./assets/work-safety.svg', imageCaption:'Bildschirm, Tastatur und Maus sind so angeordnet, dass Kopf, Schultern und Arme möglichst entspannt bleiben.', calloutTitle:'Blickrichtung', calloutText:'Wenn du den Kopf dauerhaft anheben, drehen oder nach vorne schieben musst, sollte die Position des Bildschirms überprüft werden.' },
  { id:'step-ergo-3', instructionId:'ins-ergonomie', order:3, title:'Haltung regelmäßig wechseln', text:'Auch eine gute Sitzhaltung sollte nicht über lange Zeit unverändert gehalten werden. Nutze kurze Bewegungsphasen, stehe regelmäßig auf und wechsle zwischen verschiedenen Tätigkeiten, wenn der Arbeitsablauf das zulässt. Kleine, regelmäßige Wechsel sind wirksamer als seltene lange Ausgleichsphasen.', image:'./assets/work-safety.svg', imageCaption:'Kurze Bewegungsphasen und wechselnde Arbeitshaltungen unterbrechen einseitige Belastung im Büroalltag.', calloutTitle:'Dynamisch arbeiten', calloutText:'Die beste Haltung ist die nächste Haltung: regelmäßiger Wechsel entlastet Muskeln und Gelenke stärker als starres „richtiges“ Sitzen.' },
  { id:'step-unfall-2', instructionId:'ins-unfall', order:2, title:'Erste Hilfe und Alarmierung organisieren', text:'Hole schnell Unterstützung durch betriebliche Ersthelfer oder den Rettungsdienst und gib klare Informationen zu Ort, Art des Ereignisses und betroffenen Personen. Leiste Erste Hilfe entsprechend deiner Kenntnisse und bleibe bei der verletzten Person, soweit dies sicher möglich ist, bis weitere Hilfe übernimmt.', image:'./assets/work-safety.svg', imageCaption:'Nach der Absicherung werden Ersthelfer oder Rettungsdienst gezielt alarmiert und zur Unfallstelle geführt.', calloutTitle:'Klare Angaben', calloutText:'Nenne bei der Alarmierung möglichst genau, wo sich die Unfallstelle befindet und welche Gefährdung dort noch bestehen könnte.' },
  { id:'step-unfall-3', instructionId:'ins-unfall', order:3, title:'Unfall melden und dokumentieren', text:'Informiere die zuständige Führungskraft und stelle sicher, dass der Vorfall entsprechend der betrieblichen Vorgaben dokumentiert wird. Auch scheinbar kleinere Verletzungen können für spätere medizinische oder organisatorische Bewertungen relevant sein. Eine vollständige Meldung hilft außerdem, Ursachen zu erkennen und Wiederholungen zu verhindern.', image:'./assets/work-safety.svg', imageCaption:'Nach der unmittelbaren Hilfe wird der Unfall vollständig gemeldet und nachvollziehbar dokumentiert.', calloutTitle:'Nicht bagatellisieren', calloutText:'Eine korrekte Dokumentation dient nicht der Schuldzuweisung, sondern der Nachvollziehbarkeit, Versorgung und Verbesserung des Arbeitsschutzes.' }
];

export function prepareDemoQualityData(data = DEMO_DATA) {
  for (const instruction of data.instructionTypes || []) {
    const patch = INSTRUCTION_CONTENT[instruction.id];
    if (patch) Object.assign(instruction, patch);
  }
  for (const step of data.learningSteps || []) {
    const patch = STEP_CONTENT[step.id];
    if (patch) Object.assign(step, patch);
  }
  for (const step of EXTRA_STEPS) {
    if (!(data.learningSteps || []).some(item => item.id === step.id)) data.learningSteps.push({ ...step });
  }
  return data;
}

prepareDemoQualityData(DEMO_DATA);
