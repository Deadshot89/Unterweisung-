# Nächster Schritt in Azure

## 1. Repository anlegen

- GitHub Repository erstellen, z. B. `unterweisungsmanager-online`.
- Inhalt dieses ZIPs entpacken und hochladen.
- Branch `main` verwenden.

## 2. Azure Static Web App erstellen

- Azure Portal öffnen.
- Static Web App erstellen.
- GitHub Repository verbinden.
- App location: `frontend`
- API location: `api`
- Output location: leer lassen.

## 3. Azure SQL erstellen

- Azure SQL Server + Datenbank erstellen.
- Firewall-Regel für eigene IP setzen.
- `database/schema.sql` ausführen.
- Connection String sicher speichern.

## 4. Startdaten importieren

Lokal:

```bash
SQL_CONNECTION_STRING="..." node scripts/import-startdata.js
```

## 5. App Settings setzen

In Azure Static Web App / Functions Configuration:

```text
SQL_CONNECTION_STRING=...
PUBLIC_BASE_URL=https://<deine-app>.azurestaticapps.net
BLOB_CONNECTION_STRING=...
BLOB_CONTAINER_TEMPLATES=templates
BLOB_CONTAINER_CERTIFICATES=certificates
```

## 6. Prüfen

```text
https://<deine-app>.azurestaticapps.net/api/health
```

Wenn SQL verbunden ist, muss `database: ok` erscheinen.
