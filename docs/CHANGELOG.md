# Changelog

## v0.5

- Microsoft Graph Mailversand vorbereitet.
- Neues Modul `api/src/lib/graphMail.js` für Client-Credentials-Token, Graph `sendMail`, Einladungsmails, Erinnerungen und ICS-Termine.
- Neues Modul `api/src/lib/mailLog.js` für Versandprotokoll.
- Neue API-Endpunkte: `/api/mail/config`, `/api/invitations/{id}/send-mail`, `/api/invitations/send-reminders`, `/api/planned-trainings/{id}/send-mail`, `/api/mail/log`.
- `POST /api/invitations` kann mit `sendMail:true` direkt senden.
- Beim erneuten Versand wird ein neuer Token erzeugt und der alte Link ungültig.
- Neue Migration `004_mail_dispatch.sql` mit `MailLog`, Mailstatus und Erinnerungsfeldern.
- Frontend zeigt Mailkonfiguration, Mailstatus, Senden-/Erinnern-Buttons und Outlook-Mail für geplante Termine.
- Dokumentation `docs/MAIL_GRAPH_SETUP.md` ergänzt.

## v0.4

- Externe Teilnehmerseite `frontend/external/instruction.html` erweitert.
- Externe Unterweisung kann Inhalt, Vorlage und Testfragen anzeigen.
- Testauswertung im Backend ergänzt.
- Abschluss per Einmal-Link speichert jetzt einen `InstructionRecords`-Datensatz.
- Einladung wechselt Status: `sent` → `opened` → `completed` oder `failed`.
- `ExternalInvitations` erweitert: Empfängername, Startzeit, letzter Zugriff, Testpflicht, Bestehensgrenze, Nachweisdatei.
- `vExternalInvitations` ergänzt für Admin-Übersicht.
- Nachweisdatei wird als HTML-Drucknachweis in Blob Storage vorbereitet.
- Datei-Download-Endpunkt `/api/files/{id}/download` ergänzt.
- Admin-Frontend zeigt externe Einladungen und Abschlüsse an.
- Import erzeugt automatisch 20 Testfragen je Unterweisung in Deutsch, Englisch und Polnisch, wenn keine Testfragen im Seed enthalten sind.

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
