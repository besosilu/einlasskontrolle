import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sql from '../lib/db.js';
import { sendEmail } from './email.service.js';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'einlass-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const APP_URL = process.env['APP_URL'] ?? 'http://localhost:5173';
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? '';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const TOKEN_EXPIRES_HOURS = 24;

interface UserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: Date | null;
}

export async function ensureAdminUser() {
  const [existing] = await sql<{ id: number }[]>`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (existing) return;

  const hash = await bcrypt.hash('admin', 10);
  await sql`
    INSERT INTO users (email, first_name, last_name, password_hash, role, is_active, must_change_password)
    VALUES ('admin@local', 'Admin', 'Administrator', ${hash}, 'admin', true, true)
  `;
  console.log('Admin-Benutzer erstellt: admin@local / admin (Passwort muss geändert werden)');
}

export async function register(
  email: string,
  firstName: string,
  lastName: string,
  password: string
) {
  const lowerEmail = email.toLowerCase();

  const [existingUser] = await sql`SELECT id FROM users WHERE email = ${lowerEmail}`;
  if (existingUser) throw new Error('EMAIL_EXISTS');

  const [existingReq] =
    await sql`SELECT id FROM registration_requests WHERE email = ${lowerEmail} AND status = 'pending'`;
  if (existingReq) throw new Error('REGISTRATION_PENDING');

  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO registration_requests (email, first_name, last_name, password_hash)
    VALUES (${lowerEmail}, ${firstName}, ${lastName}, ${hash})
  `;

  if (ADMIN_EMAIL) {
    sendEmail({
      to: ADMIN_EMAIL,
      subject: 'Neue Registrierungsanfrage – Einlassüberwachung',
      html: `<p>Neue Registrierungsanfrage von <strong>${firstName} ${lastName}</strong> (${lowerEmail}).</p>
             <p>Bitte melden Sie sich an und genehmigen oder lehnen Sie die Anfrage ab.</p>`,
    }).catch(console.error);
  }
}

export async function approveRegistration(requestId: number, adminId: number) {
  const [req] = await sql<
    {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      password_hash: string;
      status: string;
    }[]
  >`SELECT * FROM registration_requests WHERE id = ${requestId}`;
  if (!req) throw new Error('NOT_FOUND');
  if (req.status !== 'pending') throw new Error('NOT_PENDING');

  const activationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

  await sql`
    INSERT INTO users (email, first_name, last_name, password_hash, role, is_active, activation_token, activation_token_expires)
    VALUES (${req.email}, ${req.first_name}, ${req.last_name}, ${req.password_hash}, 'user', false, ${activationToken}, ${tokenExpires})
  `;

  await sql`
    UPDATE registration_requests
    SET status = 'approved', reviewed_at = now(), reviewed_by = ${adminId}
    WHERE id = ${requestId}
  `;

  const activationLink = `${APP_URL}/activate?token=${activationToken}`;
  await sendEmail({
    to: req.email,
    subject: 'Konto genehmigt – Bitte aktivieren Sie Ihr Konto',
    html: `<p>Hallo ${req.first_name},</p>
           <p>Ihre Registrierung wurde genehmigt. Klicken Sie auf den folgenden Link, um Ihr Konto zu aktivieren:</p>
           <p><a href="${activationLink}">${activationLink}</a></p>
           <p>Der Link ist 24 Stunden gültig.</p>`,
  });
}

export async function rejectRegistration(requestId: number, adminId: number) {
  const [req] =
    await sql<{ status: string }[]>`SELECT status FROM registration_requests WHERE id = ${requestId}`;
  if (!req) throw new Error('NOT_FOUND');
  if (req.status !== 'pending') throw new Error('NOT_PENDING');

  await sql`
    UPDATE registration_requests
    SET status = 'rejected', reviewed_at = now(), reviewed_by = ${adminId}
    WHERE id = ${requestId}
  `;
}

export async function activateAccount(token: string) {
  const [user] = await sql<{ id: number; activation_token_expires: Date }[]>`
    SELECT id, activation_token_expires FROM users
    WHERE activation_token = ${token} AND is_active = false
  `;
  if (!user) throw new Error('INVALID_TOKEN');
  if (new Date() > new Date(user.activation_token_expires)) throw new Error('TOKEN_EXPIRED');

  await sql`
    UPDATE users
    SET is_active = true, activation_token = null, activation_token_expires = null
    WHERE id = ${user.id}
  `;
}

