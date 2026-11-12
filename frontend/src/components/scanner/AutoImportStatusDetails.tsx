import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/dateUtils';
import type { AutoImportInboxFile, AutoImportStatus } from '@/types';

/** Tickt jede Sekunde, damit "in 2 Min." und die Wartezeiten zwischen den Abfragen weiterlaufen. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function statusLabel(status: AutoImportStatus): string {
  if (!status.enabled) return 'Nicht aktiv';
  if (status.state === 'processing') return 'Verarbeitet gerade';
  return 'Aktiv';
}

/** Farbiger Punkt bzw. Symbol für den Zustand; Warnungen färben "Aktiv" gelb. */
export function StatusIndicator({ status, className }: { status: AutoImportStatus; className?: string }) {
  if (status.state === 'processing') {
    return <Loader2 className={cn('h-3.5 w-3.5 animate-spin text-blue-500', className)} />;
  }
  if (!status.enabled) return <PauseCircle className={cn('h-3.5 w-3.5 text-slate-400', className)} />;
  if (status.warnings.length > 0) return <AlertTriangle className={cn('h-3.5 w-3.5 text-amber-500', className)} />;
  return <CheckCircle2 className={cn('h-3.5 w-3.5 text-emerald-500', className)} />;
}

const FILE_STATE: Record<AutoImportInboxFile['state'], { label: (f: AutoImportInboxFile) => string; color: string }> = {
  waiting: { label: (f) => `wartet noch ${f.secondsUntilReady ?? 0} Sek.`, color: 'text-slate-500' },
  ready: { label: () => 'wird im nächsten Durchlauf verarbeitet', color: 'text-blue-600' },
  'invalid-date': { label: () => 'ungültiges Datum', color: 'text-red-500' },
  ignored: { label: () => 'wird ignoriert', color: 'text-amber-600' },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="flex-shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right text-slate-700">{children}</dd>
    </div>
  );
}

const MAX_FILES_SHOWN = 8;

export function AutoImportStatusDetails({ status }: { status: AutoImportStatus }) {
  const now = useNow();
  const { lastCheck, nextCheckAt, processing, sync, inbox } = status;

  const pending = inbox.files.filter((f) => f.state === 'waiting' || f.state === 'ready').length;
  const shownFiles = inbox.files.slice(0, MAX_FILES_SHOWN);

  return (
    <div className="space-y-3 text-xs">
      {processing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
          <p className="font-medium text-blue-700">
            Verarbeite {processing.currentFile ?? '…'} ({Math.min(processing.done + 1, processing.total)} von {processing.total})
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${processing.total === 0 ? 0 : Math.round((processing.done / processing.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {status.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
          {status.warnings.map((w) => (
            <li key={w} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="divide-y divide-slate-100">
        <Row label="Letzte Prüfung">
          {lastCheck ? (
            <>
              {formatRelative(lastCheck.at, now)}
              <span className="block text-slate-400">
                {lastCheck.skippedBecauseDisabled
                  ? 'übersprungen (ausgeschaltet)'
                  : lastCheck.processed + lastCheck.failed === 0
                    ? 'keine Dateien zu verarbeiten'
                    : `${lastCheck.processed} verarbeitet${lastCheck.failed > 0 ? `, ${lastCheck.failed} fehlgeschlagen` : ''}`}
              </span>
            </>
          ) : (
            'noch keine seit dem Start'
          )}
        </Row>
        <Row label="Nächste Prüfung">
          {status.enabled && nextCheckAt ? formatRelative(nextCheckAt, now) : '–'}
        </Row>
        <Row label="Netzlaufwerk">
          {sync ? (
            <>
              <span className={sync.ok ? '' : 'text-red-600'}>{formatRelative(sync.lastRunAt, now)}</span>
              <span className={cn('block', sync.ok ? 'text-slate-400' : 'text-red-500')}>
                {sync.message ?? (sync.ok ? 'erreichbar, nichts Neues' : 'fehlgeschlagen')}
              </span>
            </>
          ) : (
            <span className="text-slate-400">noch nicht geprüft</span>
          )}
        </Row>
        <Row label="Im Eingang">
          {inbox.files.length === 0 ? 'leer' : `${pending} zu verarbeiten${inbox.files.length > pending ? `, ${inbox.files.length - pending} nicht importierbar` : ''}`}
        </Row>
        <Row label="Archiv">
          {inbox.archive.processed} verarbeitet
          {inbox.archive.failed > 0 && <span className="text-red-500">, {inbox.archive.failed} Fehler</span>}
        </Row>
      </dl>

      {shownFiles.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-slate-500">Dateien im Eingang</p>
          <ul className="space-y-0.5">
            {shownFiles.map((f) => (
              <li key={f.filename} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-slate-700" title={f.note ?? f.filename}>{f.filename}</span>
                <span className={cn('flex-shrink-0', FILE_STATE[f.state].color)}>{FILE_STATE[f.state].label(f)}</span>
              </li>
            ))}
          </ul>
          {inbox.files.length > MAX_FILES_SHOWN && (
            <p className="mt-1 text-slate-400">… und {inbox.files.length - MAX_FILES_SHOWN} weitere</p>
          )}
        </div>
      )}
    </div>
  );
}
