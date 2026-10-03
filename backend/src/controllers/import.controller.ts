import type { Request, Response, NextFunction } from 'express';
import * as importService from '../services/import.service.js';

// Erkennt ein Datum im Format yyyy-mm-dd irgendwo im Dateinamen, z.B. "scan_2026-09-15.csv"
function extractDateFromFilename(filename: string): string | undefined {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (isNaN(date.getTime())) return undefined;
  return `${year}-${month}-${day}`;
}

export async function importMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }

    const fallbackEntryDate = typeof req.body['entryDate'] === 'string' ? req.body['entryDate'] : undefined;
    const results = [];

    for (const file of files) {
      const content = file.buffer.toString('utf-8').replace(/^\uFEFF/, ''); // BOM removal
      const resolvedEntryDate = extractDateFromFilename(file.originalname) ?? fallbackEntryDate;
      try {
        const result = await importService.importMembersFromCsv(content, file.originalname, resolvedEntryDate);
        results.push({ ...result, filename: file.originalname, resolvedEntryDate });
      } catch (err) {
        results.push({
          filename: file.originalname,
          resolvedEntryDate,
          importId: null,
          recordsTotal: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [{ line: 0, content: '', reason: err instanceof Error ? err.message : 'Unbekannter Fehler' }],
          failed: true,
        });
      }
    }

    res.status(201).json({ results });
  } catch (err) {
    next(err);
  }
}

export async function getLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
    const offset = Number(req.query['offset'] ?? 0);
    const result = await importService.getImportLogs(limit, offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteLog(req: Request, res: Response, next: NextFunction) {
  try {
    await importService.deleteImportLog(Number(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getLogById(req: Request, res: Response, next: NextFunction) {
  try {
    const log = await importService.getImportLogById(Number(req.params['id']));
    if (!log) return res.status(404).json({ error: 'Import-Log nicht gefunden' });
    res.json(log);
  } catch (err) {
    next(err);
  }
}
