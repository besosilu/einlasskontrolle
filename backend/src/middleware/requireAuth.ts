import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service.js';

export interface AuthRequest extends Request {
  userId: number;
  userEmail: string;
  userRole: string;
  isAdmin: boolean;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sitzung abgelaufen' });
  }

  const r = req as AuthRequest;
  r.userId = payload.userId;
  r.userEmail = payload.email;
  r.userRole = payload.role;
  r.isAdmin = payload.role === 'admin';
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!(req as AuthRequest).isAdmin) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    next();
  });
}
