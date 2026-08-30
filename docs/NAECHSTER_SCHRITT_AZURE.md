# Nächster Schritt nach v3

1. Azure SQL erstellen.
2. Storage Account erstellen.
3. Migrationen ausführen.
4. Essentra-Seed importieren.
5. PDF-Vorlagen in Blob Storage hochladen.
6. API `/api/health` prüfen.
7. Azure Static Web App mit GitHub verbinden.
8. Application Settings setzen:
   - `SQL_CONNECTION_STRING`
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `BLOB_CONTAINER`
   - `DEFAULT_COMPANY_ID`
   - `APP_BASE_URL`

Danach bauen wir die echten produktiven Funktionen:

- Nachweisupload
- externe Unterweisungsseite
- Abschluss speichert automatisch Unterweisung + Test + Nachweis
- Microsoft Graph Mailversand
- produktiver Entra Login
