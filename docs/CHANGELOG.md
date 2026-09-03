# Changelog

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
