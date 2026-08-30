# Changelog

## v0.6 – Login/Rollen/Mandantenschutz

- Microsoft-Entra-/Static-Web-Apps-Auth vorbereitet
- produktive Benutzerfreischaltung über Tabelle `Users`
- neue API `GET /api/me`
- neue API `GET/POST/PATCH /api/users`
- neue Migration `005_auth_rbac.sql`
- neues Security-Event-Log
- API-Routen in `staticwebapp.config.json` geschützt
- Frontend zeigt angemeldeten Benutzer, Firma und Rollen
- neuer Reiter „Benutzer/Rechte“
- Startdaten-Import legt initiale Benutzer für Line Manager/HSE und optional Firmen-Admin an

## v0.5 – Microsoft Graph Mail

- Mailversand für externe Unterweisungen vorbereitet
- Outlook-Mail mit ICS für geplante Gruppenunterweisungen
- MailLog und Erinnerungsstatus

## v0.4 – Externe Unterweisung

- Einmal-Link-Unterweisung
- Testauswertung und Abschlussbuchung
- digitaler Nachweis vorbereitet
