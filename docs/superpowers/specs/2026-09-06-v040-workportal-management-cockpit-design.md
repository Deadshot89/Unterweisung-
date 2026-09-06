# v0.40 – Arbeitsportal & Management-Cockpit

## Ziel

Der Unterweisungsmanager wird von einer Sammlung technisch getrennter Bereiche zu einem rollenabhängigen Arbeitsportal mit Management-Cockpit weiterentwickelt. Design, Funktionen und Abläufe werden gemeinsam überarbeitet, ohne die bestehende Mandanten- und Berechtigungslogik zu ersetzen.

Die Anwendung soll nach dem Login unmittelbar zeigen, was die jeweilige Person als Nächstes tun muss. Führungskräfte und Administratoren erhalten zusätzlich ein Management-Cockpit mit Kennzahlen, Fristen, Teamstatus und direkten Aktionen.

## Leitprinzipien

1. Keine neue Reparaturschicht über alten Darstellungsblöcken. Ersetzte UI-Bausteine werden entfernt oder vollständig abgelöst.
2. Die API bleibt die verbindliche Sicherheitsgrenze für Rollen, Firmenzuordnung, Teamzuordnung, Downloads und direkte Dateizugriffe.
3. Normale Benutzer sehen ausschließlich ihre zugewiesene Firma. Nur Systemadmins dürfen firmenübergreifend arbeiten.
4. Führungskräfte dürfen nur ihr serverseitig zugewiesenes Team sehen und bearbeiten; diese Grenze darf nicht nur durch ausgeblendete UI-Elemente entstehen.
5. Das Portal passt Navigation, Startseite, Arbeitslisten und Aktionen an die Benutzerrolle an.
6. Fachlich zusammengehörige Vorgänge werden als ein Prozess dargestellt statt über viele Menüpunkte verteilt.
7. Desktop und Smartphone verwenden dieselbe Fachlogik, aber jeweils eine passende Darstellung.
8. Bestehende funktionierende API-Endpunkte werden bevorzugt weiterverwendet. Neue Endpunkte werden nur ergänzt, wenn ein neuer Ablauf sie tatsächlich benötigt.

## Informationsarchitektur

Die bisherige flache Hauptnavigation mit vielen gleichwertigen Bereichen wird durch sieben Hauptbereiche ersetzt:

- Start
- Meine Aufgaben / Team
- Unterweisungen
- Planung
- Nachweise
- Auswertungen
- Verwaltung

Die Fehlerdiagnose bleibt für berechtigte Benutzer erreichbar, wird aber nicht als normaler Arbeitsbereich für alle dargestellt.

Die obere Kopfzeile enthält nur:

- aktive Firma
- Benutzername und Rolle
- Benachrichtigungen
- Firmenwechsel für Systemadmins
- Abmelden

## Rollenabhängige Startseiten

### Mitarbeiter

Die Startseite zeigt ausschließlich die eigene Arbeit:

- heute fällige Aufgaben
- offene Unterweisungen
- bald fällige Unterweisungen
- geplante persönliche Termine
- direkte Aktion „Unterweisung starten“
- eigene abgeschlossene Unterweisungen
- eigene Nachweise zum Öffnen und Herunterladen

Mitarbeiter sehen keine firmenweite Verwaltung und keine fremden Mitarbeiterdaten.

### Line Manager / Führungskraft

Die Startseite kombiniert persönliche Aufgaben mit Teamarbeit:

- eigene offene Aufgaben
- offene Aufgaben des zugewiesenen Teams
- überfällige Team-Unterweisungen
- nächste Teamtermine
- fehlende Nachweise im Team
- direkte Aktion „Unterweisung planen“
- direkte Aktion „Extern verschicken“
- direkte Aktion „Team erinnern“

Eine Führungskraft sieht nur ihr zugewiesenes Team innerhalb der eigenen Firma. Diese Grenze wird von der API geprüft und nicht nur durch die Oberfläche dargestellt.

### HSE / Firmenadmin

Die Startseite wird zum Management-Cockpit der eigenen Firma:

- Erfüllungsquote
- überfällige Unterweisungen
- fehlende Unterweisungen
- Fälligkeiten in 30 Tagen
- fehlende Nachweise
- geplante Unterweisungen
- kritische Mitarbeiter oder Bereiche
- zuletzt abgeschlossene Unterweisungen
- Schnellaktionen für Planung, Erinnerung, Nachweise und Auswertung

