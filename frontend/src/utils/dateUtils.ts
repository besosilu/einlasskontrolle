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
