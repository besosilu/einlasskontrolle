import { CheckCircle, RefreshCw, SkipForward, AlertTriangle } from 'lucide-react';
import type { ImportResult as ImportResultType } from '@/types';

interface ImportResultProps {
  result: ImportResultType;
}

export function ImportResult({ result }: ImportResultProps) {
  const stats = [
    { label: 'Neu angelegt', value: result.recordsCreated, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Aktualisiert', value: result.recordsUpdated, icon: RefreshCw, color: 'text-blue-600 bg-blue-50' },
    { label: 'Übersprungen', value: result.recordsSkipped, icon: SkipForward, color: 'text-slate-500 bg-slate-50' },
    { label: 'Fehler', value: result.errors.length, icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        <span className="font-semibold">{result.recordsTotal}</span> Zeilen verarbeitet
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className={`mx-auto mb-2 inline-flex rounded-lg p-2 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-700">Fehlerhafte Zeilen</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => (
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
