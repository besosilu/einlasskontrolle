import nodemailer from 'nodemailer';

const SMTP_HOST = process.env['SMTP_HOST'] ?? '';

function createTransporter() {
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(process.env['SMTP_PORT'] ?? '587'),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: process.env['SMTP_USER']
      ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] ?? '' }
      : undefined,
  });
}

const FROM = process.env['SMTP_FROM'] ?? 'Einlassüberwachung <noreply@localhost>';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[E-Mail] SMTP nicht konfiguriert – E-Mail nicht gesendet: ${subject} → ${to}`);
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}
