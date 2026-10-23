import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox, ChevronUp, ChevronDown } from 'lucide-react';
import { importApi } from '@/api/import';
import { showToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils/dateUtils';

// Unaufdringliches Feed-Widget für den automatischen Hintergrund-Import vom Netzlaufwerk.
// Bewusst außerhalb des Scanner-Grids (eigene fixed-Ecke) und ohne <input>/autoFocus,
// damit Polling/Klicks die useScanner-Tastatureingabe nie stören.
export function AutoImportFeedWidget() {
  const [open, setOpen] = useState(false);
  const lastSeenIdRef = useRef<number | null>(null);

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

  // Solange es noch nie einen Auto-Import gab, bleibt das Widget komplett weg statt leer herumzustehen.
  if (logs.length === 0 && !open) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open && (
        <div className="mb-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-600">Automatische Importe</p>
          </div>
          {logs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Noch keine Importe</p>
          ) : (
            <div className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-2.5">
                  <p className="truncate text-xs font-medium text-slate-700">{log.filename}</p>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-slate-400">
                    <span>{formatDateTime(log.importedAt)}</span>
                    {log.errors.length > 0 ? (
                      <span className="font-medium text-red-500">{log.errors.length} Fehler</span>
                    ) : (
                      <span className="text-emerald-600">+{log.recordsCreated} neu</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Inbox className="h-3.5 w-3.5" />
        Auto-Import
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
}
