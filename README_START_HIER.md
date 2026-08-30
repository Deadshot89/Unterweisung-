# Unterweisungsmanager Online v4

Ziel: Firmenfähige Online-Version für Azure Static Web Apps + Azure Functions + Azure SQL + Azure Blob Storage.

## Inhalt

- `frontend/` – Web-Oberfläche für Admin/HSE/Line Manager
- `frontend/external/` – Teilnehmeransicht für externe Unterweisungslinks
- `api/` – Azure Functions API
- `database/migrations/` – idempotente SQL-Migrationen
- `database/seed_essentra_data.json` – Startdaten Essentra
- `templates/` – PDF-Vorlagen für den ersten Import
- `scripts/` – Datenbank-Migration, Import, Blob-Upload, Prüfskripte
- `infra/` – Azure Bicep Grundentwurf
- `docs/` – Datenschutz, Backup, Sicherheit, Roadmap

## Reihenfolge für den Aufbau

1. Azure SQL Datenbank erstellen.
2. Storage Account + privaten Blob Container erstellen.
3. Verbindung in Umgebungsvariablen eintragen.
4. Migrationen ausführen.
5. Startdaten importieren inklusive Testfragen.
6. PDF-Vorlagen in Blob Storage hochladen.
7. API testen.
8. Frontend über Azure Static Web Apps veröffentlichen.

## Lokaler technischer Ablauf

```bash
npm install
cd api && npm install && cd ..

export SQL_CONNECTION_STRING="Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=<storage>;AccountKey=<key>;EndpointSuffix=core.windows.net"
export BLOB_CONTAINER="unterweisungsmanager"
export COMPANY_ID="company-essentra"
export PUBLIC_BASE_URL="http://localhost:4280"

npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm run db:check
npm run start
```

## Wichtige Änderung in v4

Die externe Unterweisungsstrecke ist jetzt angebunden:

1. Admin/HSE erzeugt einen sicheren Einmal-Link.
2. Teilnehmer öffnet `/external/instruction.html?t=<token>`.
3. Unterweisungsinhalt und Vorlage werden angezeigt.
4. Der Teilnehmer bestätigt den Inhalt.
5. Falls Testfragen vorhanden sind, beantwortet der Teilnehmer den Test.
6. Die API bewertet den Test.
7. Bei Bestehen wird ein Unterweisungsdatensatz gespeichert.
8. Der Status ist danach in der Admin-Seite sichtbar.
9. Ein digitaler Nachweis wird als HTML-Datei in Blob Storage vorbereitet.

## Aktuelle Seed-Daten

- 1 Firma
- 40 Mitarbeiter
- 21 Unterweisungstypen
- 13 Vorlagen
- 647 vorhandene Unterweisungseinträge
- beim Import automatisch generierter 20-Fragenpool je Unterweisung in DE/EN/PL

## Aktueller Stand

v4 ist noch kein fertiges SaaS-Produkt, aber der Online-Kern ist jetzt aufgebaut:

- Azure SQL Migrationen
- Startdaten-Import
- Blob Storage Upload für Vorlagen
- externe Unterweisungslinks
- Testauswertung bei externem Abschluss
- Statusrückmeldung in Admin-Seite
- Nachweisdatei in Blob Storage vorbereitet

## Nächster Schritt

Als nächstes kommen:

1. echter PDF-Renderer für Nachweise statt HTML-Drucknachweis
2. Microsoft Graph Mailversand für Einladungen
3. Nachweis-Upload durch Admin/HSE
4. Entra Login/Rollen produktiv aktivieren
