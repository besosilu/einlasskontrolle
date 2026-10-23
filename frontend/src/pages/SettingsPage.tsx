import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

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

  useEffect(() => {
    if (data?.networkPath) setNetworkPath(data.networkPath);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.setAutoImport(networkPath),
    onSuccess: () => {
      showToast('success', 'Netzlaufwerk-Pfad gespeichert.');
      queryClient.invalidateQueries({ queryKey: ['settings', 'auto-import'] });
    },
    onError: () => showToast('error', 'Speichern fehlgeschlagen.'),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-slate-700">Automatischer Einlass-Import</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Netzlaufwerk-Pfad, von dem das Windows-Sync-Skript (<span className="font-mono">sync-inbox-from-network.ps1</span>)
          die Einlass-Dateien in den lokalen <span className="font-mono">inbox/</span>-Ordner kopiert. Das Skript liest
          diesen Wert bei jedem Lauf automatisch - keine manuelle Anpassung im Skript mehr nötig.
        </p>
      </div>

      <div className="space-y-3 px-5 py-4">
        <label className="block text-xs font-medium text-slate-600">UNC-Netzlaufwerk-Pfad</label>
        <input
          type="text"
          value={networkPath}
          onChange={(e) => setNetworkPath(e.target.value)}
          placeholder="\\server\freigabe\EinlassDateien"
          disabled={isLoading}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
    </div>
  );
}
