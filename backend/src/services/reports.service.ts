import fs from 'fs';
import path from 'path';
import * as statsService from './stats.service.js';
import { monthRange, getLastCompletedMonth } from '../lib/dateParams.js';

const REPORTS_DIR = process.env['REPORTS_DIR'] ?? path.join(process.cwd(), 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

function csvField(value: string | number): string {
  const v = String(value);
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function reportFilename(yearMonth: string): string {
  return `Besucherstatistik_${yearMonth}.csv`;
}

export { getLastCompletedMonth };

export async function generateMonthlyAttendanceReport(yearMonth: string): Promise<{ filename: string; path: string }> {
  const { from, to, days } = monthRange(yearMonth);
  const rows = await statsService.getAttendanceByDay(from, to);
  const byDate = new Map(rows.map((r) => [r.date, r]));

  const lines = ['Datum;Eintritte gesamt;Eindeutige Besucher;Scan;Manuell'];
  for (const day of days) {
    const r = byDate.get(day);
    lines.push(
      [day, r?.total ?? 0, r?.uniqueMembers ?? 0, r?.scanCount ?? 0, r?.manualCount ?? 0].map(csvField).join(';')
    );
  }
  const csv = '﻿' + lines.join('\r\n') + '\r\n';

  const filename = reportFilename(yearMonth);
  const finalPath = path.join(REPORTS_DIR, filename);
  const tmpPath = path.join(REPORTS_DIR, `.tmp-${filename}`);
  fs.writeFileSync(tmpPath, csv, 'utf-8');
  fs.renameSync(tmpPath, finalPath);

  return { filename, path: finalPath };
}

export async function ensureMonthlyReportsUpToDate(): Promise<void> {
  const target = getLastCompletedMonth();
  const expectedPath = path.join(REPORTS_DIR, reportFilename(target));
  if (!fs.existsSync(expectedPath)) {
    await generateMonthlyAttendanceReport(target);
  }
}

export function listReports(): { filename: string; yearMonth: string; sizeBytes: number; createdAt: string }[] {
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => /^Besucherstatistik_\d{4}-\d{2}\.csv$/.test(f))
    .map((filename) => {
      const stat = fs.statSync(path.join(REPORTS_DIR, filename));
      return {
        filename,
        yearMonth: filename.replace('Besucherstatistik_', '').replace('.csv', ''),
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
}

export function getReportPath(filename: string): string | null {
  if (path.basename(filename) !== filename) return null;
  const exists = listReports().some((r) => r.filename === filename);
  return exists ? path.join(REPORTS_DIR, filename) : null;
}

let running = false;
const SCHEDULER_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startMonthlyReportScheduler(): void {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await ensureMonthlyReportsUpToDate();
    } catch (err) {
      console.error('[reports] Fehler beim Erzeugen des Monatsberichts:', err);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, SCHEDULER_INTERVAL_MS);
}
