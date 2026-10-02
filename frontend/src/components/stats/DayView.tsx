import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { statsApi } from '@/api/stats';
import { EntryMethodBadge } from '@/components/entry/EntryMethodBadge';
import { formatDate, formatTime, todayIso } from '@/utils/dateUtils';
import { Button } from '@/components/ui/Button';
import { addDays, subDays, parseISO, format } from 'date-fns';

export function DayView() {
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const from = selectedDate;
  const to = selectedDate;

  const { data = [], isLoading } = useQuery({
    queryKey: ['stats-by-day', from, to],
    queryFn: () => statsApi.byDay({ from, to }),
  });

  const dayData = data.find((d) => d.date === selectedDate);

  function changeDay(delta: number) {
    const d = delta > 0
      ? addDays(parseISO(selectedDate), delta)
      : subDays(parseISO(selectedDate), -delta);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  }

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => changeDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <Button variant="secondary" size="sm" onClick={() => changeDay(1)} disabled={selectedDate >= todayIso()}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-500">{formatDate(selectedDate)}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : !dayData ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-400">
          <p className="text-sm">Keine Einlässe an diesem Tag</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-700">
              {dayData.count} Einlässe
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({dayData.scanCount} Scan, {dayData.manualCount} manuell)
              </span>
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {dayData.members.map((m) => (
              <div key={m.entryId} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {m.lastName}, {m.firstName}
                  </p>
                  {m.memberNumber && (
                    <p className="text-xs text-slate-400">#{m.memberNumber}</p>
                  )}
                </div>
                <EntryMethodBadge method={m.method} />
                <span className="text-sm text-slate-400 tabular-nums">{formatTime(m.entryTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
