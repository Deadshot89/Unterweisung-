# Sichere Erstzugangs- und Passwort-Setup-Links

Datum: 2026-09-05
Branch: `auth-password-setup-links`

## Ziel

Der Unterweisungsmanager muss einen sicheren Erstzugang ohne funktionierende Microsoft-Anmeldung und ohne bereits eingeloggten Administrator ermöglichen. Gleichzeitig darf es keine offene Registrierung, kein Standardpasswort und keinen öffentlich erratbaren Bootstrap-Pfad geben.

Der gleiche Mechanismus wird anschließend für normale Benutzer wie Andreas Zohren wiederverwendet: Ein Administrator erzeugt einen einmaligen Setup-Link, den der Benutzer zum Festlegen oder Zurücksetzen seines eigenen Passworts verwendet.

## Ausgangslage

- Die zentrale Website besitzt bereits einen E-Mail/Passwort-Login; die vorhandene Microsoft-Authentifizierung bleibt technisch im Backend erhalten, wird im aktuellen Release aber vollständig aus der Loginoberfläche ausgeblendet.
- Der Betreiberzugang ist verbindlich `UnterweisungManagment@outlook.de`.
- Für diesen Betreiberzugang muss ein sicherer Erstzugang funktionieren, auch wenn in Azure SQL noch kein passender `system_admin`-Datensatz vorhanden ist.
- Microsoft Graph Mail ist aktuell nicht konfiguriert; ein reiner E-Mail-Reset würde den Betreiber weiterhin aussperren.
- Passwort-Hashes werden per scrypt gespeichert; Sitzungen sind signiert und versioniert.

## Gewählte Architektur

### 1. Eine zentrale Loginseite

Die bestehende zentrale Website bleibt der einzige interne Einstieg. Im aktuellen Release zeigt die Loginseite ausschließlich `E-Mail und Passwort`. Microsoft-Login wird vorübergehend nicht angeboten und erst in einem späteren, separat getesteten Release wieder sichtbar gemacht.

Ein Aufruf mit gültigem Passwort-Setup-Token zeigt auf derselben Seite den Bereich `Passwort festlegen`. Ein normaler Aufruf ohne gültigen Setup-Token zeigt keine Registrierungsmöglichkeit. Benutzer können sich nicht selbst ein Konto anlegen.

### 2. Kryptografischer Setup-Token

Ein Setup-Link enthält einen zufälligen Token mit 256 Bit Entropie.

Beispielstruktur:

`https://<zentrale-domain>/#passwordSetup=<RAW_TOKEN>`

Der Token liegt bewusst im URL-Fragment (`#...`) und nicht im Query-String. URL-Fragmente werden vom Browser nicht an Azure, API-Endpunkte oder HTTP-Referrer übertragen. JavaScript liest den Token lokal aus `location.hash` und sendet ihn ausschließlich im Body des Setup-POSTs.

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
- 30 Minuten gültig
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

Zusätzlich ergänzt Migration 010 die Passwort-/Sitzungsspalten an `Users`, falls sie fehlen. Die Migration ist additiv und idempotent; bestehende Unterweisungs-, Firmen- und Benutzerdaten werden nicht gelöscht.

### 4. Erstmaliger Betreiber-Bootstrap

Der Betreiber ist fest an die normalisierte E-Mail `unterweisungmanagment@outlook.de` gebunden. Ein starker Roh-Token wird außerhalb des Repositorys erzeugt. Nur dessen SHA-256-Hash wird durch einen kontrollierten, einmaligen Datenbank-Seed gespeichert.

Der Bootstrap arbeitet fail-closed:

- Existiert kein Betreiber-Datensatz, wird genau ein aktiver `system_admin` mit der festgelegten E-Mail an einer vorhandenen aktiven Startfirma angelegt. Als globaler `system_admin` muss er sich nach dem Login trotzdem explizit für eine Firma entscheiden.
- Existiert genau ein Datensatz mit dieser E-Mail und noch ohne Passwort, wird er als aktiver `system_admin` normalisiert.
- Existieren mehrere Datensätze mit dieser E-Mail, ist bereits ein Passwort gesetzt oder existiert keine aktive Startfirma, bricht der Bootstrap ohne Token-Anlage ab.
- Vor dem neuen Seed werden alte unverbrauchte Setup-Tokens dieses Betreiberkontos widerrufen.
- Der Seed akzeptiert ausschließlich `PASSWORD_SETUP_TOKEN_HASH`; Roh-Token und Klartextpasswort sind als Bootstrap-Variablen ausdrücklich verboten.

