# RC991 – Einheitliches Lern- und Portal-Erlebnis für Hauptanwendung und Demo

## Status
Freigegebener Funktionsumfang aus dem Chat, als verbindliche Architektur-Spezifikation festgehalten. Die Implementierung erfolgt auf isolierten Branches; `main` bleibt unverändert.

## Ziel
Demo und echte Hauptanwendung sollen denselben professionellen Lern-, Mitarbeiter- und Führungskräftefluss zeigen. Die Demo bleibt technisch vollständig isoliert und verwendet ausschließlich Beispieldaten. Die Hauptanwendung verwendet echte Rollen-, Firmen-, SQL-, Blob- und Mail-Funktionen. Optik, Informationshierarchie, Begriffe und Kernabläufe sollen trotzdem möglichst identisch sein.

## Branch-Strategie
- Hauptanwendung: `rc991-unified-learning-portal`, Basis `feature/v0.36-instruction-ui`.
- Demo: `demo/company-showcase` bleibt der öffentliche Showcase-Branch.
- `main` wird während RC991 nicht verändert.
- Keine Datenbankmigration wird während der Implementierung automatisch ausgeführt.
- Die bestehende Demo-Preview bleibt der öffentliche Präsentationskanal; die Hauptanwendung erhält einen getrennten Prüf-/Preview-Stand.

## Gewählter Ansatz
### Empfehlung: gemeinsamer, reiner Präsentationskern
Ein gemeinsamer, API-freier Präsentationskern unter `frontend/` definiert Markup-Kontrakte, Statusbegriffe und Styles für Lernschritte, Tests und Abschlusszustände. Hauptanwendung, externe Unterweisung und Demo verwenden diesen Kern. Datenzugriff und Mutationen bleiben vollständig in ihren jeweiligen Laufwegen.

Vorteile:
- Demo und Hauptseite driften optisch nicht wieder auseinander.
- Demo bleibt netzwerkfrei, weil der gemeinsame Kern keine API- oder Auth-Aufrufe enthält.
- Rollen-, SQL- und Maillogik der Hauptanwendung bleiben serverseitig abgesichert.
- Bestehende Anwendungen müssen nicht komplett auf ein neues Framework umgebaut werden.

Nicht gewählt:
- bloßes Kopieren der Demo-CSS in die Hauptseite: kurzfristig schneller, aber erneute Design-Drift sehr wahrscheinlich.
- kompletter Neuaufbau als neue SPA-Komponentenarchitektur: zu groß für diesen Release und unnötig riskant.

## 1. Gemeinsamer Lernstandard
### Gemeinsame Darstellung
Jede Online-Unterweisung verwendet in Hauptanwendung, externem Teilnehmerfluss und Demo dieselbe visuelle Hierarchie:
1. Unterweisungstitel und Fortschritt
2. Lernziel
3. kurze Einleitung
4. große professionelle Bildbühne
5. dezenter Praxisbezug / Bildhinweis
6. Lernschritt-Titel und erklärender Text
7. optionaler Praxischeck oder Merksatz
8. Abschnitt `Wichtige Merkpunkte`
9. Navigation Zurück / Weiter
10. Abschlusstest oder Abschlussbestätigung

Die abgelehnte Formulierung `Das solltest du mitnehmen` darf nicht mehr verwendet werden.

### Gemeinsamer Präsentationskern
Neue Dateien:
- `frontend/learning-experience-v38.js`
- `frontend/learning-experience-v38.css`

Der JavaScript-Kern enthält nur reine Rendering-/Formatierungshelfer. Verboten sind dort insbesondere `fetch`, `/api/`, Auth-Weiterleitungen, Blob-Zugriff und Mailversand.

## 2. Inhaltsmodell für professionelle Lernstrecken
Die Hauptanwendung erhält additive, vorbereitete Schema-Erweiterungen in einer neuen, nicht automatisch ausgeführten Migration `012_learning_experience_content.sql`.

### InstructionTypes
Neue optionale Felder:
- `learningGoal` – präzises Lernziel
- `learningIntro` – professionelle Einführung
- `keyPointsJson` – geordnete Liste wichtiger Merkpunkte

### InstructionLearningSteps
Neue optionale Felder:
- `imageCaption` – fachlicher Praxisbezug zur Abbildung
- `calloutTitle` – z. B. `Praxischeck`, `Merksatz`, `Wichtig`
- `calloutText` – kurze hervorgehobene Handlungsregel

Alle Änderungen sind additiv. Kein DROP, TRUNCATE oder automatischer Migrationslauf.

