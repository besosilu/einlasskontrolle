import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { Users, ScanLine, PenLine, FlaskConical, CreditCard } from 'lucide-react';
import { cn } from '@/utils/cn';

export function DashboardCards() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: statsApi.dashboard,
    refetchInterval: 30_000,
  });

  if (!data) return null;

  const cards = [
    {
      label: 'Heute gesamt',
      value: data.today.total,
      sub: `${data.today.scans} Scan · ${data.today.manual} Manuell`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Diese Woche',
      value: data.weekTotal,
      icon: ScanLine,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Dieser Monat',
      value: data.monthTotal,
      icon: PenLine,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Schnupper aktiv',
      value: data.trialActive,
      icon: FlaskConical,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: 'Ausweis nötig',
      value: data.newCardsNeeded,
      icon: CreditCard,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className={cn('mb-2 inline-flex rounded-lg p-2', bg)}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <p className={cn('text-2xl font-bold', color)}>{value}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-600">{label}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      ))}
    </div>
  );
}
