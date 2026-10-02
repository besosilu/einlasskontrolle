import { useQuery } from '@tanstack/react-query';
import { statsApi, type NewCardStat } from '@/api/stats';
import { CreditCard, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function NewCardView() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['stats-new-card'],
    queryFn: statsApi.newCard,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
        Keine Mitglieder mit Markierung „Neuer Ausweis"
      </div>
    );
  }

  const pending = data.filter((d) => !d.resolved);
  const resolved = data.filter((d) => d.resolved);

  const avgDays =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, r) => sum + (r.daysUntilScan ?? 0), 0) / resolved.length
        )
      : null;

  return (
    <div className="space-y-4">
      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Ausstehend"
          value={pending.length}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          bg="bg-amber-50"
        />
        <SummaryCard
          label="Erster Scan erfolgt"
          value={resolved.length}
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          bg="bg-emerald-50"
        />
        <SummaryCard
          label="Ø Tage bis Scan"
          value={avgDays !== null ? `${avgDays}d` : '–'}
          icon={<CreditCard className="h-5 w-5 text-blue-500" />}
          bg="bg-blue-50"
        />
      </div>

      {/* Ausstehend */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700">Ausstehend — kein Scan seit Markierung</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">Mitglied</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">Markiert seit</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500">Tage ausstehend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pending.map((m) => (
                <NewCardRow key={m.id} entry={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Erster Scan erfolgt */}
      {resolved.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700">Erster automatischer Scan nach Markierung</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">Mitglied</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">Markiert seit</th>
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">Erster Scan</th>
                <th className="text-right px-5 py-2.5 font-medium text-slate-500">Dauer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resolved.map((m) => (
                <NewCardRow key={m.id} entry={m} showScan />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function NewCardRow({ entry, showScan = false }: { entry: NewCardStat; showScan?: boolean }) {
  const since = entry.needsNewCardSince
    ? format(parseISO(entry.needsNewCardSince), 'dd.MM.yyyy', { locale: de })
    : '–';
  const firstScan = entry.firstScanAfter
    ? format(parseISO(entry.firstScanAfter), 'dd.MM.yyyy', { locale: de })
    : '–';

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3">
        <p className="font-medium text-slate-800">
          {entry.lastName}, {entry.firstName}
        </p>
        {entry.memberNumber && (
          <p className="text-xs text-slate-400">#{entry.memberNumber}</p>
        )}
      </td>
      <td className="px-5 py-3 text-slate-600">{since}</td>
      {showScan && <td className="px-5 py-3 text-emerald-600 font-medium">{firstScan}</td>}
      <td className="px-5 py-3 text-right">
        {entry.daysUntilScan !== null ? (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              entry.resolved
                ? 'bg-emerald-100 text-emerald-700'
                : entry.daysUntilScan > 30
                ? 'bg-red-100 text-red-700'
                : entry.daysUntilScan > 14
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {entry.daysUntilScan}d
          </span>
        ) : (
          <span className="text-slate-300">–</span>
        )}
      </td>
    </tr>
  );
}
