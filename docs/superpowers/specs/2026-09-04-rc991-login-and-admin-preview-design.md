# RC991 Login-Shell und Admin-Unterweisungsvorschau – Design

**Datum:** 2026-09-04  
**Ziel-Branch:** `rc991-unified-learning-portal`  
**Status:** vom Benutzer im Chat freigegeben; Umsetzung bleibt von `main` getrennt.

## Ziel

RC991 erhält einen einzigen vorgeschalteten internen Loginbereich für Microsoft Entra sowie E-Mail/Passwort und eine echte read-only Admin-Unterweisungsvorschau. Beide Funktionen müssen die bestehende Rollen- und Mandantensicherheit unverändert respektieren. `main` bleibt bis zu einer separaten Freigabe unverändert.

## Ausgangslage

- Der Branch `rc991-unified-learning-portal` enthält bereits Dual-Auth-Backend und Passwort-Login-UI im Mitarbeiterportal.
- Die Hauptanwendung zeigt im nicht angemeldeten Zustand weiterhin einen separaten Microsoft-only Login.
- Der Admin-Knopf „Öffnen“ selektiert aktuell nur den Datensatz und scrollt zur Detailansicht; er öffnet keine echte Lernansicht.
- Der neue Admin-Vorschauvertrag ist bereits als RED-Test vorhanden.
- Systemadmins müssen nach erfolgreicher Anmeldung zuerst einen Mandanten auswählen; normale Firmenrollen bleiben auf ihre eigene Firma beschränkt.

## Login-Shell

### Einziger interner Einstieg

Vor bestätigter Authentifizierung wird ausschließlich eine zentrale Login-Shell angezeigt. Hauptnavigation, Dashboard, Firmenkontext und Fachdaten bleiben verborgen.

Die Login-Shell bietet genau zwei gleichwertige interne Anmeldewege:

1. **Mit Microsoft anmelden** über den bestehenden Azure-Static-Web-Apps-/Entra-Pfad `/.auth/login/aad`.
2. **E-Mail und Passwort** über den bestehenden Endpoint `/api/auth/password/login`.

Beide Wege lösen anschließend dieselbe Benutzeridentität, Rolle und Firmenberechtigung auf. Es gibt keinen separaten Funktionsumfang je Loginart.

### Passwort-Login

Die vorhandene Passwort-Authentifizierung wird wiederverwendet; es wird kein zweites Auth-System gebaut.

Die Login-Shell enthält:
- E-Mail-Feld mit `autocomplete="username"`
- Passwortfeld mit `autocomplete="current-password"`
- Absenden ohne Seitenwechsel bis zur erfolgreichen Authentifizierung
- verständliche Fehlermeldung direkt im Loginbereich
- Reload/Weiterleitung nach erfolgreichem Login, sodass `/api/me` erneut sauber aufgelöst wird

Passwörter werden niemals im Frontend gespeichert oder protokolliert.

### Logout

Die bestehende Abmeldung muss beide Sitzungsarten sauber beenden:
- Passwort-Session-Cookie über `/api/auth/password/logout`
- Azure-/Entra-Sitzung über `/.auth/logout`

Die UI darf nach Logout keine vorherigen Firmen- oder Fachdaten sichtbar lassen.

## Rollen- und Firmenfluss nach Login

### `system_admin`

Ablauf:

`Login → Firmenauswahl → Firma öffnen → Firmen-Dashboard`

Vor einer Firmenauswahl wird kein Fachbootstrap geladen. Erst die explizite Auswahl setzt `state.companyId`.

### `company_admin` / `hse`

Direkter Einstieg in die serverseitig erlaubte eigene Firma. Keine globale Firmenauswahl.

### `line_manager` / `employee`

Direkter Einstieg in die serverseitig erlaubte Firma und rollenbezogene Oberfläche. Team-/Mitarbeitergrenzen bleiben wie im vorhandenen Zugriffskonzept.

### Externe Unterweisungen

Externe Einmal-/Persönlichkeitslinks bleiben vollständig unabhängig vom internen Login und benötigen weder Microsoft- noch internes Passwortkonto.

## Auth-Shell-Verhalten

Die bestehende zentrale Auth-Shell bleibt die sichtbare Zustandssteuerung:
- `auth-pending`: Identität wird geprüft; kein Fachinhalt sichtbar.
- `auth-required`: zentrale Dual-Login-Shell sichtbar; kein Fachinhalt sichtbar.
- `auth-authenticated`: Login-Shell verborgen; danach Rollen-/Firmenfluss.

Es darf keinen parallelen zweiten Loginbereich mehr geben. Der vorhandene Dual-Login-Renderer aus dem Mitarbeiterportal wird entweder als gemeinsame UI-Funktion wiederverwendet oder in ein fokussiertes gemeinsames Auth-Modul verschoben. Unabhängig von der konkreten Dateigrenze existiert nur ein sichtbarer interner Loginzustand.

## Admin-Unterweisungsvorschau

### Zweck

Der Admin-/HSE-Knopf **„Öffnen“** zeigt die Unterweisung so, wie ein Mitarbeiter sie inhaltlich erleben würde, jedoch strikt ohne Lern- oder Prüfungszustand zu verändern.

### Inhalt

Die Vorschau zeigt, soweit für die Unterweisung vorhanden:
- Titel und Metadaten
- Lernschritte in Reihenfolge
- Schritttexte
- Bilder über die bereits autorisierte Datei-Downloadlogik
- Praxisbezug
- Merkpunkte
- Testfragen und Antwortoptionen
- Verweis auf die Originalunterlage

