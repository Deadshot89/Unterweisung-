# Microsoft Graph Mailversand einrichten

Version v5 bereitet echten Outlook-/Microsoft-365-Mailversand vor.

## Azure App Registration

1. In Microsoft Entra ID eine App Registration anlegen.
2. Client Secret erstellen.
3. API Permission hinzufügen:
   - Microsoft Graph
   - Application permission
   - `Mail.Send`
4. Admin Consent erteilen.
5. Absenderpostfach festlegen, z. B. `unterweisungsmanager@firma.de`.

## App Settings / Umgebungsvariablen

```bash
GRAPH_TENANT_ID="<tenant-id>"
GRAPH_CLIENT_ID="<app-client-id>"
GRAPH_CLIENT_SECRET="<client-secret>"
MAIL_FROM="unterweisungsmanager@firma.de"
MAIL_HSE_CC="hse@firma.de"
PUBLIC_BASE_URL="https://deine-domain.de"
EXTERNAL_LINK_DEFAULT_DAYS="14"
```

## Endpunkte

- `GET /api/mail/config` prüft, ob Graph-Mail vollständig konfiguriert ist.
- `POST /api/invitations` kann mit `sendMail:true` direkt den Link per Mail senden.
- `POST /api/invitations/{id}/send-mail` erzeugt einen neuen sicheren Token und sendet die Mail erneut.
- `POST /api/invitations/send-reminders` verschickt Erinnerungen für fällige offene Einladungen.
- `POST /api/planned-trainings/{id}/send-mail` sendet eine Outlook-Mail mit `.ics`-Terminanhang an die Teilnehmer.
- `GET /api/mail/log` zeigt die letzten Mailversand-Einträge.

## Sicherheitsnotiz

Tokens werden weiterhin nur gehasht in SQL gespeichert. Bei erneutem Versand wird ein neuer Token erzeugt und der alte Link ungültig. Das ist sicherer, als Klartext-Links dauerhaft in der Datenbank abzulegen.
