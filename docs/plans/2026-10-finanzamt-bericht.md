# Plan: Monatlicher Besucherzahlen-Bericht für das Finanzamt, automatisch auf Netzlaufwerk

**Status:** umgesetzt (manuell gegen Testcontainer verifiziert; echter UNC-Sync noch nicht mit realem Netzlaufwerk getestet)
**Erstellt:** 2026-10-18

## Context

Der Verein braucht einen für das Finanzamt nachvollziehbaren Nachweis der Besucherzahlen (kein Geld - die App erfasst keine Zahlungen, `price_items` ist nur eine unverknüpfte Referenzliste, per Code-Audit bestätigt). Aktuell existieren nur manuelle, im Browser ausgelöste Tagesexporte (`ExportDialog.tsx`) für Mitglieder-Kennzeichen - kein automatischer, periodischer Bericht, keine Anbindung an ein Netzlaufwerk.

### Entscheidungen

- **Inhalt:** nur Besucherzahlen/Anwesenheit, kein Geld.
- **Turnus:** automatisch, monatlich.
- **Format:** nur CSV (kein PDF - zusätzliche Bibliothek widerspräche dem "klein/kompakt"-Ziel des Images).
- **Granularität:** ein Eintrag pro Tag des Monats (Datum, Eintritte gesamt, eindeutige Besucher, Scan/Manuell) - keine Namen, rein aggregierte Zahlen.
- **Netzlaufwerk-Zugriff:** UNC-Pfad (`\\server\freigabe`), **kein** fester Laufwerksbuchstabe.

**Technische Konsequenz der UNC-Antwort:** Docker Desktop (WSL2-Backend) kann einen rohen UNC-Pfad nicht zuverlässig direkt als Bind-Mount-Quelle einbinden. Deshalb schreibt der Container in einen lokalen, bind-gemounteten Ordner `./reports` neben der `docker-compose.yml` (normaler Windows-Pfad, funktioniert zuverlässig - **neues Muster für dieses Projekt**, bisher gibt es dort nur das benannte Docker-Volume für Postgres, keinen Host-Bind-Mount). Ein separates Windows-Skript übernimmt per `robocopy` die Zustellung von dort auf den UNC-Pfad, geplant über die Windows-Aufgabenplanung - trennt "Bericht erzeugen" (Container) von "auf Netzlaufwerk kopieren" (Windows selbst, das UNC-Pfade nativ beherrscht).

**Befund bei der Datenquelle:** Das bereits vorhandene `statsService.getStatsByDay()` (`backend/src/services/stats.service.ts:89`) gruppiert Einträge nach `entry_time.toISOString().split('T')[0]` - also nach **UTC**-Kalendertag, nicht nach der korrekten Berlin-Zeitzone. Einträge zwischen Mitternacht und 1-2 Uhr lokal würden dadurch dem falschen (Vor-)Tag zugeordnet. Für einen lückenlosen, Finanzamt-tauglichen Bericht wird daher **nicht** `getStatsByDay` wiederverwendet, sondern eine neue, schlanke Funktion, die direkt nach der bereits korrekt befüllten `entry_date`-Spalte gruppiert (dieselbe Spalte, die `entries.service.ts:205,231` für exakte Tages-Lookups nutzt). `getStatsByDay` selbst bleibt unangetastet (andere Konsumenten, eigener Bugfix wäre ein separates Thema).

## Ansatz

### Backend

1. **`backend/src/lib/dateParams.ts`**: `monthRange(yearMonth)` (erster/letzter Tag + lückenlose Liste aller Kalendertage, lokale `Date`-Konstruktoren unter `TZ=Europe/Berlin`) und `getLastCompletedMonth()`.
2. **`backend/src/services/stats.service.ts`**: neue Funktion `getAttendanceByDay(from, to)` - `GROUP BY entry_date` direkt in SQL, inkl. `COUNT(DISTINCT member_id)` für eindeutige Besucher.
3. **`backend/src/services/reports.service.ts`** (neu): `generateMonthlyAttendanceReport()` (CSV im Stil von `entries.service.ts:213-241`, BOM-Präfix wie `entries.controller.ts:152`, atomarer Schreibvorgang über Temp-Datei + `rename`), `ensureMonthlyReportsUpToDate()` (selbstheilend bei Downtime), `listReports()`, `startMonthlyReportScheduler()` (Mutex-Flag, Start-Check + `setInterval` 6h, kein neuer npm-Dependency).
4. **`backend/src/controllers/reports.controller.ts`** + **`backend/src/routes/reports.routes.ts`** (neu): `GET /`, `POST /generate`, `GET /:filename/download` (`res.download`, Pfad-Traversal-Schutz via `path.basename`-Check).
5. **`backend/src/index.ts`**: Route unter `/api/v1/reports` mit `requireAdmin` mounten; Scheduler nach `ensureAdminUser()` starten.
6. **`Dockerfile`**: `REPORTS_DIR=/app/reports` (ENV + mkdir).

