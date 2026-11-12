import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import * as statsService from './stats.service.js';
import { csvField } from './entries.service.js';
import { monthRange, yearRange, getLastCompletedMonth } from '../lib/dateParams.js';

const REPORTS_DIR = process.env['REPORTS_DIR'] ?? path.join(process.cwd(), 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const MEMBER_COLUMNS = [
  { header: 'Mitgliedsnummer', key: 'memberNumber', width: 16 },
  { header: 'Name', key: 'lastName', width: 22 },
  { header: 'Vorname', key: 'firstName', width: 22 },
];

export type ReportFormat = 'xlsx' | 'csv';

// Ein Tabellenblatt: wird als Excel-Sheet oder als eine CSV-Datei geschrieben
interface ReportSheet {
  name: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string | number>[];
}

// CSV-Berichte liegen als Ordner (ohne Endung) im Berichtsordner, Excel-Berichte als .xlsx-Datei
function monthlyBase(yearMonth: string): string {
  return `Finanzamt_Monat_${yearMonth}`;
}

function yearlyBase(year: string): string {
  return `Finanzamt_Jahr_${year}`;
}

async function writeXlsx(sheets: ReportSheet[], base: string): Promise<{ filename: string; path: string }> {
  const workbook = new ExcelJS.Workbook();
  for (const s of sheets) {
    const sheet = workbook.addWorksheet(s.name);
    sheet.columns = s.columns;
    for (const row of s.rows) sheet.addRow(row);
  }
  const filename = `${base}.xlsx`;
  const finalPath = path.join(REPORTS_DIR, filename);
  const tmpPath = path.join(REPORTS_DIR, `.tmp-${filename}`);
  await workbook.xlsx.writeFile(tmpPath);
  fs.renameSync(tmpPath, finalPath);
  return { filename, path: finalPath };
}

// Eine CSV-Datei pro Sheet im Ordner <base>/ - gleiche Konventionen wie die übrigen CSV-Exporte
// (; getrennt, \r\n, UTF-8 mit BOM). Der Ordner wird erst fertig befüllt und dann umbenannt.
function writeCsvFolder(sheets: ReportSheet[], base: string): { filename: string; path: string } {
  const finalPath = path.join(REPORTS_DIR, base);
  const tmpPath = path.join(REPORTS_DIR, `.tmp-${base}`);
  fs.rmSync(tmpPath, { recursive: true, force: true });
  fs.mkdirSync(tmpPath);
  for (const s of sheets) {
    const lines = [
      s.columns.map((c) => csvField(c.header)).join(';'),
      ...s.rows.map((r) => s.columns.map((c) => csvField(String(r[c.key] ?? ''))).join(';')),
    ];
    fs.writeFileSync(path.join(tmpPath, `${s.name}.csv`), '﻿' + lines.join('\r\n') + '\r\n', 'utf-8');
  }
  fs.rmSync(finalPath, { recursive: true, force: true });
  fs.renameSync(tmpPath, finalPath);
  return { filename: base, path: finalPath };
}

async function writeReport(sheets: ReportSheet[], base: string, format: ReportFormat) {
  return format === 'csv' ? writeCsvFolder(sheets, base) : writeXlsx(sheets, base);
}

export { getLastCompletedMonth };

export async function generateMonthlyAttendanceReport(
  yearMonth: string,
  format: ReportFormat = 'xlsx'
): Promise<{ filename: string; path: string }> {
  const { from, to, days } = monthRange(yearMonth);
  const dayRows = await statsService.getAttendanceByDay(from, to);
  const byDate = new Map(dayRows.map((r) => [r.date, r]));

  const sheets: ReportSheet[] = [
    {
      name: 'Übersicht',
      columns: [
        { header: 'Datum', key: 'date', width: 14 },
        { header: 'Eintritte gesamt', key: 'total', width: 18 },
      ],
      rows: days.map((day) => ({ date: day, total: byDate.get(day)?.total ?? 0 })),
    },
  ];

  // Ein Sheet pro Tag, an dem tatsächlich gescannt wurde (keine leeren Tage).
  for (const day of days) {
    if ((byDate.get(day)?.total ?? 0) === 0) continue;
    const members = await statsService.getMembersForDay(day);
    sheets.push({
      name: day,
      columns: MEMBER_COLUMNS,
      rows: members.map((m) => ({ memberNumber: m.memberNumber ?? '', lastName: m.lastName, firstName: m.firstName })),
    });
  }

  return writeReport(sheets, monthlyBase(yearMonth), format);
}

export async function generateYearlyAttendanceReport(
  year: string,
  format: ReportFormat = 'xlsx'
): Promise<{ filename: string; path: string }> {
  const { from, to, months } = yearRange(year);
  const monthRows = await statsService.getAttendanceByMonth(from, to);
  const byMonth = new Map(monthRows.map((r) => [r.month, r.total]));

  const sheets: ReportSheet[] = [
    {
      name: 'Übersicht',
      columns: [
        { header: 'Monat', key: 'month', width: 14 },
        { header: 'Eintritte gesamt', key: 'total', width: 18 },
      ],
      rows: months.map((month) => ({ month, total: byMonth.get(month) ?? 0 })),
    },
  ];

  // Ein Sheet pro Monat mit Eintritten (statt pro Tag) - sonst zu viele Sheets für ein ganzes Jahr.
  // Jede Zeile ist ein einzelner Besuch; Mitglieder, die mehrfach im Monat waren, erscheinen mehrfach.
  for (const month of months) {
    if ((byMonth.get(month) ?? 0) === 0) continue;
    const { from: mFrom, to: mTo } = monthRange(month);
    const entries = await statsService.getEntriesForMonth(mFrom, mTo);
    sheets.push({
      name: month,
      columns: MEMBER_COLUMNS,
      rows: entries.map((e) => ({ memberNumber: e.memberNumber ?? '', lastName: e.lastName, firstName: e.firstName })),
    });
  }

  return writeReport(sheets, yearlyBase(year), format);
}

export async function ensureMonthlyReportsUpToDate(): Promise<void> {
  const target = getLastCompletedMonth();
  const expectedPath = path.join(REPORTS_DIR, `${monthlyBase(target)}.xlsx`);
  if (!fs.existsSync(expectedPath)) {
    await generateMonthlyAttendanceReport(target);
  }
}

const MONTHLY_FILE_PATTERN = /^Finanzamt_Monat_(\d{4}-\d{2})(\.xlsx)?$/;
const YEARLY_FILE_PATTERN = /^Finanzamt_Jahr_(\d{4})(\.xlsx)?$/;

export interface ReportFile {
  filename: string;
  period: string;
  scope: 'month' | 'year';
  format: ReportFormat;
  /** Nur bei CSV-Ordnern: die enthaltenen Dateien */
  files: string[];
  sizeBytes: number;
  createdAt: string;
}

function listCsvFiles(folder: string): string[] {
  return fs.readdirSync(path.join(REPORTS_DIR, folder)).filter((f) => f.endsWith('.csv')).sort();
}

export function listReports(): ReportFile[] {
  return fs
    .readdirSync(REPORTS_DIR, { withFileTypes: true })
    .flatMap((entry): ReportFile[] => {
      const match = MONTHLY_FILE_PATTERN.exec(entry.name) ?? YEARLY_FILE_PATTERN.exec(entry.name);
      if (!match) return [];
      const scope = entry.name.startsWith('Finanzamt_Monat_') ? 'month' : 'year';
      const full = path.join(REPORTS_DIR, entry.name);
      // Excel = Datei mit .xlsx, CSV = Ordner ohne Endung
      if (entry.isFile() && match[2]) {
        const stat = fs.statSync(full);
        return [{ filename: entry.name, period: match[1], scope, format: 'xlsx', files: [], sizeBytes: stat.size, createdAt: stat.mtime.toISOString() }];
      }
      if (entry.isDirectory() && !match[2]) {
        const files = listCsvFiles(entry.name);
        const sizeBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(full, f)).size, 0);
        return [{ filename: entry.name, period: match[1], scope, format: 'csv', files, sizeBytes, createdAt: fs.statSync(full).mtime.toISOString() }];
      }
      return [];
    })
    .sort((a, b) =>
      a.scope === b.scope ? b.period.localeCompare(a.period) || a.format.localeCompare(b.format) : a.scope.localeCompare(b.scope)
    );
}

// Bei CSV-Berichten ist `file` eine Datei im Berichtsordner; beide Namen werden gegen Pfadtricks geprüft.
export function getReportPath(filename: string, file?: string): string | null {
  if (path.basename(filename) !== filename) return null;
  const report = listReports().find((r) => r.filename === filename);
  if (!report) return null;
  if (report.format === 'xlsx') return path.join(REPORTS_DIR, filename);
  if (!file || path.basename(file) !== file || !report.files.includes(file)) return null;
  return path.join(REPORTS_DIR, filename, file);
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
