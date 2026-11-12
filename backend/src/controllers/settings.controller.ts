import type { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service.js';
import { triggerAutoImportNow } from '../services/autoImport.service.js';

export async function getAutoImport(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ enabled: await settingsService.getAutoImportEnabled() });
  } catch (err) {
    next(err);
  }
}

export async function setAutoImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { enabled } = req.body as { enabled?: unknown };
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled muss true oder false sein.' });
    }
    await settingsService.setAutoImportEnabled(enabled);
    res.json({ enabled: await settingsService.getAutoImportEnabled() });
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
