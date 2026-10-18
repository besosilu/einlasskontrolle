const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** yyyy-MM-dd of a Date in the process time zone */
export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Validates a day sent by the client (the browser's date); undefined if missing or malformed. */
export function parseDay(value: unknown): string | undefined {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? value : undefined;
}

/** The browser's current time; the server clock is only a fallback because it can drift (e.g. Docker Desktop). */
export function parseClientNow(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/** First/last day (yyyy-MM-dd) and every calendar day in between, for a yyyy-MM month. */
export function monthRange(yearMonth: string): { from: string; to: string; days: string[] } {
  if (!MONTH_PATTERN.test(yearMonth)) {
    throw new Error(`Ungültiger Monat: ${yearMonth}`);
  }
  const [y, m] = yearMonth.split('-').map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);

  const days: string[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(toDayString(d));
  }

  return { from: toDayString(from), to: toDayString(to), days };
}

/** yyyy-MM of the last fully completed month (the current month doesn't count, it isn't over yet). */
export function getLastCompletedMonth(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** First/last day (yyyy-MM-dd) and every yyyy-MM month in between, for a yyyy year. */
export function yearRange(year: string): { from: string; to: string; months: string[] } {
  if (!YEAR_PATTERN.test(year)) {
    throw new Error(`Ungültiges Jahr: ${year}`);
  }
  const y = Number(year);
  const from = new Date(y, 0, 1);
  const to = new Date(y, 11, 31);
  const months = Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`);
  return { from: toDayString(from), to: toDayString(to), months };
}
