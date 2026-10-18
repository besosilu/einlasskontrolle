import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import * as statsService from './stats.service.js';
import { monthRange, yearRange, getLastCompletedMonth } from '../lib/dateParams.js';

const REPORTS_DIR = process.env['REPORTS_DIR'] ?? path.join(process.cwd(), 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const MEMBER_COLUMNS = [
  { header: 'Mitgliedsnummer', key: 'memberNumber', width: 16 },
  { header: 'Name', key: 'lastName', width: 22 },
  { header: 'Vorname', key: 'firstName', width: 22 },
];

function monthlyFilename(yearMonth: string): string {
  return `Besucherstatistik_${yearMonth}.xlsx`;
}

function yearlyFilename(year: string): string {
  return `Besucherstatistik_${year}.xlsx`;
}

async function writeWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<string> {
  const finalPath = path.join(REPORTS_DIR, filename);
  const tmpPath = path.join(REPORTS_DIR, `.tmp-${filename}`);
  await workbook.xlsx.writeFile(tmpPath);
  fs.renameSync(tmpPath, finalPath);
  return finalPath;
}

export { getLastCompletedMonth };

export async function generateMonthlyAttendanceReport(yearMonth: string): Promise<{ filename: string; path: string }> {
  const { from, to, days } = monthRange(yearMonth);
  const dayRows = await statsService.getAttendanceByDay(from, to);
  const byDate = new Map(dayRows.map((r) => [r.date, r]));

  const workbook = new ExcelJS.Workbook();

  const overview = workbook.addWorksheet('Übersicht');
  overview.columns = [
    { header: 'Datum', key: 'date', width: 14 },
    { header: 'Eintritte gesamt', key: 'total', width: 18 },
  ];
  for (const day of days) {
    overview.addRow({ date: day, total: byDate.get(day)?.total ?? 0 });
  }

  // Ein Sheet pro Tag, an dem tatsächlich gescannt wurde (keine leeren Tage).
  for (const day of days) {
    const total = byDate.get(day)?.total ?? 0;
    if (total === 0) continue;
    const members = await statsService.getMembersForDay(day);
    const sheet = workbook.addWorksheet(day);
    sheet.columns = MEMBER_COLUMNS;
    for (const m of members) {
      sheet.addRow({ memberNumber: m.memberNumber ?? '', lastName: m.lastName, firstName: m.firstName });
    }
  }

  const filename = monthlyFilename(yearMonth);
  const finalPath = await writeWorkbook(workbook, filename);
  return { filename, path: finalPath };
}

export async function generateYearlyAttendanceReport(year: string): Promise<{ filename: string; path: string }> {
  const { from, to, months } = yearRange(year);
  const monthRows = await statsService.getAttendanceByMonth(from, to);
  const byMonth = new Map(monthRows.map((r) => [r.month, r.total]));

  const workbook = new ExcelJS.Workbook();

  const overview = workbook.addWorksheet('Übersicht');
  overview.columns = [
    { header: 'Monat', key: 'month', width: 14 },
    { header: 'Eintritte gesamt', key: 'total', width: 18 },
  ];
  for (const month of months) {
    overview.addRow({ month, total: byMonth.get(month) ?? 0 });
  }

  // Ein Sheet pro Monat mit Eintritten (statt pro Tag) - sonst zu viele Sheets für ein ganzes Jahr.
  // Jede Zeile ist ein einzelner Besuch; Mitglieder, die mehrfach im Monat waren, erscheinen mehrfach.
  for (const month of months) {
    const total = byMonth.get(month) ?? 0;
    if (total === 0) continue;
    const { from: mFrom, to: mTo } = monthRange(month);
    const entries = await statsService.getEntriesForMonth(mFrom, mTo);
    const sheet = workbook.addWorksheet(month);
    sheet.columns = MEMBER_COLUMNS;
    for (const e of entries) {
      sheet.addRow({ memberNumber: e.memberNumber ?? '', lastName: e.lastName, firstName: e.firstName });
    }
  }

  const filename = yearlyFilename(year);
  const finalPath = await writeWorkbook(workbook, filename);
  return { filename, path: finalPath };
}

export async function ensureMonthlyReportsUpToDate(): Promise<void> {
  const target = getLastCompletedMonth();
  const expectedPath = path.join(REPORTS_DIR, monthlyFilename(target));
  if (!fs.existsSync(expectedPath)) {
    await generateMonthlyAttendanceReport(target);
  }
}

const MONTHLY_FILE_PATTERN = /^Besucherstatistik_(\d{4}-\d{2})\.xlsx$/;
const YEARLY_FILE_PATTERN = /^Besucherstatistik_(\d{4})\.xlsx$/;

export interface ReportFile {
  filename: string;
  period: string;
  scope: 'month' | 'year';
  sizeBytes: number;
  createdAt: string;
}

interface ParsedReportFilename {
  filename: string;
  period: string;
  scope: 'month' | 'year';
}

export function listReports(): ReportFile[] {
  return fs
    .readdirSync(REPORTS_DIR)
    .flatMap((filename): ParsedReportFilename[] => {
      const monthMatch = MONTHLY_FILE_PATTERN.exec(filename);
      if (monthMatch) return [{ filename, period: monthMatch[1], scope: 'month' }];
      const yearMatch = YEARLY_FILE_PATTERN.exec(filename);
      if (yearMatch) return [{ filename, period: yearMatch[1], scope: 'year' }];
      return [];
    })
    .map(({ filename, period, scope }): ReportFile => {
      const stat = fs.statSync(path.join(REPORTS_DIR, filename));
      return { filename, period, scope, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.scope === b.scope ? b.period.localeCompare(a.period) : a.scope.localeCompare(b.scope)));
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
