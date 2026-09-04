# Unternehmens-Demo / Showcase – Design-Spezifikation

Datum: 03.09.2026
Branch: `demo/company-showcase`
Basis: `feature/v0.36-instruction-ui` / v0.36.3
Status: zur Freigabe vor Implementierung

## 1. Ziel

Es entsteht eine eigenständige, öffentlich präsentierbare Demo des Unterweisungsmanagers für Gespräche mit anderen Firmen. Die Demo soll wie eine echte Kundenumgebung wirken, aber ausschließlich erfundene Daten verwenden und technisch keinen Zugriff auf Produktivdaten, SQL, Blob Storage, Mailversand oder echte Benutzerkonten besitzen.

Die Demo ist eine Verkaufs- und Präsentationsumgebung, keine Testumgebung für Produktivdaten.

## 2. Sicherheits- und Isolationsprinzip

Die Demo läuft getrennt von `main` und getrennt von der produktiven Datenbank.

Verbindliche Regeln:

- eigener Branch `demo/company-showcase`
- eigener Draft-PR
- eigene Azure-Preview-URL
- Demo-Oberfläche unter eigenem Einstieg, bevorzugt `/demo/`
- keine API-Aufrufe zu `/api/*`
- keine SQL-Verbindung
- kein Blob-Storage-Zugriff
- kein Microsoft-/Entra-Login erforderlich
- kein Passwort-Login erforderlich
- keine echten E-Mail-Adressen
- kein echter Mailversand
- keine echten Firmen-, Mitarbeiter-, Unterweisungs- oder Nachweisdaten
- keine Änderungen an `main`
- keine Migrationen und keine produktiven Secrets
- keine Uploads in reale Speicherziele

Alle Demo-Seiten tragen gut sichtbar den Hinweis: **„DEMO – ausschließlich Beispieldaten“**.

## 3. Demo-Firma

Fiktiver Mandant:

**Musterwerk Solutions GmbH**

Beispielprofil:

- Branche: Produktion & Logistik
- Standort: Nordrhein-Westfalen
- ca. 15 Demo-Mitarbeiter
- Abteilungen: Produktion, Lager & Logistik, Verwaltung, Technik
- Firmen-E-Mail-Domain ausschließlich reserviert/fiktiv: `@musterwerk.example`

Die Demo darf keinerlei reale Marke, reale Firma oder reale persönliche E-Mail-Adresse verwenden.

## 4. Demo-Rollen

Oben in der Demo wird ein Präsentations-Umschalter angeboten:

1. **System-/Firmenadmin**
   - Dashboard der Demo-Firma
   - Mitarbeiter verwalten
   - Unterweisungen verwalten
   - Planung
   - Status
   - Nachweise
   - Erinnerungen
   - Rollen-/Benutzerübersicht in Demoform

2. **Führungskraft**
   - eigene Mitarbeiter / direktes Team
   - offene Unterweisungen des Teams
   - Einplanung
   - praktische Unterweisung bestätigen
   - Nachweise des Teams ansehen

3. **Mitarbeiter**
   - persönliche Startseite
   - „Jetzt erledigen“
   - „Einplanung erforderlich“
   - „Geplante Termine“
   - „Bald fällig“
   - „Abgeschlossen“
   - Online-Unterweisung starten/fortsetzen
   - Demo-Nachweis anzeigen/herunterladen

Der Rollenwechsel ist nur eine Präsentationsfunktion und stellt keinen echten Authentifizierungsmechanismus dar.

## 5. Demo-Mitarbeiter

Die Demo enthält ungefähr 15 vollständig fiktive Personen mit unterschiedlichen Rollen, Abteilungen und Statusständen.

Beispiel:

- Lena Hoffmann – Produktionsleitung
- Jonas Keller – Schichtleitung Produktion
- Mila Hartmann – Produktion
- David Sommer – Produktion
- Amira König – Produktion
- Felix Berger – Lagerleitung
- Nora Weiss – Lager & Logistik
- Leon Wagner – Lager & Logistik
- Elias Braun – Lager & Logistik
- Sophie Neumann – Verwaltung
- Marie Vogel – Personal
- Luca Richter – Technik
- Emma Krüger – Technik
- Noah Schmitt – Auszubildender
- Mia Franke – Qualitätsmanagement

Alle E-Mail-Adressen verwenden `@musterwerk.example`.

## 6. Demo-Unterweisungen

Die Demo enthält unterschiedliche fachliche Arten und bewusst unterschiedliche Fälligkeitszustände.

Vorgesehene Unterweisungen:

