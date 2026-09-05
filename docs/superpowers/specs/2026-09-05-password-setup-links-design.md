# Sichere Erstzugangs- und Passwort-Setup-Links

Datum: 2026-09-05
Branch: `auth-password-setup-links`

## Ziel

Der Unterweisungsmanager muss einen sicheren Erstzugang ohne funktionierende Microsoft-Anmeldung und ohne bereits eingeloggten Administrator ermöglichen. Gleichzeitig darf es keine offene Registrierung, kein Standardpasswort und keinen öffentlich erratbaren Bootstrap-Pfad geben.

Der gleiche Mechanismus soll anschließend für normale Benutzer wie Andreas Zohren wiederverwendet werden: Ein Administrator erzeugt einen einmaligen Setup-Link, den der Benutzer zum Festlegen oder Zurücksetzen seines eigenen Passworts verwendet.

## Ausgangslage

- Die zentrale Website besitzt bereits Microsoft- sowie E-Mail/Passwort-Login.
- Das vorhandene `system_admin`-Konto kann derzeit über Microsoft nicht zuverlässig freigeschaltet werden.
- Für dieses Konto ist noch kein nutzbares Passwort gesetzt.
- Der Microsoft-Graph-Mailversand ist aktuell nicht konfiguriert; ein reiner E-Mail-Reset würde den Betreiber weiterhin aussperren.
- Passwort-Hashes werden bereits per scrypt gespeichert; Sitzungen sind signiert und versioniert.

## Gewählte Architektur

### 1. Eine zentrale Loginseite

Die bestehende zentrale Website bleibt der einzige interne Einstieg. Auf der Loginseite wird neben Microsoft und E-Mail/Passwort ein Bereich `Erstzugang / Passwort festlegen` integriert.

Ein normaler Aufruf ohne gültigen Setup-Token zeigt keine Registrierungsmöglichkeit. Der Benutzer kann sich nicht selbst ein Konto anlegen.

### 2. Kryptografischer Setup-Token

Ein Setup-Link enthält einen zufälligen Token mit mindestens 256 Bit Entropie.

Beispielstruktur:

`https://<zentrale-domain>/?passwordSetup=<RAW_TOKEN>`

Der Roh-Token wird niemals in der Datenbank und niemals im Repository gespeichert. Persistiert wird ausschließlich:

- SHA-256-Hash des Tokens
- Zielbenutzer
- Zielunternehmen
- Zweck (`initial_password` oder `password_reset`)
- Ablaufzeit
- Erstellzeit
- Verbrauchszeit
- Erstellerkennung, soweit vorhanden

Ein Token ist:

- nur einmal verwendbar
- standardmäßig 30 Minuten gültig
- an genau einen Benutzer gebunden
- nach erfolgreicher Passwortsetzung sofort verbraucht
- nach Ablauf unbrauchbar

### 3. Datenmodell

Neue Tabelle `PasswordSetupTokens`:

- `id` NVARCHAR(80), Primary Key
- `userId` NVARCHAR(120), NOT NULL
- `companyId` NVARCHAR(80), NOT NULL
- `tokenHash` NVARCHAR(128), NOT NULL, UNIQUE
- `purpose` NVARCHAR(30), NOT NULL
- `expiresAt` DATETIME2, NOT NULL
- `usedAt` DATETIME2, NULL
- `createdBy` NVARCHAR(120), NULL
- `createdAt` DATETIME2, NOT NULL

Indizes unterstützen die Suche nach Token-Hash und Zielbenutzer.

Die Migration ist additiv und idempotent. Bestehende Benutzer-, Rollen- und Unterweisungsdaten werden nicht verändert.

### 4. Erstmaliger Betreiber-Bootstrap

Für den bereits vorhandenen `system_admin` ohne Passwort wird einmalig ein starker Roh-Token außerhalb des Repositorys erzeugt. Nur dessen SHA-256-Hash wird durch einen kontrollierten, einmaligen Datenbank-Seed in `PasswordSetupTokens` gespeichert.

Der Roh-Token wird ausschließlich dem Betreiber im Chat als Setup-Link übergeben.

Der Seed darf nur dann eine Zeile anlegen, wenn:

- genau ein aktiver `system_admin` ohne gesetztes Passwort existiert
- noch kein unverbrauchter `initial_password`-Token für diesen Benutzer existiert

Bei abweichendem Zustand bricht der Seed ohne Änderung ab.

Damit wird kein Passwort vorgegeben und kein dauerhafter Bootstrap-Schlüssel benötigt.

### 5. Setup-Endpunkt

Neuer anonymer API-Endpunkt:

`POST /api/auth/password/setup`

Payload:

- `token`
- `password`
- `passwordConfirm`

Serverablauf:

1. Token normalisieren und SHA-256 bilden.
2. Tokenzeile plus Zielbenutzer laden.
3. Prüfen: nicht benutzt, nicht abgelaufen, Benutzer aktiv.
4. Bei `initial_password` zusätzlich sicherstellen, dass der Benutzer noch kein Passwort gesetzt hat.
5. Passwortregeln 10–256 Zeichen anwenden.
6. Passwort mit bestehendem scrypt-Verfahren hashen.
7. In einer DB-Transaktion:
   - `passwordHash` aktualisieren
   - `passwordSetAt` setzen
   - Fehlversuche und Sperre zurücksetzen
   - `sessionVersion` erhöhen
   - Provider auf `dual` setzen, sofern Microsoft-Zugang bestehen bleibt
   - Token `usedAt` setzen
   - weitere unverbrauchte Setup-Tokens desselben Benutzers widerrufen
