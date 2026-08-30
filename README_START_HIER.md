# Unterweisungsmanager Online v3

Ziel: Firmenfähige Online-Version für Azure Static Web Apps + Azure Functions + Azure SQL + Azure Blob Storage.

## Inhalt

- `frontend/` – Web-Oberfläche für Admin/HSE/Line Manager
- `frontend/external/` – spätere Teilnehmeransicht für externe Unterweisungslinks
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
5. Startdaten importieren.
6. PDF-Vorlagen in Blob Storage hochladen.
7. API testen.
8. Frontend über Azure Static Web Apps veröffentlichen.

## Lokaler technischer Ablauf

```bash
npm install
cd api && npm install && cd ..

# Umgebungsvariablen setzen
export SQL_CONNECTION_STRING="Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=<storage>;AccountKey=<key>;EndpointSuffix=core.windows.net"
export BLOB_CONTAINER="unterweisungsmanager"
export COMPANY_ID="company-essentra"

npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm run db:check
npm run start
```

## Wichtige Änderung in v3

Die Datenbank ist jetzt über `database/migrations` sauber migrierbar. Die PDF-Vorlagen werden nicht mehr als Frontend-Daten behandelt, sondern in Azure Blob Storage vorbereitet. Die API kann über `/api/templates/{id}/download` später kurzfristige Download-Links erzeugen.

## Aktuelle Seed-Daten

- 1 Firma
- 40 Mitarbeiter
- 21 Unterweisungstypen
- 13 Vorlagen
- 647 vorhandene Unterweisungseinträge

## Aktueller Stand

v3 ist noch kein fertiges SaaS-Produkt, aber der technische Grundaufbau ist jetzt deutlich näher an Produktion:

- Azure SQL Migrationen
- Startdaten-Import
- Blob Storage Upload für Vorlagen
- Healthcheck mit SQL + Blob Prüfung
- Einstellungen je Firma
- Manager-Report-Endpunkt
- Download-Endpunkt für Vorlagen

## Nächster Schritt

Als nächstes kommen:

1. echter Upload von Nachweisen in Blob Storage
2. externe Unterweisungsseite mit Abschluss zurück in die Datenbank
3. Microsoft Graph Mailversand für Einladungen
4. Entra Login/Rollen produktiv aktivieren
