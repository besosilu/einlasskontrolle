import { Users, QrCode, Pencil, CalendarDays } from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';
import type { Summary } from '@/types';

interface SummaryCardsProps {
  summary: Summary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Einlässe gesamt',
      value: summary.totalEntries,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Verschiedene Mitglieder',
      value: summary.uniqueMembers,
      icon: Users,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Per Scan',
      value: summary.scanCount,
      icon: QrCode,
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Manuell',
      value: summary.manualCount,
      icon: Pencil,
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="text-xs text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>

      {summary.busiestDay && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Stärkster Tag</p>
            <p className="font-semibold text-slate-800">
              {formatDate(summary.busiestDay.date)} – {summary.busiestDay.count} Einlässe
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
