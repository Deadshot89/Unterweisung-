# Changelog

## 2026-09-03 – Öffentliche Unternehmens-Demo / Showcase

- Separate Präsentationsumgebung unter `/demo/` mit der vollständig fiktiven **Musterwerk Solutions GmbH**, 15 Fake-Mitarbeitenden und 10 Fake-Unterweisungen.
- Rollenumschalter für System-/Firmenadmin, Führungskraft und Mitarbeiter; Führungskräfte sehen nur direkte Demo-Teammitglieder, Mitarbeiter ausschließlich die eigene Demo-Person.
- Präsentations-Dashboard mit Statusmix aus gültig, bald fällig, kritisch, überfällig, fehlend, geplant, in Bearbeitung, nicht erforderlich und praktischer Bestätigung ausstehend.
- Mehrere bildgestützte Online-Unterweisungen mit lokalen Illustrationen, Lernfortschritt, Bildvergrößerung, Abschlusstest und lokal erzeugtem DEMO-Nachweis.
- Praktische Unterweisungen lassen sich in der Demo lokal einplanen und ausschließlich durch Admin/Führungskraft bestätigen; Mitarbeiter können diese nicht selbst abschließen.
- Demo-Nachweise werden rein im Browser erzeugt und tragen sichtbar `DEMO / MUSTER` sowie den Hinweis, dass sie keine rechtliche Gültigkeit besitzen.
- Sämtliche Änderungen während einer Präsentation verbleiben ausschließlich im Browser-`localStorage` und können über **„Demo zurücksetzen“** vollständig verworfen werden.
- Automatische Sicherheitsprüfung blockiert Netzwerkaufrufe, Auth-Routen, API-Routen, Azure-Blob-Endpunkte, produktive Firmenreferenzen und reale Mailprovider innerhalb des Demo-Verzeichnisses.
- Keine produktive Migration, kein Datenimport, keine Secrets, kein SQL-/Blob-Zugriff, kein Mailversand und kein Merge nach `main` werden durch diese Showcase-Branch ausgelöst.

## v0.36.3 – Mitarbeiterportal, Dual-Login und Bild-Unterweisungen (Preview)

- Interne Anmeldung unterstützt Microsoft sowie E-Mail/Passwort über dieselbe Benutzer-, Firmen- und Rollenlogik. Passwort-Sitzungen sind signiert, HttpOnly und zeitlich begrenzt; Passwörter werden ausschließlich als gesalzene Scrypt-Hashes vorbereitet.
- Rollen- und Mandantengrenzen werden serverseitig durchgesetzt: System Admin firmenübergreifend, Company Admin/HSE innerhalb der eigenen Firma, Line Manager nur eigenes Konto plus direkt zugewiesenes Team, Mitarbeiter nur eigene Daten.
- Die Begrenzung gilt auch für Bootstrap-Daten, Status, Unterweisungseinträge, Planungen, Teilnehmer, Einladungen, Manager-Report, Nachweis-Uploads und direkte Datei-Downloads. Kurzlebige SAS-Links werden erst nach erfolgreicher Berechtigungsprüfung ausgegeben.
- Mitarbeiter erhalten eine eigene Startoberfläche mit „Jetzt erledigen“, „Einplanung erforderlich“, „Geplante Termine“, „Bald fällig“ und „Abgeschlossen“ sowie Aktionen zum Starten/Fortsetzen, Termin anfragen und Nachweis herunterladen.
- Online-Unterweisungen können als bildgestützte Lernschritte mit kurzer Erklärung, Fortschrittsanzeige und Bildvergrößerung aufgebaut werden. Lernschritte bleiben Entwurf, bis HSE/Firmenadmin/Systemadmin sie ausdrücklich fachlich freigibt; Originalunterlagen bleiben downloadbar.
- Online-Unterweisungen können nach einem freigegebenen Abschlusstest automatisch als offizieller Unterweisungseintrag abgeschlossen werden. Nicht bestandene Versuche erzeugen keinen Abschluss. Praktische Unterweisungen können Mitarbeiter nicht selbst abschließen; sie bleiben bei der Bestätigung durch einen berechtigten Verantwortlichen.
- Die additive Migration `011_employee_portal_dual_auth.sql` bereitet Passwortfelder, Online-/Praxis-Konfiguration, Lernschritte und interne Versuche vor. Sie wird mit diesem Preview-Update ausdrücklich **nicht ausgeführt**. Der Passwortbetrieb benötigt zusätzlich einen geheimen `AUTH_SESSION_SECRET`; fehlt Migration oder Secret, schließen die neuen Pfade kontrolliert mit einem Setup-Hinweis statt unsicher weiterzulaufen.
- Static Web Apps lässt die Login-Oberfläche und API bis zur gemeinsamen eigenen Autorisierungsschicht durch, damit beide Loginwege funktionieren. Externe persönliche Unterweisungslinks bleiben weiterhin ohne internes Benutzerkonto nutzbar.
- Das Gesamtpaket bleibt ausschließlich im bestehenden Draft-Preview-PR. Keine Migration, kein Datenimport, kein Seed-/Reparaturlauf, keine Produktionsfreigabe und keine Änderung kostenpflichtiger Azure-Tarife werden durch dieses Update ausgelöst.

