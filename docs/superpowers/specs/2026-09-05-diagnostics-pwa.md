# Fehlerdiagnose-PWA – Designspezifikation

## Ziel

Eine installierbare Diagnose-PWA für den Unterweisungsmanager, die technische Fehler zentral erfasst, dem Systemadmin verständlich darstellt, ein bereinigtes Diagnosepaket exportiert und bei kritischen Fehlern ausschließlich Systemadmins per E-Mail und Android/Web-Push benachrichtigt.

## Zugriffsmodell

- `system_admin` hat immer Zugriff auf die Fehlerdiagnose und darf globale Ereignisse aller Firmen sehen.
- Andere Benutzer sehen die Diagnose nur mit dem expliziten Funktionsrecht `diagnostics.view`.
- Dieses Recht kann ausschließlich ein Systemadmin vergeben oder entziehen.
- Delegierte Benutzer sehen nur Diagnoseereignisse ihrer eigenen Firma.
- Die API erzwingt dieselben Grenzen serverseitig; UI-Verstecken allein reicht nicht.

## Diagnoseereignisse

Ein Ereignis enthält mindestens: Datum/Uhrzeit, Firma, Benutzer, Schweregrad, Bereich, Aktion, Fehlermeldung, Fehlercode, API-Pfad, HTTP-Methode, HTTP-Status, Browser/Gerät, App-Version und technische Zusatzdaten. Zugangsdaten, Cookies, Passwörter, Session-Tokens, Setup-Tokens und Request-Bodies werden nicht gespeichert.

Frontend-API-Fehler werden zentral erfasst. HTTP 5xx gilt als kritisch, HTTP 4xx als Warnung. Bestehende System-/Healthchecks bleiben erhalten und werden in der Diagnose-PWA als Systemstatus zusammengeführt.

## Kritische Benachrichtigungen

- Kritische Fehler werden protokolliert und an aktive `system_admin`-Konten eskaliert.
- E-Mail wird über die bestehende Microsoft-Graph-Mailfunktion versendet.
- Handy-Push wird als Web Push über den installierten Service Worker der Diagnose-PWA versendet.
- Push-Abonnements gehören ausschließlich Systemadmins.
- Gleiche kritische Fehler werden weiter protokolliert, aber Push/E-Mail werden für 10 Minuten dedupliziert, damit kein Benachrichtigungssturm entsteht.
- Abgelaufene Push-Abonnements (HTTP 404/410 vom Push-Dienst) werden automatisch entfernt.

## Push-Schlüssel

Es wird kein zusätzlicher privater Schlüssel im Repository gespeichert. Der VAPID-Schlüssel wird deterministisch und mit eigener Kontexttrennung aus dem bereits produktiv vorhandenen `AUTH_SESSION_SECRET` abgeleitet. Dadurch bleibt der Push-Schlüssel über Deployments stabil, ohne das Session-Geheimnis direkt als VAPID-Schlüssel zu verwenden.

## PWA

Die Diagnose erhält eine eigene Seite `/diagnostics.html` mit Manifest und Service Worker. Sie kann auf Android installiert werden. Die Oberfläche zeigt Systemstatus, Fehlerliste, Filter, Detailansicht, Push-Aktivierung und Diagnoseexport. Ein sichtbarer Einstieg aus dem normalen Unterweisungsmanager erscheint nur bei vorhandenem Diagnoserecht.

## Diagnoseexport

Der Server erzeugt ein JSON-Diagnosepaket mit gefilterten Diagnoseereignissen und nicht-sensiblen Metadaten. Es enthält niemals Passwörter, Hashes, Cookies, Tokens, Secrets oder vollständige Request-Bodies.

## Nicht-Ziele dieses ersten Blocks

- Keine native Android-App und kein Firebase-Zwang.
- Keine SMS.
- Keine automatische Reparatur produktiver Daten.
- Keine Pushmeldungen für normale Warnungen; Handy-Push ist zunächst nur für kritische Fehler.
