import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { useAutoImportStatus } from '@/hooks/useAutoImportStatus';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import {
  AutoImportStatusDetails,
  StatusIndicator,
  statusLabel,
} from '@/components/scanner/AutoImportStatusDetails';

function errorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Einstellungen</h1>
      <AutoImportSection />
    </div>
  );
}

// Weitere Einstellungen können künftig als weitere Sektionen hier ergänzt werden.
function AutoImportSection() {
  const queryClient = useQueryClient();
  const [networkPath, setNetworkPath] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'auto-import'],
    queryFn: settingsApi.getAutoImport,
  });
  const { data: status } = useAutoImportStatus();

  useEffect(() => {
    if (data?.networkPath) setNetworkPath(data.networkPath);
  }, [data]);

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'auto-import'] });
    queryClient.invalidateQueries({ queryKey: ['auto-import-status'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.setAutoImport({ networkPath }),
    onSuccess: () => {
      showToast('success', 'Netzlaufwerk-Pfad gespeichert.');
      refreshStatus();
    },
    onError: (err) => showToast('error', errorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => settingsApi.setAutoImport({ enabled }),
    onSuccess: (saved) => {
      showToast('success', saved.enabled ? 'Auto-Import eingeschaltet.' : 'Auto-Import ausgeschaltet.');
      refreshStatus();
    },
    onError: (err) => showToast('error', errorMessage(err, 'Schalter konnte nicht gespeichert werden.')),
  });

  const runMutation = useMutation({
    mutationFn: settingsApi.runAutoImport,
    onSuccess: () => {
      showToast('info', 'Prüfung gestartet.');
      refreshStatus();
    },
    onError: (err) => showToast('error', errorMessage(err, 'Prüfung konnte nicht gestartet werden.')),
  });

  const enabled = status?.enabled ?? data?.enabled ?? true;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Automatischer Einlass-Import</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Dateien im Format <span className="font-mono">TT-MM-JJJJ.txt</span> im <span className="font-mono">inbox/</span>-Ordner
            werden alle 5 Minuten automatisch importiert. Ein Windows-Skript kopiert sie vorher vom Netzlaufwerk.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {status && (
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                !status.enabled ? 'bg-slate-100 text-slate-500'
                  : status.warnings.length > 0 ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              )}
            >
              <StatusIndicator status={status} />
              {statusLabel(status)}
            </span>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Automatischen Import ein- oder ausschalten"
            disabled={isLoading || toggleMutation.isPending}
            onClick={(e) => {
              toggleMutation.mutate(!enabled);
              e.currentTarget.blur();
            }}
            className={cn(
              'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50',
              enabled ? 'bg-emerald-500' : 'bg-slate-300'
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                enabled && 'translate-x-5'
              )}
            />
          </button>
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-100 px-5 py-4">
        <label className="block text-xs font-medium text-slate-600" htmlFor="auto-import-path">
          Netzlaufwerk-Pfad (Quelle)
        </label>
        <input
          id="auto-import-path"
          type="text"
          value={networkPath}
          onChange={(e) => setNetworkPath(e.target.value)}
          placeholder="\\server\freigabe\EinlassDateien"
          disabled={isLoading}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400">
          Das Skript <span className="font-mono">sync-inbox-from-network.ps1</span> liest diesen Wert bei jedem Lauf und meldet
          sich nach jedem Lauf zurück (siehe „Sync-Skript“ unten).
        </p>
        <div className="flex items-center justify-between">
          {!isLoading && !data?.networkPath && (
            <p className="text-xs text-amber-600">Noch nicht konfiguriert - das Sync-Skript nutzt derzeit seinen Beispiel-Default.</p>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!networkPath.trim() || saveMutation.isPending}
            loading={saveMutation.isPending}
            size="sm"
            className="ml-auto"
          >
            Speichern
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600">Status</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={!enabled || status?.state === 'processing' || runMutation.isPending}
            loading={runMutation.isPending}
            title={enabled ? 'Eingang jetzt prüfen und verarbeiten' : 'Der Auto-Import ist ausgeschaltet'}
          >
            Jetzt prüfen
          </Button>
        </div>
        {status ? (
          <AutoImportStatusDetails status={status} />
        ) : (
          <p className="text-xs text-slate-400">Status wird geladen…</p>
        )}
      </div>
    </div>
  );
}