### Systemadmin

Der Systemadmin sieht zunächst die Firmenauswahl bzw. Firmenübersicht. Nach Auswahl einer Firma arbeitet auch der Systemadmin im selben Firmenkontext wie die anderen Rollen.

Zusätzlich stehen bereit:

- Firmenverwaltung
- Benutzer- und Rollenverwaltung
- Betrieb / Systemstatus
- Fehlerdiagnose
- Sicherheitsfunktionen

## Neuer Unterweisungsworkflow

Unterweisungen werden als ein zusammenhängender Ablauf behandelt:

1. Unterweisung auswählen
2. Zielgruppe / Personen auswählen
3. Durchführungsart wählen
4. Termin oder Frist festlegen
5. Benachrichtigung / Einladung versenden
6. Unterweisung durchführen
7. Prüfung ablegen, falls erforderlich
8. Nachweis erzeugen oder hochladen
9. Abschluss und Historie speichern

### Durchführungsarten

#### Digital intern

Die Unterweisung wird einem internen Benutzer zugewiesen und erscheint direkt im persönlichen Arbeitsportal.

#### Geplanter Termin / Gruppenunterweisung

Ein Termin enthält:

- Unterweisung
- Datum und Uhrzeit
- Dauer
- Ort
- Verantwortlichen
- Teilnehmer
- Status
- optionale Notiz

Beim Abschluss werden für alle Teilnehmer echte Unterweisungseinträge erzeugt. Der Abschluss erfolgt über einen richtigen Dialog statt über Browser-`prompt()`-Fenster.

#### Extern

Für externe Teilnehmer wird ein persönlicher sicherer Link erstellt. Ein normales Website-Konto oder Microsoft-Konto ist dafür nicht erforderlich.

Führungskräfte dürfen externe Unterweisungen ebenfalls verschicken, sofern ihre Rolle dies erlaubt.

## Unterweisungsdarstellung

Die eigentliche Unterweisung wird als professioneller Lerninhalt dargestellt.

Struktur:

- Titel und Lernziel
- Kapitel / Abschnitte
- Textblöcke
- Bildblöcke mit Beschreibung
- Hinweisboxen
- Warnhinweise
- Zusammenfassung
- Verständnisfragen
- Abschlussprüfung
- Ergebnis und Abschluss

### Bilddarstellung

Bilder werden nicht mehr nur als einfache Anhänge angezeigt. Jeder Bildblock kann enthalten:

- Bild
- Bildtitel
- Bildbeschreibung
- optionale Hervorhebung
- Vollbildansicht

Die Darstellung muss auf Desktop und Smartphone funktionieren.

## Aufgaben- und Teamarbeitsbereich

Der bisherige Statusbereich wird zu einem Aktionszentrum weiterentwickelt.

Spalten / Karteninhalt:

- Mitarbeiter
- Unterweisung
- Frist
- Status
- Verantwortlicher
- Nachweis
- nächste Aktion

Direkte Einzelaktionen:

- erinnern
- planen
- intern zuweisen
- extern senden
- als durchgeführt erfassen
- Nachweis öffnen
- Ausnahme bearbeiten

Sammelaktionen bleiben möglich und werden verbessert:

- mehrere Mitarbeiter erinnern
- mehrere Unterweisungen planen
- mehrere externe Links erzeugen
- mehrere Einträge abschließen
- mehrere Einträge als nicht erforderlich markieren

Filter:

- Suche
- Status
- Unterweisung
- Bereich
- Line Manager
- nur offene
- Fristbereich

## Management-Cockpit

### Kennzahlen

Die oberste Ebene zeigt höchstens sechs zentrale Kennzahlen:

- Erfüllungsquote
- Überfällig
- Fehlend
- In 30 Tagen fällig
- Nachweise fehlen
- Termine diese Woche

Jede Kennzahl ist klickbar und öffnet die passende gefilterte Arbeitsliste.

### Weitere Inhalte

- kritische Fälle
- Team- / Abteilungsvergleich
- Fälligkeiten der nächsten Wochen
- geplante Unterweisungen
- Nachweisstatus
- letzte Aktivitäten
- Schnellaktionen

## Planung

Die Planung bekommt zwei Darstellungen:

### Kalender

- Monatsansicht
- Wochenansicht
- Termin-Karten
- Teilnehmerzahl
- Verantwortlicher
- Status

### Liste

