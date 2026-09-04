# Company Showcase – Admin-Einrichtung und Inhaltseditor

## Ziel
Die öffentliche Unternehmens-Demo soll neben der Präsentation fertiger Abläufe auch zeigen können, wie eine neue Firma eingerichtet, Mitarbeitende gepflegt, Unterweisungen erstellt/bearbeitet, Bilder ergänzt und Unterweisungen Mitarbeitenden zugewiesen werden.

## Grundsatz
Die Erweiterung bleibt vollständig innerhalb der isolierten Showcase-Demo unter `/demo/`. Es gibt keinerlei Verbindung zu API, SQL, Blob Storage, Auth, Mail oder produktiven Firmen-/Mitarbeiterdaten. Alle Änderungen werden ausschließlich im Browser-`localStorage` gespeichert und durch `Demo zurücksetzen` vollständig verworfen.

## Rollen
Nur die Demo-Rolle `company_admin` darf den Einrichtungsbereich verwenden und Daten verändern. Führungskräfte und Mitarbeitende sehen weiterhin ausschließlich ihre bestehenden rollenbezogenen Ansichten. Die Store-Methoden prüfen die Admin-Rolle selbst; eine reine UI-Sperre reicht nicht aus.

## Einrichtungsbereich
Die Admin-Navigation erhält `Einrichtung`. Der Bereich zeigt einen klaren 4-Schritt-Ablauf:

1. **Unternehmensprofil** – Firmenname, Branche und Standort für die Präsentation lokal ändern.
2. **Mitarbeitende** – Demo-Mitarbeitende anlegen und bearbeiten; Name, Demo-E-Mail, Abteilung, Funktion, Rolle und optionale Führungskraft.
3. **Unterweisung** – Online- oder Praxis-Unterweisung anlegen/bearbeiten; Titel, Kategorie, Beschreibung, Intervall, Testpflicht und Bestehensgrenze.
4. **Zuweisung** – Unterweisung einem oder mehreren Demo-Mitarbeitenden zuweisen; bestehende Zuordnungen werden nicht dupliziert.

Der Ausgangsbestand `Musterwerk Solutions GmbH` mit den vorhandenen 15 Mitarbeitenden und 10 Unterweisungen bleibt die Reset-Basis.

## Unterweisungseditor und Lernschritte
Für Online-Unterweisungen können mindestens drei Lernschritte mit Titel, Erklärung und Bild gepflegt werden. Neue Online-Unterweisungen erhalten beim Anlegen drei leere Lernschritte, damit die Präsentation direkt fortgesetzt werden kann. Praxis-Unterweisungen benötigen keine Lernschritte und keinen Online-Test.

Der Editor erlaubt Änderungen an bestehenden Demo-Unterweisungen. Änderungen wirken sofort auf die vorhandenen Demo-Ansichten und Zuordnungen, ohne Datensätze neu zu laden.

## Eigene Bilder
Ein Admin kann für einen Lernschritt eine lokale PNG-, JPEG- oder WEBP-Datei auswählen. Der Browser liest die Datei per `FileReader` als `data:image/...`-URL ein. Es erfolgen keine Uploads oder Netzwerkaufrufe.

Regeln:
- nur `image/png`, `image/jpeg`, `image/webp`;
- maximale Dateigröße 1,5 MB;
- nur `data:image/png`, `data:image/jpeg` oder `data:image/webp` werden im Store akzeptiert;
- bestehende lokale SVG-Demo-Assets bleiben unverändert zulässig;
- Reset entfernt benutzerdefinierte Bilder zusammen mit allen anderen lokalen Demo-Änderungen.

## Mitarbeiterregeln
Neue Demo-E-Mail-Adressen müssen auf `.example` enden. Damit werden im Showcase keine echten Mailadressen als Standardworkflow erzeugt. IDs werden ausschließlich lokal und deterministisch mit `demo-`-Präfix erzeugt. Bei Führungskräften darf die optionale Führungskraft gesetzt werden; bei Mitarbeitenden dient `lineManagerId` weiterhin der Teambegrenzung.

## Zuweisung
`assignInstruction(instructionId, employeeIds, dueDate)` erzeugt für gültige Demo-Mitarbeitende fehlende Zuordnungen mit Status `missing` und Fortschritt `0`. Bereits vorhandene Kombinationen aus Mitarbeiter und Unterweisung bleiben bestehen und werden nicht dupliziert. Die Zuweisung ist nur als Admin erlaubt.

## Präsentations-UX
Der Einrichtungsbereich soll wie ein echter Onboarding-Workflow wirken, aber jederzeit deutlich als Demo erkennbar bleiben. Der Nutzer kann jeden Schritt unabhängig öffnen; es gibt keine erzwungene Wizard-Sperre. Eine kompakte Fortschrittsleiste erklärt den typischen Ablauf.

Die bestehenden Bereiche Dashboard, Mitarbeiter, Unterweisungen, Status, Planung, Nachweise und die geführte Verkaufstour bleiben funktionsfähig.

## Sicherheit und Abnahme
Erforderliche Regressionen:
- Nicht-Admins können keine Admin-Store-Operation ausführen.
- Unternehmensprofil wird nur lokal geändert und durch Reset wiederhergestellt.
- Mitarbeitende können angelegt und bearbeitet werden; Nicht-`.example`-Mails werden abgewiesen.
- Unterweisungen können angelegt/bearbeitet werden; Online-Inhalte erhalten Lernschritte.
- Zuweisungen sind idempotent.
- Bilddaten werden nach MIME-Typ und Größenlimit validiert.
- Demo-Dateien enthalten weiterhin keine Netzwerk-, API-, Auth- oder Produktivdaten-Verbindung.
- bestehende Projekt-Regressionen bleiben grün.
- Azure-Preview `/demo/` bleibt per HTTP erreichbar und enthält den sichtbaren Demo-Hinweis.

## Nicht Bestandteil
Keine produktive Firmenanlage, keine echte Benutzeranlage, kein echter Upload, kein Mailversand, keine SQL-Migration, kein Blob Storage, kein Login, keine Preis-/Lizenzlogik und kein Merge nach `main`.