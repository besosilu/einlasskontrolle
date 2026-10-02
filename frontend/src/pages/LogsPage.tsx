import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { importApi } from '@/api/import';
import { entriesApi } from '@/api/entries';
import { formatDateTime } from '@/utils/dateUtils';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trash2, FileText, ScanLine } from 'lucide-react';
import type { ImportLog, Entry } from '@/types';

type Tab = 'import' | 'scans';

const PAGE_SIZE_IMPORT = 20;
const PAGE_SIZE_SCANS = 50;

export function LogsPage() {
  const [tab, setTab] = useState<Tab>('import');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Protokoll</h1>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setTab('import')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'import' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <FileText className="h-4 w-4" />
          Import
        </button>
        <button
          onClick={() => setTab('scans')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'scans' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <ScanLine className="h-4 w-4" />
          Scans
        </button>
      </div>

      {tab === 'import' && <ImportLogTab />}
      {tab === 'scans' && <ScansLogTab />}
    </div>
  );
}

// ─── Import Log Tab ──────────────────────────────────────────────────────────

function ImportLogTab() {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['import-logs', page],
    queryFn: () => importApi.getLogs(PAGE_SIZE_IMPORT, page * PAGE_SIZE_IMPORT),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => importApi.deleteLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-logs'] });
      showToast('info', 'Import-Eintrag gelöscht.');
    },
    onError: () => showToast('error', 'Fehler beim Löschen.'),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE_IMPORT);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-slate-700">Import-Verlauf</p>
        {total > 0 && (
          <p className="text-xs text-slate-400">{total} Einträge gesamt</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Keine Import-Einträge vorhanden</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {logs.map((log) => (
            <ImportLogRow
              key={log.id}
              log={log}
              onDelete={() => {
                if (confirm(`Import "${log.filename}" wirklich löschen?`)) {
                  deleteMutation.mutate(log.id);
                }
              }}
              deleteDisabled={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={PAGE_SIZE_IMPORT} />
      )}
    </div>
  );
}

function ImportLogRow({ log, onDelete, deleteDisabled }: { log: ImportLog; onDelete: () => void; deleteDisabled: boolean }) {
  const [open, setOpen] = useState(false);
  const hasErrors = log.errors && log.errors.length > 0;

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
            onClick={onDelete}
            disabled={deleteDisabled}
            title="Import-Eintrag löschen"
            className="ml-1 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
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
                {e.content && <span className="ml-1 font-mono text-red-400">({e.content})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scans Log Tab ───────────────────────────────────────────────────────────

function ScansLogTab() {
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['logs-scans', page, from, to, method],
    queryFn: () =>
      entriesApi.list({
        from: from || undefined,
        to: to || undefined,
        method: method || undefined,
        limit: PAGE_SIZE_SCANS,
        offset: page * PAGE_SIZE_SCANS,
      }),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE_SCANS);

  function handleFilterChange() {
    setPage(0);
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Von</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Bis</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Methode</label>
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Alle</option>
            <option value="scan">Scan</option>
            <option value="manual">Manuell</option>
          </select>
        </div>
        {(from || to || method) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setMethod(''); setPage(0); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-700">Scan-Protokoll</p>
          {total > 0 && <p className="text-xs text-slate-400">{total} Einträge gesamt</p>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Keine Einträge gefunden</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((entry) => (
              <ScanLogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={PAGE_SIZE_SCANS} />
        )}
      </div>
    </div>
  );
}

function ScanLogRow({ entry }: { entry: Entry }) {
  const dateStr = format(new Date(entry.entryTime), 'dd.MM.yyyy HH:mm', { locale: de });
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">
          {entry.member.lastName}, {entry.member.firstName}
        </p>
        {entry.member.memberNumber && (
          <p className="text-xs text-slate-400">#{entry.member.memberNumber}</p>
        )}
      </div>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          entry.method === 'scan'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-100 text-slate-600'
        )}
      >
        {entry.method === 'scan' ? 'Scan' : 'Manuell'}
      </span>
      <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">{dateStr}</span>
    </div>
  );
}

// ─── Shared Pagination ───────────────────────────────────────────────────────

function Pagination({
  page, pageCount, onPage, total, pageSize,
}: {
  page: number; pageCount: number; onPage: (p: number) => void; total: number; pageSize: number;
}) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      <p className="text-xs text-slate-400">{from}–{to} von {total}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs text-slate-600">
          {page + 1} / {pageCount}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