## 3. Hauptanwendung – Mitarbeiterportal
`frontend/employee-portal-v37.js` und die Portal-Styles werden auf den gemeinsamen Lernstandard umgestellt.

### Dashboard-Buckets bleiben bestehen
- Jetzt erledigen
- Einplanung erforderlich
- Geplante Termine
- Bald fällig
- Abgeschlossen

### Karten werden erweitert
- sichtbarer Status / Fälligkeit
- Online oder Praxis
- Fortschritt bei begonnener Online-Unterweisung
- klare Primäraktion: Starten / Fortsetzen / Termin anfragen / Nachweis öffnen
- dichtere, professionelle Darstellung ohne unnötige Leerflächen

### Online-Lernmodal
- verwendet den gemeinsamen Präsentationskern
- zeigt Lernziel, Intro, Bildbühne, Caption, Callout und Merkpunkte
- Bildzoom bleibt erhalten
- Originalunterlage bleibt verfügbar
- serverseitige sequenzielle Fortschrittsregel bleibt unverändert bindend

## 4. Abschlusstest und Ergebnis
Interner und externer Test verwenden denselben visuellen Standard:
- Frage als eigenständige Karte
- Antworten als klar anklickbare Antwortkarten
- Fortschrittsanzeige
- Bestehensgrenze sichtbar
- fehlende Antwort klar erkennbar
- Bestanden / Nicht bestanden als professionelle Ergebnisfläche
- bei Nichtbestehen verständliche Wiederholungsaktion
- bei Bestehen Nachweis-/Abschlussaktion

Die Bewertungslogik bleibt serverseitig. Das Frontend darf keine korrekten Antworten ableiten oder vorab kennen.

## 5. Externe Unterweisungen durch Führungskräfte
Führungskräfte dürfen echte externe Online-Unterweisungen auch an Personen senden, die nicht als interner Mitarbeiter angelegt sind.

### Regeln
- Rollen: `company_admin`, `hse`, `line_manager` dürfen externe Online-Unterweisungen erstellen und versenden.
- `line_manager` darf zusätzlich zu Team-Mitarbeitern auch eine rein externe Person mit `employeeId = null` einladen.
- praktische Unterweisungen werden nicht als konto-freie externe Online-Unterweisung versendet.
- Mitarbeiterrolle darf keine externen Einladungen erstellen oder senden.

### Sichtbarkeit für Führungskräfte
Ein Line Manager sieht:
- externe Einladungen für direkte Teammitglieder
- rein externe Einladungen, die er selbst erstellt hat

Er sieht keine rein externen Einladungen anderer Führungskräfte.

### Ändern / erneut senden
Für rein externe Einladungen darf ein Line Manager nur Datensätze bearbeiten oder erneut versenden, deren `createdBy` seinem eigenen Benutzer entspricht.

## 6. Externe Lernseite
`frontend/external/instruction.html` und `instruction.js` werden auf den gemeinsamen Lernstandard umgestellt.

Die öffentliche API liefert zusätzlich:
- Lernziel
- Intro
- Merkpunkte
- veröffentlichte Lernschritte inklusive Bild, Caption und Callout

Externe Sessions erhalten beim ersten Öffnen einen konsistenten Snapshot der freigegebenen Lerninhalte und Testfragen. Eine spätere redaktionelle Änderung darf eine laufende Einladung nicht mitten in der Durchführung verändern.

Bilddateien werden über kurzlebige Leselinks ausgeliefert. Nur veröffentlichte, freigegebene Schritte werden extern gezeigt.

## 7. Planung und Mailversand
Die bestehende Graph-/ICS-Funktion bleibt die echte Versandbasis.

### Hauptanwendung
Führungskräfte dürfen Planungen für das eigene Team erstellen und die Terminmail direkt aus der Planung senden.

Die Oberfläche erhält:
- `Planung speichern`
- optional `Planung speichern und Mail senden`
- in bestehenden Planungen `Termin per Mail senden` / `erneut senden`
- Versandstatus pro Planung
- klare Empfängeranzahl und Fehleranzeige

### Berechtigungen
- `company_admin` und `hse`: Firmenbereich
- `line_manager`: nur eigene Teamplanung bzw. Planungen, deren `lineManagerId` der eigenen Mitarbeiteridentität entspricht
- `employee`: kein Versand

Die bestehende serverseitige Teamprüfung in `mail.js` bleibt erhalten und wird durch Regressionstests abgesichert.

## 8. Demo-Parität
Die Demo übernimmt denselben Präsentationskern und dieselben Begriffe.

