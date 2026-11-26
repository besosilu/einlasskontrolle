import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import * as statsService from './stats.service.js';
import { MEMBER_FLAGS, type MemberFlag } from './stats.service.js';
import { csvField } from './entries.service.js';
import { monthRange, yearRange, getLastCompletedMonth } from '../lib/dateParams.js';

const REPORTS_DIR = process.env['REPORTS_DIR'] ?? path.join(process.cwd(), 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const MEMBER_COLUMNS = [
  { header: 'Mitgliedsnummer', key: 'memberNumber', width: 16 },
  { header: 'Name', key: 'lastName', width: 22 },
  { header: 'Vorname', key: 'firstName', width: 22 },
];

export type ReportFormat = 'xlsx' | 'csv' | 'md';

// Ein Tabellenblatt: wird als Excel-Sheet oder als eine CSV-Datei geschrieben
interface ReportSheet {
  name: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string | number>[];
  /** Nur CSV: Statistikzeile ganz oben vor der Kopfzeile (Excel hat dafür das Übersicht-Sheet) */
  summary?: (string | number)[];
}

// Berichte mit Kennzeichen-Auswahl tragen diese Kürzel im Namen (neben dem Bericht über alle Mitglieder)
const FLAG_FILE: Record<MemberFlag, string> = {
  trainer: 'Uebungsleiter',
  new_card: 'NeuerAusweis',
  trial: 'Schnupper',
  pre_swim: 'Vorschwimmen',
};
const FLAG_LABELS: Record<MemberFlag, string> = {
  trainer: 'Übungsleiter',
  new_card: 'Neuer Ausweis',
  trial: 'Schnupper-Training',
  pre_swim: 'Vorschwimmen',
};

function flagSuffix(flags: MemberFlag[]): string {
  return flags.length ? `_${flags.map((f) => FLAG_FILE[f]).join('-')}` : '';
}

function statsLabel(flags: MemberFlag[]): string {
  return flags.length ? `Statistik ${flags.map((f) => FLAG_LABELS[f]).join(' + ')}` : 'Statistik';
}

// CSV-Berichte liegen als Ordner (ohne Endung) im Berichtsordner, Excel-Berichte als .xlsx-Datei
function monthlyBase(yearMonth: string, flags: MemberFlag[] = []): string {
  return `Finanzamt_Monat_${yearMonth}${flagSuffix(flags)}`;
}

function yearlyBase(year: string, flags: MemberFlag[] = []): string {
  return `Finanzamt_Jahr_${year}${flagSuffix(flags)}`;
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
      ...(s.summary ? [s.summary.map((v) => csvField(String(v))).join(';')] : []),
      s.columns.map((c) => csvField(c.header)).join(';'),
      ...s.rows.map((r) => s.columns.map((c) => csvField(String(r[c.key] ?? ''))).join(';')),
    ];
    fs.writeFileSync(path.join(tmpPath, `${s.name}.csv`), '﻿' + lines.join('\r\n') + '\r\n', 'utf-8');
  }
  fs.rmSync(finalPath, { recursive: true, force: true });
  fs.renameSync(tmpPath, finalPath);
  return { filename: base, path: finalPath };
}

// Markdown: eine .md-Datei pro Sheet im Ordner <base>_md/; erste Zeile = Statistik, danach die Tabelle
function mdCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function writeMarkdownFolder(sheets: ReportSheet[], base: string): { filename: string; path: string } {
  const folder = `${base}_md`;
  const finalPath = path.join(REPORTS_DIR, folder);
  const tmpPath = path.join(REPORTS_DIR, `.tmp-${folder}`);
  fs.rmSync(tmpPath, { recursive: true, force: true });
  fs.mkdirSync(tmpPath);
  for (const s of sheets) {
    const lines: string[] = [];
    if (s.summary) {
      // "Statistik | 2026-11 | Eintritte gesamt | 7" -> **Statistik** · 2026-11 · Eintritte gesamt: 7
      const [label, period, ...pairs] = s.summary;
      const facts: string[] = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) facts.push(`${pairs[i]}: ${pairs[i + 1]}`);
      lines.push(`**${label}** · ${period} · ${facts.join(' · ')}`, '');
    }
    lines.push(`| ${s.columns.map((c) => mdCell(c.header)).join(' | ')} |`);
    lines.push(`| ${s.columns.map(() => '---').join(' | ')} |`);
    for (const r of s.rows) lines.push(`| ${s.columns.map((c) => mdCell(r[c.key])).join(' | ')} |`);
    fs.writeFileSync(path.join(tmpPath, `${s.name}.md`), lines.join('\n') + '\n', 'utf-8');
  }
  fs.rmSync(finalPath, { recursive: true, force: true });
  fs.renameSync(tmpPath, finalPath);
  return { filename: folder, path: finalPath };
}

