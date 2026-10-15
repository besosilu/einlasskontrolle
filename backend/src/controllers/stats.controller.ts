import type { Request, Response, NextFunction } from 'express';
import * as statsService from '../services/stats.service.js';
import { parseDay } from '../lib/dateParams.js';
import type { AuthRequest } from '../middleware/requireAuth.js';
import {
  Anthropic,
  chatModel,
  chatRequestSchema,
  isChatConfigured,
  runStatsChat,
} from '../services/statsChat.service.js';

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

// ---- Statistics chat ----

const CHAT_LIMIT_PER_MINUTE = 20;
const recentChats = new Map<number, number[]>();

function chatRateLimited(userId: number): boolean {
  const now = Date.now();
  const recent = (recentChats.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= CHAT_LIMIT_PER_MINUTE) {
    recentChats.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentChats.set(userId, recent);
  return false;
}

export function chatStatus(_req: Request, res: Response) {
  res.json({ configured: isChatConfigured(), model: chatModel() });
}

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    const last = parsed.success ? parsed.data.messages[parsed.data.messages.length - 1] : undefined;
    if (!parsed.success || last?.role !== 'user') {
      return res.status(400).json({ error: 'Ungültige Anfrage (1-40 Nachrichten bis 2000 Zeichen, die letzte vom Benutzer, plus Datum).' });
    }
    if (!parseDay(parsed.data.today)) {
      return res.status(400).json({ error: 'Ungültiges Datum.' });
    }
    if (!isChatConfigured()) {
      return res.status(503).json({
        error: 'Die KI-Auswertung ist nicht eingerichtet. Ein Administrator muss ANTHROPIC_API_KEY in der .env eintragen.',
        code: 'not_configured',
      });
    }
    if (chatRateLimited((req as AuthRequest).userId)) {
      return res.status(429).json({ error: 'Zu viele Fragen in kurzer Zeit. Bitte kurz warten.' });
    }

    res.json(await runStatsChat(parsed.data));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[stats-chat] API key rejected');
      return res.status(502).json({ error: 'Der API-Key für die KI-Auswertung wurde abgelehnt.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Die KI ist gerade überlastet. Bitte gleich noch einmal versuchen.' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(503).json({ error: 'Keine Verbindung zur KI. Ist der Computer mit dem Internet verbunden?' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[stats-chat] API error', err.status, err.message);
      return res.status(502).json({ error: 'Die KI-Auswertung ist gerade nicht verfügbar.' });
    }
    next(err);
  }
}
