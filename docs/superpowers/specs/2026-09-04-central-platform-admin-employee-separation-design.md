# RC991 Zentrale Plattform mit Firmenauswahl und getrennten Admin-/Mitarbeiterbereichen – Design

**Datum:** 2026-09-04  
**Ziel-Branch:** `rc991-unified-learning-portal`  
**Status:** im Chat fachlich freigegeben; schriftliche Spec wartet auf finale Benutzerbestätigung.  
**Ersetzt:** Den Abschnitt „Azure-/Domain-Zielbild“ aus `2026-09-04-multitenant-company-branches-and-admin-selection-design.md`, soweit dort eigene Live-Domains oder eigene produktive Webseiten pro Firma als Ziel vorgesehen waren.

## Ziel

Der Unterweisungsmanager wird als **eine zentrale Website mit einer gemeinsamen Login-Adresse** betrieben. Alle internen Benutzer aller Firmen melden sich auf derselben Seite an. Nach erfolgreicher Authentifizierung entscheidet ausschließlich die serverseitig aufgelöste Rolle und Firmenberechtigung, welcher Portalbereich sichtbar wird.

Es gibt **keine getrennten produktiven Webseiten pro Firma** und keine separate Login-Adresse für Admins, Mitarbeiter, Essentra oder Kontur.

Trotz gemeinsamer Website bleiben Verwaltungs- und Mitarbeiteroberfläche fachlich und visuell klar voneinander getrennt.

## Verbindliches Benutzererlebnis

### Gemeinsamer Einstieg

Alle internen Benutzer öffnen dieselbe zentrale Anwendung und sehen dieselbe Login-Shell:

1. **Mit Microsoft anmelden**
2. **E-Mail und Passwort**

Beide Anmeldearten führen in dieselbe Rollen- und Mandantenauflösung. Die Loginart ändert niemals Rechte oder Firmenzugriff.

Externe Unterweisungslinks bleiben als bewusste Ausnahme ohne internes Konto erreichbar. Sie sind keine zweite Verwaltungs- oder Mitarbeiterwebsite, sondern zweckgebundene persönliche Lernlinks.

## Rollenfluss nach erfolgreichem Login

### `system_admin`

Der Systemadmin ist mandantenübergreifend und bekommt **immer zuerst eine Firmenauswahl**.

Ablauf:

`Zentrale Loginseite → Firmenauswahl → Firma öffnen → Verwaltungsportal dieser Firma`

Aktuell auswählbare Firmen sind insbesondere:
- Essentra Components GmbH
- Kontur Werkzeugstahl GmbH
- später weitere aktive Firmen aus der zentralen Firmenquelle

Es gibt keine automatisch vorausgewählte Standardfirma.

Nach Auswahl einer Firma wird der aktive Firmenkontext deutlich angezeigt. Die Aktion **„Firma wechseln“** führt innerhalb derselben Website zurück zur Firmenauswahl und leert vorher alle firmenspezifischen Frontendzustände.

### `company_admin` und `hse`

Diese Rollen sehen **keine globale Firmenauswahl**. Der Server ordnet sie ihrer berechtigten Firma zu und öffnet direkt das Verwaltungsportal dieser Firma.

Sie können keinen fremden `companyId`-Kontext erzwingen.

### `line_manager`

Führungskräfte bleiben im rollenbezogenen Mitarbeiter-/Führungsportal ihrer Firma. Sie sehen ihre eigenen Unterweisungen und Nachweise sowie die ausdrücklich freigegebenen Teamfunktionen, z. B.:
- eigenes Team einplanen
- zugewiesene Mitarbeiter sehen
- externe Unterweisungen versenden
- erlaubte Teamstatus-/Planungsinformationen

Sie erhalten dadurch keine allgemeinen Firmenadminrechte.

### `employee`

