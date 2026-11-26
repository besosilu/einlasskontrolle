import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { statsApi } from '@/api/stats';
import { EntryMethodBadge } from '@/components/entry/EntryMethodBadge';
import { formatTime } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Monday-first: getDay returns 0=Sun..6=Sat → remap to 0=Mon..6=Sun
function mondayFirst(date: Date): number {
  return (getDay(date) + 6) % 7;
}

// Im gewählten Jahr: im aktuellen Jahr der aktuelle Monat, sonst der Dezember
function startMonth(year: number, today: Date): Date {
  return new Date(year, year === today.getFullYear() ? today.getMonth() : 11, 1);
}

export function CalendarView({ year }: { year: number }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(() => startMonth(year, today));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  useEffect(() => {
    const month = startMonth(year, new Date());
    setCurrentMonth(month);
    setSelectedDate(year === new Date().getFullYear() ? new Date() : endOfMonth(month));
  }, [year]);

  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: monthData = [] } = useQuery({
    queryKey: ['stats-by-day', from, to],
    queryFn: () => statsApi.byDay({ from, to }),
  });

  // Map date-string → entry count for fast lookup
  const entryCountByDate = new Map<string, number>(
    monthData.map((d) => [d.date, d.count])
  );

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const leadingBlanks = mondayFirst(days[0]);

  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayData = monthData.find((d) => d.date === selectedKey);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[21rem_1fr]">
      <div className="space-y-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          disabled={currentMonth.getMonth() === 0}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-slate-800">
          {format(currentMonth, 'MMMM yyyy', { locale: de })}
        </h2>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          disabled={currentMonth.getMonth() === 11 || format(addMonths(currentMonth, 1), 'yyyy-MM') > format(today, 'yyyy-MM')}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1.5 text-center text-xs font-medium text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Leading blank cells */}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="h-11 border-b border-r border-slate-50" />
          ))}

          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const count = entryCountByDate.get(key) ?? 0;
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const hasEntries = count > 0;
            const isFuture = day > today;

            return (
              <button
                key={key}
                disabled={isFuture}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'relative flex h-11 flex-col items-center justify-center border-b border-r border-slate-50 text-sm transition-colors',
                  isFuture
                    ? 'cursor-not-allowed text-slate-200'
                    : isSelected
                    ? 'bg-blue-600 text-white'
                    : hasEntries
                    ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isTodayDay && !isSelected && 'ring-2 ring-blue-400'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {hasEntries && !isSelected && (
                  <span className="text-[10px] font-semibold text-blue-500 leading-none">
                    {count}
                  </span>
                )}
                {hasEntries && isSelected && (
                  <span className="text-[10px] font-semibold text-blue-100 leading-none">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-100 ring-1 ring-blue-200" />
          Einlässe vorhanden
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full ring-2 ring-blue-400" />
          Heute
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-blue-600" />
          Ausgewählt
        </span>
      </div>

      </div>

      {/* Selected Day Detail */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-700">
            {format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </p>
        </div>

        {!selectedDayData ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Keine Einlässe an diesem Tag
          </div>
        ) : (
          <>
            {/* Count summary */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-slate-800">{selectedDayData.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">Gesamt</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-blue-600">{selectedDayData.scanCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Scan</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-slate-500">{selectedDayData.manualCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Manuell</p>
              </div>
            </div>

            <div className="max-h-[calc(100vh-18rem)] divide-y divide-slate-50 overflow-y-auto">
              {selectedDayData.members.map((m) => (
                <div key={m.entryId} className="flex items-center gap-3 px-5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {m.lastName}, {m.firstName}
                    </p>
                    {m.memberNumber && (
                      <p className="text-xs text-slate-400">#{m.memberNumber}</p>
                    )}
                  </div>
                  <EntryMethodBadge method={m.method} />
                  <span className="text-sm tabular-nums text-slate-400">{formatTime(m.entryTime)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
