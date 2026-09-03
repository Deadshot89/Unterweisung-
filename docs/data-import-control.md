# Datenimport gezielt über GitHub starten

Website-Updates, Tests, Daten-/Vorlagenänderungen und Änderungen am Importworkflow lösen keinen Datenimport mehr aus. Der bestehende Importworkflow reagiert ausschließlich auf eine Änderung an `operations/data-import-request.json` auf `main`.

Die Einrichtung enthält **keine echte Startdatei**. Sie führt keinen Datenimport aus. Ein neuer Import benötigt einen ausdrücklichen Auftrag des Benutzers. Codex kann diesen Auftrag über die vorhandene GitHub-Schreibverbindung hinterlegen; neue Zugangsdaten sind nicht nötig.

## Vor jedem Start

Der Import verarbeitet die Startdaten aus `database/seed_essentra_data.json` sowie die PDFs im Ordner `templates`. Er kann bestehende Stammdaten, Einstellungen, Benutzerrollen, Testfragen und PDF-Vorlagen überschreiben. Bestehende Unterweisungsnachweise werden bei gleicher ID nicht überschrieben; fehlende werden ergänzt. Deshalb zuerst Ziel, Auswirkungen und verfügbaren Sicherungsstand prüfen und die ausdrückliche Freigabe einholen. Ein allgemeines „weiter“ bei Website-Arbeiten ist kein Importauftrag.

## Startauftrag hinterlegen

1. Aktuellen `main`-Commit und die zuletzt verwendete Request-ID lesen.
2. Nach der Freigabe eine neue UUID v4 und den aktuellen UTC-Zeitpunkt erzeugen.
3. Ausschließlich `operations/data-import-request.json` in **einem neuen Commit** ändern oder erstmals erstellen. Keine Code-, Workflow-, Daten- oder Vorlagenänderungen im selben Push. `baseSha` muss genau der vorherige `main`-Commit sein.
4. Den Commit ohne Force-Push auf `main` übertragen. Falls `main` zwischenzeitlich geändert wurde: stoppen, Stand erneut prüfen und einen neuen Auftrag aufsetzen.
5. Den dadurch ausgelösten Workflow `Seed Unterweisungsmanager Database` prüfen. Erst nach der getrennten Freigabeprüfung erhält der Importjob Zugriff auf die vorhandenen Datenbank-/Storage-Secrets.

Schema der Startdatei (nur Dokumentation, nicht ausführbarer Startauftrag):

```json
{
  "schemaVersion": 1,
  "requestId": "NEUE-UUID-V4",
  "companyId": "company-essentra",
  "baseSha": "AKTUELLER-MAIN-COMMIT",
  "requestedAt": "AKTUELLER-UTC-ZEITPUNKT-ALS-ISO-8601",
  "confirmation": "IMPORT_START_DATA"
}
```

Die Anfrage darf bei der Prüfung höchstens eine Stunde alt und höchstens fünf Minuten vordatiert sein. Fremde Firmen, andere Branches, Force-Pushes, gemischte Änderungen, eine gegenüber dem vorherigen Auftrag unveränderte Request-ID und Workflow-Wiederholungen werden abgelehnt. Ein fehlgeschlagener oder abgelaufener Auftrag darf nur nach erneuter ausdrücklicher Freigabe als neuer Request gestartet werden. Laufende Importe werden durch neue Aufträge nicht automatisch abgebrochen.

Die Datei ist ein explizites Betriebssignal innerhalb der bestehenden GitHub-Schreibrechte, kein zusätzlicher Authentifizierungsmechanismus. Wer Schreibrechte auf `main` besitzt, kann einen gültigen Auftrag erstellen. Alte Workflow-Läufe behalten ihren damaligen Code; insbesondere alte Importläufe nicht erneut starten.

## Abbruch und Rücknahme

Die aktuelle Codex-GitHub-Anbindung kann einen laufenden Workflow nicht abbrechen. Falls nötig, erfolgt der Abbruch direkt in GitHub Actions über „Cancel workflow“. Ein Abbruch macht bereits abgeschlossene Migrationen, bestätigte Datenimporte oder PDF-Uploads nicht rückgängig. Keine automatische Rücknahme und kein automatischer Neuimport.

## Prüfung ohne Datenzugriff

`npm test` prüft die Workflow-Auslöser und führt den echten Freigabeprüfer ausschließlich in temporären lokalen Git-Repositories mit synthetischen Aufträgen aus. Weder SQL noch Blob Storage werden dabei aufgerufen. Ein erfolgreicher Prüflauf bestätigt den Startschutz, nicht die Wiederherstellbarkeit bereits veränderter Produktivdaten.
