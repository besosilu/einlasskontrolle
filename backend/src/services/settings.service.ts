import sql from '../lib/db.js';

const AUTO_IMPORT_ENABLED_KEY = 'auto_import_enabled';

// Feature-Schalter des Auto-Imports. Ohne gespeicherten Wert gilt "an" (so lief er vor dem Schalter).
export async function getAutoImportEnabled(): Promise<boolean> {
  const [row] = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${AUTO_IMPORT_ENABLED_KEY}
  `;
  return row ? row.value === 'true' : true;
}

export async function setAutoImportEnabled(enabled: boolean): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${AUTO_IMPORT_ENABLED_KEY}, ${enabled ? 'true' : 'false'}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
