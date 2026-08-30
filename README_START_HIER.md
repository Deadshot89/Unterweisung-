# Unterweisungsmanager Online v0.7

Diese Version härtet den **Nachweis-Upload** für den Firmenbetrieb.

## Neu in v0.7

- sicherer Nachweis-Upload über `POST /api/proof-files`
- erlaubte Dateitypen: PDF, JPG, PNG, WEBP
- Dateigrößenlimit über `UPLOAD_MAX_MB`, Standard 15 MB
- Prüfung von Dateiendung, Content-Type und Datei-Signatur/Magic Bytes
- private Speicherung in Azure Blob Storage
- Datei-Metadaten in SQL: Größe, SHA-256, Scanstatus, verknüpfter Datensatz
- Download nur für berechtigte Rollen
- gesperrte/quarantänisierte Dateien können nicht heruntergeladen werden
- Nachweis-Upload direkt aus der Unterweisungsstatus-Ansicht
- Gruppen-Nachweis kann auf alle Teilnehmer einer Gruppenunterweisung übernommen werden
- neue Migration `006_secure_file_uploads.sql`
- neue Doku `docs/UPLOAD_SECURITY.md`

## Wichtig für Produktion

In Produktion setzen:

```env
NODE_ENV=production
AUTH_REQUIRE_DB_USER=true
UPLOAD_MAX_MB=15
UPLOAD_SCAN_STATUS=pending
UPLOAD_SCAN_PROVIDER=manual-or-defender
```

`UPLOAD_SCAN_STATUS=pending` bedeutet: Datei ist gespeichert, aber noch nicht durch einen Virenscan bestätigt. Für den späteren Verkauf sollte Microsoft Defender for Storage oder ein vergleichbarer Scanprozess aktiviert werden.

## Reihenfolge lokal / Azure

```bash
npm install
cd api && npm install && cd ..
npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm start
```

## Test Nachweis-Upload

1. Admin-Seite öffnen
2. Reiter „Unterweisungsstatus“
3. Einen bestehenden erledigten Eintrag suchen
4. „Nachweis hochladen“ klicken
5. PDF oder Bild auswählen
6. Danach erscheint der Nachweis beim Datensatz und kann über „Öffnen“ geladen werden

## Dokumentation

- `docs/UPLOAD_SECURITY.md`
- `docs/AUTH_ENTRA_SETUP.md`
- `docs/MAIL_GRAPH_SETUP.md`
- `docs/AZURE_SQL_SETUP.md`
- `docs/BLOB_STORAGE_SETUP.md`
- `docs/SICHERHEIT_BACKUP_DATENSCHUTZ.md`
- `docs/CHANGELOG.md`

## Nächster Schritt

Nach v0.7 kommt v0.8: Backup-/Restore-Konsole, Betriebsmonitoring, Admin-Health-Dashboard und Datenexport je Firma.
