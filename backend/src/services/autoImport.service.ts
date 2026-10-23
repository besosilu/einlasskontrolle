import fs from 'fs';
import path from 'path';
import { importMembersFromCsv } from './import.service.js';

const INBOX_DIR = process.env['AUTO_IMPORT_INBOX_DIR'] ?? '/app/inbox';
const VERARBEITET_DIR = path.join(INBOX_DIR, 'verarbeitet');
const FEHLER_DIR = path.join(INBOX_DIR, 'fehler');
fs.mkdirSync(INBOX_DIR, { recursive: true });
fs.mkdirSync(VERARBEITET_DIR, { recursive: true });
fs.mkdirSync(FEHLER_DIR, { recursive: true });

const STABLE_THRESHOLD_MS = 60_000;
const MAX_FILES_PER_TICK = 20;
const TICK_INTERVAL_MS = 5 * 60_000;

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

export async function processInboxOnce(): Promise<void> {
  const candidates = scanInbox();
  const stable = candidates.filter((c) => isStable(path.join(INBOX_DIR, c.filename)));
  stable.sort((a, b) => a.filename.localeCompare(b.filename));
  const batch = stable.slice(0, MAX_FILES_PER_TICK);

  // Sequenziell statt parallel, damit die Reihenfolge vorhersagbar bleibt und ein Fehler bei
  // einer Datei den Scan/Erfassung-Pfad nicht durch gleichzeitige DB-Last beeinträchtigt.
  for (const candidate of batch) {
    const filePath = path.join(INBOX_DIR, candidate.filename);
    try {
      if (candidate.kind === 'invalid-date') {
        moveTo(filePath, FEHLER_DIR, candidate.filename);
        console.warn(`[autoImport] Ungültiges Datum im Dateinamen, verschoben nach fehler/: ${candidate.filename}`);
        continue;
      }

      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.codePointAt(0) === 0xfeff) content = content.slice(1); // BOM entfernen
      await importMembersFromCsv(content, candidate.filename, candidate.entryDate, 'auto');
      moveTo(filePath, VERARBEITET_DIR, candidate.filename);
    } catch (err) {
      console.error(`[autoImport] Fehler bei ${candidate.filename}:`, err);
      try {
        moveTo(filePath, FEHLER_DIR, candidate.filename);
      } catch {
        // Datei bereits verschoben/entfernt - nichts mehr zu tun
      }
    }
  }
}

let running = false;

export function startAutoImportScheduler(): void {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processInboxOnce();
    } catch (err) {
      console.error('[autoImport] Fehler beim Verarbeiten des Inbox-Ordners:', err);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, TICK_INTERVAL_MS);
}
