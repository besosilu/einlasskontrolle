import type { Request, Response, NextFunction } from 'express';
import * as statsService from '../services/stats.service.js';
import { parseDay } from '../lib/dateParams.js';

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getDashboard(parseDay(req.query['date']));
    res.json(data);
  } catch (err) { next(err); }
}

export async function workload(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getWorkload();
    res.json(data);
  } catch (err) { next(err); }
}

export async function byDay(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getStatsByDay(
      req.query['from'] as string | undefined,
      req.query['to'] as string | undefined
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function byMember(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getStatsByMember(Number(req.params['id']));
    if (!data) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function newCardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getNewCardStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await statsService.getSummary(
      req.query['from'] as string | undefined,
      req.query['to'] as string | undefined
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}
