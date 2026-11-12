import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Inbox, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import { importApi } from '@/api/import';
import { useAuth } from '@/context/AuthContext';
import { useAutoImportStatus } from '@/hooks/useAutoImportStatus';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/dateUtils';
import { AutoImportStatusDetails, StatusIndicator, statusLabel } from './AutoImportStatusDetails';

// Immer sichtbares Status- und Feed-Widget für den automatischen Hintergrund-Import vom Netzlaufwerk.
// Bewusst außerhalb des Scanner-Grids (eigene fixed-Ecke) und ohne <input>/autoFocus; Buttons geben ihren
// Fokus sofort wieder ab, damit der Enter-Anschlag des Handscanners sie nie auslöst und die
// useScanner-Tastatureingabe nie gestört wird.
export function AutoImportFeedWidget() {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const { isAdmin } = useAuth();

  const { data: status, isError: statusError } = useAutoImportStatus();

  const { data } = useQuery({
    queryKey: ['auto-import-feed'],
    queryFn: () => importApi.getLogs(5, 0, 'auto'),
    refetchInterval: 25_000,
  });

  const logs = data?.logs ?? [];

  useEffect(() => {
    if (logs.length === 0) return;
    const newestId = logs[0].id;
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = newestId; // erstes Laden - kein Toast, nur Referenzpunkt setzen
      return;
    }
    if (newestId > lastSeenIdRef.current) {
      lastSeenIdRef.current = newestId;
      showToast('info', `Automatischer Import verarbeitet: ${logs[0].filename}`);
    }
  }, [logs]);

  const badgeText = statusError ? 'Status nicht abrufbar' : status ? statusLabel(status) : 'Lädt…';

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open && (
        <div className="mb-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-600">Automatischer Import</p>
            {isAdmin && (
              <Link
                to="/einstellungen"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600"
                title="Schalter und Einstellungen"
              >
                <Settings className="h-3 w-3" />
                Einstellungen
              </Link>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              {statusError ? (
                <p className="text-xs text-red-500">Der Status konnte nicht geladen werden.</p>
              ) : status ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <StatusIndicator status={status} />
                    <span className="text-sm font-semibold text-slate-700">{statusLabel(status)}</span>
                  </div>
                  <AutoImportStatusDetails status={status} />
                </>
              ) : (
                <p className="text-xs text-slate-400">Lädt…</p>
              )}
            </div>

            <div>
              <p className="px-4 pt-3 text-xs font-semibold text-slate-500">Letzte automatische Importe</p>
              {logs.length === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-slate-400">Noch keine Importe</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {logs.map((log) => {
                    const hasErrors = log.errors.length > 0;
                    const isExpanded = expandedId === log.id;
                    return (
                      <div key={log.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            setExpandedId(isExpanded ? null : log.id);
                            e.currentTarget.blur();
                          }}
                          className="flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-700">{log.filename}</p>
                            <p className="text-xs text-slate-400">{formatDateTime(log.importedAt)}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1">
                            {hasErrors ? (
                              <span className="text-xs font-medium text-red-500">{log.errors.length} Fehler</span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600">+{log.recordsCreated} neu</span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                              {log.entriesCreated !== null && (
                                <span className="font-medium text-indigo-600">{log.entriesCreated} Eintritte</span>
                              )}
                              <span className="font-medium text-emerald-600">+{log.recordsCreated} neu</span>
                              <span className="font-medium text-blue-600">~{log.recordsUpdated} akt.</span>
                            </div>

                            {hasErrors && (
                              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                                <p className="mb-1.5 text-xs font-semibold text-red-700">Fehlerdetails</p>
                                <div className="max-h-32 space-y-1 overflow-y-auto">
                                  {log.errors.map((e, i) => (
                                    <div key={i} className="text-xs text-red-600">
                                      <span className="font-medium">Zeile {e.line}:</span> {e.reason}
                                      {e.content && <span className="ml-1 font-mono text-red-400">({e.content})</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          setOpen((o) => !o);
          e.currentTarget.blur();
        }}
        className={cn(
          'flex items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-slate-50',
          status?.state === 'processing' ? 'border-blue-300 text-blue-600'
            : status && status.enabled && status.warnings.length > 0 ? 'border-amber-300 text-amber-700'
            : 'border-slate-200 text-slate-500'
        )}
        title="Status des automatischen Imports"
      >
        <Inbox className="h-3.5 w-3.5" />
        Auto-Import
        {status && <StatusIndicator status={status} />}
        <span>{badgeText}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
}
