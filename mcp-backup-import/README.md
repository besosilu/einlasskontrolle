# mcp-backup-import

MCP-Server (stdio), der Sicherungen der Einlasskontrolle-App abruft und in eine zentrale
Postgres-Datenbank importiert (Offsite-Backup, Upsert, idempotent). Läuft lokal auf dem Rechner
des Nutzers - der Claude-Client startet den Prozess bei Bedarf selbst, kein Dauerbetrieb nötig.

Hintergrund/Entscheidungen: [`docs/plans/2026-10-backup-export-mcp.md`](../docs/plans/2026-10-backup-export-mcp.md).

## Einrichtung

```bash
cd mcp-backup-import
npm install
npm run build
```

### Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `APP_BASE_URL` | Basis-URL der Einlasskontrolle-App, z.B. `http://localhost:3001` (Standard, falls nicht gesetzt) |
| `BACKUP_API_KEY` | Derselbe Wert wie `BACKUP_API_KEY` in der `.env` der App |
| `CENTRAL_DATABASE_URL` | Postgres-Connection-String der zentralen Backup-Datenbank, z.B. `postgresql://user:pass@host:5432/zentrale_backup_db` - wird beim ersten Import automatisch mit dem benötigten Schema versehen |

### Einbindung in Claude Desktop / Claude Code

In der jeweiligen MCP-Server-Konfiguration (`claude_desktop_config.json` o.ä.):

```json
{
  "mcpServers": {
    "backup-import": {
      "command": "node",
      "args": ["F:/Entwicklung/EinlassÜberwachung/mcp-backup-import/dist/index.js"],
      "env": {
        "APP_BASE_URL": "http://localhost:3001",
        "BACKUP_API_KEY": "<gleicher Wert wie in der App-.env>",
        "CENTRAL_DATABASE_URL": "postgresql://user:pass@host:5432/zentrale_backup_db"
      }
    }
  }
}
```

## Tools

- `list_backups` - listet vorhandene Sicherungsdateien auf dem App-Server.
- `generate_backup` - erzeugt jetzt eine neue Sicherung auf dem App-Server.
- `import_backup` (optional: `filename`) - lädt die angegebene (oder neueste) Sicherung herunter und importiert sie
  per Upsert in `CENTRAL_DATABASE_URL`. Mehrfacher Import derselben/einer späteren Datei verursacht keine Duplikate.

## Wichtig

- Exportiert werden nur `members`, `entries`, `import_logs`, `import_member_links`, `price_items` -
  **nie** `users`/`registration_requests` (Passwort-Hashes verlassen das Haus nie).
- `import_backup` prüft die `schemaVersion` der Exportdatei gegen `SUPPORTED_SCHEMA_VERSION` in
  `src/targetDb.ts` und bricht bei Abweichung ab, statt blind zu importieren.
- Kein Ersatz für das reguläre `pg_dump`-Backup (siehe Haupt-`README.md`) - zusätzliche, strukturierte Offsite-Kopie.
