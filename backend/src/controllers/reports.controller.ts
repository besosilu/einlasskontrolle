import type { Request, Response, NextFunction } from 'express';
import * as reportsService from '../services/reports.service.js';

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

export function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(reportsService.listReports());
  } catch (err) {
    next(err);
  }
}

export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = req.query['scope'] === 'year' ? 'year' : 'month';
    const period = typeof req.query['period'] === 'string' ? req.query['period'] : undefined;

    if (scope === 'year') {
      const year = period ?? String(new Date().getFullYear() - 1);
      if (!YEAR_PATTERN.test(year)) {
        return res.status(400).json({ error: 'Ungültiges Jahr (erwartet yyyy)' });
      }
      const { filename } = await reportsService.generateYearlyAttendanceReport(year);
      return res.status(201).json({ filename });
    }

    const month = period ?? reportsService.getLastCompletedMonth();
    if (!MONTH_PATTERN.test(month)) {
      return res.status(400).json({ error: 'Ungültiger Monat (erwartet yyyy-MM)' });
    }
    const { filename } = await reportsService.generateMonthlyAttendanceReport(month);
    res.status(201).json({ filename });
  } catch (err) {
    next(err);
  }
}

export function download(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = reportsService.getReportPath(String(req.params['filename'] ?? ''));
    if (!filePath) {
      return res.status(404).json({ error: 'Bericht nicht gefunden' });
    }
    res.download(filePath);
  } catch (err) {
    next(err);
  }
}
