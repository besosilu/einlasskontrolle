import { listBackupsRemote } from '../sourceClient.js';

export async function listBackupsTool() {
  const backups = await listBackupsRemote();
  return { content: [{ type: 'text' as const, text: JSON.stringify(backups, null, 2) }] };
}
