import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import type { AuthRequest } from '../middleware/requireAuth.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    const result = await authService.login(email, password);
    if (!result) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    }

    res.json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ACCOUNT_LOCKED') {
      return res.status(403).json({ error: 'Konto gesperrt. Bitte wenden Sie sich an den Administrator.' });
    }
    if (err instanceof Error && err.message === 'ACCOUNT_NOT_ACTIVE') {
      return res.status(403).json({ error: 'Konto nicht aktiviert. Bitte prüfen Sie Ihre E-Mails.' });
    }
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, firstName, lastName, password } = req.body as {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
    };

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    await authService.register(email, firstName, lastName, password);
    res.status(201).json({ message: 'Registrierung erfolgreich. Bitte warten Sie auf die Genehmigung.' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert' });
    }
    if (err instanceof Error && err.message === 'REGISTRATION_PENDING') {
      return res.status(409).json({ error: 'Für diese E-Mail-Adresse liegt bereits eine Anfrage vor' });
    }
    next(err);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body as { token: string };
    if (!token) return res.status(400).json({ error: 'Token erforderlich' });

    await authService.activateAccount(token);
    res.json({ message: 'Konto erfolgreich aktiviert' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_TOKEN') {
      return res.status(400).json({ error: 'Ungültiger Aktivierungslink' });
    }
    if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
      return res.status(400).json({ error: 'Aktivierungslink abgelaufen' });
    }
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' });

    await authService.forgotPassword(email);
    res.json({ message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token und neues Passwort erforderlich' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_TOKEN') {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' });
    }
    if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
      return res.status(400).json({ error: 'Link abgelaufen. Bitte fordern Sie einen neuen an.' });
    }
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthRequest;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    const success = await authService.changePassword(userId, currentPassword, newPassword);
    if (!success) {
      return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
    }

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (err) {
    next(err);
  }
}

export async function setInitialPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthRequest;
    const { newPassword } = req.body as { newPassword: string };

    if (!newPassword) {
      return res.status(400).json({ error: 'Neues Passwort erforderlich' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    await authService.setInitialPassword(userId, newPassword);
    res.json({ message: 'Passwort erfolgreich gesetzt' });
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response) {
  const r = req as AuthRequest;
  res.json({ userId: r.userId, email: r.userEmail, role: r.userRole, isAdmin: r.isAdmin });
}
