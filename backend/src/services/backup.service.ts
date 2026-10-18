import fs from 'fs';
import path from 'path';
import sql from '../lib/db.js';

const BACKUP_DIR = process.env['BACKUP_DIR'] ?? path.join(process.cwd(), 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Nur fachlicher Datenbestand - niemals users/registration_requests (password_hash) oder _migrations.
export const SCHEMA_VERSION = 1;
const EXPORTED_TABLES = ['members', 'entries', 'import_logs', 'import_member_links', 'price_items'] as const;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, { rowCount: number; rows: Record<string, unknown>[] }>;
}

function backupFilename(now: Date): string {
  const stamp = now.toISOString().replace(/:/g, '-').replace(/\..+$/, '');
  return `Sicherung_${stamp}.json`;
}

export async function generateBackup(): Promise<{ filename: string; path: string }> {
  const tables: BackupPayload['tables'] = {};
  for (const table of EXPORTED_TABLES) {
    const rows = await sql.unsafe(`SELECT * FROM ${table} ORDER BY 1`);
    tables[table] = { rowCount: rows.length, rows: [...rows] as Record<string, unknown>[] };
  }

  const payload: BackupPayload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };

  const filename = backupFilename(new Date());
  const finalPath = path.join(BACKUP_DIR, filename);
  const tmpPath = path.join(BACKUP_DIR, `.tmp-${filename}`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, finalPath);
  return { filename, path: finalPath };
}

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

const BACKUP_FILE_PATTERN = /^Sicherung_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/;

export function listBackups(): BackupFile[] {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((filename) => BACKUP_FILE_PATTERN.test(filename))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

export function getBackupPath(filename: string): string | null {
  if (path.basename(filename) !== filename) return null;
  const exists = listBackups().some((b) => b.filename === filename);
  return exists ? path.join(BACKUP_DIR, filename) : null;
}
