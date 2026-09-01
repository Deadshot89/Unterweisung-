# Unterweisungsmanager Online v12 - Dev/Pilot Login-Bypass

Diese Version behebt den aktuellen Blocker auf der Website:
`Anmeldung erforderlich / Nicht angemeldet`.

## Datei ersetzen

In GitHub ersetzen:

- `api/src/lib/auth.js`

Danach committen. Der Workflow `Deploy Unterweisungsmanager API` läuft automatisch.

## Temporäre Azure-Umgebungsvariablen für Pilot-Test

In Azure Function App `func-unterweisungsmanager-dev` unter `Umgebungsvariablen` ergänzen:

- `AUTH_DEV_BYPASS` = `true`
- `DEFAULT_COMPANY_ID` = `company-essentra`
- `DEV_USER_NAME` = `Tobias Limberg`
- `DEV_USER_EMAIL` = `TobiasLimberg@essentra.com`

Danach speichern und Function App neu starten.

## Wichtig

`AUTH_DEV_BYPASS=true` ist nur für Aufbau/Testbetrieb. Vor Produktivbetrieb wieder auf `false` setzen oder löschen und Microsoft Entra Login sauber aktivieren.