Mitarbeiter landen direkt im Mitarbeiterportal der eigenen Firma. Sichtbar sind ausschließlich persönliche bzw. rollenbezogen erlaubte Inhalte:
- offene Unterweisungen
- fällige Unterweisungen
- geplante Termine
- abgeschlossene Unterweisungen
- eigene Nachweise und Downloads

Adminformulare, Benutzerverwaltung, Firmenverwaltung und globale Auswertungen sind dort nicht vorhanden.

## Klare Trennung von Verwaltungsportal und Mitarbeiterportal

Die Trennung wird nicht nur durch das Ausblenden einzelner Buttons umgesetzt. Nach der Rollenauflösung wird ein eindeutiger **Portalmodus** gesetzt.

### Verwaltungsportal

Für `system_admin` nach Firmenauswahl sowie `company_admin`/`hse` innerhalb ihrer Firma.

Typische Bereiche:
- Firmen-Dashboard
- Mitarbeiterverwaltung
- Unterweisungen erstellen/bearbeiten/veröffentlichen
- professionelle read-only Unterweisungsvorschau
- Planung
- Nachweise
- Erinnerungen
- Manager-/Statusauswertungen
- externe Unterweisungen
- Benutzer und Rechte entsprechend der Rolle
- Betriebs-/Sicherheitsfunktionen nur entsprechend der Rolle

### Mitarbeiter-/Führungsportal

Für `employee` und `line_manager`.

Typische Bereiche:
- Meine Unterweisungen
- Jetzt erledigen
- Einplanung erforderlich
- Geplante Termine
- Bald fällig
- Abgeschlossen
- Meine Nachweise
- bei Führungskräften zusätzlich klar abgegrenzte Teamfunktionen

Die Navigation dieses Portals ist eigenständig und enthält keine ausgegrauten oder versteckten Admin-Menüpunkte als Attrappen.

## Eine URL, ein Browserkontext, mehrere Portalansichten

Alle internen Portalmodi laufen unter derselben zentralen Origin und derselben Anwendung. Ein Rollen- oder Firmenwechsel öffnet keine andere Kunden-Domain und keine andere produktive Azure-Static-Web-App.

Technisches Ziel:
- eine produktive Haupt-URL
- eine gemeinsame Auth-Shell
- eine gemeinsame API
- eine zentrale Firmenquelle
- serverseitige Mandantenisolierung über `companyId`
- rollenabhängige Portalansichten innerhalb derselben Anwendung

Preview-/RC-URLs dürfen intern für Entwicklung und Abnahme weiter existieren. Sie sind **keine Benutzer- oder Firmenstruktur** und werden nicht als reguläre Firmenwebseiten kommuniziert.

## Firmenbranches und Deployments

Die vorhandenen GitHub-Branches `company/essentra-components` und `company/kontur-werkzeugstahl` dürfen weiterhin als Entwicklungs-/Integrationszweige existieren, sind aber **nicht** die Zielarchitektur für getrennte produktive Kundenwebseiten.

Wiederverwendbare Produktfunktionen gehören in den gemeinsamen Produktkern. Firmenspezifische Unterschiede sollen, soweit technisch sinnvoll, über zentrale Firmenkonfiguration, Rechte oder Feature-Konfiguration gelöst werden statt über dauerhaft auseinanderlaufende produktive Frontends.

Ein Firmenbranch darf nicht dazu führen, dass ein Kunde im Normalbetrieb eine andere Login-URL benötigt.

## Firmenauswahl für Systemadmins

Die Firmenauswahl ist eine echte vorgeschaltete Ansicht innerhalb der zentralen App.

Jede Firmenkarte zeigt mindestens:
- Firmenname
- Status aktiv/inaktiv
- eindeutige Firmenkennung nur soweit administrativ sinnvoll
- Aktion **„Firma öffnen“**

Solange keine Firma ausgewählt ist:
- kein Fach-Dashboard
- keine Adminnavigation
- keine Firmenfachdaten
- kein automatischer `x-company-id`
- keine Default-Firma

