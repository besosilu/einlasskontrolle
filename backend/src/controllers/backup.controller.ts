import type { Request, Response, NextFunction } from 'express';
import * as backupService from '../services/backup.service.js';

export function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(backupService.listBackups());
  } catch (err) {
    next(err);
  }
}

export async function generate(_req: Request, res: Response, next: NextFunction) {
  try {
    const { filename } = await backupService.generateBackup();
    res.status(201).json({ filename });
  } catch (err) {
    next(err);
  }
}

export function download(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = backupService.getBackupPath(String(req.params['filename'] ?? ''));
    if (!filePath) {
      return res.status(404).json({ error: 'Sicherung nicht gefunden' });
    }
    res.download(filePath);
  } catch (err) {
    next(err);
  }
}