- bestehende tabellarische Planung
- Suche und Filter
- Bearbeiten
- Einladung senden
- Teilnehmer ergänzen
- abschließen
- stornieren

Der gleiche Datensatz wird in beiden Darstellungen verwendet.

## Benachrichtigungszentrum

Eine Glocke in der Kopfzeile zeigt fachliche Hinweise, unter anderem:

- Unterweisung überfällig
- Unterweisung wird bald fällig
- Nachweis fehlt
- Gruppenunterweisung steht bevor
- externer Link läuft bald ab
- relevante System- oder Fehlerdiagnosemeldung für berechtigte Rollen

Benachrichtigungen führen direkt zur passenden Arbeitsansicht.

## Nachweise

Der Nachweisbereich wird nicht mehr nur als isolierte Dateiliste behandelt.

Er zeigt:

- Mitarbeiter
- Unterweisung
- Abschlussdatum
- Gültigkeit
- Nachweisstatus
- Datei
- direkte Aktion

Mitarbeiter sehen nur ihre eigenen Nachweise. Führungskräfte sehen nur das zugewiesene Team. HSE/Firmenadmins sehen die eigene Firma. Systemadmins sehen nach Firmenauswahl nur den aktiven Firmenkontext.

## Auswertungen

Der bisherige Manager-Report wird in den Bereich „Auswertungen“ integriert.

Mindestens enthalten:

- Erfüllungsquote gesamt
- Status nach Unterweisung
- Status nach Bereich
- Status nach Führungskraft
- Fälligkeiten
- überfällige Fälle
- fehlende Nachweise
- abgeschlossene Unterweisungen
- Export

## Verwaltung

Verwaltung bündelt die bisher verteilten Stammdaten- und Administrationsbereiche.

Unterbereiche je Berechtigung:

- Mitarbeiter
- Unterweisungen / Typen
- Vorlagen und Prüfungsfragen
- Benutzer
- Firmen
- Betrieb
- Sicherheit
- Fehlerdiagnose

Die Unterbereiche werden rollenabhängig angezeigt.

## Smartphone-Verhalten

Auf kleinen Bildschirmen wird die Navigation auf vier primäre Punkte reduziert:

- Start
- Aufgaben
- Unterweisungen
- Mehr

Tabellen werden, wo nötig, in Karten umgewandelt. Hauptaktionen müssen mit Touch gut erreichbar sein. Planung, Teilnahme, Nachweise und externe Unterweisungen dürfen keinen Desktop voraussetzen.

## Designsystem

Das Design ist hell, professionell und funktional.

Vorgaben:

- klare visuelle Hierarchie
- wenige primäre Farben
- Statusfarben nur für fachliche Zustände
- große lesbare Typografie
- ausreichend Weißraum
- Karten nur dort, wo sie Inhalte strukturieren
- keine doppelten Kartenrahmen
- keine überladenen Toolbars
- einheitliche Buttons und Formulare
- responsive Tabellen und Formulare
- gut sichtbare Fokuszustände
- keine abgeschnittenen Inhalte
- keine unnötigen horizontalen Scrollbereiche

## Technische Struktur

Die neue Oberfläche wird nicht als weitere Serie von `*-v36`, `*-v37`-Override-Skripten aufgebaut.

Stattdessen wird die aktive Oberfläche in klar getrennte Einheiten aufgeteilt:

- App-Shell / Navigation
- Rollenabhängige Startseiten
- Aufgaben- und Teamarbeitsbereich
- Unterweisungsworkflow
- Planung
- Nachweise
- Auswertungen
- Verwaltung
- Benachrichtigungszentrum

Bestehende Darstellungs-Overrides, die dadurch ersetzt werden, werden nach erfolgreicher Migration aus `index.html` entfernt und anschließend gelöscht oder stillgelegt.

Die bestehende API-Fachlogik wird wiederverwendet, sofern sie den neuen Ablauf korrekt unterstützt.

## Datenfluss

1. Anmeldung erfolgreich abschließen.
2. Sicheren Firmenkontext laden.
3. Rollen und Berechtigungen bestimmen.
4. Rollenabhängige Navigation und Startseite erzeugen.
5. Fachliche Daten parallel laden, soweit sicher möglich.
6. Aktionen schreiben ausschließlich über die bestehenden bzw. gezielt erweiterten APIs.
7. Nach erfolgreichen Änderungen werden nur die betroffenen Datenbereiche neu geladen.
8. Ein alter Request einer zuvor aktiven Firma darf niemals Daten in den neuen Firmenkontext zurückschreiben.
9. Teambezogene API-Antworten werden anhand der serverseitig gespeicherten Führungszuordnung begrenzt; vom Client gelieferte Mitarbeiter-IDs erweitern niemals den erlaubten Scope.

