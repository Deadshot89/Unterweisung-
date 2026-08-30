# Sicherheit, Backup und Datenschutz - Startkonzept

## Sicherheitsgrundsatz

Die Offline-HTML wird durch eine echte Online-Architektur ersetzt:

- Frontend: Azure Static Web Apps
- API: Azure Functions
- Daten: Azure SQL
- Dateien: Azure Blob Storage
- Login: Microsoft Entra / External ID
- Mail: Microsoft Graph oder SMTP-Provider

## Mindest-Sicherheitsmaßnahmen vor Verkauf

1. Kein direkter Datenbankzugriff aus dem Browser.
2. Jede API prüft Benutzer, Rolle und `companyId`.
3. Externe Links erhalten zufällige Tokens und Ablaufdatum.
4. Tokens werden nur gehasht gespeichert.
5. PDFs/Nachweise liegen in privaten Blob-Containern.
6. Admins nutzen MFA.
7. Audit-Log für alle relevanten Aktionen.
8. Uploads bekommen Dateityp-/Größenprüfung und Malware-Prüfung.
9. Secrets liegen in Azure App Settings/Key Vault, nicht im Code.
10. Fehler- und Zugriffsmuster werden überwacht.

## Backup-Konzept

### Azure SQL

- Point-in-Time-Restore aktiv nutzen.
- Täglicher Export oder zusätzliche Sicherung für kritische Kunden.
- Monatlicher Restore-Test.
- Optional längere Aufbewahrung für Enterprise-Kunden.

### Blob Storage

- Soft Delete aktiv.
- Versionierung aktiv.
- Container nicht öffentlich.
- Nachweise und Vorlagen getrennt speichern.

### Code

- GitHub als Source of Truth.
- Releases taggen.
- Rollback auf letzte stabile Version.

## DSGVO-Unterlagen

Vor Verkauf benötigt:

- Impressum
- Datenschutzerklärung
- AV-Vertrag
- TOMs
- Löschkonzept
- Berechtigungskonzept
- Backup-Konzept
- Verarbeitungsverzeichnis
- Support-/SLA-Regeln