## v0.36.2 – Zusammenhängendes Verwaltungs- und Dokumentupdate (Preview)

- Gesamtpaket auf Basis der bestehenden v0.36-Vorschau: kompaktes Menü, Planungs- und Statusarbeitslisten, Unterweisungsdetails, Frageneditor sowie PDF-/Bildanalyse mit Quellenprüfung und fachlicher Freigabe bleiben zusammen erhalten.
- Planung lädt nur ihre Ergebnisse nach. Formulare, Fokus, Suche und Teilnehmerauswahl bleiben bestehen; parallele Leseanfragen werden je Firma gebündelt. Veraltete Antworten überschreiben keine gespeicherten Planungen. Hinweise bleiben bis zum erfolgreichen Nachladen sichtbar.
- Dokumentauswahl und Freigabe sind an denselben angezeigten Auftrag gebunden. Ein Wechsel oder erneutes Laden verwirft die alte Prüfbestätigung; überholte Antworten und fremde Mandantenantworten werden ignoriert. Laufende Freigaben lassen sich nicht durch Mehrfachklicks oder Dokumentwechsel umleiten.
- Uploads verwenden einen Schnappschuss von Datei, Formular und Firma. Ein Firmenwechsel vor dem Versand bricht den Upload ab; spätere Antworten starten keine Analyse unter einer anderen Firma. Zwischenzeitlich geänderte Upload-Eingaben bleiben erhalten.
- „Neue Unterweisung“ öffnet nach bestätigtem Verwerfen eine echte Neuanlage statt versehentlich den zuvor bearbeiteten Eintrag zu überschreiben.
- Freigaben und Uploads aktualisieren Daten, Kennzahlen und Listen ohne Neuaufbau der übrigen Bearbeitungsformulare. Frisch veröffentlichte Fragen können nicht durch ältere laufende Leseanfragen ersetzt werden.
- Hauptseiten- und Vorschau-Bereitstellungen verwenden getrennte Ausführungsgruppen; Schließereignisse einer Vorschau können die Hauptseite nicht abbrechen. Der explizite Importschutz bleibt unverändert.
- Zusätzliche isolierte DOM- und Deployment-Regressionen verwenden ausschließlich synthetische Daten und kontrollierte API-Antworten. Keine Änderungen am API-Code, an Authentifizierung, Datenbank, Quelldokumenten oder Importfreigaben; keine Wartungs- oder Health-Aufrufe.
- Diese Version wird als ein Paket nur im bestehenden Vorschau-PR veröffentlicht. Eine visuelle Prüfung im angemeldeten Browser und ein echter KI-Dokumentlauf sind weiterhin nicht bestätigt; die produktive Hauptseite bleibt unverändert.

## 2026-09-03 – Vorschau-Sicherheit und Erhalt der Hauptseitenkorrekturen

- v0.36-Deployments führen keine Administratorreparatur, Schemaeinrichtung oder Neuverteilung bestehender Antworten mehr aus. Auch speicherverändernde Health-Aufrufe entfallen; Paketierung, Tests und Stylesheetprüfung bleiben erhalten.
- Der explizite Importschutz der Hauptseite ist im Vorschau-Branch übernommen. Keine Startdatei wird angelegt; alte Workflow-Läufe nicht erneut starten.
- Das Desktop-Menü bleibt einspaltig und vertikal scrollbar. Die vorhandene v0.36-Planungsansicht behält Suche und ausgeblendete Teilnehmerauswahl.
- Unterweisungsfilter, Detailauswahl und Filterrücksetzung lassen Bearbeitungsfelder und Uploadauswahl bestehen. Aktualisierte Tabellen und Detailaktionen erhalten weiterhin ihre Formatierung.
- Beim Abgleich mit main bleiben die erweiterten v0.36-Oberflächen und die Release-Anzeige erhalten; die Hauptseiten-Regressionsprüfungen werden an diese DOM-Struktur angepasst und weiter ausgeführt. Kein Merge der Vorschau auf main und keine Datenwartung.