8. Sicherheitsereignis schreiben.
9. Keine automatische Anmeldung über den Setup-Link; danach erfolgt normale Anmeldung über die zentrale Loginseite.

Fehlermeldungen geben keine sensiblen Kontodetails preis. Ungültig, verbraucht oder abgelaufen wird einheitlich behandelt.

### 6. Login-UI für Setup-Link

`auth-login-v42.js` erkennt `passwordSetup` in der aktuellen URL.

Bei vorhandenem Token zeigt die zentrale Loginseite statt des normalen Passwortformulars einen fokussierten Bereich:

- `Passwort festlegen`
- Neues Passwort
- Passwort bestätigen
- Speichern
- verständliche Passwortanforderung

Nach Erfolg:

- Token wird aus der Browser-URL entfernt
- Erfolgsmeldung erscheint
- normales E-Mail/Passwort-Login wird wieder angezeigt

Der Token darf nicht in Logs, Analytics, Fehlertexte oder DOM-Debug-Ausgaben geschrieben werden.

### 7. Admin-Funktion für weitere Benutzer

Nach erfolgreichem Adminzugang erhält `Benutzer / Rechte` bei berechtigten Zielbenutzern die Aktion:

`Passwort-Setup-Link erstellen`

Neuer geschützter Endpunkt:

`POST /api/users/{id}/password-setup-link`

Berechtigung:

- `system_admin` darf Setup-Links für alle verwaltbaren Benutzer erzeugen.
- `company_admin` darf nur Benutzer der eigenen Firma verwalten.
- Ein `company_admin` darf niemals einen `system_admin` ändern, sperren, zurücksetzen oder einen Setup-Link für ihn erzeugen.

Ablauf:

- neue 256-Bit-Zufallsfolge erzeugen
- nur Hash speichern
- bestehende unverbrauchte Setup-Tokens des Zielbenutzers widerrufen
- 30-Minuten-Ablaufzeit setzen
- vollständigen Link genau einmal an den berechtigten Admin zurückgeben

Solange Graph-Mail nicht konfiguriert ist, kopiert der Admin den Link manuell und gibt ihn dem Benutzer. Sobald Mail später verfügbar ist, kann derselbe Mechanismus um Mailversand ergänzt werden, ohne das Tokenmodell zu ändern.

### 8. Sicherheitsgrenzen

- Keine Selbstregistrierung.
- Kein Endpoint, der anhand einer E-Mail-Adresse öffentlich einen Setup-Link zurückgibt.
- Kein Klartextpasswort in Datenbank, Logs oder Repository.
- Kein Roh-Setup-Token in Datenbank oder Repository.
- Token wird nur einmal als URL an den berechtigten Empfänger ausgegeben.
- Alle Passwortänderungen erhöhen `sessionVersion` und machen bestehende Passwortsitzungen ungültig.
- `company_admin` kann keinen `system_admin` verwalten.
- Mandantenfilter werden serverseitig durchgesetzt.
- Rate-Limit-/Fehlversuchsschutz des normalen Passwort-Logins bleibt unverändert.

### 9. Tests

TDD-Verträge müssen mindestens abdecken:

1. Setup-Token-Hashing: Roh-Token wird nie persistiert.
2. Ungültiger Token wird abgelehnt.
3. Abgelaufener Token wird abgelehnt.
4. Bereits verbrauchter Token wird abgelehnt.
5. `initial_password` funktioniert nur, solange noch kein Passwort gesetzt ist.
6. Erfolgreiche Passwortsetzung setzt scrypt-Hash, `passwordSetAt`, Provider und erhöht `sessionVersion`.
7. Erfolgreiche Passwortsetzung verbraucht bzw. widerruft alle Setup-Tokens des Benutzers.
8. Setup-Seite zeigt Passwort + Bestätigung und entfernt Token nach Erfolg aus der URL.
9. Admin-Link-Erzeugung ist mandantengebunden.
10. `company_admin` kann niemals einen `system_admin` zurücksetzen.
11. Das normale Login mit dem neu gesetzten Passwort funktioniert anschließend.
12. Anonymer Zugriff auf Dashboard/Firmendaten bleibt weiterhin gesperrt.

### 10. Rollout

Reihenfolge:

1. Migration und API/UI auf einem Feature-Branch implementieren.
2. Vollständige Tests grün.
3. Additive Migration auf Azure SQL ausführen.
4. Produktcode auf die eine zentrale Produktionsseite deployen.
5. Einmaligen `initial_password`-Token für den bestehenden Systemadmin seeden.
6. Roh-Link ausschließlich dem Betreiber übergeben.
7. Betreiber setzt eigenes Passwort.
8. Live-Login mit E-Mail/Passwort verifizieren.
9. Erst danach weitere Benutzer wie Andreas über die Admin-Funktion mit Setup-Link versorgen.

## Nicht im Scope

- Offene Benutzerregistrierung
- Klartext- oder Standardpasswörter
- Zwang zu Microsoft für den Erstzugang
- Vollständige Microsoft-Graph-Mail-Einrichtung
- Separate Firmen- oder Login-Websites

## Erfolgskriterium

Der Betreiber kann auf der einzigen zentralen Website ohne Microsoft-Login über einen einmaligen Setup-Link sein eigenes Systemadmin-Passwort setzen und sich danach regulär mit E-Mail/Passwort anmelden. Anschließend kann er für Andreas Zohren und andere berechtigte Benutzer sichere, einmalige Passwort-Setup-Links erzeugen.