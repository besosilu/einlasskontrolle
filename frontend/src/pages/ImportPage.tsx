import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { importApi } from '@/api/import';
import { FileDropzone } from '@/components/import/FileDropzone';
import { ImportResult } from '@/components/import/ImportResult';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils/dateUtils';
import { History, Upload, CheckCircle, ChevronDown, ChevronUp, ExternalLink, Trash2, XCircle } from 'lucide-react';
import type { ImportLog, ImportResult as ImportResultType } from '@/types';

const HISTORY_LIMIT = 5;

export function ImportPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lastResults, setLastResults] = useState<ImportResultType[]>([]);
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  const { data: logsResult } = useQuery({
    queryKey: ['import-logs', 0],
    queryFn: () => importApi.getLogs(HISTORY_LIMIT, 0),
  });
  const logs = logsResult?.logs ?? [];
  const total = logsResult?.total ?? 0;

  const importMutation = useMutation({
    mutationFn: (files: File[]) => importApi.importMembers(files, entryDate),
    onSuccess: (batchResult) => {
      setLastResults(batchResult.results);
      queryClient.invalidateQueries({ queryKey: ['import-logs'] });
      queryClient.invalidateQueries({ queryKey: ['member-search'] });
      queryClient.invalidateQueries({ queryKey: ['members-list'] });
      queryClient.invalidateQueries({ queryKey: ['entries', entryDate] });
      queryClient.invalidateQueries({ queryKey: ['today-count'] });
      const totalCreated = batchResult.results.reduce((sum, r) => sum + r.recordsCreated, 0);
      const totalUpdated = batchResult.results.reduce((sum, r) => sum + r.recordsUpdated, 0);
      showToast(
        'success',
        `${batchResult.results.length} Datei(en) importiert: ${totalCreated} neu, ${totalUpdated} aktualisiert.`
      );
    },
    onError: () => showToast('error', 'Import fehlgeschlagen. Bitte Dateiformat prüfen.'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Scan importieren</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-1" id="csv-upload-heading">CSV-Dateien hochladen</h2>
          <p className="text-xs text-slate-500 mb-4">
            Format: <span className="font-mono">Mitgliedsnummer;Name;Vorname</span> – Semikolon als Trennzeichen, UTF-8-kodiert. CSV und TXT werden unterstützt.
            Mitgliedsnummer <span className="font-mono">0</span> = manueller Eintrag. Mehrere Dateien gleichzeitig möglich.
          </p>
          <FileDropzone
            onFiles={setSelectedFiles}
            disabled={importMutation.isPending}
          />
        </div>

        {/* Date selector */}
        <div>
          <label htmlFor="import-entry-date" className="block text-sm font-semibold text-slate-700 mb-1">
            Datum des Imports
          </label>
          <input
            id="import-entry-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            Wird nur verwendet, wenn der Dateiname kein Datum enthält. Enthält ein Dateiname ein Datum im Format{' '}
            <span className="font-mono">yyyy-mm-dd</span> (z.B. <span className="font-mono">scan_2026-09-15.csv</span>),
            wird dieses automatisch für den Import dieser Datei übernommen.
          </p>
        </div>

        {selectedFiles.length > 0 && lastResults.length === 0 && (() => {
          const fileWord = selectedFiles.length === 1 ? 'Datei' : 'Dateien';
          const buttonLabel = importMutation.isPending
            ? 'Wird importiert...'
            : `Import starten (${selectedFiles.length} ${fileWord})`;
          return (
            <Button
              onClick={() => importMutation.mutate(selectedFiles)}
              loading={importMutation.isPending}
              className="w-full"
            >
              <Upload className="h-4 w-4" />
              {buttonLabel}
            </Button>
          );
        })()}

        {lastResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">Import abgeschlossen</span>
            </div>
            {lastResults.map((result) => (
              <div key={result.filename} className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {result.failed ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  )}
                  <span className="text-sm font-medium text-slate-700 truncate">{result.filename}</span>
                  {result.resolvedEntryDate && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      ({format(new Date(result.resolvedEntryDate), 'dd.MM.yyyy')})
                    </span>
                  )}
                </div>
                {result.failed ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Datei fehlgeschlagen: {result.errors[0]?.reason ?? 'Unbekannter Fehler'}
                  </div>
                ) : (
                  <ImportResult result={result} />
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => { setLastResults([]); setSelectedFiles([]); }}
              className="w-full"
            >
              Weiteren Import durchführen
            </Button>
          </div>
        )}
      </div>

      {/* Import History */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Letzte Importe</h2>
            </div>
            {total > HISTORY_LIMIT && (
              <Link
                to="/logs"
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                Alle {total} anzeigen
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {logs.map((log) => (
              <ImportLogRow key={log.id} log={log} queryClient={queryClient} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportLogRow({ log, queryClient }: { log: ImportLog; queryClient: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const hasErrors = log.errors && log.errors.length > 0;

  const deleteMutation = useMutation({
    mutationFn: () => importApi.deleteLog(log.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-logs'] });
      showToast('info', 'Import-Eintrag gelöscht.');
    },
    onError: () => showToast('error', 'Fehler beim Löschen.'),
  });

  return (
    <div>
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{log.filename}</p>
          <p className="text-xs text-slate-400">{formatDateTime(log.importedAt)}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
          <span className="text-emerald-600 font-medium">+{log.recordsCreated} neu</span>
          <span className="text-blue-600 font-medium">~{log.recordsUpdated} akt.</span>
          {hasErrors ? (
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-red-500 font-medium hover:text-red-700 transition-colors"
            >
              {log.errors.length} Fehler
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : (
            <span className="text-slate-300">0 Fehler</span>
          )}
          <button
            onClick={() => { if (confirm(`Import "${log.filename}" wirklich löschen?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            title="Löschen"
            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && hasErrors && (
        <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-xs font-semibold text-red-700">Fehlerdetails</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {log.errors.map((e, i) => (
              <div key={i} className="text-xs text-red-600">
                <span className="font-medium">Zeile {e.line}:</span> {e.reason}
                {e.content && (
                  <span className="ml-1 font-mono text-red-400">({e.content})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
