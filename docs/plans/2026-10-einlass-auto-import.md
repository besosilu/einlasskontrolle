# Plan: Automatischer Hintergrund-Import täglicher "Einlass"-Dateien vom Netzlaufwerk

**Status:** genehmigt, Umsetzung noch nicht begonnen (Finanzamt-Bericht wird zuerst fertiggestellt)
**Erstellt:** 2026-10-18

## Context

Mitgliederlisten werden heute nur manuell über den Upload-Dialog importiert (`POST /api/v1/import/members`). Zusätzlich sollen Dateien im Format `dd-mm-yyyy.txt` (gleicher `Mitgliedsnummer;Name;Vorname`-Inhalt wie der bestehende Import), die auf einem UNC-Netzlaufwerk erscheinen, automatisch im Hintergrund erkannt und verarbeitet werden - ohne die Live-Pfade Scan (`POST /api/v1/scan`) und manuelle Erfassung (`POST /api/v1/entries`) zu beeinträchtigen (gleicher 10-Connection-Pool, gleicher Event-Loop, kein separater Worker-Prozess). Verarbeitete Dateien werden lokal nach `verarbeitet/`/`fehler/` archiviert. Zusätzlich: ein kleines, bewusst unaufdringliches Feed-Widget direkt auf der Scanner-Seite, das über die automatischen Importe auf dem Laufenden hält, ohne vom Scannen/Erfassen abzulenken oder die Tastatur-Scanner-Eingabe zu stören.

**Mit dem Nutzer geklärt:**
- Dateiquelle: UNC-Netzlaufwerk (kein Laufwerksbuchstabe) - gleiche technische Einschränkung wie beim parallel geplanten Finanzamt-Bericht (`docs/plans/2026-10-finanzamt-bericht.md`, noch nicht umgesetzt): Docker Desktop/WSL2 kann einen rohen UNC-Pfad nicht zuverlässig direkt mounten. Container arbeitet nur mit einem lokalen, bind-gemounteten `./inbox`-Ordner; ein separates Windows-Skript synchronisiert **in umgekehrter Richtung** (UNC → lokal, statt lokal → UNC wie beim Finanzamt-Bericht).
- Dateiinhalt: identisch zum bestehenden Import-Format, bestehende Parser/Service-Logik (`parseMemberCsv`, `importMembersFromCsv`) wird wiederverwendet.
- Nach Verarbeitung: Verschieben nach `verarbeitet/` bzw. `fehler/` (Archiv bleibt erhalten, kein Löschen).
- Feed: kleines Widget **auf der Scanner-Seite selbst** (nicht auf einer separaten Seite), unaufdringlich, darf die Erfassung nicht ablenken oder die `useScanner`-Tastatureingabe stören.

## Verifizierte Fakten aus dem Code

- `importMembersFromCsv(fileContent, filename, entryDateOverride?)` (`backend/src/services/import.service.ts:4`) ist bereits die wiederzuverwendende Logik (Parsing, Find-or-Create, `sql.begin()` mit Savepoint pro Zeile, schreibt `import_logs`/`import_member_links`). Hat aktuell **keinen** `source`-Parameter - muss ergänzt werden.
- `import_logs` (`backend/src/lib/migrate.ts`) hat aktuell keine `source`-Spalte - neue Migration nötig (Migrationen sind ein TS-Array `{name, sql}`, idempotent über `_migrations`-Tabelle, neuer Eintrag einfach ans Ende anhängen).
- `extractDateFromFilename()` (`backend/src/controllers/import.controller.ts`) matcht nur `yyyy-mm-dd` und wird von der bestehenden Multi-Upload-Route verwendet - **nicht** wiederverwenden/erweitern; eigener Parser für `dd-mm-yyyy.txt` nötig.
- BOM-Stripping passiert aktuell nur im Controller beim Upload, nicht in `importMembersFromCsv` selbst - der neue Datei-Leser muss das beim Lesen von der Platte selbst übernehmen.
- Kein `setInterval`/`fs.watch`/Cron-Mechanismus existiert im Code - Scheduler-Pattern wird neu gebaut (gleiches Mutex+`setInterval`-Muster wie im noch nicht umgesetzten Finanzamt-Plan).
- `useScanner.ts` ignoriert Keydowns nur bei `INPUT`/`TEXTAREA`/`contentEditable` als Event-Target, hängt am `document`. Das Feed-Widget darf daher keine `<input>`/`<textarea>`/`autoFocus`-Elemente enthalten; reine `<div>`/`<button>`-Elemente sind unkritisch.
- Alle drei All-in-One-Compose-Dateien (`docker-compose.standalone.yml`, `docker-compose.portable.yml`, `release/docker-compose.yml`) haben aktuell nur das benannte Postgres-Volume, keinen Host-Bind-Mount - ein `./inbox`-Bind-Mount ist ein neues, aber durch den Finanzamt-Plan bereits vorgezeichnetes Muster.

