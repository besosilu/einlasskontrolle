import type { Request, Response, NextFunction } from 'express';
import * as importService from '../services/import.service.js';

export async function importMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const content = file.buffer.toString('utf-8').replace(/^\uFEFF/, ''); // BOM removal
    const entryDate = typeof req.body['entryDate'] === 'string' ? req.body['entryDate'] : undefined;
    const result = await importService.importMembersFromCsv(content, file.originalname, entryDate);
    res.status(201).json(result);
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
