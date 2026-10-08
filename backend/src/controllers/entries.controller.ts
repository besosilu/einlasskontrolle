import type { Request, Response, NextFunction } from 'express';
import * as entriesService from '../services/entries.service.js';
import * as membersService from '../services/members.service.js';
import type { Warning } from '../types/api.types.js';
import { parseClientNow, parseDay, toDayString } from '../lib/dateParams.js';

export async function getTodayCount(req: Request, res: Response, next: NextFunction) {
  try {
    const day = parseDay(req.query['date']) ?? toDayString(new Date());
    const count = await entriesService.getTodayCount(day);
    res.json({ count, date: day });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await entriesService.getEntries({
      date: req.query['date'] as string | undefined,
      memberId: req.query['member_id'] ? Number(req.query['member_id']) : undefined,
      from: req.query['from'] as string | undefined,
      to: req.query['to'] as string | undefined,
      method: req.query['method'] as string | undefined,
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      offset: req.query['offset'] ? Number(req.query['offset']) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, lastName, firstName, memberNumber, method, notes, entryDate, clientNow } = req.body as {
      clientNow?: string;
      memberId?: number;
      lastName?: string;
      firstName?: string;
      memberNumber?: string;
      method: 'scan' | 'manual';
      notes?: string;
      entryDate?: string;
    };

    if (!method || !['scan', 'manual'].includes(method)) {
      return res.status(400).json({ error: 'Methode muss "scan" oder "manual" sein' });
    }

    let resolvedMemberId = memberId;

    // If no memberId, find or create by name
    if (!resolvedMemberId) {
      if (!lastName || !firstName) {
        return res
          .status(400)
          .json({ error: 'memberId oder Name + Vorname erforderlich' });
      }
      const { member } = await membersService.findOrCreateMember(
        lastName,
        firstName,
        memberNumber
      );
      resolvedMemberId = member.id;
    }

    const warnings: Warning[] = [];

    // Check duplicate (same person, same day)
    const existing = await entriesService.getExistingEntryForDate(resolvedMemberId, entryDate);
    if (existing) {
      const member = await membersService.getMemberById(resolvedMemberId);
      return res.status(200).json({
        entry: existing,
        member,
        warnings: [
          {
            type: 'already_checked_in',
            message: `${existing.member.firstName} ${existing.member.lastName} ist heute bereits um ${existing.entryTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr eingelassen worden.`,
          },
        ],
        alreadyCheckedIn: true,
      });
    }

    // Manual frequency warning
    if (method === 'manual') {
      const warning = await entriesService.checkManualWarning(resolvedMemberId);
      if (warning) warnings.push(warning);
    }

    // Trial training warning (after 3rd visit)
    const member = await membersService.getMemberById(resolvedMemberId);
    if (member?.isTrial) {
      const trialWarning = await entriesService.checkTrialWarning(resolvedMemberId);
      if (trialWarning) warnings.push(trialWarning);
    }

    const entry = await entriesService.createEntry({
      memberId: resolvedMemberId,
      method,
      notes,
      entryDateOverride: entryDate,
      clientNow: parseClientNow(clientNow),
    });

    res.status(201).json({
      entry,
      member: entry.member,
      warnings,
      alreadyCheckedIn: false,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const { notes } = req.body as { notes: string | null };
    const entry = await entriesService.updateEntryNotes(Number(req.params['id']), notes ?? null);
    if (!entry) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.json(entry);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await entriesService.deleteEntry(Number(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const EXPORT_FILENAMES = { 'new-card': 'neuer-ausweis', trial: 'schnupper-training', 'pre-swim': 'vorschwimmen' } as const;

export async function exportMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const day = parseDay(req.query['date']);
    const kind = req.query['type'] as string;
    if (!day) return res.status(400).json({ error: 'Datum (yyyy-MM-dd) erforderlich' });
    if (kind !== 'new-card' && kind !== 'trial' && kind !== 'pre-swim') {
      return res.status(400).json({ error: 'type muss "new-card", "trial" oder "pre-swim" sein' });
    }

    const { csv } = await entriesService.exportMembersForDay(day, kind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${EXPORT_FILENAMES[kind]}_${day}.csv"`);
    // BOM so Excel opens umlauts correctly; the importer strips it again
    res.send('﻿' + csv);
  } catch (err) {
    next(err);
  }
}

export async function exportSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const day = parseDay(req.query['date']);
    if (!day) return res.status(400).json({ error: 'Datum (yyyy-MM-dd) erforderlich' });
    res.json(await entriesService.getExportSummary(day));
  } catch (err) {
    next(err);
  }
}
