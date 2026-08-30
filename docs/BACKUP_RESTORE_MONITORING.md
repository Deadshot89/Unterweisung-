# Backup, Restore und Betriebsmonitoring

Version v0.8 ergänzt die technische Grundlage für den späteren Firmenbetrieb.

## Ziel

Das System soll nicht nur Unterweisungen speichern, sondern als Betreiber kontrollierbar sein:

- Datenbank erreichbar?
- Blob Storage erreichbar?
- Microsoft Graph Mailversand konfiguriert?
- Gibt es offene Sicherheitsereignisse?
- Wann lief das letzte Backup?
- Kann ein Backup geprüft werden?
- Welche Audit-Einträge wurden zuletzt geschrieben?

## Neue API-Endpunkte

| Endpunkt | Zweck | Rollen |
|---|---|---|
| `GET /api/operations/overview` | Betriebsübersicht je Firma | System Admin, Firmen Admin, HSE |
| `GET /api/operations/health` | Healthcheck ausführen und speichern | System Admin, Firmen Admin, HSE |
| `GET /api/operations/health-history` | letzte Healthchecks anzeigen | System Admin, Firmen Admin, HSE |
| `POST /api/operations/backup-export` | manuellen JSON-Backup-Export erstellen | System Admin, Firmen Admin, HSE |
| `GET /api/operations/backups` | Backup-Läufe anzeigen | System Admin, Firmen Admin, HSE |
| `GET /api/operations/backup-download/{id}` | kurz gültigen SAS-Link erzeugen | System Admin, Firmen Admin, HSE |
| `POST /api/operations/restore-validate` | Backup-Metadaten prüfen | System Admin, Firmen Admin, HSE |
| `GET /api/operations/security-events` | Sicherheitsereignisse anzeigen | System Admin, Firmen Admin, HSE |
| `GET /api/operations/audit` | Audit-Log anzeigen | System Admin, Firmen Admin, HSE |

## Backup-Strategie

### 1. Azure SQL

Azure SQL bringt Point-in-Time-Restore mit. Trotzdem braucht das Produkt eigene Betreiberkontrollen:

- täglicher Restore-fähiger Datenbankstand
- dokumentierter Wiederherstellungsprozess
- monatlicher Restore-Test in Staging
- Export je Firma für Support-/Prüfzwecke

### 2. Blob Storage

Für Nachweise und Vorlagen:

- private Container
- Soft Delete aktivieren
- Versionierung aktivieren
- keine öffentlichen Container
- Download nur über zeitlich begrenzte SAS-Links

### 3. Manueller Export

Der neue Backup-Export erzeugt eine JSON-Datei je Firma und legt sie in Blob Storage ab:

```text
backups/{companyId}/{YYYY-MM-DD}/unterweisungsmanager-backup-...
```

Der Export enthält Fach-/Konfigurationsdaten, aber ersetzt nicht den Azure-SQL-Point-in-Time-Restore.

## Restore-Regel

Produktiv wird **kein automatischer Restore per Button** eingebaut. Das wäre zu gefährlich.

Ablauf:

1. Backup auswählen
2. Restore-Prüfung starten
3. Backup-Metadaten prüfen
4. Wiederherstellung nur in Staging/Testdatenbank
5. Daten prüfen
6. Freigabe dokumentieren
7. Produktiv-Restore nur durch Betreiber/Admin mit Vier-Augen-Prinzip

## Lokale Scripts

```bash
npm run backup:export
npm run backup:verify -- backups/datei.json
```

Oder direkt:

```bash
node scripts/export-backup.js company-essentra
node scripts/verify-backup.js backups/unterweisungsmanager-backup-....json
```

## Betriebspflichten

Für produktiven Firmenbetrieb sollte zusätzlich eingerichtet werden:

- Azure Monitor Alert bei API-Fehlern
- Azure Budget Alert
- Storage Soft Delete / Versioning
- Azure SQL PITR prüfen
- monatlicher Restore-Test
- Sicherheitsereignisse regelmäßig prüfen
- Audit-Log-Aufbewahrung definieren
- DSGVO-Lösch- und Aufbewahrungsfristen dokumentieren