- Allgemeine Arbeitsschutzunterweisung
- Brandschutz & Evakuierung
- Persönliche Schutzausrüstung (PSA)
- Gefahrstoff-Unterweisung
- Flurförderzeuge / Stapler
- Ladungssicherung
- Datenschutz im Arbeitsalltag
- Informationssicherheit & Phishing
- Bildschirmarbeitsplatz / Ergonomie
- Verhalten bei Arbeitsunfällen

Mindestens drei Unterweisungen werden als bildgestützte Online-Unterweisung umgesetzt.

Mindestens zwei Unterweisungen werden als praktische Unterweisung dargestellt, die durch eine Führungskraft bestätigt werden muss.

## 7. Bildgestützte Lernstrecken

Online-Unterweisungen sollen in der Präsentation die neue Lernansicht zeigen:

- Titel und kurze Einleitung
- mehrere Lernschritte
- pro Schritt Überschrift, kurzer Erklärungstext und Demonstrationsbild/Illustration
- Fortschrittsanzeige
- Vor/Zurück
- Bild vergrößern
- optionales Originaldokument
- Abschlusstest
- Ergebnis mit bestanden/nicht bestanden
- Abschluss und Demo-Nachweis

Für die Demo werden ausschließlich eigens erzeugte oder neutrale Demo-Illustrationen verwendet, keine vertraulichen Firmenbilder.

## 8. Beispieldaten und Statusmix

Der Datenbestand wird so angelegt, dass bei einer Vorführung alle wichtigen Zustände sofort sichtbar sind:

- gültig
- bald fällig
- kritisch
- überfällig
- noch nie durchgeführt
- geplant
- aktuell in Bearbeitung
- abgeschlossen
- nicht erforderlich
- praktische Bestätigung ausstehend

So kann das Dashboard ohne vorherige Vorbereitung unterschiedliche Warnungen und Kennzahlen zeigen.

## 9. Präsentations-Dashboard

Die Admin-Ansicht zeigt mindestens:

- Mitarbeiter gesamt
- aktive Unterweisungen
- gültige Nachweise
- bald fällige Unterweisungen
- überfällige Unterweisungen
- fehlende Unterweisungen
- geplante Termine
- Abschlussquote
- Abteilungsübersicht
- kompakte Liste „Handlungsbedarf“

Die Oberfläche soll professionell, modern und präsentationsfähig sein und sichtbar an die reale Anwendung angelehnt bleiben.

## 10. Mitarbeiter-Demo

Die Mitarbeiteransicht muss besonders präsentationsstark sein.

Aufbau:

### Jetzt erledigen
Online-Unterweisungen, die direkt gestartet werden können.

### Einplanung erforderlich
Praktische Unterweisungen oder Termine, die nicht online abgeschlossen werden können.

### Geplante Termine
Mit Datum, Unterweisung und verantwortlicher Person.

### Bald fällig
Noch gültige, aber bald erneut notwendige Unterweisungen.

### Abgeschlossen
Historie mit Datum und Demo-Nachweis.

Aktionen wie „Starten“, „Fortsetzen“, „Termin anfragen“ und „Nachweis öffnen“ funktionieren innerhalb der Demo sichtbar und nachvollziehbar.

## 11. Führungskräfte-Demo

Die Führungskraft sieht ausschließlich ihr simuliertes Team.

Funktionen:

- Teamstatus
- offene Aufgaben
- Mitarbeiter auswählen
- Termin simuliert einplanen
- praktische Durchführung simuliert bestätigen
- Nachweise aufrufen
- überfällige Unterweisungen priorisieren

Die Demo soll dadurch die Rollenabgrenzung der späteren echten Anwendung verständlich demonstrieren.

## 12. Simulierte Interaktionen

Damit die Demo nicht wie ein Screenshot wirkt, werden Aktionen lokal simuliert.

Zulässig:

- Unterweisung starten und Lernfortschritt setzen
- Abschlusstest durchführen
- Demo-Unterweisung abschließen
- Termin lokal einplanen
- praktische Bestätigung lokal setzen
- Demo-Mitarbeiter lokal hinzufügen/bearbeiten
- Status lokal verändern
- Demo-Nachweis erzeugen/anzeigen

Nicht zulässig:

- echte API-Requests
- echte E-Mails
- echte Benutzeranlage
- echte Datei-Uploads in Azure
- Änderungen an Produktivdaten

## 13. Lokaler Demo-Zustand

Der Demo-Zustand lebt ausschließlich im Browser.

Empfehlung:

- Basisdatensatz als statische JSON-/JS-Demodaten
- Änderungen optional in `localStorage`
- gut sichtbarer Button **„Demo zurücksetzen“**
- Reset stellt jederzeit den definierten Ausgangszustand wieder her

