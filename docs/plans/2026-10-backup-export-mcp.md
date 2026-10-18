# Plan: Backup-Export der DB + MCP-Server für Import in eine zentrale Sicherungs-DB

**Status:** genehmigt, Umsetzung begonnen
**Erstellt:** 2026-10-18

## Context

Für Mitglieder, Einträge usw. existiert bereits ein manueller, vollständiger `pg_dump`/`psql`-Weg (README, "Backup und Wiederherstellung") - das bleibt unverändert der Weg für eine komplette Katastrophen-Wiederherstellung desselben Schemas. Zusätzlich soll es einen **laufenden, strukturierten, App-internen Export** geben, der eine zweite ("zentrale") Postgres-Instanz an einem anderen Ort (eigener Rechner/NAS/Cloud-VM - noch nicht gebaut) mit den Daten dieses einen Vereins versorgt, rein zu Offsite-Backup-Zwecken (kein Multi-Mandanten-Aggregat). Format: JSON statt rohem SQL-Dump, robuster gegen Schema-Drift zwischen Quelle und Ziel. Auslösung ausschließlich manuell über einen Button in der Admin-UI. Konsumiert wird der Export über einen neuen MCP-Server (noch nicht gebaut), den der Nutzer über einen Claude-Client (Desktop/Code) anstößt.

### Mit dem Nutzer geklärt (final)

1. Zweck der zentralen DB: reines Offsite-Backup, ein Verein, keine Mandantentrennung nötig.
2. Format: strukturiertes JSON pro Tabelle, kein `pg_dump`.
3. Trigger: ausschließlich manuell, Button analog "Jetzt erzeugen" im Finanzamt-Tab.
4. MCP-Serverstandort/Transport: dem Planer überlassen - siehe Entscheidung unten.

## Entscheidungen

**Exportierte Tabellen:** `members`, `entries`, `import_logs`, `import_member_links`, `price_items` - vollständig. **Nicht exportiert:** `users`, `registration_requests` (enthalten `password_hash` - darf das Haus nie verlassen; Zugangskonten sind nach einer echten Wiederherstellung ohnehin bewusst neu zu vergeben, kein fachlicher Datenbestand), `_migrations` (rein technisch, quellsystem-spezifisch).

**JSON-Form:** eine Datei pro Lauf (`Sicherung_<yyyy-MM-ddTHH-mm-ss>.json`, Bindestriche statt `:` - Windows-Dateinamen), Top-Level `{ schemaVersion, exportedAt, tables: { <name>: { rowCount, rows } } }`. `schemaVersion` beschreibt nur die Form der Exportdatei (Tabellenliste/Spalten), nicht das interne Postgres-Schema - wird nur bei Vertragsänderung erhöht, nicht bei jeder Backend-Migration. Spaltennamen in `rows`: snake_case wie in Postgres (kein API-Mapping), da der Importer direkt gegen eine Ziel-Postgres arbeitet.

**Speicherort:** `BACKUP_DIR` (`./backups` - bereits in `.gitignore`), atomar geschrieben (`.tmp-<name>` + `fs.renameSync`), exakt das Muster aus `reports.service.ts`. Kein Scheduler (rein manuell).

**MCP-Server läuft lokal beim Nutzer** (dort wo der Claude-Client läuft), nicht im App-Container, nicht als Dauer-Dienst - stdio-Transport (`@modelcontextprotocol/sdk`), vom Claude-Client bei Bedarf gestartet. Begründung: Einzelperson, kein Mehrbenutzer-Fall, kein Mehrwert durch Netzwerk-Transport; ein Backup, das vom selben Host wie das Original liegt, schützt nicht gegen Hostausfall - der MCP-Server muss daher unabhängig vom App-Container sein. Eigenes Paket `mcp-backup-import/` auf oberster Ebene dieses Repos (gemeinsame Pflege von `schemaVersion` zwischen Exporteur und Importeur im selben PR).

**Der MCP-Server ruft die Backend-HTTP-API** (`/api/v1/backup/...`), statt direkt auf dem Dateisystem des App-Containers zu arbeiten (unterschiedliche Hosts/Dateisysteme in der Zielarchitektur; die API kennt bereits die Traversal-Guards und kann bei Bedarf frisch generieren).

**MCP-Tools:**
1. `list_backups` - `GET /api/v1/backup`.
2. `generate_backup` - `POST /api/v1/backup/generate`.
3. `import_backup` (Kernstück) - Datei holen, `schemaVersion` prüfen (unbekannt/höher → Fehler statt blinder Import), Zieltabellen per `CREATE TABLE IF NOT EXISTS` sicherstellen (fest verdrahtet pro `schemaVersion`), **Upsert** (`INSERT ... ON CONFLICT (id) DO UPDATE`) in einer einzigen Transaktion über alle Tabellen (alles-oder-nichts, analog `sql.begin()` in `import.service.ts`) - idempotent, mehrfacher Import derselben/späterer Datei dupliziert nichts. Natürliche Schlüssel: Quell-`id` 1:1 übernommen (Single-Source, kein `source_installation_id` nötig, da nur ein Verein).

**Sicherheit (Maschine-zu-Maschine-Auth):** statischer `BACKUP_API_KEY` (Env-Var, selbst generiert z.B. `openssl rand -hex 32`), Header `X-Backup-Api-Key`, Vergleich per `crypto.timingSafeEqual` in neuer Middleware `requireBackupApiKey.ts`. Kombinierte Middleware `requireAdminOrBackupApiKey` in `requireAuth.ts`: lässt bei gültigem Key-Header durch, fällt sonst auf normalen `requireAdmin` (Browser-JWT) zurück - ein Routensatz, zwei Zugriffswege. Ohne gesetzten `BACKUP_API_KEY` bleibt nur der Browser-Weg nutzbar (kein Verhaltensbruch für bestehende Nutzung). Kein TLS-Thema in diesem Plan - falls der Port je ins offene Internet exponiert wird, ist ein Key allein nicht ausreichend (VPN/Reverse-Proxy nötig, außerhalb dieses Scopes).

