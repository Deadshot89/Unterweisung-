# Azure SQL Setup

## Ziel

Die Daten werden zentral in Azure SQL gespeichert. Jede fachliche Tabelle enthält `companyId`, damit mehrere Firmen getrennt geführt werden können.

## Schritte

1. Azure SQL Server erstellen.
2. Azure SQL Datenbank erstellen.
3. Firewall-Regel für deinen aktuellen Arbeitsplatz setzen.
4. Connection String kopieren.
5. `SQL_CONNECTION_STRING` als GitHub Secret und als Azure Static Web App Application Setting hinterlegen.
6. Migration ausführen:

```bash
npm run db:migrate
```

7. Startdaten importieren:

```bash
npm run db:seed
```

8. Prüfung ausführen:

```bash
npm run db:check
```

## Wichtige Tabellen

- `Companies`
- `Employees`
- `InstructionTypes`
- `InstructionRecords`
- `EmployeeInstructionExclusions`
- `PlannedTrainings`
- `ExternalInvitations`
- `Files`
- `AuditLog`

## Wiederherstellung

Für Produktion müssen Azure SQL automatische Backups, Point-in-Time-Restore und ein getesteter Restore-Prozess aktiv sein. Ein Backup ist nur dann wertvoll, wenn die Wiederherstellung regelmäßig getestet wird.
