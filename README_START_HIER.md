# Unterweisungsmanager Online v5

Ziel: Firmenfähige Online-Version für Azure Static Web Apps + Azure Functions + Azure SQL + Azure Blob Storage + Microsoft Graph Mailversand.

## Inhalt

- `frontend/` – Web-Oberfläche für Admin/HSE/Line Manager
- `frontend/external/` – Teilnehmeransicht für externe Unterweisungslinks
- `api/` – Azure Functions API
- `database/migrations/` – idempotente SQL-Migrationen
- `database/seed_essentra_data.json` – Startdaten Essentra
- `templates/` – PDF-Vorlagen für den ersten Import
- `scripts/` – Datenbank-Migration, Import, Blob-Upload, Prüfskripte
- `infra/` – Azure Bicep Grundentwurf
- `docs/` – Datenschutz, Backup, Sicherheit, Mail, Roadmap

## Reihenfolge für den Aufbau

1. Azure SQL Datenbank erstellen.
2. Storage Account + privaten Blob Container erstellen.
3. Microsoft Entra App Registration für Graph Mail erstellen.
4. Verbindung in Umgebungsvariablen eintragen.
5. Migrationen ausführen.
6. Startdaten importieren inklusive Testfragen.
7. PDF-Vorlagen in Blob Storage hochladen.
8. API testen.
9. Frontend über Azure Static Web Apps veröffentlichen.

## Lokaler technischer Ablauf

```bash
npm install
cd api && npm install && cd ..

export SQL_CONNECTION_STRING="Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=<storage>;AccountKey=<key>;EndpointSuffix=core.windows.net"
export BLOB_CONTAINER="unterweisungsmanager"
export COMPANY_ID="company-essentra"
export PUBLIC_BASE_URL="http://localhost:4280"

# Graph Mail optional, aber für echten Mailversand erforderlich
export GRAPH_TENANT_ID="<tenant-id>"
export GRAPH_CLIENT_ID="<app-client-id>"
export GRAPH_CLIENT_SECRET="<client-secret>"
export MAIL_FROM="unterweisungsmanager@firma.de"

npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm run db:check
npm run start
```

## Wichtige Änderung in v5

Microsoft Graph Mailversand ist vorbereitet:

1. Externe Unterweisungslinks können direkt per Mail gesendet werden.
2. Erinnerungen für offene/fällige Einladungen können gesendet werden.
3. Geplante Gruppenunterweisungen können als Outlook-Mail mit `.ics`-Terminanhang an Teilnehmer gesendet werden.
4. Jeder Mailversand wird in `MailLog` protokolliert.
5. Beim erneuten Senden wird ein neuer sicherer Token erzeugt; der alte Link wird dadurch ungültig.

## Aktuelle Seed-Daten

- 1 Firma
- 40 Mitarbeiter
- 21 Unterweisungstypen
- 13 Vorlagen
- 647 vorhandene Unterweisungseinträge
- beim Import automatisch generierter 20-Fragenpool je Unterweisung in DE/EN/PL

## Aktueller Stand

v5 ist noch kein fertiges SaaS-Produkt, aber der Online-Kern ist jetzt aufgebaut:

- Azure SQL Migrationen
- Startdaten-Import
- Blob Storage Upload für Vorlagen
- externe Unterweisungslinks
- Testauswertung bei externem Abschluss
- Statusrückmeldung in Admin-Seite
- Nachweisdatei in Blob Storage vorbereitet
- Microsoft Graph Mailversand vorbereitet
- Mail-Log und Erinnerungen vorbereitet

Nächster Schritt: Microsoft Entra Rollen produktiv anbinden und echte Firmen-/Benutzerverwaltung absichern.
