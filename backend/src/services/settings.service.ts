import fs from 'fs';
import path from 'path';
import sql from '../lib/db.js';

const INBOX_DIR = process.env['AUTO_IMPORT_INBOX_DIR'] ?? '/app/inbox';
const SYNC_CONFIG_FILE = path.join(INBOX_DIR, '.sync-config.json');

const AUTO_IMPORT_NETWORK_PATH_KEY = 'auto_import_network_path';

export async function getAutoImportNetworkPath(): Promise<string | null> {
  const [row] = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${AUTO_IMPORT_NETWORK_PATH_KEY}
  `;
  return row?.value ?? null;
}

// Schreibt die Brücken-Datei zuerst, da sie der eigentliche Zweck der Einstellung ist (das
// Windows-Sync-Skript liest sie direkt) - erst danach die DB, die nur der UI als Anzeige dient.
export async function setAutoImportNetworkPath(networkPath: string): Promise<void> {
  const trimmed = networkPath.trim();
  if (!trimmed) {
    throw new Error('Netzlaufwerk-Pfad darf nicht leer sein.');
  }

  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const tmpPath = `${SYNC_CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ networkPath: trimmed }));
  fs.renameSync(tmpPath, SYNC_CONFIG_FILE);

  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${AUTO_IMPORT_NETWORK_PATH_KEY}, ${trimmed}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
