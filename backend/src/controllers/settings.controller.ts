import type { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service.js';
import { triggerAutoImportNow } from '../services/autoImport.service.js';

export async function getAutoImport(_req: Request, res: Response, next: NextFunction) {
  try {
    const [networkPath, enabled] = await Promise.all([
      settingsService.getAutoImportNetworkPath(),
      settingsService.getAutoImportEnabled(),
    ]);
    res.json({ networkPath, enabled });
  } catch (err) {
    next(err);
  }
}

// Netzlaufwerk-Pfad und Schalter sind getrennt änderbar; mindestens eines von beiden ist nötig.
export async function setAutoImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { networkPath, enabled } = req.body as { networkPath?: unknown; enabled?: unknown };
    if (networkPath === undefined && enabled === undefined) {
      return res.status(400).json({ error: 'networkPath oder enabled erforderlich.' });
    }

    if (networkPath !== undefined) {
      if (typeof networkPath !== 'string' || !networkPath.trim()) {
        return res.status(400).json({ error: 'Netzlaufwerk-Pfad darf nicht leer sein.' });
      }
      await settingsService.setAutoImportNetworkPath(networkPath);
    }
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled muss true oder false sein.' });
      }
      await settingsService.setAutoImportEnabled(enabled);
    }

    const [savedPath, savedEnabled] = await Promise.all([
      settingsService.getAutoImportNetworkPath(),
      settingsService.getAutoImportEnabled(),
    ]);
    res.json({ networkPath: savedPath, enabled: savedEnabled });
  } catch (err) {
    next(err);
  }
}

export async function runAutoImport(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await triggerAutoImportNow();
    if (result === 'disabled') {
      return res.status(409).json({ error: 'Der Auto-Import ist ausgeschaltet.' });
    }
    if (result === 'busy') {
      return res.status(409).json({ error: 'Es läuft bereits ein Durchlauf.' });
    }
    res.status(202).json({ started: true });
  } catch (err) {
    next(err);
  }
}