Damit kann Tobias eine Präsentation beliebig oft neu starten, ohne vorher Daten reparieren zu müssen.

## 14. Downloads und Nachweise

Demo-Downloads müssen klar als Muster erkennbar sein.

Beispiel:

- Teilnahme-/Unterweisungsnachweis
- Aufdruck/Wasserzeichen „DEMO / MUSTER“
- Fake-Firma
- Fake-Mitarbeiter
- Fake-Unterweisung
- Demo-Datum

Es dürfen keine produktiven Dokumentvorlagen oder vertraulichen Dokumente ausgegeben werden.

## 15. Präsentationsführung

Die Demo soll eine typische Vorführung in wenigen Minuten ermöglichen:

1. Admin-Dashboard öffnen
2. Handlungsbedarf zeigen
3. Mitarbeiterliste und Status öffnen
4. Führungskraft auswählen und Teameinsicht zeigen
5. in Mitarbeiterrolle wechseln
6. bildgestützte Online-Unterweisung starten
7. Lernschritte und Test absolvieren
8. Demo-Nachweis öffnen
9. zurück zur Führungskraft
10. praktische Unterweisung einplanen/bestätigen

Es soll dafür keine Konfiguration während der Präsentation nötig sein.

## 16. Technische Struktur

Bevorzugte Struktur innerhalb des bestehenden Repositories:

- `frontend/demo/index.html`
- `frontend/demo/demo.css`
- `frontend/demo/demo.js`
- `frontend/demo/demo-data.js` oder `demo-data.json`
- optional eigene Demo-Bildassets unter `frontend/demo/assets/`
- eigene Demo-Tests

Die Demo verwendet gemeinsame Designprinzipien, aber keine API-Initialisierung der echten Anwendung.

## 17. Testanforderungen

Vor Freigabe der Demo müssen mindestens folgende Punkte automatisiert geprüft werden:

1. Demo enthält ausschließlich fiktive Firmendaten.
2. Demo ruft weder `/api/*` noch Auth-Endpunkte auf.
3. Rollenumschalter rendert Admin, Führungskraft und Mitarbeiter korrekt.
4. Mitarbeiterrolle sieht nur die eigene Demo-Person.
5. Führungskraft sieht nur direkte Demo-Mitarbeiter.
6. Online-Unterweisung kann nicht vor dem letzten Lernschritt abgeschlossen werden.
7. Abschlusstest erzeugt nachvollziehbares Demo-Ergebnis.
8. praktische Unterweisung kann vom Mitarbeiter nicht selbst bestätigt werden.
9. Demo-Reset stellt den Ausgangsdatensatz wieder her.
10. Demo-Nachweise tragen eindeutig „DEMO / MUSTER“.
11. bestehende v0.36.3-Tests bleiben grün.
12. keine Datei in `main` wird während der Demo-Entwicklung verändert.

## 18. Deployment

Die Demo wird zunächst ausschließlich als Azure-Preview der Demo-Branch veröffentlicht.

Erwartetes Ergebnis:

- öffentlicher Präsentationslink
- kein Login erforderlich
- keine Verbindung zu Produktivdaten
- jederzeit zurücksetzbare Beispieldaten

Erst nach ausdrücklicher Freigabe darf später entschieden werden, ob eine dauerhafte öffentliche Demo-Domain eingerichtet wird.

## 19. Nicht Bestandteil dieses Blocks

Nicht Teil der ersten Showcase-Version:

- echte Neukunden-Selbstregistrierung
- echtes CRM
- echtes Lizenz-/Preis-Modul
- Mandantenanlage über die öffentliche Demo
- produktive Passwortkonten
- echte Microsoft-Anmeldung
- produktiver Mailversand
- produktive Migrationen
- produktiver Blob-/SQL-Zugriff

## 20. Abnahmekriterien

Die Showcase-Version ist fertig, wenn:

- sie über einen separaten öffentlichen Vorschau-Link erreichbar ist,
- sämtliche sichtbaren Daten erkennbar fiktiv sind,
- kein Zugriff auf echte Daten technisch vorgesehen ist,
- Admin-, Führungskraft- und Mitarbeiteransicht überzeugend demonstriert werden können,
- mindestens eine vollständige bildgestützte Online-Unterweisung inklusive Test durchgespielt werden kann,
- mindestens eine praktische Unterweisung inklusive Einplanung/Bestätigung demonstriert werden kann,
- Demo-Nachweise funktionieren,
- der Demo-Zustand per Knopfdruck zurückgesetzt werden kann,
- alle Demo- und bestehenden Regressionstests grün sind.
