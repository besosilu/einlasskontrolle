const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
