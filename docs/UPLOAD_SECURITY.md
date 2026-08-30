# Nachweis-Upload: Sicherheitskonzept v0.7

## Ziel

Unterweisungsnachweise sollen sicher hochgeladen, privat gespeichert, revisionsfähig verknüpft und nur berechtigt heruntergeladen werden.

## Erlaubte Dateien

Aktuell erlaubt:

- PDF (`application/pdf`)
- JPG/JPEG (`image/jpeg`)
- PNG (`image/png`)
- WEBP (`image/webp`)

Nicht erlaubt:

- Office-Dateien mit Makros
- ZIP/RAR/7z
- HTML/SVG/JS
- ausführbare Dateien
- unbekannte oder manipulierte Dateiendungen

## Prüfungen im Backend

Beim Upload prüft die API:

1. Dateiname wird bereinigt.
2. Endung muss erlaubt sein.
3. Content-Type muss zur Endung passen.
4. Dateiinhalt wird über Magic Bytes geprüft.
5. Größe darf `UPLOAD_MAX_MB` nicht überschreiten.
6. SHA-256 Hash wird gespeichert.
7. Datei wird nur in privaten Blob Container geschrieben.
8. Datei wird mit Datensatz oder Gruppe verknüpft.
9. Audit-Log wird geschrieben.

## Scanstatus

Jede Datei bekommt einen `scanStatus`:

| Status | Bedeutung |
|---|---|
| `pending` | Datei wartet auf Scan / Kontrolle |
| `clean` | Datei wurde geprüft und freigegeben |
| `not_configured` | Scan ist noch nicht angebunden |
| `quarantined` | Datei wurde isoliert |
| `blocked` | Datei ist gesperrt |

Downloads werden blockiert bei:

- `status = blocked`
- `scanStatus = quarantined`
- `scanStatus = blocked`

## Empfohlene Produktionserweiterung

Für echten SaaS-Verkauf sollte zusätzlich aktiviert werden:

- Microsoft Defender for Storage Malware Scanning
- Blob Soft Delete
- Blob Versioning
- Storage private endpoint oder restriktive Netzwerkregeln
- Logging aller Downloads
- Alarm bei `quarantined` oder ungewöhnlich vielen Uploads

## API-Endpunkte

### Nachweis hochladen

`POST /api/proof-files`

JSON-Beispiel:

```json
{
  "recordId": "instruction-record-id",
  "fileName": "Nachweis.pdf",
  "contentType": "application/pdf",
  "base64": "JVBERi0xLjQ..."
}
```

Für Gruppenunterweisung:

```json
{
  "groupId": "group-id",
  "fileName": "Gruppennachweis.pdf",
  "contentType": "application/pdf",
  "base64": "JVBERi0xLjQ..."
}
```

### Nachweise auflisten

`GET /api/proof-files?recordId=<id>`

oder

`GET /api/proof-files?groupId=<id>`

### Scanstatus setzen

`PATCH /api/proof-files/{fileId}`

```json
{
  "scanStatus": "clean",
  "scanProvider": "manual"
}
```

### Datei herunterladen

`GET /api/files/{fileId}/download`

Antwort enthält eine kurzlebige SAS-URL für privaten Blob-Download.