const SELECTION_COLUMNS = [
  { header: 'Mitgliedsnummer', key: 'memberNumber', width: 16 },
  { header: 'Name', key: 'lastName', width: 22 },
  { header: 'Vorname', key: 'firstName', width: 22 },
  { header: 'Kennzeichen', key: 'flags', width: 30 },
  { header: 'Anzahl Scans', key: 'total', width: 14 },
];

// Zusätzliches Sheet "Übungsleiter" bzw. "Auswahl": Name und Anzahl der Scans pro ausgewähltem Mitglied
async function selectionSheet(from: string, to: string, period: string, flags: MemberFlag[]): Promise<ReportSheet> {
  const members = await statsService.getFlaggedSummary(from, to, flags);
  return {
    name: flags.length === 1 && flags[0] === 'trainer' ? 'Übungsleiter' : 'Auswahl',
    summary: [statsLabel(flags), period, 'Mitglieder', members.length, 'Scans gesamt', members.reduce((sum, m) => sum + m.total, 0)],
    columns: SELECTION_COLUMNS,
    rows: members.map((m) => ({
      memberNumber: m.memberNumber ?? '',
      lastName: m.lastName,
      firstName: m.firstName,
      // nur die ausgewählten Kennzeichen, die das Mitglied tatsächlich hat
      flags: flags.filter((f) => m.flags.includes(f)).map((f) => FLAG_LABELS[f]).join(', '),
      total: m.total,
    })),
  };
}

function distinctVisitors(rows: { memberNumber: string | null; lastName: string; firstName: string }[]): number {
  return new Set(rows.map((r) => r.memberNumber ?? `${r.lastName}|${r.firstName}`)).size;
}

async function writeReport(sheets: ReportSheet[], base: string, format: ReportFormat) {
  if (format === 'csv') return writeCsvFolder(sheets, base);
  if (format === 'md') return writeMarkdownFolder(sheets, base);
  return writeXlsx(sheets, base);
}

export { getLastCompletedMonth };

export async function generateMonthlyAttendanceReport(
  yearMonth: string,
  format: ReportFormat = 'xlsx',
  flags: MemberFlag[] = []
): Promise<{ filename: string; path: string }> {
  const { from, to, days } = monthRange(yearMonth);
  const dayRows = await statsService.getAttendanceByDay(from, to, flags);
  const byDate = new Map(dayRows.map((r) => [r.date, r]));

  const sheets: ReportSheet[] = [
    {
      name: 'Übersicht',
      columns: [
        { header: 'Datum', key: 'date', width: 14 },
        { header: 'Eintritte gesamt', key: 'total', width: 18 },
      ],
      rows: days.map((day) => ({ date: day, total: byDate.get(day)?.total ?? 0 })),
      summary: [
        statsLabel(flags),
        yearMonth,
        'Eintritte gesamt',
        dayRows.reduce((sum, r) => sum + r.total, 0),
        'Tage mit Eintritten',
        dayRows.filter((r) => r.total > 0).length,
      ],
    },
  ];

  if (flags.length) sheets.push(await selectionSheet(from, to, yearMonth, flags));

  // Ein Sheet pro Tag, an dem tatsächlich gescannt wurde (keine leeren Tage).
  for (const day of days) {
    if ((byDate.get(day)?.total ?? 0) === 0) continue;
    const members = await statsService.getMembersForDay(day, flags);
    sheets.push({
      name: day,
      summary: [statsLabel(flags), day, 'Eintritte gesamt', members.length, 'Verschiedene Mitglieder', distinctVisitors(members)],
      columns: MEMBER_COLUMNS,
      rows: members.map((m) => ({ memberNumber: m.memberNumber ?? '', lastName: m.lastName, firstName: m.firstName })),
    });
  }

  return writeReport(sheets, monthlyBase(yearMonth, flags), format);
}

