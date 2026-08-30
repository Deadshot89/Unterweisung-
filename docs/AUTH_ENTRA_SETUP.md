# Microsoft Entra Login und Rollen – v0.6

Ziel: Die Admin-Webseite darf nur angemeldete und freigeschaltete Benutzer zulassen. Externe Unterweisungslinks bleiben anonym, sind aber tokenbasiert und zeitlich begrenzt.

## Rollen

| Rolle | Code | Zweck |
|---|---|---|
| System Admin | `system_admin` | alle Firmen, technische Administration |
| Firmen Admin | `company_admin` | Benutzer, Firma, Stammdaten |
| HSE | `hse` | Unterweisungen, Nachweise, Reports |
| Line Manager | `line_manager` | eigene Mitarbeiter, Planung, Durchführung |
| Mitarbeiter | `employee` | eigene/zugewiesene Unterweisungen |

## Produktivregel

In Produktion sollte gesetzt werden:

```env
NODE_ENV=production
AUTH_REQUIRE_DB_USER=true
```

Dann reicht Microsoft-Login allein nicht. Der Benutzer muss zusätzlich in der Tabelle `Users` aktiv für die Firma freigeschaltet sein.

## Static Web Apps

`staticwebapp.config.json` schützt jetzt:

- `/api/*` nur für `authenticated`
- `/api/external/*` anonym für Einmal-Link-Unterweisungen
- `/external/*` anonym für Teilnehmerseite
- `/api/health` anonym für Monitoring

## Startbenutzer

Beim Import können folgende Variablen gesetzt werden:

```env
INITIAL_ADMIN_EMAIL=TobiasLimberg@essentra.com
INITIAL_ADMIN_NAME=Tobias Limberg
INITIAL_ADMIN_ROLE=company_admin
```

Zusätzlich werden Line Manager/HSE aus dem Mitarbeiterstamm als Benutzer vorbereitet.

## Datenbank

Migration `005_auth_rbac.sql` ergänzt:

- `Users.entraObjectId`
- `Users.lastSeenAt`
- `Users.provider`
- `SecurityEvents`
- View `vUserAccess`

## Nächste Härtung

- Entra App Registration final anlegen
- MFA/Conditional Access für Admins erzwingen
- eigene Rollen/Groups aus Entra den DB-Rollen zuordnen
- Audit-/Security-Events regelmäßig auswerten
