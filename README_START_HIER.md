# Unterweisungsmanager Online v0.2

Diese Version ist der nächste Schritt vom Offline-Prototyp zum Firmen-System.

## Neu in v0.2

- API-Endpunkte für Firmen / Mandanten
- API-Endpunkte für Mitarbeiter-Stammdaten
- API-Endpunkte für Unterweisungstypen
- API-Endpunkte für Unterweisungsstatus
- API-Endpunkte für „Nicht erforderlich“ / „Wieder erforderlich“
- API-Endpunkte für durchgeführte Einzel- und Gruppenunterweisungen
- API-Endpunkte für geplante Unterweisungen und Teilnehmer
- API-Endpunkte für externe Einmal-Links
- Audit-Log für wichtige Änderungen vorbereitet
- Rollenprüfung vorbereitet: system_admin, company_admin, hse, line_manager, employee
- Healthcheck prüft optional die SQL-Verbindung
- Frontend zeigt jetzt zusätzlich Unterweisungsstatus und Planung

## Ordnerstruktur

```text
frontend/                  # Azure Static Web App Frontend
api/                       # Azure Functions API
api/src/functions/          # HTTP-Endpunkte
database/schema.sql         # Azure SQL Tabellenmodell
database/seed_essentra_data.json
scripts/import-startdata.js # Import der Startdaten
infra/main.bicep            # Azure-Ressourcenentwurf
docs/                       # Sicherheit, Backup, Datenschutz, Roadmap
```

## Lokaler Start

```bash
npm install
cd api && npm install && cd ..
npm start
```

Ohne SQL-Verbindung lädt das Frontend automatisch die Seed-Daten.
Mit SQL-Verbindung setzt du in `api/local.settings.json`:

```json
{
  "Values": {
    "SQL_CONNECTION_STRING": "Server=tcp:..."
  }
}
```

## Datenbank anlegen

1. Azure SQL Datenbank erstellen.
2. `database/schema.sql` ausführen.
3. Startdaten importieren:

```bash
SQL_CONNECTION_STRING="..." node scripts/import-startdata.js
```

## Wichtige Endpunkte

```text
GET  /api/health
GET  /api/bootstrap
GET  /api/companies
GET  /api/employees
POST /api/employees
PATCH /api/employees/{id}
GET  /api/instruction-types
POST /api/instruction-types
PATCH /api/instruction-types/{id}
GET  /api/instruction-status
GET  /api/exclusions
POST /api/exclusions
DELETE /api/exclusions/{id}
GET  /api/records
POST /api/records
GET  /api/planned-trainings
POST /api/planned-trainings
PATCH /api/planned-trainings/{id}
POST /api/invitations
GET  /api/external/{token}
POST /api/external/{token}
```

## Nächster technischer Schritt

1. Azure SQL wirklich verbinden.
2. Startdaten importieren.
3. Static Web App auf Azure veröffentlichen.
4. Auth / Microsoft Entra Rollen produktiv aktivieren.
5. Blob Storage Upload für Vorlagen/Nachweise anbinden.
6. Microsoft Graph Mailversand für Outlook-Einladungen anbinden.
