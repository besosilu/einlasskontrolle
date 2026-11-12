import fs from 'fs';
import path from 'path';
import sql from '../lib/db.js';
import { importMembersFromCsv, logImportFailure } from './import.service.js';
import { getAutoImportEnabled, getAutoImportNetworkPath } from './settings.service.js';

const INBOX_DIR = process.env['AUTO_IMPORT_INBOX_DIR'] ?? '/app/inbox';
const VERARBEITET_DIR = path.join(INBOX_DIR, 'verarbeitet');
const FEHLER_DIR = path.join(INBOX_DIR, 'fehler');
const SYNC_STATUS_FILE = path.join(INBOX_DIR, '.sync-status.json');
fs.mkdirSync(INBOX_DIR, { recursive: true });
fs.mkdirSync(VERARBEITET_DIR, { recursive: true });
fs.mkdirSync(FEHLER_DIR, { recursive: true });

const STABLE_THRESHOLD_MS = 60_000;
const MAX_FILES_PER_TICK = 20;
const TICK_INTERVAL_MS = 5 * 60_000;
// Das Sync-Skript läuft alle 5-15 Minuten; ab dieser Pause gilt es als nicht mehr aktiv
const SYNC_STALE_AFTER_MS = 60 * 60_000;

const INBOX_FILENAME_PATTERN = /^(\d{2})-(\d{2})-(\d{4})\.txt$/;

type ParsedInboxFilename = { entryDate: string } | 'invalid-date' | null;

// null = Dateiname passt nicht zum Muster (ignorieren, nie anfassen).
// 'invalid-date' = Muster passt, aber Kalenderdatum ungültig (z.B. 31-02-2026) -> fehler/.
export function parseInboxFilename(filename: string): ParsedInboxFilename {
  const match = INBOX_FILENAME_PATTERN.exec(filename);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'invalid-date';
  }

  return { entryDate: `${yyyy}-${mm}-${dd}` };
}

function isStable(filePath: string): boolean {
  const stat = fs.statSync(filePath);
  return Date.now() - stat.mtimeMs >= STABLE_THRESHOLD_MS;
}

// logImportFailure() selbst darf nie den Datei-Move verhindern - ein DB-Fehler beim Protokollieren
// ist hier zweitrangig gegenüber dem eigentlichen Ziel, die Datei aus der Inbox zu bekommen.
async function logFailureSafely(filename: string, reason: string): Promise<void> {
  try {
    await logImportFailure(filename, reason, 'auto');
  } catch (err) {
    console.error(`[autoImport] Konnte Fehlerprotokoll für ${filename} nicht schreiben:`, err);
  }
}

function moveTo(filePath: string, targetDir: string, filename: string): void {
  let targetPath = path.join(targetDir, filename);
  if (fs.existsSync(targetPath)) {
    const ext = path.extname(filename);
    const base = filename.slice(0, -ext.length);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    targetPath = path.join(targetDir, `${base}_${stamp}${ext}`);
  }
  fs.renameSync(filePath, targetPath);
}

interface InboxCandidate {
  filename: string;
  kind: 'valid' | 'invalid-date';
  entryDate?: string;
}

