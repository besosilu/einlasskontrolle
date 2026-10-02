import type { Request, Response, NextFunction } from 'express';
import * as membersService from '../services/members.service.js';

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const query = String(req.query['search'] ?? '');
    const limit = Math.min(Number(req.query['limit'] ?? 10), 50);
    const members = await membersService.searchMembers(query, limit);
    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await membersService.getMemberById(Number(req.params['id']));
    if (!member) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    res.json(member);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { lastName, firstName, memberNumber } = req.body as {
      lastName: string;
      firstName: string;
      memberNumber?: string;
    };
    if (!lastName || !firstName) {
      return res.status(400).json({ error: 'Name und Vorname sind erforderlich' });
    }
    const member = await membersService.createMember({ lastName, firstName, memberNumber });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await membersService.updateMember(
      Number(req.params['id']),
      req.body as { lastName?: string; firstName?: string; memberNumber?: string }
    );
    res.json(member);
  } catch (err) {
    next(err);
  }
}

export async function updateFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const { needsNewCard, isTrainer, isTrial, trialRegistrationDate } = req.body as {
      needsNewCard?: boolean;
      isTrainer?: boolean;
      isTrial?: boolean;
      trialRegistrationDate?: string | null;
    };
    const member = await membersService.updateMemberFlags(Number(req.params['id']), {
      needsNewCard,
      isTrainer,
      isTrial,
      trialRegistrationDate,
    });
    res.json(member);
  } catch (err) {
    next(err);
  }
}
