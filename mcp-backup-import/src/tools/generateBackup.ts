import { generateBackupRemote } from '../sourceClient.js';

export async function generateBackupTool() {
  const result = await generateBackupRemote();
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}