Demo-spezifisch bleibt:
- ausschließlich Fake-Daten
- kein `/api/*`
- kein Auth
- kein SQL
- kein Blob Storage
- kein echter Mailversand
- alle Änderungen nur lokal im Browser
- externe Einladung und Terminmail bleiben simuliert

Die Demo-Texte und Illustrationen bleiben Präsentationsdaten; die Hauptanwendung erhält keine fiktiven Musterinhalte als produktive Daten.

## 9. Admin-/HSE-Inhaltseditor
Die echte Hauptanwendung erweitert die bestehende Lernschrittverwaltung um:
- Lernziel
- Einleitung
- Merkpunkte
- Bildunterschrift / Praxisbezug
- Callout-Titel
- Callout-Text
- Bildvorschau in der späteren Lernbühne

Nur `system_admin`, `company_admin`, `hse` dürfen Inhalte bearbeiten oder veröffentlichen. Führungskräfte führen und planen, bearbeiten aber keine zentralen Lerninhalte.

## 10. Sicherheit
Unverändert bindend:
- Firmen-/Mandantenscope serverseitig
- Mitarbeiter self-only
- Line Manager self + direct reports
- Admin/HSE Firmenbereich
- Systemadmin systemweit
- Online-Abschluss erst nach serverseitig gespeichertem Lernfortschritt
- Testbewertung serverseitig
- externe Links tokenisiert und zeitlich begrenzt
- kein Client darf Berechtigungsgrenzen durch reine UI-Manipulation umgehen

Neu abgesichert:
- Line Manager mit rein externer Einladung: Zugriff nur auf selbst erstellte externe Datensätze
- gemeinsame Präsentationsdateien enthalten keine Netzwerk-/Auth-/Mail-Funktion
- veröffentlichte Lernschritte und Bilddateien werden tenantgebunden geladen

## 11. Tests
### Gemeinsamer UI-Vertrag
- gemeinsame CSS-/Renderer-Dateien werden von Hauptportal, externer Seite und Demo verwendet
- abgelehnte Formulierung kommt nicht mehr vor
- Lernziel, Bildbühne, Praxisbezug und Merkpunkte sind in allen drei Laufwegen vorhanden

### API / Daten
- neue Contentfelder lesen/schreiben
- ältere Datenbanken ohne Migration liefern weiterhin kompatible Defaults oder gezielte 503 nur bei neuen Schreibfunktionen
- nur veröffentlichte Schritte an Lernende
- externe Snapshot-Stabilität

### Rollen
- Mitarbeiter kann keine externe Einladung / Terminmail senden
- Line Manager kann beliebige externe E-Mail-Adresse einladen
- Line Manager sieht/bearbeitet rein externe Einladungen nur, wenn selbst erstellt
- Line Manager kann keine Teamplanung anderer Führungskräfte mailen

### Regression
- bestehende 74+ Haupttests bleiben grün
- Demo-Isolationscheck bleibt grün
- Demo-Tests bleiben grün und werden um Shared-UI-Vertrag erweitert
- Preview-Livechecks für Hauptseite und `/demo/`

## 12. Release- und Deployment-Regeln
- `main` bleibt während der Entwicklung unverändert.
- keine Migration wird automatisch ausgeführt.
- keine Seed-/Repair-/Import-Aktion.
- keine produktiven Secrets werden geändert.
- Demo-PR bleibt Draft/unmerged.
- RC991 erhält einen eigenen Draft-PR gegen `feature/v0.36-instruction-ui` oder einen separaten Preview-Mechanismus; kein produktiver Merge ohne gesonderte Freigabe.

## Akzeptanzkriterien
RC991 ist fachlich fertig, wenn:
1. Hauptanwendung, externe Seite und Demo dieselbe professionelle Lernstruktur verwenden.
2. Bilder in Lernschritten groß, hochwertig und ohne alte Leerflächen dargestellt werden.
3. Lernziel, Intro, Praxisbezug, Merkpunkte und Testabschluss konsistent sind.
4. Führungskräfte beliebige externe Online-Teilnehmer per echter Mailfunktion der Hauptseite einladen dürfen, ohne internes Mitarbeiterkonto.
5. Führungskräfte Planungstermine ihres eigenen Teams per Mail/ICS senden können.
6. Rollen- und Tenantgrenzen serverseitig getestet sind.
7. Demo weiterhin vollständig isoliert bleibt.
8. alle bestehenden Regressionen und neuen RC991-Tests grün sind.
9. `main` unverändert bleibt und keine Migration automatisch ausgeführt wurde.
