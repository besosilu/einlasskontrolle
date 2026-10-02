import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import type { AuthRequest } from '../middleware/requireAuth.js';

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await authService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function getRegistrationRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await authService.listRegistrationRequests();
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function approveRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { userId } = req as AuthRequest;
    await authService.approveRegistration(parseInt(id), userId);
    res.json({ message: 'Registrierung genehmigt und Aktivierungslink gesendet' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }
    if (err instanceof Error && err.message === 'NOT_PENDING') {
      return res.status(409).json({ error: 'Anfrage wurde bereits bearbeitet' });
    }
    next(err);
  }
}

export async function rejectRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { userId } = req as AuthRequest;
    await authService.rejectRegistration(parseInt(id), userId);
    res.json({ message: 'Registrierung abgelehnt' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }
    if (err instanceof Error && err.message === 'NOT_PENDING') {
      return res.status(409).json({ error: 'Anfrage wurde bereits bearbeitet' });
    }
    next(err);
  }
}

export async function toggleLock(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { lock } = req.body as { lock: boolean };
    const { userId } = req as AuthRequest;

    if (parseInt(id) === userId) {
      return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht sperren' });
    }

    await authService.toggleUserLock(parseInt(id), lock);
    res.json({ message: lock ? 'Benutzer gesperrt' : 'Benutzer entsperrt' });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { userId } = req as AuthRequest;

    if (parseInt(id) === userId) {
      return res.status(400).json({ error: 'Sie können Ihr eigenes Konto nicht löschen' });
    }

    await authService.deleteUser(parseInt(id));
    res.json({ message: 'Benutzer gelöscht' });
  } catch (err) {
    next(err);
  }
}