Der Roh-Token wird ausschließlich dem Betreiber als einmaliger Setup-Link übergeben. Damit wird kein Passwort vorgegeben und kein dauerhafter Bootstrap-Schlüssel benötigt.

### 5. Setup-Endpunkt

Anonymer API-Endpunkt:

`POST /api/auth/password/setup`

Payload:

- `token`
- `password`
- `passwordConfirm`

Serverablauf:

1. Exakte Form des 256-Bit-Base64url-Tokens prüfen und SHA-256 bilden.
2. Token vor der teuren scrypt-Berechnung auf Existenz, Ablauf, Verbrauch und aktiven Benutzer prüfen; ungültige Zufallsanfragen verursachen dadurch keine teure Passwort-Hash-Arbeit.
3. Passwortregeln 10–256 Zeichen und Gleichheit von `password`/`passwordConfirm` anwenden.
4. Passwort mit scrypt hashen.
5. Token und Zielbenutzer innerhalb einer DB-Transaktion erneut mit Sperren laden, um Race Conditions auszuschließen.
6. Bei `initial_password` sicherstellen, dass noch kein Passwort gesetzt wurde.
7. In derselben Transaktion:
   - `passwordHash` aktualisieren
   - `passwordSetAt` setzen
   - Fehlversuche und Sperre zurücksetzen
   - `sessionVersion` erhöhen
   - Provider bei vorhandener AAD-Identität auf `dual`, beim reinen Betreiberzugang auf `password` belassen
   - Token verbrauchen
   - weitere unverbrauchte Setup-Tokens desselben Benutzers widerrufen
8. Sicherheitsereignis ohne Roh-Token oder Passwortdaten schreiben.
9. Keine automatische Anmeldung über den Setup-Link; danach erfolgt die normale Anmeldung über E-Mail und Passwort.

Ungültig, verbraucht oder abgelaufen wird einheitlich behandelt.

### 6. Login-UI für Setup-Link

`auth-login-v42.js` erkennt `passwordSetup` ausschließlich im URL-Fragment der aktuellen Seite.

Bei vorhandenem Token zeigt die zentrale Loginseite statt des normalen Passwortformulars:

- `Passwort festlegen`
- Neues Passwort
- Passwort bestätigen
- Speichern
- Passwortanforderung

Nach Erfolg:

- Fragment und damit der Token werden mit `history.replaceState` aus der Browser-URL entfernt
- eine Erfolgsmeldung erscheint
- das normale E-Mail/Passwort-Login wird wieder angezeigt

Ohne Token zeigt die Seite nur E-Mail und Passwort. Sie weist darauf hin, dass Erstzugang oder Passwort-Reset über einen Administrator-Setup-Link erfolgen. Externe Unterweisungslinks bleiben unabhängig erreichbar.

### 7. Admin-Funktion für weitere Benutzer

Nach erfolgreichem Adminzugang erhält `Benutzer / Rechte` bei berechtigten Zielbenutzern die Aktion:

`Passwort-Setup-Link erstellen`

Geschützter Endpunkt:

`POST /api/users/{id}/password-setup-link`

Berechtigung:

- `system_admin` darf Setup-Links für alle verwaltbaren Benutzer erzeugen.
- `company_admin` darf nur Benutzer der eigenen Firma verwalten.
- Ein `company_admin` darf niemals einen `system_admin` ändern, sperren, zurücksetzen oder einen Setup-Link für ihn erzeugen.
- Der Server lädt die Zielrolle aus der Datenbank; er vertraut dafür nicht auf die Rolle im Request-Body.

Ablauf:

- neue 256-Bit-Zufallsfolge erzeugen
- nur Hash speichern
- bestehende unverbrauchte Setup-Tokens widerrufen
- 30-Minuten-Ablaufzeit setzen
- vollständigen Link genau einmal an den berechtigten Admin zurückgeben

