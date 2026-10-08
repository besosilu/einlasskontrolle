import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { entriesApi } from '@/api/entries';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import type { ExportKind, ExportRow } from '@/types';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  dateStr: string; // yyyy-MM-dd
  dateLabel: string; // dd.MM.yyyy
}

const SECTIONS: { kind: ExportKind; key: 'newCard' | 'trial' | 'preSwim'; title: string; color: string }[] = [
  { kind: 'new-card', key: 'newCard', title: 'Neuer Ausweis', color: 'border-amber-200 bg-amber-50 text-amber-700' },
  { kind: 'trial', key: 'trial', title: 'Schnupper-Training', color: 'border-teal-200 bg-teal-50 text-teal-700' },
  { kind: 'pre-swim', key: 'preSwim', title: 'Vorschwimmen', color: 'border-sky-200 bg-sky-50 text-sky-700' },
];

export function ExportDialog({ open, onClose, dateStr, dateLabel }: ExportDialogProps) {
  const [saving, setSaving] = useState<ExportKind | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['export-summary', dateStr],
    queryFn: () => entriesApi.exportSummary(dateStr),
    enabled: open,
    staleTime: 0,
  });

  async function save(kind: ExportKind) {
    setSaving(kind);
    try {
      const { blob, filename } = await entriesApi.exportMembers(dateStr, kind);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Export ${dateLabel}`} className="max-w-xl">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : isError || !data ? (
        <p className="py-6 text-center text-sm text-red-500">Export konnte nicht geladen werden.</p>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {SECTIONS.map(({ kind, key, title, color }) => {
            const rows: ExportRow[] = data[key];
            return (
              <section key={kind} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', color)}>{rows.length}</span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => save(kind)}
                    disabled={rows.length === 0 || saving !== null}
                    loading={saving === kind}
                  >
                    <Download className="h-4 w-4" />
                    Speichern
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400">Keine Einträge an diesem Tag</p>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {rows.map((r, i) => (
                      <li key={`${r.memberNumber ?? ''}-${r.lastName}-${r.firstName}-${i}`} className="flex gap-3 px-3 py-1.5 text-sm">
                        <span className="w-16 flex-shrink-0 tabular-nums text-slate-400">{r.memberNumber ?? '–'}</span>
                        <span className="text-slate-700">{r.lastName}, {r.firstName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Schließen
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