export async function generateYearlyAttendanceReport(
  year: string,
  format: ReportFormat = 'xlsx',
  flags: MemberFlag[] = []
): Promise<{ filename: string; path: string }> {
  const { from, to, months } = yearRange(year);
  const monthRows = await statsService.getAttendanceByMonth(from, to, flags);
  const byMonth = new Map(monthRows.map((r) => [r.month, r.total]));

  const sheets: ReportSheet[] = [
    {
      name: 'Übersicht',
      columns: [
        { header: 'Monat', key: 'month', width: 14 },
        { header: 'Eintritte gesamt', key: 'total', width: 18 },
      ],
      rows: months.map((month) => ({ month, total: byMonth.get(month) ?? 0 })),
      summary: [
        statsLabel(flags),
        year,
        'Eintritte gesamt',
        [...byMonth.values()].reduce((sum, n) => sum + n, 0),
        'Monate mit Eintritten',
        [...byMonth.values()].filter((n) => n > 0).length,
      ],
    },
  ];

  if (flags.length) sheets.push(await selectionSheet(from, to, year, flags));

  // Ein Sheet pro Monat mit Eintritten (statt pro Tag) - sonst zu viele Sheets für ein ganzes Jahr.
  // Jede Zeile ist ein einzelner Besuch; Mitglieder, die mehrfach im Monat waren, erscheinen mehrfach.
  for (const month of months) {
    if ((byMonth.get(month) ?? 0) === 0) continue;
    const { from: mFrom, to: mTo } = monthRange(month);
    const entries = await statsService.getEntriesForMonth(mFrom, mTo, flags);
    sheets.push({
      name: month,
      summary: [statsLabel(flags), month, 'Eintritte gesamt', entries.length, 'Verschiedene Mitglieder', distinctVisitors(entries)],
      columns: MEMBER_COLUMNS,
      rows: entries.map((e) => ({ memberNumber: e.memberNumber ?? '', lastName: e.lastName, firstName: e.firstName })),
    });
  }

  return writeReport(sheets, yearlyBase(year, flags), format);
}

export async function ensureMonthlyReportsUpToDate(): Promise<void> {
  const target = getLastCompletedMonth();
  const expectedPath = path.join(REPORTS_DIR, `${monthlyBase(target)}.xlsx`);
  if (!fs.existsSync(expectedPath)) {
    await generateMonthlyAttendanceReport(target);
  }
}

// Namensteil der Kennzeichen-Auswahl, z. B. "_Uebungsleiter-Schnupper"
const FLAG_ALT = Object.values(FLAG_FILE).join('|');
const FLAG_PART = `(_(?:${FLAG_ALT})(?:-(?:${FLAG_ALT}))*)?`;
const MONTHLY_FILE_PATTERN = new RegExp(String.raw`^Finanzamt_Monat_(\d{4}-\d{2})${FLAG_PART}(\.xlsx|_md)?$`);
const YEARLY_FILE_PATTERN = new RegExp(String.raw`^Finanzamt_Jahr_(\d{4})${FLAG_PART}(\.xlsx|_md)?$`);

function parseFlagSuffix(suffix: string | undefined): MemberFlag[] {
  if (!suffix) return [];
  const names = suffix.slice(1).split('-');
  return MEMBER_FLAGS.filter((f) => names.includes(FLAG_FILE[f]));
}

export interface ReportFile {
  filename: string;
  period: string;
  scope: 'month' | 'year';
  format: ReportFormat;
  /** Kennzeichen-Auswahl; leer = alle Mitglieder */
  flags: MemberFlag[];
  /** Nur bei CSV-/Markdown-Ordnern: die enthaltenen Dateien */
  files: string[];
  sizeBytes: number;
  createdAt: string;
}

function listFolderFiles(folder: string, ext: '.csv' | '.md'): string[] {
  return fs.readdirSync(path.join(REPORTS_DIR, folder)).filter((f) => f.endsWith(ext)).sort();
}

export function listReports(): ReportFile[] {
  return fs
    .readdirSync(REPORTS_DIR, { withFileTypes: true })
    .flatMap((entry): ReportFile[] => {
      const match = MONTHLY_FILE_PATTERN.exec(entry.name) ?? YEARLY_FILE_PATTERN.exec(entry.name);
      if (!match) return [];
      const scope = entry.name.startsWith('Finanzamt_Monat_') ? 'month' : 'year';
      const full = path.join(REPORTS_DIR, entry.name);
      // Excel = Datei mit .xlsx, CSV = Ordner ohne Endung, Markdown = Ordner mit Endung _md
      if (entry.isFile() && match[3] === '.xlsx') {
        const stat = fs.statSync(full);
        return [{ filename: entry.name, period: match[1], scope, format: 'xlsx', flags: parseFlagSuffix(match[2]), files: [], sizeBytes: stat.size, createdAt: stat.mtime.toISOString() }];
      }
      if (entry.isDirectory() && match[3] !== '.xlsx') {
        const format = match[3] === '_md' ? 'md' : 'csv';
        const files = listFolderFiles(entry.name, format === 'md' ? '.md' : '.csv');
        const sizeBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(full, f)).size, 0);
        return [{ filename: entry.name, period: match[1], scope, format, flags: parseFlagSuffix(match[2]), files, sizeBytes, createdAt: fs.statSync(full).mtime.toISOString() }];
      }
      return [];
    })
    .sort((a, b) =>
      a.scope === b.scope ? b.period.localeCompare(a.period) || a.flags.length - b.flags.length || a.flags.join().localeCompare(b.flags.join()) || a.format.localeCompare(b.format) : a.scope.localeCompare(b.scope)
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
