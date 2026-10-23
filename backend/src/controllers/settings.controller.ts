import type { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service.js';

export async function getAutoImport(_req: Request, res: Response, next: NextFunction) {
  try {
    const networkPath = await settingsService.getAutoImportNetworkPath();
    res.json({ networkPath });
  } catch (err) {
    next(err);
  }
}

export async function setAutoImport(req: Request, res: Response, next: NextFunction) {
  try {
    const networkPath = typeof req.body['networkPath'] === 'string' ? req.body['networkPath'] : '';
    if (!networkPath.trim()) {
      return res.status(400).json({ error: 'Netzlaufwerk-Pfad darf nicht leer sein.' });
    }
    await settingsService.setAutoImportNetworkPath(networkPath);
    res.json({ networkPath: networkPath.trim() });
  } catch (err) {
    next(err);
  }
}