Die Darstellung nutzt möglichst dieselben read-only Rendering-Bausteine wie die Mitarbeiter-Lernansicht, damit Vorschau und reale Lernansicht nicht auseinanderlaufen.

### Strikter Read-only-Modus

Die Admin-Vorschau darf niemals:
- einen Trainingsversuch anlegen
- `currentStep` speichern
- Lernfortschritt aktualisieren
- Testantworten absenden
- einen Testabschluss erzeugen
- einen Unterweisungsnachweis erzeugen
- einen Datensatz als abgeschlossen markieren

Insbesondere darf die Vorschau keine POST-/PUT-/PATCH-/DELETE-Aufrufe an Trainings-, Abschluss- oder Nachweisendpunkte auslösen.

### Datenquelle

Die Vorschau verwendet vorhandene autorisierte Admin-/Learning-Endpunkte und lädt nur Daten, die zur aktiven Firma gehören. Fehlende Bilder/Unterlagen werden über das bereits gehärtete `blob_missing`-Verhalten verständlich angezeigt; rohe Azure-XML-Seiten dürfen nicht erscheinen.

## Sicherheitsgrenzen

- Der Server bleibt Autorität für Rolle und `companyId`.
- Fremde `x-company-id`-Anforderungen normaler Firmenbenutzer bleiben 403.
- Direkte Datei-IDs umgehen keine Firmen-/Rollenprüfung.
- Login-UI-Hiding ersetzt niemals API-Autorisierung.
- Keine Migration, kein Seed, kein Datenimport und keine automatische Datenreparatur in diesem Block.

## Geplante Dateigrenzen

Voraussichtlich werden nur die vorhandenen fokussierten Bereiche angepasst:
- `frontend/auth-shell-v40.js` – gemeinsamer sichtbarer Auth-Zustand
- `frontend/employee-portal-v37.js` – vorhandene Passwort-Loginlogik wiederverwenden/entkoppeln, keine zweite sichtbare Login-Shell
- `frontend/app.js` – `renderAuthenticationRequired()` auf die zentrale Login-Shell routen
- `frontend/learning-admin-v38.js` – echtes Öffnen der read-only Vorschau
- `frontend/learning-experience-v38.js` und/oder ein kleines gemeinsames Lern-Rendering-Modul nur falls nötig, um Darstellung ohne Schreibaktionen wiederzuverwenden
- vorhandene Tests unter `tests/` plus gezielte neue Auth-/Preview-Verträge

Große, sachfremde Refactorings sind ausdrücklich nicht Bestandteil von RC991.

## Fehlerbehandlung

- 401/403 im initialen Identitätscheck → Login-Shell statt Fachoberfläche.
- Falsche E-Mail/Passwort-Kombination → verständliche Inline-Meldung, keine Datenanzeige.
- Temporär gesperrtes Passwortkonto → Backendmeldung verständlich anzeigen; keine Umgehung über Frontendlogik.
- API-Ausfall nach bestätigtem Login → vorhandene Service-Unavailable-Ansicht; keine Offline-/Fremddaten.
- Fehlende Lernabbildung/Unterlage → verständlicher Fehler innerhalb der Vorschau; keine Azure-XML-Ausgabe.

## TDD- und Abnahmekriterien

Der Block gilt erst als fertig, wenn mindestens folgende Verträge automatisiert grün sind:

1. Ohne bestätigte Authentifizierung sind Navigation und Fachansichten nicht sichtbar.
2. Der sichtbare Loginbereich enthält Microsoft **und** E-Mail/Passwort.
3. Es existiert nicht gleichzeitig ein zweiter separater interner Loginbereich.
4. Erfolgreicher Passwort-Login führt nach erneuter Identitätsauflösung in denselben Rollen-/Firmenfluss wie Microsoft.
5. Passwort-Fehler bleiben im Loginbereich und geben keine internen Details preis.
6. Systemadmin lädt vor Firmenauswahl keinen Fachbootstrap.
7. Nicht-Systemadmins können weiterhin keinen fremden Mandanten erzwingen.
8. Admin/HSE „Öffnen“ startet eine echte Lernvorschau statt nur zu scrollen.
9. Vorschau zeigt Lernschritte, Bilder/Praxisbezug/Merkpunkte und Testfragen, soweit vorhanden.
10. Vorschau führt keine Trainingsfortschritts-, Testabschluss- oder Nachweis-Schreiboperation aus.
11. Fehlende Dateien zeigen die vorhandene verständliche `blob_missing`-Meldung.
12. Alle bestehenden RC991-, Mandanten-, Auth-, Lern-, Planungs- und Downloadtests bleiben grün.
13. Der vollständige Workflow muss GREEN sein, bevor Essentra und Kontur den gemeinsamen Stand übernehmen.
14. `main` bleibt auf seinem bisherigen freigegebenen Stand, bis eine separate Produktionsfreigabe erfolgt.

## Release-Reihenfolge

1. Vorhandenen RED-Test für echte Admin-Unterweisungsvorschau GREEN machen.
2. Auth-Shell-Vertrag für einen gemeinsamen Dual-Login RED schreiben.
3. Login-Shell minimal implementieren und GREEN machen.
4. Gezielte Regressionstests ausführen.
5. Vollständige RC991-Suite/Workflow ausführen.
6. Erst bei vollständig GREEN den gemeinsamen geprüften Stand kontrolliert in `company/essentra-components` und `company/kontur-werkzeugstahl` übernehmen.
7. `main` nicht verändern.
