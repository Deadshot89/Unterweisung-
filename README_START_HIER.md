# Unterweisungsmanager Online v0.6

Diese Version ist der nächste Schritt Richtung Firmen-System / SaaS-Betrieb.

## Neu in v0.6

- Microsoft-Entra-/Static-Web-Apps-Login vorbereitet
- Benutzer-/Rollenverwaltung (`Users`)
- produktive Freischaltung je Firma
- Mandantenschutz: Benutzer darf nur die zugewiesene Firma laden
- neuer Reiter „Benutzer/Rechte“ im Frontend
- neue API `GET /api/me`
- neue API `GET/POST/PATCH /api/users`
- neue SQL-Migration `005_auth_rbac.sql`
- Security-Events für Login-/Rechtevorgänge
- `staticwebapp.config.json` schützt Admin/API-Routen

## Wichtig

In Produktion setzen:

```env
NODE_ENV=production
AUTH_REQUIRE_DB_USER=true
```

Dann reicht Microsoft-Login alleine nicht. Der Benutzer muss zusätzlich aktiv in der Tabelle `Users` stehen.

## Reihenfolge lokal / Azure

```bash
npm install
cd api && npm install && cd ..
npm run db:migrate
npm run db:seed
npm run blob:upload-templates
npm start
```

## Initialer Admin

Vor `npm run db:seed` setzen:

```env
INITIAL_ADMIN_EMAIL=TobiasLimberg@essentra.com
INITIAL_ADMIN_NAME=Tobias Limberg
INITIAL_ADMIN_ROLE=company_admin
```

## Dokumentation

- `docs/AUTH_ENTRA_SETUP.md`
- `docs/MAIL_GRAPH_SETUP.md`
- `docs/AZURE_SQL_SETUP.md`
- `docs/BLOB_STORAGE_SETUP.md`
- `docs/SICHERHEIT_BACKUP_DATENSCHUTZ.md`
- `docs/CHANGELOG.md`

## Nächster Schritt

Nach v0.6 kommt v0.7: Nachweis-Upload produktiv härten, Dateiprüfung, Upload-Limits, Virenscan-/Defender-Konzept und saubere Nachweisverwaltung.