## v0.36.1 – Ausgewogene Testantworten (Preview)

- Standardfragen verteilen die richtige Antwort gleichmäßig auf A, B, C und D: fünf je Position bei 20 Fragen pro Sprache.
- Neue externe Tests mischen die Antworten mit möglichst gleichmäßiger Verteilung der richtigen Positionen; die Bewertung bleibt an die jeweilige Antwort gebunden.
- Die gezielte Datenkorrektur ersetzt unveränderte aktive Standardfragen durch neue Versionen. Ursprüngliche Antwortschlüssel bleiben für bereits geöffnete Tests und historische Ergebnisse erhalten.
- Manuell bearbeitete und deaktivierte Fragen werden nicht überschrieben. Wiederholte Ausführung erzeugt keine weiteren Versionen.

## v0.36.1 – Kompakte Verwaltungsansichten (Preview)

- Mitarbeiter: fünf übersichtliche Spalten, vollständige Aktionen, Suche ohne Verlust offener Formulare.
- Externe Einladungen: einheitliche Formularbreiten, lesbare Buttons und gruppierte Status-, Test-, Termin- und Nachweisangaben.
- Planung: durchsuchbare Teilnehmerauswahl mit Auswahlzähler, begrenzter Listenhöhe und unveränderter Auswahl beim Filtern.
- Tabellen wechseln bei schmalem Inhaltsbereich zu beschrifteten Zeilenkarten; die übrigen Seiten bleiben unverändert.
- Buttons in diesen drei Ansichten werden über JavaScript angebunden, passend zur bestehenden Content Security Policy.
- Neue Verhaltenstests für Suche, Auswahl, Aktionen und Rollen; vollständiger bestehender Testlauf bleibt erforderlich.

## v0.7 – Nachweis-Upload gehärtet

- sichere Upload-API `POST /api/proof-files`
- Dateityp-, Content-Type-, Magic-Bytes- und Größenprüfung
- private Blob-Speicherung mit Metadaten und Tags
- SHA-256 Hash je Datei
- Scanstatus je Datei: pending, clean, not_configured, quarantined, blocked
- Downloadrechte über Rollenprüfung
- blockierte/quarantänisierte Dateien können nicht heruntergeladen werden
- Nachweis-Upload direkt im Unterweisungsstatus
- Gruppen-Nachweis kann auf alle Datensätze einer Gruppenunterweisung übernommen werden
- neue Migration `006_secure_file_uploads.sql`
- neue Dokumentation `docs/UPLOAD_SECURITY.md`

## v0.6 – Login/Rollen/Mandantenschutz

- Microsoft-Entra-/Static-Web-Apps-Auth vorbereitet
- produktive Benutzerfreischaltung über Tabelle `Users`
- neue API `GET /api/me`
- neue API `GET/POST/PATCH /api/users`
- neue Migration `005_auth_rbac.sql`
- neues Security-Event-Log
- API-Routen in `staticwebapp.config.json` geschützt
- Frontend zeigt angemeldeten Benutzer, Firma und Rollen
- neuer Reiter „Benutzer/Rechte“
- Startdaten-Import legt initiale Benutzer für Line Manager/HSE und optional Firmen-Admin an

## v0.5 – Microsoft Graph Mail

- Mailversand für externe Unterweisungen vorbereitet
- Outlook-Mail mit ICS für geplante Gruppenunterweisungen
- MailLog und Erinnerungsstatus

## v0.4 – Externe Unterweisung

- Einmal-Link-Unterweisung
- Testauswertung und Abschlussbuchung
- digitaler Nachweis vorbereitet

## v0.8.0 - Backup, Restore und Betriebsmonitoring

- Neuer Reiter `Betrieb/Backup` im Frontend.
- Neue Operations-API für Healthcheck, Backup-Export, Backup-Liste, Restore-Prüfung, Security-Events und Audit-Log.
- Neue SQL-Migration `007_operations_monitoring.sql`.
- Neue Tabellen `BackupRuns`, `SystemHealthSnapshots`, `RestoreChecks`.
- Neue View `vOperationsOverview`.
- Manueller JSON-Backup-Export in privaten Blob Storage.
- Backup-Download nur über kurz gültigen SAS-Link.
- Restore wird bewusst nur validiert, nicht automatisch produktiv ausgeführt.
- Lokale Scripts `backup:export` und `backup:verify` ergänzt.