### Docker Compose

7. `docker-compose.standalone.yml`, `docker-compose.portable.yml`, `release/docker-compose.yml`: `./reports:/app/reports` Bind-Mount ergänzen.
8. `.gitignore`: `reports/` ergänzen.

### Zustellung ans Netzlaufwerk (Windows-seitig)

9. **`sync-reports-to-network.ps1`** (neu): Erreichbarkeits-Check vor dem Kopieren, `robocopy ... /E /R:3 /W:10 /LOG+:...` (kein `/MIR`, damit fremde Dateien am Ziel bleiben), korrekte Robocopy-Exitcode-Prüfung (`-ge 8` = Fehler, nicht `-ne 0`).
10. **Dokumentation**: README-Abschnitt "Finanzamt-Berichte" (Aufteilung Container/Windows-Skript, `schtasks`-Registrierung, Hinweis auf Ruhezustand - "Computer zur Ausführung aufwecken" aktivieren, gleiche Problemklasse wie die Docker-Desktop-Uhr-im-Standby-Problematik).
11. `build-portable.ps1`: `LIESMICH.txt`-Heredoc um Hinweis ergänzen, dass `reports/` echte Daten sind (anders als das Docker-Volume), die mitgenommen werden müssen.

### Frontend

12. **`frontend/src/api/reports.ts`** (neu): Download exakt im Stil von `entriesApi.exportMembers` (`entries.ts:32-38`, Blob + `Content-Disposition`-Header), da ein normaler `<a href>` kein Bearer-Token mitschickt.
13. **`frontend/src/pages/LogsPage.tsx`**: dritter Tab "Finanzamt" (Liste, Download, "Jetzt erzeugen"), **nur sichtbar wenn `useAuth().isAdmin`** - `/logs` ist nicht per `AdminRoute` geschützt, Sichtbarkeit muss in der Seite selbst geprüft werden.

## Kritische Dateien

- neu: `backend/src/services/reports.service.ts`, `backend/src/controllers/reports.controller.ts`, `backend/src/routes/reports.routes.ts`, `sync-reports-to-network.ps1`, `frontend/src/api/reports.ts`
- geändert: `backend/src/lib/dateParams.ts`, `backend/src/services/stats.service.ts`, `backend/src/index.ts`, `Dockerfile`, `docker-compose.standalone.yml`/`docker-compose.portable.yml`/`release/docker-compose.yml`, `.gitignore`, `build-portable.ps1`, `README.md`, `frontend/src/pages/LogsPage.tsx`

## Verifikation

1. `npm run build` in `backend/` und `frontend/` fehlerfrei.
2. `POST /api/v1/reports/generate` als Admin - Datei erscheint unter `./reports/Besucherstatistik_<yyyy-MM>.csv`, Inhalt (BOM, Spalten, lückenlose Tage) gegen direkte `entry_date`-Zählungen prüfen (**nicht** gegen `getStatsByDay`, wegen dessen UTC-Bug).
3. `GET /api/v1/reports` + Download im Frontend liefern korrekten Dateinamen/Inhalt.
4. Neustart-Test: Report-Datei löschen, Container neu starten - wird automatisch nachgeneriert.
5. `sync-reports-to-network.ps1` gegen Testordner: Datei kommt an, fremde Dateien am Ziel bleiben erhalten, nicht erreichbarer Pfad liefert `exit 1` statt Hängenbleiben.
6. Finanzamt-Tab nur für Admins sichtbar, Liste/Download/"Jetzt erzeugen" funktionieren.

## Vom Nutzer zu erledigen / Risiken

- `$NetworkPath` im Sync-Skript auf den tatsächlichen UNC-Pfad setzen und als tägliche Windows-Aufgabe registrieren (inkl. "Computer aufwecken", falls der PC schläft).
- Bei einem PC, der dauerhaft ausgeschaltet/im Standby ist, läuft weder die Generierung noch der Sync - kein Ersatz für eine eigene Überwachung, falls Verlässlichkeit kritisch ist.
- `getStatsByDay` hat den beschriebenen UTC-Bug weiterhin (nicht Teil dieses Plans); andere Statistik-Ansichten, die Tagesgrenzen nahe Mitternacht auswerten, sind davon separat betroffen.
