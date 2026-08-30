# Unterweisungsmanager Online v0.1

Das ist der Start für den Firmenbetrieb als Online-System.

## Inhalt

- `frontend/` – erste Online-Oberfläche für Azure Static Web Apps
- `api/` – Azure Functions API mit Start-Endpunkten
- `database/schema.sql` – Azure SQL Datenmodell für Firmen, Mitarbeiter, Unterweisungen, externe Links, Tests, Nachweise und Audit-Log
- `database/seed_essentra_data.json` – Startdaten aus der stabilen V24
- `templates/` – PDF-Unterweisungsvorlagen aus V24
- `scripts/import-startdata.js` – Import der V24-Startdaten in Azure SQL
- `infra/main.bicep` – erster Azure-Ressourcenentwurf
- `docs/` – Datenschutz-, Sicherheits-, Backup- und Roadmap-Unterlagen

## Reihenfolge

1. Neues GitHub-Repository erstellen.
2. ZIP entpacken und Inhalt in das Repository hochladen.
3. Azure Static Web App erstellen und mit GitHub verbinden.
4. Azure SQL anlegen und `database/schema.sql` ausführen.
5. Blob Storage anlegen und `templates/` in den Container `templates` hochladen.
6. API-App-Settings setzen:
   - `SQL_CONNECTION_STRING`
   - `BLOB_CONNECTION_STRING`
   - `BLOB_CONTAINER_TEMPLATES=templates`
   - `BLOB_CONTAINER_CERTIFICATES=certificates`
   - `PUBLIC_BASE_URL=https://<deine-domain>`
7. Startdaten importieren:
   ```bash
   npm install
   npm run api:install
   SQL_CONNECTION_STRING="..." node scripts/import-startdata.js
   ```
8. GitHub Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` setzen.
9. Push auf `main` löst das Deployment aus.

## Wichtig

Diese Version ist ein technischer Start. Vor Verkauf/Produktivbetrieb müssen noch umgesetzt werden:

- Microsoft Entra Login und Rollenprüfung in jeder API
- echte Mandantentrennung mit Berechtigungstest
- Upload-/Virenscan-Konzept
- Zertifikats-PDF-Erzeugung
- Microsoft Graph Mailversand
- Backups und Restore-Test
- Datenschutzunterlagen und AV-Vertrag