Beim Wechsel der Firma werden mindestens geleert:
- Bootstrap-/Fachdaten
- Mitarbeiter- und Benutzerlisten
- Unterweisungs-/Editorzustände
- Statusdaten
- Planung
- Nachweise
- Mail-/Firmenkonfiguration
- Caches der Lern-/Adminansichten

Erst danach wird der neue Firmenkontext geladen.

## Portal-Routing

Die zentrale Startlogik soll nach erfolgreichem `/api/me` eindeutig entscheiden:

1. nicht authentifiziert → `auth-required`
2. `system_admin` ohne Firma → `company-selection`
3. `system_admin` mit gewählter Firma → `admin-portal`
4. `company_admin` oder `hse` → `admin-portal`
5. `line_manager` → `employee-manager-portal`
6. `employee` → `employee-portal`

Unbekannte oder inkonsistente Rollen führen zu einer sicheren Zugriffsfehlermeldung statt zu einem Default-Dashboard.

Die Entscheidung wird im Frontend dargestellt, die Berechtigung bleibt aber serverseitig verbindlich.

## Navigation

### Adminnavigation

Die bisherige globale Navigation wird zu einer echten Adminnavigation. Sichtbare Menüpunkte werden rollenbezogen aus einer zentralen Navigationsdefinition erzeugt. Systemadmin-Funktionen wie globale Firmenverwaltung erscheinen nur für `system_admin`.

### Mitarbeiternavigation

Das Mitarbeiter-/Führungsportal bekommt eine eigene reduzierte Navigation. Es verwendet dieselbe Website und Authentifizierung, aber keine Admin-Menüstruktur.

### Kein Mischzustand

Zu keinem Zeitpunkt dürfen gleichzeitig Adminnavigation und Mitarbeiterportalnavigation als zwei konkurrierende Hauptnavigationen sichtbar sein.

## Sicherheit und Mandantenisolierung

Die bisherige Sicherheitslogik bleibt zwingend:
- Server ist Autorität für Rolle, Benutzer und Firmenzugriff.
- Normale Firmenbenutzer können keine fremde Firma per Header, URL oder direkter Datei-ID öffnen.
- `system_admin` darf Firmenkontext wechseln, aber Fachendpunkte benötigen einen expliziten gültigen Kontext.
- Downloads und direkte Dateilinks respektieren dieselben Firmen- und Rollenrechte.
- Frontend-Hiding ist nur Darstellung und ersetzt keine API-Autorisierung.
- Externe persönliche Links bleiben tokengebunden und geben keine internen Firmenportale frei.

## Authentifizierung und Passwortverwaltung

Die bereits gebaute zentrale Dual-Auth-Shell bleibt der einzige interne Login.

- Microsoft und E-Mail/Passwort nutzen dieselbe Benutzerquelle.
- `UnterweisungManagment@outlook.de` ist als Betreiber-/Systemadmin-Identität vorgesehen.
- Passwort-Sessions bleiben serverseitig signiert.
- Passwörter werden nur gehasht gespeichert und niemals auslesbar angezeigt.
- Passwort setzen/ändern erfolgt im berechtigten Benutzerverwaltungsfluss.
- Ein späterer „Passwort vergessen?“-Flow kann auf derselben Loginseite ergänzt werden; er erzeugt keine zweite Website.

## Fehlerverhalten

- nicht angemeldet → nur Login-Shell, keine Fachdaten
- Microsoft authentifiziert, aber Benutzer nicht freigeschaltet → verständliche Loginmeldung
- ungültiges Passwort → Inline-Fehler im Login
- Systemadmin ohne Firma → Firmenauswahl, kein Dashboard
- nicht erlaubter Firmenwechsel → 403 und aktueller erlaubter Kontext bleibt unverändert
- API-Ausfall → keine Offline-/Seed-Firmendaten als Ersatz
- inkonsistente Rolle → sicherer Fehler statt falscher Portalmodus

