# Mehrmandanten-, Firmenbranch- und Admin-Auswahl-Design

## Ziel

Der Unterweisungsmanager wird für mehrere Firmen so strukturiert, dass Systemadministratoren nach dem Login zuerst bewusst einen Firmenkontext auswählen, alle Fachfunktionen danach ausschließlich in diesem Kontext arbeiten und firmenspezifische Codewünsche zusätzlich in getrennten GitHub-Branches gepflegt werden können. Gleichzeitig wird das Öffnen von Unterweisungsunterlagen gegen fehlende Azure-Blobs gehärtet, sodass keine rohe `BlobNotFound`-XML-Seite mehr beim Benutzer erscheint.

## Aktuelle Firmen

1. **Essentra Components GmbH**
   - GitHub-Branch: `company/essentra-components`
2. **Kontur Werkzeugstahl GmbH**
   - GitHub-Branch: `company/kontur-werkzeugstahl`

Beide Firmen sind echte Mandanten. Mitarbeiter, Unterweisungen, Lernschritte, Nachweise, Planungen, Einladungen, Benutzer, Mailkonfigurationen und Dateien bleiben in Azure SQL/Blob über `companyId` voneinander getrennt. GitHub-Branches trennen ausschließlich kundenspezifische Code-, Design- oder Funktionsabweichungen.

## GitHub-Struktur

- `main`: stabiler gemeinsamer Produktkern.
- `rc...` / `feature/...`: gemeinsame Produktentwicklung und Release-Kandidaten.
- `demo/company-showcase`: vollständig isolierte öffentliche Demo.
- `company/essentra-components`: Essentra-spezifische Anpassungen.
- `company/kontur-werkzeugstahl`: Kontur-spezifische Anpassungen.

Die beiden Firmenbranches werden zunächst vom aktuell geprüften RC991-Stand abgeleitet, damit beide denselben neuen Lern-/Portal-Kern erhalten. Allgemeine Fehlerkorrekturen und wiederverwendbare Funktionen werden im gemeinsamen Produktkern entwickelt und anschließend kontrolliert in die Firmenbranches übernommen. Ausschließlich kundenspezifische Anforderungen verbleiben im jeweiligen `company/...`-Branch.

Kein Firmenbranch darf automatisch nach `main` gemergt werden. Produktionsfreigaben bleiben explizite Entscheidungen.

## Systemadmin-Ablauf

### Nach dem Login

Ein Benutzer mit Rolle `system_admin` darf nicht mehr automatisch in eine Standardfirma fallen. Der Ablauf ist:

`Login → Firmenauswahl → Firma öffnen → Firmen-Dashboard`

Die Firmenauswahl zeigt alle aktiven Mandanten, aktuell Essentra Components GmbH und Kontur Werkzeugstahl GmbH. Erst nach bewusster Auswahl wird `state.companyId` gesetzt und der fachliche Bootstrap geladen.

### Firmenkontext

Nach Auswahl wird der aktive Firmenname dauerhaft und deutlich im Header/Systembereich angezeigt. Zusätzlich gibt es für Systemadmins eine Aktion **„Firma wechseln“**, die den fachlichen Zustand leert und zurück zur Firmenauswahl führt.

Beim Firmenwechsel werden mindestens zurückgesetzt:
- Bootstrap-/Fachdaten
- Statusdaten
- Benutzerlisten
- Mailkonfiguration
- Admin-/Editor-Caches
- Lern-/Planungszustände, soweit im Frontend vorhanden

Danach werden alle Daten neu mit dem gewählten `x-company-id` geladen.

### Nicht-Systemadmins

`company_admin`, `hse`, `line_manager` und `employee` sehen keine globale Firmenauswahl. Sie landen direkt in der ihnen serverseitig zugeordneten Firma. Sie dürfen keinen fremden `x-company-id`-Kontext erzwingen.

## Authentifizierungs- und API-Regel

Der Server bleibt die Autorität für Mandant und Rolle.

Für `system_admin` gilt:
- `/api/me` darf den Benutzer identifizieren, ohne ihn fachlich an die Default-Firma zu binden.
- Eine Firmenliste für die Auswahl kommt aus der vorhandenen Systemadmin-Firmen-API.
- Fachendpunkte benötigen danach einen expliziten gültigen Firmenkontext.
- Ein Systemadmin darf einen aktiven Mandanten auswählen.

Für alle anderen Rollen gilt:
- der Server ignoriert bzw. verweigert einen fremden angeforderten Mandanten und verwendet nur die erlaubte Firma.