## Offene Designfragen - Entscheidungen

1. **Race-Condition-Schutz:** mtime-Schwelle von 60 Sekunden (Datei wird erst verarbeitet, wenn seit dem letzten Schreibzugriff mindestens 60s vergangen sind) **plus** `fs.rename` statt Copy+Delete beim Verschieben nach `verarbeitet/`/`fehler/` (atomar innerhalb desselben Mounts, verhindert Doppel-Verarbeitung zuverlässiger als die mtime-Schwelle allein).
2. **Dateinamen-Validierung:** Nicht zum Muster `^\d{2}-\d{2}-\d{4}\.txt$` passende Dateien werden ignoriert und nur geloggt, nie verschoben (könnten aus anderen Gründen im Ordner liegen). Dateien, die zwar matchen, aber ein ungültiges Kalenderdatum codieren (z.B. `31-02-2026.txt`), wandern dagegen nach `fehler/` (sieht nach einem Tippfehler in einer echten Einlass-Datei aus - Ignorieren würde das verstecken).
3. **Cap pro Tick:** 20 Dateien pro Durchlauf (nicht nur wegen Performance, sondern Fehlerisolation/Vorhersagbarkeit der Tick-Dauer), älteste zuerst, Rest folgt im nächsten Tick (alle 5 Minuten).
4. **Widget-Platzierung:** `fixed bottom-4 left-4 z-40` (eigene Ecke, kollidiert nicht mit den bestehenden Toasts unten rechts), per Klick aufklappbares Badge, komplett außerhalb des Grid-Layouts von `ScannerPage.tsx` - ein Re-Render durch Polling kann so nie einen Reflow im Scan-/Erfassungsbereich auslösen.

## Vorgehen

### Backend

1. **`backend/src/lib/migrate.ts`**: neue Migration anhängen - `ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'manual'` + Index auf `source`.

2. **`backend/src/services/import.service.ts`**:
   - `importMembersFromCsv(fileContent, filename, entryDateOverride?, source: 'manual' | 'auto' = 'manual')` - Signatur erweitern, `source` in den `import_logs`-INSERT übernehmen.
   - `mapImportLog()`/`ImportLogRow`-Typ um `source` ergänzen.
   - `getImportLogs(limit, offset, source?)`: optionaler Filter (für das Feed-Widget `source = 'auto'`).

3. **`backend/src/services/autoImport.service.ts`** (neu):
   - `INBOX_DIR = process.env['AUTO_IMPORT_INBOX_DIR'] ?? '/app/inbox'`, Unterordner `verarbeitet/`/`fehler/` beim Start sicherstellen.
   - `parseInboxFilename(filename)`: eigener Parser für `dd-mm-yyyy.txt` → `yyyy-mm-dd`, inkl. Kalender-Validitätsprüfung (Rück-Vergleich nach `Date`-Konstruktion, damit z.B. `31-02-2026` nicht stillschweigend auf März überläuft).
   - `isStable(filePath)`: `fs.stat`, mindestens 60s seit `mtime`.
   - `processInboxOnce()`: `fs.readdir` (nur Root des Inbox-Ordners, nicht rekursiv in die Archiv-Unterordner), pro Datei: Muster-Check → ignorieren/Kandidat/Fehler-Move, Kandidaten nach Stabilität filtern, nach Dateiname sortieren, auf 20 kappen, **sequenziell** (nicht parallel) verarbeiten: Datei lesen, BOM stripen, `importMembersFromCsv(content, filename, entryDate, 'auto')`, danach `fs.rename` nach `verarbeitet/` (Erfolg, auch bei Teil-Fehlern in der Datei) oder `fehler/` (wenn die Funktion selbst wirft) - Namenskollisionen im Zielordner per Zeitstempel-Suffix auflösen.
   - `running`-Mutex-Flag um `processInboxOnce()`, `startAutoImportScheduler()`: sofortiger Check beim Start + `setInterval(..., 5 * 60_000)`. Je-Datei-try/catch, damit eine fehlerhafte Datei nicht den ganzen Tick abbricht.

