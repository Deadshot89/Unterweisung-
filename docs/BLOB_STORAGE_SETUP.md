# Blob Storage Setup

## Ziel

PDF-Vorlagen und Nachweise gehören nicht in die HTML-Datei. Sie werden privat in Azure Blob Storage gespeichert.

## Struktur im Container

```text
unterweisungsmanager/
  company-essentra/
    templates/
      Unterweisungsnachweis ...pdf
    certificates/
      <jahr>/<monat>/<nachweis>.pdf
    uploads/
      <dateien>
```

## Import der vorhandenen Vorlagen

```bash
export AZURE_STORAGE_CONNECTION_STRING="..."
export SQL_CONNECTION_STRING="..."
export BLOB_CONTAINER="unterweisungsmanager"
export COMPANY_ID="company-essentra"
npm run blob:upload-templates
```

Das Skript lädt alle PDFs aus `templates/` hoch und aktualisiert `Templates.blobPath` in Azure SQL.

## Sicherheit

- Container bleibt privat.
- Downloads laufen über kurzlebige SAS-Links.
- Nachweise bekommen später getrennte Pfade.
- Soft Delete und Versioning sollen im Storage Account aktiviert werden.