function scanInbox(): InboxCandidate[] {
  const entries = fs.readdirSync(INBOX_DIR, { withFileTypes: true });
  const candidates: InboxCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue; // überspringt verarbeitet/ und fehler/ selbst

    const parsed = parseInboxFilename(entry.name);
    if (parsed === null) continue; // kein Einlass-Dateiname - nie anfassen
    if (parsed === 'invalid-date') {
      candidates.push({ filename: entry.name, kind: 'invalid-date' });
    } else {
      candidates.push({ filename: entry.name, kind: 'valid', entryDate: parsed.entryDate });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------------------------
// Laufzeit-Zustand für die Statusanzeige (nur im Speicher; nach einem Neustart beginnt er neu)
// ---------------------------------------------------------------------------------------------

interface LastCheck {
  finishedAt: number;
  trigger: 'timer' | 'manual' | 'start';
  processed: number;
  failed: number;
  skippedBecauseDisabled: boolean;
  error: string | null;
}

let running = false;
let progress: { currentFile: string | null; done: number; total: number } | null = null;
let lastCheck: LastCheck | null = null;
let nextCheckAt: number | null = null;

export async function processInboxOnce(): Promise<{ processed: number; failed: number }> {
  const candidates = scanInbox();
  const stable = candidates.filter((c) => isStable(path.join(INBOX_DIR, c.filename)));
  stable.sort((a, b) => a.filename.localeCompare(b.filename));
  const batch = stable.slice(0, MAX_FILES_PER_TICK);
  let processed = 0;
  let failed = 0;

  progress = { currentFile: null, done: 0, total: batch.length };

  // Sequenziell statt parallel, damit die Reihenfolge vorhersagbar bleibt und ein Fehler bei
  // einer Datei den Scan/Erfassung-Pfad nicht durch gleichzeitige DB-Last beeinträchtigt.
  for (const candidate of batch) {
    const filePath = path.join(INBOX_DIR, candidate.filename);
    progress.currentFile = candidate.filename;
    try {
      if (candidate.kind === 'invalid-date') {
        const reason = `Ungültiges Kalenderdatum im Dateinamen: ${candidate.filename}`;
        await logFailureSafely(candidate.filename, reason);
        moveTo(filePath, FEHLER_DIR, candidate.filename);
        console.warn(`[autoImport] ${reason} - verschoben nach fehler/`);
        failed++;
        continue;
      }

      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.codePointAt(0) === 0xfeff) content = content.slice(1); // BOM entfernen
      await importMembersFromCsv(content, candidate.filename, candidate.entryDate, 'auto');
      moveTo(filePath, VERARBEITET_DIR, candidate.filename);
      processed++;
    } catch (err) {
      console.error(`[autoImport] Fehler bei ${candidate.filename}:`, err);
      const reason = err instanceof Error ? err.message : 'Unbekannter Fehler beim Verarbeiten der Datei';
      await logFailureSafely(candidate.filename, reason);
      try {
        moveTo(filePath, FEHLER_DIR, candidate.filename);
      } catch {
        // Datei bereits verschoben/entfernt - nichts mehr zu tun
      }
      failed++;
    } finally {
      progress.done++;
    }
  }

  return { processed, failed };
}

/** Ein Durchlauf inkl. Schalter, Mutex und Statistik. Gibt zurück, warum nicht gelaufen wurde. */
async function runCheck(trigger: LastCheck['trigger']): Promise<'ran' | 'disabled' | 'busy'> {
  if (running) return 'busy';
  running = true;
  try {
    if (!(await getAutoImportEnabled())) {
      lastCheck = { finishedAt: Date.now(), trigger, processed: 0, failed: 0, skippedBecauseDisabled: true, error: null };
      return 'disabled';
    }
    try {
      const { processed, failed } = await processInboxOnce();
      lastCheck = { finishedAt: Date.now(), trigger, processed, failed, skippedBecauseDisabled: false, error: null };
    } catch (err) {
      console.error('[autoImport] Fehler beim Verarbeiten des Inbox-Ordners:', err);
      lastCheck = {
        finishedAt: Date.now(), trigger, processed: 0, failed: 0, skippedBecauseDisabled: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      };
    }
    return 'ran';
  } finally {
    progress = null;
    running = false;
  }
}

export function startAutoImportScheduler(): void {
  const tick = (trigger: LastCheck['trigger']) => {
    nextCheckAt = Date.now() + TICK_INTERVAL_MS;
    void runCheck(trigger);
  };

  tick('start');
  setInterval(() => tick('timer'), TICK_INTERVAL_MS);
}

/** "Jetzt prüfen": startet sofort einen Durchlauf im Hintergrund; der Fortschritt steht im Status. */
export async function triggerAutoImportNow(): Promise<'started' | 'disabled' | 'busy'> {
  if (running) return 'busy';
  if (!(await getAutoImportEnabled())) return 'disabled';
  void runCheck('manual');
  return 'started';
}

// ---------------------------------------------------------------------------------------------
// Status für die Oberfläche
// ---------------------------------------------------------------------------------------------

export interface InboxFileInfo {
  filename: string;
  /** waiting = zu frisch, wird in Kürze verarbeitet; ready = wird im nächsten Durchlauf verarbeitet */
  state: 'waiting' | 'ready' | 'invalid-date' | 'ignored';
  secondsUntilReady: number | null;
  note: string | null;
}

function listInboxFiles(): InboxFileInfo[] {
  const files: InboxFileInfo[] = [];
  for (const entry of fs.readdirSync(INBOX_DIR, { withFileTypes: true })) {
    // Punktdateien (.sync-config.json, .sync-status.json) und Nicht-Textdateien sind nie Einlassdateien
    if (!entry.isFile() || entry.name.startsWith('.') || !entry.name.toLowerCase().endsWith('.txt')) continue;

    const parsed = parseInboxFilename(entry.name);
    if (parsed === null) {
      files.push({
        filename: entry.name,
        state: 'ignored',
        secondsUntilReady: null,
        note: 'Name passt nicht zu TT-MM-JJJJ.txt, wird nicht importiert',
      });
      continue;
    }
    const age = Date.now() - fs.statSync(path.join(INBOX_DIR, entry.name)).mtimeMs;
    const wait = Math.max(0, Math.ceil((STABLE_THRESHOLD_MS - age) / 1000));
    files.push({
      filename: entry.name,
      state: parsed === 'invalid-date' ? 'invalid-date' : wait > 0 ? 'waiting' : 'ready',
      secondsUntilReady: wait > 0 ? wait : null,
      note: parsed === 'invalid-date' ? 'Ungültiges Kalenderdatum im Namen' : null,
    });
  }
  return files.sort((a, b) => a.filename.localeCompare(b.filename));
}

function countFiles(dir: string): number {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

interface SyncStatus {
  lastRunAt: string;
  ok: boolean;
  message: string | null;
}

// Das Windows-Sync-Skript schreibt nach jedem Lauf .sync-status.json in den Eingangsordner
function readSyncStatus(): SyncStatus | null {
  try {
    const raw = JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, 'utf-8').replace(/^﻿/, ''));
    const when = new Date(raw.lastRun);
    if (isNaN(when.getTime())) return null;
    return { lastRunAt: when.toISOString(), ok: raw.ok === true, message: typeof raw.message === 'string' ? raw.message : null };
  } catch {
    return null;
  }
}

