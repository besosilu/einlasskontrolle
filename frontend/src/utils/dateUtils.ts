import { format, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '–';
  return format(d, 'dd.MM.yyyy', { locale: de });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '–';
  return format(d, 'dd.MM.yyyy HH:mm', { locale: de });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '–';
  return format(d, 'HH:mm', { locale: de });
}

export function formatMonth(monthStr: string): string {
  const d = parseISO(monthStr + '-01');
  if (!isValid(d)) return monthStr;
  return format(d, 'MMMM yyyy', { locale: de });
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** "vor 3 Min." / "in 2 Min." relativ zu jetzt; für Statusanzeigen */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  const unit =
    abs < 60 ? `${abs} Sek.` :
    abs < 3600 ? `${Math.round(abs / 60)} Min.` :
    abs < 86400 ? `${Math.round(abs / 3600)} Std.` :
    `${Math.round(abs / 86400)} Tg.`;
  if (abs < 5) return 'gerade eben';
  return diffSec < 0 ? `vor ${unit}` : `in ${unit}`;
}