**Frontend:** vierter Tab "Sicherung" in `LogsPage.tsx`, 1:1 nach dem Vorbild des bestehenden `FinanzamtTab()` (Liste, Download, "Jetzt erzeugen"), nur sichtbar bei `useAuth().isAdmin`. Neuer `frontend/src/api/backup.ts` spiegelt `reports.ts` (Blob-Download, `Content-Disposition`-Parsing).

## Vorgehen

### Backend
1. `backend/src/services/backup.service.ts` (neu): `generateBackup()` (SELECT * je Tabelle, JSON bauen, atomar schreiben), `listBackups()`, `getBackupPath()` (Traversal-Guard wie `reports.service.ts`).
2. `backend/src/controllers/backup.controller.ts` + `backend/src/routes/backup.routes.ts` (neu): `GET /`, `POST /generate`, `GET /:filename/download` - Struktur 1:1 wie `reports.*`.
3. `backend/src/middleware/requireBackupApiKey.ts` (neu) + `requireAdminOrBackupApiKey` in `backend/src/middleware/requireAuth.ts`.
4. `backend/src/index.ts`: `app.use('/api/v1/backup', requireAdminOrBackupApiKey, backupRoutes)`.
5. `Dockerfile`: `ENV BACKUP_DIR=/app/backups`, `mkdir -p /app/backups`.
6. `.env.example`: `BACKUP_API_KEY=` mit Kommentar.

### Docker Compose
7. `docker-compose.standalone.yml`, `docker-compose.portable.yml`, `release/docker-compose.yml`, `docker-compose.dev.yml`: `BACKUP_API_KEY`-Env durchreichen, `./backups:/app/backups` Bind-Mount (`.gitignore`-Eintrag `backups/` existiert bereits).

### MCP-Server (neues Paket `mcp-backup-import/`)
8. `package.json` (neu): `@modelcontextprotocol/sdk`, `postgres` (gleicher Client wie Hauptprojekt), eigene TS-Toolchain.
9. `src/index.ts`: stdio-Server-Bootstrap, registriert die 3 Tools.
10. `src/sourceClient.ts`: HTTP-Client gegen `/api/v1/backup/*`, `X-Backup-Api-Key` aus Env.
11. `src/targetDb.ts`: Verbindung zur zentralen DB (`CENTRAL_DATABASE_URL`), `ensureTargetSchema()`, `upsertBackup()` (Transaktion + Upsert, s.o.).
12. `src/tools/{listBackups,generateBackup,importBackup}.ts`: Tool-Handler.
13. `mcp-backup-import/README.md`: Einrichtung, Beispiel-`claude_desktop_config.json`-Eintrag.

### Frontend
14. `frontend/src/api/backup.ts` (neu), `frontend/src/types/index.ts` (`BackupFile`-Typ), `frontend/src/pages/LogsPage.tsx` (vierter Tab "Sicherung", `BackupTab()`-Komponente).

### Dokumentation
15. `README.md`: neuer Abschnitt "Zentrale Backup-Sicherung (JSON-Export + MCP-Import)" - Verhältnis zum bestehenden `pg_dump`-Verfahren klarstellen (additiv, kein Ersatz), API-Key-Einrichtung.
16. `docs/README.md`: Zeile in der Plantabelle ergänzt.

## Kritische Dateien
`backend/src/services/backup.service.ts`, `backend/src/middleware/requireAuth.ts` (sicherheitskritische Änderung), `backend/src/index.ts` (Mount-Punkt), `mcp-backup-import/src/targetDb.ts` (Upsert/Idempotenz), `frontend/src/pages/LogsPage.tsx`.

## Verifikation
1. `npm run build` fehlerfrei in `backend/`, neu `mcp-backup-import/`, `frontend/`.
2. `POST /api/v1/backup/generate` als Admin - Datei mit korrekten Zeilenzahlen, keine `password_hash`-Spalte irgendwo in der Datei.
3. Download ohne Auth → 401/403; mit `X-Backup-Api-Key` ohne JWT → 200 (MCP-Pfad eigenständig); ohne gesetzten `BACKUP_API_KEY` bleibt Browser-Zugriff unverändert (Regression).
4. Pfad-Traversal (`../../etc/passwd`) → 404.
5. MCP-Server lokal starten, über Claude Desktop/Code verbinden, `list_backups`/`import_backup` gegen leere Test-DB - Zieltabellen werden angelegt, Zeilen korrekt.
6. Idempotenz: gleichen Export zweimal importieren → keine Duplikate. Re-Export nach neuen Daten → nur Deltas kommen hinzu/aktualisieren sich.
7. Frontend: "Sicherung"-Tab nur für Admins, Liste/Download/"Jetzt erzeugen" funktionieren.
8. Docker-Neustart: `./backups`-Bind-Mount bleibt erhalten.

## Risiken / offene Punkte
- Kein TLS in diesem Plan - API-Key allein reicht nicht, falls der Port je ins offene Internet exponiert wird.
- Bei einer möglichen künftigen Erweiterung auf mehrere Vereine in derselben zentralen DB wäre eine `source_installation_id`-Spalte nötig (aktuell bewusst weggelassen, da Single-Club).
- `mcp-backup-import/` liegt im selben Repo wie die App, aber als komplett eigenständiges Node-Paket (eigene `package.json`, läuft nie im Docker-Image mit).
