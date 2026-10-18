import crypto from 'crypto';
import type { Request } from 'express';

// Zeitkonstanter Vergleich gegen den MCP-Backup-Importer; true nur bei exakt passendem Key.
// Ohne gesetztes BACKUP_API_KEY ist dieser Pfad immer deaktiviert (nie ein gültiger Treffer).
export function hasValidBackupApiKey(req: Request): boolean {
  const expected = process.env['BACKUP_API_KEY'];
  if (!expected) return false;

  const provided = req.headers['x-backup-api-key'];
  if (typeof provided !== 'string') return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