4. **`backend/src/controllers/import.controller.ts`**: `getLogs` um optionalen `source`-Query-Param erweitern (`GET /api/v1/import/logs?source=auto`).

5. **`backend/src/index.ts`**: `startAutoImportScheduler()` nach `ensureAdminUser()` aufrufen (vor/bei `app.listen`).

6. **`Dockerfile`**: `ENV AUTO_IMPORT_INBOX_DIR=/app/inbox`, `RUN mkdir -p /app/inbox/verarbeitet /app/inbox/fehler`.

### Docker Compose

7. **`docker-compose.standalone.yml`, `docker-compose.portable.yml`, `release/docker-compose.yml`**: Bind-Mount `./inbox:/app/inbox` ergänzen.
8. **`.gitignore`**: `inbox/` ergänzen (kann personenbezogene Daten enthalten).

### Zustellung vom Netzlaufwerk (Windows-seitig, UNC → lokal)

9. **`sync-inbox-from-network.ps1`** (neu, Gegenstück zu `sync-reports-to-network.ps1`, umgekehrte Richtung):
   - Erreichbarkeits-Check vor dem Kopieren, `exit 1` statt Hängenbleiben bei nicht erreichbarem UNC-Pfad.
   - `robocopy "\\server\freigabe" ".\inbox" *.txt /R:3 /W:10 /LOG+:...` - **kein** `/MOV` (Original bleibt auf dem Netzlaufwerk, falls der nachgelagerte Backend-Schritt ausfällt - hier sogar wichtiger als beim Finanzamt-Bericht, da zwei zeitlich entkoppelte Schritte hintereinander hängen). **Kein** `/MOV`, **kein** `/E`/`/S`/`/MIR` - nur flacher Copy ins Inbox-Root, damit die vom Backend verwalteten Unterordner `verarbeitet/`/`fehler/` vom Sync-Skript nie angefasst werden.
   - Korrekte Robocopy-Exitcode-Prüfung (`-ge 8` = Fehler, nicht `-ne 0`).
   - Windows-Aufgabenplanung, Intervall z.B. 5-15 Minuten, "Computer aufwecken" aktivieren.

10. **Dokumentation**: `docs/README.md`-Plantabelle ergänzen; `README.md`/`Installation.md` Abschnitt "Automatischer Einlass-Import vom Netzlaufwerk" (Aufteilung Container/Windows-Skript, Hinweis dass auf dem Netzlaufwerk nie etwas gelöscht wird).

### Frontend

11. **`frontend/src/api/import.ts`**: `getLogs` um optionalen `source`-Parameter erweitern.
12. **`frontend/src/types/index.ts`**: `ImportLog` um `source: 'manual' | 'auto'` ergänzen.
13. **`frontend/src/components/scanner/AutoImportFeedWidget.tsx`** (neu): `useQuery({ queryKey: ['auto-import-feed'], queryFn: () => importApi.getLogs(5, 0, 'auto'), refetchInterval: 25_000 })`. Kollabiertes Badge (`fixed bottom-4 left-4 z-40`, keine `<input>`/`autoFocus`), Klick klappt eine kleine Liste der letzten 5 Auto-Import-Logs auf. Optional: `useRef`-basierte Erkennung einer neuen höchsten `id` löst beim ersten Erscheinen (nicht beim initialen Laden) einen `showToast('info', ...)` aus. Zurückhaltendes Styling - "auffällig genug" über Positionierung + einmaligen Toast, nicht über aggressive visuelle Reize.
14. **`frontend/src/pages/ScannerPage.tsx`**: `<AutoImportFeedWidget />` als zusätzliches Sibling-Element am Ende einbinden, kein Eingriff ins bestehende Grid/Layout/State nötig.

