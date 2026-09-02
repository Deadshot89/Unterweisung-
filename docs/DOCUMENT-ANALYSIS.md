# Automatische Unterweisungsanalyse

PDF, JPG, PNG oder WEBP hochladen: Standard ist ein neuer, zunächst inaktiver Unterweisungsentwurf mit Test. Alternativ eine bestehende Unterweisung für eine neue Fassung auswählen oder die Datei nur als Vorlage speichern. Die Analyse liest die Datei ohne festes Layoutschema. PDFs werden mit Text und Seitenbildern, Bilder mit Bildverarbeitung ausgewertet.

Die Analyseansicht zeigt den gegliederten Text, Seitenfundstellen, bewertete Sicherheitsaspekte, fehlende Angaben und Testfragen mit Begründungen. Abgedeckte Aspekte benötigen Text, Fundstelle und mindestens eine Frage. Unlesbare Seiten, fehlende Quellenangaben und offene Sicherheitslücken sperren die Freigabe. Firmenadmin/HSE prüft auch Gerätebezug, betriebliche Bedingungen, weitere Gefahren und die Begründungen für „nicht anwendbar“. Erst die bestätigte Freigabe aktiviert den Entwurf und verbindet Quelle und Test.

## Azure einrichten

Benötigt wird eine Azure-OpenAI-Bereitstellung mit PDF-/Bildeingabe, Responses API, Hintergrundverarbeitung und strukturierten Ausgaben. Modell und Region müssen diese Funktionen unterstützen. Kein Modellname wird automatisch angenommen.

Diese Einstellungen serverseitig als SWA-Anwendungseinstellungen hinterlegen. Für den bestehenden Deployment-Workflow können sie stattdessen über GitHub Actions bereitgestellt werden:

| Einstellung | Inhalt | GitHub-Speicher |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | `https://RESSOURCE.openai.azure.com` | Secret oder Repository-Variable |
| `AZURE_OPENAI_API_KEY` | Schlüssel der Azure-OpenAI-Ressource | Secret |
| `AZURE_OPENAI_DEPLOYMENT` | Name der passenden Modellbereitstellung | Secret oder Repository-Variable |

Der Workflow übernimmt die Werte ausschließlich in das ignorierte serverseitige API-Paket. Keine Schlüssel in Frontend, Repository, Chat oder Logs eintragen. SQL-/Blob-Konfiguration bleibt erforderlich. Der neue Schema-Schritt führt nur die additive Migration `010_instruction_analysis.sql` aus; bestehende Inhalte werden nicht migriert oder neu generiert.

`/api/health` meldet für `documentAnalysis` lediglich `configured` oder `not_configured`. `configured` bestätigt die vollständige Konfiguration, **keine erfolgreiche Modellanfrage**. Bei fehlender Konfiguration bleibt die Datei mit dem Status „Analysedienst einrichten“ gespeichert. Nach Einrichtung erneut deployen und den gespeicherten Auftrag starten.

Dokumentation des Anbieters: [Azure Responses API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses), [strukturierte Ausgaben](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs).

## Verarbeitung und Grenzen

- Aktuell PDF/Bild bis zur vorhandenen Uploadgrenze von 15 MB, PDF bis 50 Seiten. Verschlüsselte oder nicht lesbare PDFs werden als Fehler angezeigt. Maximal 100 Sicherheitsaspekte und 100 Fragen pro Entwurf; darüber muss eine vollständige, überschaubare Fassung bereitgestellt werden. Kein stilles Abschneiden.
- Analyseaufträge werden in SQL gespeichert; die KI verarbeitet im Hintergrund. Status und Ergebnis werden beim geöffneten Analysebereich abgeholt. Nach Schließen und Wiederöffnen wird fortgesetzt. Ein unterbrochener Start kann nach zwei Minuten erneut versucht werden. Ohne offene UI wird ein fertiges Providerergebnis erst beim nächsten Abruf in SQL übernommen.
- Inhalt und Layout können falsch erkannt werden. Fundstellen sind Modellangaben, kein unabhängiger Nachweis ihrer Richtigkeit. Unvollständige Herstellerunterlagen oder Gefährdungsbeurteilungen werden nicht durch erfundene Regeln ersetzt. Eine automatische Garantie, sämtliche realen Gefahren zu kennen, gibt es nicht; fachliche Quellenprüfung bleibt erforderlich.
- Übertragung erfolgt an die konfigurierte Azure-OpenAI-Ressource. Hintergrundverarbeitung erfordert gespeicherte Antworten. Nach erfolgreicher Übernahme wird die Providerantwort bestmöglich gelöscht; bei gescheiterter Löschung gilt die Aufbewahrung des Anbieters.
- Freigegebene Sprachfassungen werden für Teilnehmer getrennt aufgelöst. Neue Tests enthalten alle freigegebenen Aspekte, auch mehr als sieben Fragen. Quelle, Text, Fragen und Lösungsschlüssel werden beim ersten Öffnen als vollständiger Prüfungsstand gespeichert. Spätere Änderungen beeinflussen die laufende Prüfung nicht.
- Bereits vor diesem Update gestartete Alttests ohne gespeicherten Prüfungsstand bleiben mit ihren bisherigen Fragen bewertbar. Für neu angelegte Einladungen ist ein zuvor bereitgestellter Test zwingend. Es gibt keine automatische Einladung oder E-Mail durch die Analyse.
- Manuell veränderte generierte Fragen verlieren ihre behauptete Quellenabdeckung und werden bei späterer Generierung erhalten. Fehlt dadurch die geprüfte Frage zu einem erforderlichen Aspekt, werden neue Tests bis zur erneuten fachlichen Freigabe gesperrt. Bereits gespeicherte Prüfungsstände funktionieren weiter.

## Prüfung

`npm test` enthält Offline-Prüfungen für PDF-Seitenzählung, Provider-Payload/Fehler, Quellen- und Frageabdeckung, Antwortverteilung, Freigabesperren und den gespeicherten Prüfungsstand. Die Tests senden keine Dokumente an einen KI-Dienst. Nach Konfiguration muss eine geeignete echte Unterlage mit abweichendem Layout durch Upload, Analyse, Quellenprüfung und Freigabe geprüft werden.
