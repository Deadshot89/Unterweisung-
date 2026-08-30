# Unterweisungsmanager Online v0.8

Mandantenfähiger Unterweisungsmanager für Azure Static Web Apps, Azure Functions, Azure SQL und Azure Blob Storage.

## Stand v0.8

Enthalten:

- Firmen-/Mandantenstruktur
- Mitarbeiter und Line Manager
- Unterweisungstypen und Vorlagen
- Unterweisungsstatus mit Fälligkeiten
- Nicht erforderlich / Wieder erforderlich
- Einzel- und Gruppenunterweisung
- Planung mit Outlook-/ICS-Vorbereitung
- externe Unterweisungslinks mit Test und Abschlussrückmeldung
- Microsoft Graph Mailversand vorbereitet
- Microsoft Entra / Rollen vorbereitet
- sicherer Nachweis-Upload
- **Betrieb/Backup-Konsole**
- Healthcheck SQL/Blob/Mail/Auth
- manueller Backup-Export in Blob Storage
- Restore-Prüfung ohne gefährlichen Produktiv-Restore
- Security-Events und Audit-Log

## Start lokal

```bash
npm install
cd api && npm install && cd ..
npm run start
```

## Datenbank vorbereiten

```bash
npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm run db:check
```

## Backup lokal testen

```bash
npm run backup:export
node scripts/verify-backup.js backups/<datei>.json
```

## Wichtige Dokumente

- `docs/AZURE_SQL_SETUP.md`
- `docs/BLOB_STORAGE_SETUP.md`
- `docs/AUTH_ENTRA_SETUP.md`
- `docs/MAIL_GRAPH_SETUP.md`
- `docs/UPLOAD_SECURITY.md`
- `docs/BACKUP_RESTORE_MONITORING.md`
- `docs/SICHERHEIT_BACKUP_DATENSCHUTZ.md`

## Nächster Schritt

Nach v0.8 sollte als nächstes die echte Azure-Infrastruktur gehärtet werden:

- Bicep/Infra erweitern
- Monitoring Alerts
- Storage Soft Delete und Versionierung erzwingen
- Azure SQL Retention konfigurieren
- Staging-Umgebung für Restore-Tests
- DSGVO-Unterlagen / AVV / TOMs finalisieren
