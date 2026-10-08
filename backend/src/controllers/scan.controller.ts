import type { Request, Response, NextFunction } from 'express';
import { findMemberByQrCode } from '../services/scan.service.js';
import * as entriesService from '../services/entries.service.js';
import { parseClientNow } from '../lib/dateParams.js';

export async function scan(req: Request, res: Response, next: NextFunction) {
  try {
    const { qrCode, entryDate, clientNow } = req.body as { qrCode: string; entryDate?: string; clientNow?: string };

    if (!qrCode?.trim()) {
      return res.status(400).json({ error: 'QR-Code darf nicht leer sein' });
    }

    const member = await findMemberByQrCode(qrCode);

    if (!member) {
      return res.status(404).json({
        error: 'Mitglied nicht gefunden',
        message: 'Der gescannte QR-Code konnte keinem Mitglied zugeordnet werden.',
        qrCode,
      });
    }

    // Duplicate check for the given date
    const existing = await entriesService.getExistingEntryForDate(member.id, entryDate);
    if (existing) {
      return res.status(200).json({
        entry: existing,
        member,
        warnings: [
          {
            type: 'already_checked_in',
            message: `${member.firstName} ${member.lastName} ist an diesem Tag bereits um ${existing.entryTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr eingelassen worden.`,
          },
        ],
        alreadyCheckedIn: true,
      });
    }

    const entry = await entriesService.createEntry({
      memberId: member.id,
      method: 'scan',
      entryDateOverride: entryDate,
      clientNow: parseClientNow(clientNow),
    });

    res.status(201).json({
      entry,
      member,
      warnings: [],
      alreadyCheckedIn: false,
    });
  } catch (err) {
    next(err);
  }
}
