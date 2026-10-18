import type { BackupFile, BackupPayload } from './types.js';

const APP_BASE_URL = process.env['APP_BASE_URL'] ?? 'http://localhost:3001';

function authHeaders(): Record<string, string> {
  const key = process.env['BACKUP_API_KEY'];
  if (!key) {
    throw new Error('BACKUP_API_KEY ist nicht gesetzt (siehe mcp-backup-import/README.md).');
  }
  return { 'X-Backup-Api-Key': key };
}

export async function listBackupsRemote(): Promise<BackupFile[]> {
  const res = await fetch(`${APP_BASE_URL}/api/v1/backup`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Liste der Sicherungen fehlgeschlagen: HTTP ${res.status}`);
  }
  return res.json() as Promise<BackupFile[]>;
}

export async function generateBackupRemote(): Promise<{ filename: string }> {
  const res = await fetch(`${APP_BASE_URL}/api/v1/backup/generate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Erzeugen der Sicherung fehlgeschlagen: HTTP ${res.status}`);
  }
  return res.json() as Promise<{ filename: string }>;
}

export async function downloadBackupRemote(filename: string): Promise<BackupPayload> {
  const res = await fetch(`${APP_BASE_URL}/api/v1/backup/${encodeURIComponent(filename)}/download`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Download der Sicherung '${filename}' fehlgeschlagen: HTTP ${res.status}`);
  }
  return res.json() as Promise<BackupPayload>;
}