Die bestehende `allowedCompanies`-/Rollenlogik bleibt Grundlage und wird nicht durch reine Frontend-Prüfungen ersetzt.

## UI der Firmenauswahl

Die Auswahl ist eine eigene vorgeschaltete Ansicht, nicht nur ein kleines Select-Feld im Dashboard.

Jede Firmenkarte zeigt mindestens:
- Firmenname
- Mandanten-ID
- Status aktiv/inaktiv
- optional Kennzahlen, wenn sie bereits ohne Fachbootstrap verfügbar sind
- Aktion **„Firma öffnen“**

Die normale Hauptnavigation bleibt für Systemadmins verborgen oder deaktiviert, solange noch keine Firma gewählt ist. Dadurch kann kein Fachbereich versehentlich mit einer Default-Firma laden.

## Unterweisungen öffnen / BlobNotFound

Der gemeldete Fehler zeigt, dass die Datenbank einen Datei-/Blobverweis kennt, dessen Blob im Storage nicht mehr existiert oder unter einem falschen Pfad liegt.

### Gewünschtes Verhalten

Beim Öffnen einer Unterlage oder Lernabbildung:
1. API prüft Datei-Metadaten und Berechtigung wie bisher.
2. Vor Ausgabe des Downloadlinks wird geprüft, ob der Blob tatsächlich existiert.
3. Fehlt der Blob, liefert die API einen strukturierten 404/410-Fehler mit verständlichem Code, z. B. `blob_missing`, statt eine SAS-URL auf einen nicht vorhandenen Blob auszugeben.
4. Das Frontend öffnet nur bei erfolgreicher API-Antwort ein neues Fenster.
5. Bei `blob_missing` erscheint im Firmen-Admin/HSE-Bereich eine klare Meldung: **„Unterlage fehlt im Dateispeicher. Bitte Datei neu hochladen oder ersetzen.“**
6. In der Unterweisungsverwaltung wird die betroffene Unterlage als **„Datei fehlt“** gekennzeichnet und es wird direkt die Aktion **„Ersetzen“** angeboten.
7. Normale Mitarbeiter/externe Lernende sehen keine Azure-XML-Fehlerdetails.

### Keine automatische Datenreparatur

Dieser Block führt keine Migration, keinen Seed, keinen Import und keine automatische Löschung/Reparatur bestehender Dateidatensätze aus. Defekte Verweise werden sichtbar gemacht; die eigentliche Datei wird anschließend bewusst ersetzt.

## Azure-/Domain-Zielbild

Kurzfristig kann die gemeinsame Preview-/Plattformumgebung weiterbestehen. Die Branch-Struktur erlaubt später pro Firma eigene Azure-Deployments und Domains, ohne die Mandantentrennung in der Anwendung aufzugeben.

Zielbild:
- gemeinsame Plattform und gemeinsamer Produktkern
- optional eigenes Deployment / eigene Domain je Firma
- getrennte Konfiguration/Secrets je Deployment
- dieselbe serverseitige `companyId`-Sicherheitslogik

## Nicht Bestandteil dieses Blocks

Der bereits beschlossene KI-Bildworkflow (`automatisch erzeugen + neu erzeugen + eigenes Bild hochladen`) wird als eigener Folgeblock umgesetzt. Er baut auf der hier stabilisierten Firmen-/Dateistruktur auf.

## Tests / Abnahmekriterien

Der Block gilt erst als fertig, wenn automatisiert nachgewiesen ist:

1. Systemadmin bekommt nach Login zuerst die Firmenauswahl.
2. Essentra und Kontur erscheinen als getrennte auswählbare Mandanten, sofern sie in der Systemfirmenquelle aktiv vorhanden sind.
3. Ohne Systemadmin-Firmenauswahl wird kein Fachbootstrap mit Default-Firma geladen.
4. Nach Auswahl tragen Fach-API-Aufrufe den gewählten Firmenkontext.
5. „Firma wechseln“ leert den alten Firmenzustand und lädt keine alten Daten in die neue Firma.
6. Nicht-Systemadmins können keine fremde Firma auswählen.
7. Fehlende Blobs erzeugen keinen rohen Azure-XML-/SAS-Fehler mehr.
8. Admin/HSE sieht bei fehlender Unterlage einen verständlichen Fehler und eine Ersetzen-Aktion.
9. Bestehende Rollen-/Mandanten- und RC991-Lerntests bleiben grün.
10. `main` bleibt unverändert, bis eine spätere explizite Produktionsfreigabe erfolgt.