export async function login(email: string, password: string) {
  const lowerEmail = email.toLowerCase();
  const [user] = await sql<UserRow[]>`
    SELECT id, email, first_name, last_name, password_hash, role, is_active,
           must_change_password, failed_attempts, locked_until
    FROM users WHERE email = ${lowerEmail}
  `;
  if (!user) return null;

  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    throw new Error('ACCOUNT_LOCKED');
  }

  if (!user.is_active) {
    throw new Error('ACCOUNT_NOT_ACTIVE');
  }

  if (!user.password_hash) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const newAttempts = user.failed_attempts + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await sql`UPDATE users SET failed_attempts = ${newAttempts}, locked_until = ${lockedUntil} WHERE id = ${user.id}`;
      throw new Error('ACCOUNT_LOCKED');
    }
    await sql`UPDATE users SET failed_attempts = ${newAttempts} WHERE id = ${user.id}`;
    return null;
  }

  await sql`UPDATE users SET failed_attempts = 0, locked_until = null WHERE id = ${user.id}`;

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    mustChangePassword: user.must_change_password,
  };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const [user] =
    await sql<UserRow[]>`SELECT id, password_hash FROM users WHERE id = ${userId}`;
  if (!user) return false;

  if (user.password_hash) {
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return false;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${hash}, must_change_password = false WHERE id = ${userId}`;
  return true;
}

export async function setInitialPassword(userId: number, newPassword: string) {
  const hash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${hash}, must_change_password = false WHERE id = ${userId}`;
}

export async function forgotPassword(email: string) {
  const lowerEmail = email.toLowerCase();
  const [user] = await sql<{ id: number; first_name: string }[]>`
    SELECT id, first_name FROM users WHERE email = ${lowerEmail} AND is_active = true
  `;
  if (!user) return;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);

  await sql`
    UPDATE users SET reset_token = ${resetToken}, reset_token_expires = ${tokenExpires}
    WHERE id = ${user.id}
  `;

  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: lowerEmail,
    subject: 'Passwort zurücksetzen – Einlassüberwachung',
    html: `<p>Hallo ${user.first_name},</p>
           <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:</p>
           <p><a href="${resetLink}">${resetLink}</a></p>
           <p>Der Link ist 24 Stunden gültig. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const [user] = await sql<{ id: number; reset_token_expires: Date }[]>`
    SELECT id, reset_token_expires FROM users WHERE reset_token = ${token}
  `;
  if (!user) throw new Error('INVALID_TOKEN');
  if (new Date() > new Date(user.reset_token_expires)) throw new Error('TOKEN_EXPIRED');

  const hash = await bcrypt.hash(newPassword, 10);
  await sql`
    UPDATE users
    SET password_hash = ${hash}, reset_token = null, reset_token_expires = null,
        failed_attempts = 0, locked_until = null
    WHERE id = ${user.id}
  `;
}

export function verifyToken(token: string): { userId: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string; role: string };
  } catch {
    return null;
  }
}

export async function listUsers() {
  return sql<
    {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      is_active: boolean;
      must_change_password: boolean;
      failed_attempts: number;
      locked_until: Date | null;
      created_at: Date;
    }[]
  >`
    SELECT id, email, first_name, last_name, role, is_active, must_change_password,
           failed_attempts, locked_until, created_at
    FROM users ORDER BY created_at DESC
  `;
}

export async function listRegistrationRequests() {
  return sql<
    {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      status: string;
      created_at: Date;
      reviewed_at: Date | null;
    }[]
  >`
    SELECT id, email, first_name, last_name, status, created_at, reviewed_at
    FROM registration_requests ORDER BY created_at DESC
  `;
}

export async function toggleUserLock(userId: number, lock: boolean) {
  if (lock) {
    const lockedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    await sql`
      UPDATE users SET locked_until = ${lockedUntil}, failed_attempts = ${MAX_FAILED_ATTEMPTS}
      WHERE id = ${userId}
    `;
  } else {
    await sql`UPDATE users SET locked_until = null, failed_attempts = 0 WHERE id = ${userId}`;
  }
}

export async function deleteUser(userId: number) {
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