Solange Graph Mail nicht konfiguriert ist, kopiert der Admin den Link manuell und gibt ihn dem Benutzer. Später kann derselbe Mechanismus um Mailversand ergänzt werden, ohne das Tokenmodell zu ändern.

### 8. Sicherheitsgrenzen

- Keine Selbstregistrierung.
- Kein öffentlicher Endpoint, der anhand einer E-Mail-Adresse einen Setup-Link zurückgibt.
- Kein Klartextpasswort in Datenbank, Logs, Auditdaten oder Repository.
- Kein Roh-Setup-Token in Datenbank oder Repository.
- Roh-Token nur im URL-Fragment, nicht im Query-String.
- Token nur einmal als URL an einen berechtigten Empfänger ausgeben.
- Alle Passwortänderungen erhöhen `sessionVersion` und machen bestehende Passwortsitzungen ungültig.
- `company_admin` kann keinen `system_admin` verwalten.
- Mandantenfilter werden serverseitig durchgesetzt.
- Normales Passwort-Login behält Fehlversuchsschutz: fünf Fehlversuche führen zu 30 Minuten Sperre.
- Der vollständige Arbeitsbereich bleibt bis erfolgreicher Anmeldung und gültigem Firmenkontext physisch verborgen.

### 9. Tests

TDD-Verträge decken mindestens ab:

1. Setup-Token-Hashing: Roh-Token wird nie persistiert.
2. Ungültiger, abgelaufener oder verbrauchter Token wird abgelehnt.
3. Ungültige Tokens werden vor scrypt abgewiesen.
4. `initial_password` funktioniert nur solange noch kein Passwort gesetzt ist.
5. Erfolgreiche Passwortsetzung setzt scrypt-Hash, `passwordSetAt`, Provider und erhöht `sessionVersion`.
6. Erfolgreiche Passwortsetzung verbraucht/widerruft Setup-Tokens.
7. Setup-Seite liest den Token aus dem URL-Fragment und entfernt ihn nach Erfolg.
8. Microsoft-Login ist im aktuellen Release nicht Bestandteil der Login-UI.
9. Admin-Link-Erzeugung ist mandantengebunden.
10. `company_admin` kann niemals einen `system_admin` verwalten oder zurücksetzen.
11. Benutzerlisten geben nur `passwordEnabled`, niemals Hashes aus.
12. Audit- und Security-Events enthalten keine Passwort-/Token-Rohdaten.
13. Betreiber-Bootstrap akzeptiert ausschließlich den Token-Hash und ist an die festgelegte Betreiber-E-Mail gebunden.
14. Anonymer Zugriff auf Dashboard/Firmendaten bleibt gesperrt.

### 10. Rollout

Reihenfolge:

1. Produktcode, Migration und Bootstrap auf dem Feature-Branch vollständig implementieren.
2. Vollständige Tests und API-Syntaxprüfungen grün.
3. Bereinigten Kandidaten auf `main` freigeben und die eine zentrale Website deployen.
4. Migration 010 auf Azure SQL ausführen.
5. Erst unmittelbar danach einen neuen 256-Bit-Roh-Token außerhalb GitHubs erzeugen und nur dessen SHA-256-Hash seeden.
6. Einmaligen Setup-Link ausschließlich dem Betreiber übergeben.
7. Betreiber setzt sein Passwort und meldet sich mit `UnterweisungManagment@outlook.de` an.
8. Systemadmin-Firmenauswahl und Live-Sitzung verifizieren.
9. Danach weitere Benutzer wie Andreas über `Benutzer / Rechte` mit Setup-Link versorgen.

## Nicht im Scope

- Offene Benutzerregistrierung
- Klartext- oder Standardpasswörter
- Sichtbarer Microsoft-Login im aktuellen Release
- Vollständige Microsoft-Graph-Mail-Einrichtung
- Separate Firmen- oder Login-Websites

## Erfolgskriterium

Der Betreiber kann auf der einzigen zentralen Website ohne Microsoft-Login über einen einmaligen Setup-Link sein eigenes Systemadmin-Passwort setzen und sich danach regulär mit `UnterweisungManagment@outlook.de` und seinem selbst gewählten Passwort anmelden. Anschließend kann er für Andreas Zohren und andere berechtigte Benutzer sichere, einmalige Passwort-Setup-Links erzeugen.