## Fehlerbehandlung

- Ladefehler werden im betroffenen Bereich angezeigt, nicht als globale Browser-Alerts, soweit technisch möglich.
- Erfolgreich geladene Daten bleiben sichtbar, wenn eine spätere Aktualisierung fehlschlägt.
- Schreibfehler zeigen eine verständliche Meldung und verlieren keine Formulareingaben.
- Rollen-, Team- oder Mandantenfehler führen zu einer klaren Zugriffsmeldung und niemals zur Anzeige fremder Daten.
- Netzwerkfehler dürfen keinen automatischen Firmenwechsel oder Auto-Login in einen falschen Kontext auslösen.

## Migration

Die Umstellung erfolgt auf einer isolierten Branch.

Reihenfolge:

1. neue App-Shell und Navigation
2. rollenabhängige Startseiten
3. Aufgaben- und Teamarbeitsbereich
4. Unterweisungsworkflow
5. Planung mit Kalender und Dialogen
6. Nachweise und Auswertungen
7. Benachrichtigungszentrum
8. Smartphone-Anpassung
9. Entfernung ersetzter alter UI-Overrides
10. vollständige Regressionstests und Deployment-Prüfung

Produktion wird erst nach vollständigem grünem Test- und Deployment-Nachweis aktualisiert.

## Tests und Abnahmekriterien

### Sicherheit und Rollen

- Mitarbeiter sieht nur eigene Firma und eigene Daten.
- Line Manager sieht nur eigene Firma und serverseitig zugewiesenes Team.
- Manipulierte Client-Requests dürfen einem Line Manager keinen Zugriff auf andere Mitarbeiter derselben Firma geben.
- HSE/Firmenadmin sieht nur die eigene Firma.
- Systemadmin sieht Firmenauswahl und arbeitet nach Auswahl im aktiven Firmenkontext.
- Downloads und direkte Dateilinks respektieren dieselben Grenzen.
- Kein Firmeninhalt blitzt beim Login vor sicher geladenem Firmenkontext auf.

### Arbeitsabläufe

- Interne Unterweisung kann zugewiesen und abgeschlossen werden.
- Gruppenunterweisung kann geplant, per Mail verschickt und abgeschlossen werden.
- Externe Unterweisung kann durch berechtigte Führungskraft erstellt werden.
- Nachweis wird korrekt mit dem Abschluss verbunden.
- Kennzahlen führen zur passenden gefilterten Arbeitsliste.
- Sammelaktionen verändern nur ausgewählte Einträge.

### Oberfläche

- Rollen sehen nur relevante Navigation.
- Desktop und Smartphone sind vollständig bedienbar.
- Keine Browser-`prompt()`-Dialoge für normale Fachabläufe.
- Unterweisungsbilder werden professionell und responsiv dargestellt.
- Keine doppelten Navigations- oder Design-Overrides nach Migration.

### Regression

- vorhandene automatisierte Tests bleiben grün.
- neue Tests decken Rollen-Dashboard, Navigation, Workflow, Planung, Teamgrenzen und Mandantenwechsel ab.
- Deployment-Workflow muss vollständig grün sein.

## Nicht-Ziele für v0.40

- keine Änderung des Azure-SQL-Tarifs oder der Auto-Pause-Kostenlogik
- kein vollständiger Neuaufbau der Backend-Architektur
- keine neue native Mobile-App nur für dieses Update
- keine Änderung der grundsätzlichen Mandantenstruktur
- keine Reduzierung der serverseitigen Sicherheitsprüfungen zugunsten reiner UI-Logik

## Erfolgskriterium

v0.40 ist erfolgreich, wenn ein Mitarbeiter, eine Führungskraft und ein Firmenadmin nach dem Login jeweils eine klar unterschiedliche, auf ihre Aufgabe zugeschnittene Oberfläche erhalten und die häufigsten Unterweisungsabläufe ohne Wechsel zwischen vielen technischen Einzelbereichen erledigen können, während Mandanten-, Team- und Rollenabgrenzung unverändert sicher bleiben.
