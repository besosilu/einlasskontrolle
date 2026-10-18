import { downloadBackupRemote, listBackupsRemote } from '../sourceClient.js';
import { importBackupIntoTargetDb, SUPPORTED_SCHEMA_VERSION } from '../targetDb.js';

export async function importBackupTool(filename?: string) {
  let target = filename;
  if (!target) {
    const backups = await listBackupsRemote();
    if (backups.length === 0) {
      throw new Error('Keine Sicherungsdateien vorhanden - zuerst generate_backup aufrufen.');
    }
    target = backups[0]!.filename; // listBackupsRemote liefert neueste zuerst (gleiche Sortierung wie backend)
  }

  const payload = await downloadBackupRemote(target);
  if (payload.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Unbekannte schemaVersion ${payload.schemaVersion} (erwartet ${SUPPORTED_SCHEMA_VERSION}) - Import abgebrochen, bitte mcp-backup-import aktualisieren.`,
    );
  }

  const importedRows = await importBackupIntoTargetDb(payload);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ filename: target, schemaVersion: payload.schemaVersion, importedRows }, null, 2),
      },
    ],
  };
}