## Geplante Codegrenzen

Die Umsetzung soll möglichst auf vorhandenen Modulen aufbauen:
- `frontend/index.html` – neutrale zentrale Shell statt dauerhaft sichtbarer Adminnavigation
- `frontend/app.js` – zentrale Portal-/Firmenzustandsmaschine nach `/api/me`
- `frontend/auth-login-v42.js` – unverändert der einzige interne Loginrenderer
- `frontend/auth-shell-v40.js` – Auth-Zustände
- `frontend/company-context-v39.js` – Systemadmin-Firmenauswahl und Firmenwechsel
- `frontend/role-guard-v20.js` – bestehende Rollenregeln weiterverwenden
- `frontend/employee-portal-v37.js` – Mitarbeiter-/Führungsportal klar vom Adminportal abgrenzen
- neues kleines fokussiertes Portal-Navigationsmodul nur falls die aktuelle Navigation nicht sauber ohne Duplizierung getrennt werden kann
- bestehende API-Autorisierung bleibt serverseitige Quelle der Wahrheit

Keine zweite `index.html` für Mitarbeiter oder Firmen wird eingeführt.

## TDD- und Abnahmekriterien

Die Architektur gilt erst als umgesetzt, wenn automatisiert nachgewiesen ist:

1. Es existiert genau eine interne Loginseite mit Microsoft und E-Mail/Passwort.
2. `system_admin` sieht nach Login ohne Firmenkontext ausschließlich die Firmenauswahl, keine Fachnavigation.
3. `system_admin` kann Essentra und Kontur innerhalb derselben Website auswählen.
4. „Firma wechseln“ bleibt auf derselben Origin und leert den alten Firmenzustand vollständig.
5. `company_admin` und `hse` landen direkt im Verwaltungsportal ihrer eigenen Firma und sehen keine globale Firmenauswahl.
6. `employee` landet direkt im Mitarbeiterportal und erhält keine Adminnavigation.
7. `line_manager` erhält das Mitarbeiter-/Führungsportal mit den erlaubten Teamfunktionen, aber keine allgemeinen Adminrechte.
8. Admin- und Mitarbeiterhauptnavigation sind niemals gleichzeitig sichtbar.
9. Rollenwechsel/Reload kann keinen falschen Portalmodus aus einem alten Frontendcache übernehmen.
10. Nicht-Systemadmins können keinen fremden `companyId` erzwingen.
11. Direkte Downloads bleiben firmen- und rollenbeschränkt.
12. Der Systemadmin-Firmenwechsel verursacht keinen Datenrest aus der vorherigen Firma.
13. Externe Unterweisungslinks bleiben unabhängig und kontolos nutzbar.
14. Alle bestehenden Auth-, Tenant-, Learning-, Planning-, Preview- und Blob-Sicherheitsverträge bleiben grün.
15. Der vollständige RC991-Workflow einschließlich Azure-Preview-Deploy muss GREEN sein.
16. `main` bleibt bis zur ausdrücklichen Produktionsfreigabe unverändert.

## Nicht Bestandteil dieses Architekturblocks

- eigene produktive Domains je Firma
- separate Loginseiten für Firmen
- separate Admin- und Mitarbeiter-Websites
- automatische Veröffentlichung nach `main`
- Datenimport oder Seed-Reparatur
- vollständiger Passwort-vergessen-Mailflow; dieser kann als eigener Folgeblock auf der zentralen Loginseite umgesetzt werden

## Release-Zielbild

Während der Entwicklung darf die RC991-Preview-URL bestehen bleiben. Nach endgültiger Freigabe wird der gemeinsame geprüfte Produktstand auf **eine** produktive Hauptanwendung veröffentlicht. Firmen und Rollen werden anschließend ausschließlich innerhalb dieser einen Plattform aufgelöst.
