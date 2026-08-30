# Changelog

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