export async function getAutoImportStatus() {
  const [enabled, networkPath] = await Promise.all([getAutoImportEnabled(), getAutoImportNetworkPath()]);
  const [lastImport] = await sql<{ id: number; filename: string; imported_at: Date; errors: unknown }[]>`
    SELECT id, filename, imported_at, errors FROM import_logs WHERE source = 'auto' ORDER BY id DESC LIMIT 1
  `;

  const files = listInboxFiles();
  const sync = readSyncStatus();
  const archive = { processed: countFiles(VERARBEITET_DIR), failed: countFiles(FEHLER_DIR) };

  const warnings: string[] = [];
  if (enabled) {
    if (!sync) {
      warnings.push('Das Sync-Skript hat sich noch nie gemeldet. Ist die Windows-Aufgabe „EinlassInboxSync“ eingerichtet?');
    } else if (!sync.ok) {
      warnings.push(`Der letzte Lauf des Sync-Skripts ist fehlgeschlagen${sync.message ? `: ${sync.message}` : ''}.`);
    } else if (Date.now() - new Date(sync.lastRunAt).getTime() > SYNC_STALE_AFTER_MS) {
      warnings.push('Das Sync-Skript hat sich seit über einer Stunde nicht mehr gemeldet.');
    }
    if (!networkPath) warnings.push('Es ist noch kein Netzlaufwerk-Pfad hinterlegt.');
  }
  const ignored = files.filter((f) => f.state === 'ignored').length;
  if (ignored > 0) {
    warnings.push(`${ignored} Datei${ignored === 1 ? '' : 'en'} im Eingang ${ignored === 1 ? 'wird' : 'werden'} ignoriert, weil der Name nicht zu TT-MM-JJJJ.txt passt.`);
  }
  if (archive.failed > 0) {
    warnings.push(
      archive.failed === 1
        ? 'Im Ordner „fehler“ liegt 1 Datei.'
        : `Im Ordner „fehler“ liegen ${archive.failed} Dateien.`
    );
  }
  if (lastCheck?.error) warnings.push(`Der letzte Durchlauf ist fehlgeschlagen: ${lastCheck.error}`);

  return {
    enabled,
    state: !enabled ? 'disabled' : progress ? 'processing' : 'active',
    networkPath,
    intervalSeconds: TICK_INTERVAL_MS / 1000,
    nextCheckAt: enabled && nextCheckAt ? new Date(nextCheckAt).toISOString() : null,
    lastCheck: lastCheck
      ? {
          at: new Date(lastCheck.finishedAt).toISOString(),
          trigger: lastCheck.trigger,
          processed: lastCheck.processed,
          failed: lastCheck.failed,
          skippedBecauseDisabled: lastCheck.skippedBecauseDisabled,
        }
      : null,
    processing: progress ? { currentFile: progress.currentFile, done: progress.done, total: progress.total } : null,
    inbox: { files, archive },
    sync,
    lastImport: lastImport
      ? {
          id: lastImport.id,
          filename: lastImport.filename,
          importedAt: lastImport.imported_at.toISOString(),
          hadErrors: (typeof lastImport.errors === 'string' ? JSON.parse(lastImport.errors) : (lastImport.errors as unknown[] | null) ?? []).length > 0,
        }
      : null,
    warnings,
  };
}
