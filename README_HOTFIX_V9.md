# Unterweisungsmanager Online v9 Hotfix

Dieser Hotfix behebt zwei Deploy-/Healthcheck-Probleme:

1. SQL wird jetzt entweder über `SQL_CONNECTION_STRING` oder über die vorhandenen Einzelwerte `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` erkannt.
2. Blob Storage erstellt/prüft private Container korrekt. Der ungültige SDK-Wert `access: 'private'` wurde entfernt.

Nach dem Commit der geänderten Dateien API-Workflow neu laufen lassen und `/api/health` erneut prüfen.
