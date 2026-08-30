# Changelog

## v0.3

- Idempotente SQL-Migrationen unter `database/migrations` ergänzt.
- `npm run db:migrate` ergänzt.
- `npm run db:check` ergänzt.
- `npm run blob:upload-templates` ergänzt.
- Blob Storage Hilfsmodul für API ergänzt.
- Vorlagen-Download per zeitlich begrenztem SAS-Link vorbereitet.
- Healthcheck prüft jetzt SQL und Blob Storage.
- CompanySettings ergänzt: gelbe Warnung, orange kritisch, Mail-Fallback, HSE-Mail, Aufbewahrung.
- Statusberechnung in SQL-View `vInstructionStatus` verschoben.
- Manager-Report-Endpunkt `/api/reports/manager-training-time` ergänzt.

## v0.2

- Erste API-Struktur für Firmen, Mitarbeiter, Unterweisungstypen, Status, Planung und externe Links.

## v0.1

- Projektstruktur für Azure Static Web Apps + Azure Functions + Azure SQL/Blob Storage.
