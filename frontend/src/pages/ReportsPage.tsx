import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { reportsApi } from '@/api/reports';
import { backupApi } from '@/api/backup';
import { formatDateTime } from '@/utils/dateUtils';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { Landmark, Download, RefreshCw, Database } from 'lucide-react';
import type { MonthlyReport, ReportFlag } from '@/types';

const FLAG_LABELS: Record<ReportFlag, string> = {
  trainer: 'Übungsleiter',
  new_card: 'Neuer Ausweis',
  trial: 'Schnupper-Training',
  pre_swim: 'Vorschwimmen',
};

export function ReportsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'finanzamt' | 'backup'>('finanzamt');

  const tabs = [
    { key: 'finanzamt' as const, label: 'Finanzamt', icon: Landmark },
    ...(isAdmin ? [{ key: 'backup' as const, label: 'Sicherung', icon: Database }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Berichte &amp; Export</h1>

      {tabs.length > 1 && (
        <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'finanzamt' && <FinanzamtTab />}
      {tab === 'backup' && isAdmin && <BackupTab />}
    </div>
  );
}

// ─── Finanzamt-Berichte Tab ──────────────────────────────────────────────────

function FinanzamtTab() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'month' | 'year'>('month');
  const [period, setPeriod] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'md'>('xlsx');
  const [flags, setFlags] = useState<ReportFlag[]>([]);
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['monthly-reports'],
    queryFn: reportsApi.list,
  });

  const generateMutation = useMutation({
    mutationFn: () => reportsApi.generate(scope, format, flags, period || undefined),
    onSuccess: () => {
      showToast('success', format === 'xlsx' ? 'Bericht erzeugt (Excel).' : 'Bericht erzeugt (Ordner mit Dateien).');
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
    },
    onError: () => showToast('error', 'Bericht konnte nicht erzeugt werden.'),
  });

  // Erzeugt den Bericht mit denselben Einstellungen (Zeitraum, Format, Kennzeichen) neu aus den aktuellen Daten
  const refreshMutation = useMutation({
    mutationFn: (r: MonthlyReport) => reportsApi.generate(r.scope, r.format, r.flags, r.period),
    onSuccess: () => {
      showToast('success', 'Bericht aktualisiert.');
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
    },
    onError: () => showToast('error', 'Bericht konnte nicht aktualisiert werden.'),
  });

  async function download(filename: string, file?: string) {
    try {
      const { blob, filename: name } = await reportsApi.download(filename, file);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Download fehlgeschlagen.');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Besucherzahlen-Berichte</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Monatsberichte werden automatisch zum Monatswechsel erzeugt. Jahresberichte entstehen nur auf
            Knopfdruck. Excel ergibt eine Datei, CSV und Markdown je einen Ordner mit einer Datei pro Tabellenblatt (beide beginnen mit einer Statistikzeile); alles liegt in <span className="font-mono">reports/</span>. Der automatische Monatsbericht ist immer Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => { setScope('month'); setPeriod(''); }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                scope === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Monat
            </button>
            <button
              onClick={() => { setScope('year'); setPeriod(''); }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                scope === 'year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Jahr
            </button>
          </div>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['xlsx', 'csv', 'md'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  format === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {f === 'xlsx' ? 'Excel' : f === 'csv' ? 'CSV' : 'Markdown'}
              </button>
            ))}
          </div>

          {scope === 'month' ? (
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="letzter abgeschlossener Monat"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder={`${new Date().getFullYear() - 1}`}
              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}

          <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <legend className="sr-only">Nur Mitglieder mit diesem Kennzeichen exportieren</legend>
            <span className="text-xs text-slate-500">Nur:</span>
            {(Object.keys(FLAG_LABELS) as ReportFlag[]).map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={flags.includes(f)}
                  onChange={(e) => setFlags((cur) => (e.target.checked ? [...cur, f] : cur.filter((x) => x !== f)))}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                {FLAG_LABELS[f]}
              </label>
            ))}
          </fieldset>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', generateMutation.isPending && 'animate-spin')} />
            Jetzt erzeugen
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Noch keine Berichte vorhanden</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {reports.map((r) => (
            <div key={r.filename}>
              <div className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {r.period}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {r.scope === 'year' ? 'Jahr' : 'Monat'}{r.flags.length ? ` · ${r.flags.map((f) => FLAG_LABELS[f]).join(', ')}` : ''} · {r.format === 'csv' ? 'CSV' : r.format === 'md' ? 'Markdown' : 'Excel'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.format !== 'xlsx' ? `Ordner ${r.filename}/ · ${r.files.length} Dateien · ` : ''}
                    {(r.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => refreshMutation.mutate(r)}
                  disabled={refreshMutation.isPending}
                  title="Mit den aktuellen Daten neu erzeugen"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn('h-3.5 w-3.5', refreshMutation.isPending && refreshMutation.variables?.filename === r.filename && 'animate-spin')}
                  />
                  Aktualisieren
                </button>
                {r.format === 'xlsx' ? (
                  <button
                    onClick={() => download(r.filename)}
                    title="Herunterladen"
                    className="flex items-center gap-1.5 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setOpenFolder(openFolder === r.filename ? null : r.filename)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    {openFolder === r.filename ? 'Dateien ausblenden' : 'Dateien anzeigen'}
                  </button>
                )}
              </div>
              {r.format !== 'xlsx' && openFolder === r.filename && (
                <ul className="bg-slate-50 px-5 py-2">
                  {r.files.map((f) => (
                    <li key={f} className="flex items-center justify-between py-1 text-xs text-slate-600">
                      <span className="font-mono">{f}</span>
                      <button
                        onClick={() => download(r.filename, f)}
                        title="Herunterladen"
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Backup-Sicherung Tab ────────────────────────────────────────────────────

function BackupTab() {
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.list,
  });

  const generateMutation = useMutation({
    mutationFn: () => backupApi.generate(),
    onSuccess: () => {
      showToast('success', 'Sicherung erzeugt.');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: () => showToast('error', 'Sicherung konnte nicht erzeugt werden.'),
  });

  async function download(filename: string) {
    try {
      const { blob, filename: name } = await backupApi.download(filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Download fehlgeschlagen.');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Zentrale Backup-Sicherung (JSON)</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Strukturierter Datenexport (Mitglieder, Einträge) für den MCP-Import in eine zentrale Sicherungs-DB.
            Kein Ersatz für reguläre <span className="font-mono">pg_dump</span>-Backups, nur manuell erzeugbar.
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', generateMutation.isPending && 'animate-spin')} />
          Jetzt erzeugen
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : backups.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Noch keine Sicherungen vorhanden</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {backups.map((b) => (
            <div key={b.filename} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{b.filename}</p>
                <p className="text-xs text-slate-400">
                  {(b.sizeBytes / 1024).toFixed(1)} KB · {formatDateTime(b.createdAt)}
                </p>
              </div>
              <button
                onClick={() => download(b.filename)}
                title="Herunterladen"
                className="flex items-center gap-1.5 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