## Kritische Dateien

- neu: `backend/src/services/autoImport.service.ts`, `sync-inbox-from-network.ps1`, `frontend/src/components/scanner/AutoImportFeedWidget.tsx`
- geändert: `backend/src/lib/migrate.ts`, `backend/src/services/import.service.ts`, `backend/src/controllers/import.controller.ts`, `backend/src/index.ts`, `Dockerfile`, alle drei All-in-One-Compose-Dateien, `.gitignore`, `frontend/src/api/import.ts`, `frontend/src/types/index.ts`, `frontend/src/pages/ScannerPage.tsx`, `docs/README.md`, `README.md`/`Installation.md`

## Verifikation

1. `npm run build` in `backend/` und `frontend/` fehlerfrei.
2. Migration wird genau einmal angewendet (Log "Applying migration: ..."), erneuter Start wendet sie nicht nochmal an.
3. Testdatei `02-10-2026.txt` manuell in `./inbox/` legen - verschwindet nach max. 5 Min (oder verkürztem Testintervall), landet in `inbox/verarbeitet/`, neuer `import_logs`-Eintrag mit `source='auto'` und korrektem Datum.
4. Datei mit `mtime` jünger als 60s wird im ersten Tick übersprungen, erst im übernächsten verarbeitet.
5. Falsches Namensmuster (`test.tmp`) bleibt unverändert liegen, kein Move, nur Log.
6. Erkanntes aber ungültiges Datum (`31-02-2026.txt`) wandert nach `inbox/fehler/`, kein `import_logs`-Eintrag.
7. Datei mit fehlerhaftem Inhalt (aber lesbar): landet trotzdem in `verarbeitet/` (Row-Fehler landen im `errors`-Array); nur ein echter Wurf (z.B. DB down) führt nach `fehler/`.
8. Mehr als 20 valide Dateien gleichzeitig: genau 20 im ersten Tick (älteste zuerst), Rest im Folgetick.
9. Während ein Tick mit mehreren Dateien läuft: `POST /api/v1/scan` und `POST /api/v1/entries` parallel testen - keine merkliche Latenz-Zunahme.
10. Frontend: Widget erscheint unten links, kein Fokus-Diebstahl (Scanner-Hardware-Test parallel zum Polling), Klick klappt Liste ohne Layout-Sprung im Scan-Bereich auf, neuer Eintrag löst einmalig einen Toast aus (nicht beim Seitenladen).
11. `GET /api/v1/import/logs?source=auto` liefert nur Auto-Importe; `GET /api/v1/import/logs` ohne Filter liefert weiterhin alles (Regressionstest für bestehende Konsumenten).
12. `sync-inbox-from-network.ps1` gegen Testordner: Datei kommt an, wiederholter Lauf kopiert unverändert liegende Dateien nicht erneut, `verarbeitet/`/`fehler/` werden vom Sync-Skript nicht berührt, nicht erreichbarer Pfad liefert `exit 1` statt Hängenbleiben.

## Vom Nutzer zu erledigen / Risiken

- `$NetworkPath` im Sync-Skript setzen, als Windows-Aufgabe registrieren (Intervall 5-15 Min, "Computer aufwecken" aktivieren).
- PC im Standby: weder Sync noch Verarbeitung laufen dann - bekannte Grenze, bereits beim Finanzamt-Plan dokumentiert.
- Kein `/MOV` bedeutet, das Netzlaufwerk wächst über die Zeit an - falls unerwünscht, wäre eine spätere Aufräum-Routine ein eigenes, hier bewusst nicht gelöstes Thema.
- `LogsPage.tsx` zeigt Import-Logs aktuell ohne Quelle-Unterscheidung an - eine UI-Erweiterung dort ist nicht Teil dieses Plans, nur das neue Scanner-Widget zeigt Auto-Importe gezielt an.
