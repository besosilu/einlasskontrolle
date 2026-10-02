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
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { cn } from '@/utils/cn';

interface MiniCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onToday: () => void;
}

function mondayFirst(date: Date): number {
  return (getDay(date) + 6) % 7;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function MiniCalendar({ selectedDate, onSelect, currentMonth, onMonthChange, onToday }: MiniCalendarProps) {
  const today = new Date();

  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: monthData = [] } = useQuery({
    queryKey: ['stats-by-day', from, to],
    queryFn: () => statsApi.byDay({ from, to }),
  });

  const entryDates = new Set(monthData.filter((d) => d.count > 0).map((d) => d.date));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const leadingBlanks = mondayFirst(days[0]);

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-slate-600">
          {format(currentMonth, 'MMMM yyyy', { locale: de })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToday}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              isToday(selectedDate)
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50 border border-blue-200'
            )}
          >
            Heute
          </button>
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            disabled={format(addMonths(currentMonth, 1), 'yyyy-MM') > format(today, 'yyyy-MM')}
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`b-${i}`} />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const hasEntries = entryDates.has(key);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const isFuture = day > today;

          return (
            <button
              key={key}
              disabled={isFuture}
              onClick={() => onSelect(day)}
              title={hasEntries ? `${monthData.find(d => d.date === key)?.count ?? 0} Einlässe` : undefined}
              className={cn(
                'relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors',
                isFuture && 'cursor-not-allowed text-slate-200',
                !isFuture && isSelected && 'bg-blue-600 text-white font-semibold',
                !isFuture && !isSelected && hasEntries && 'bg-blue-100 text-blue-700 font-medium hover:bg-blue-200',
                !isFuture && !isSelected && !hasEntries && 'text-slate-400 hover:bg-slate-100',
                !isSelected && isTodayDay && 'ring-2 ring-blue-400 ring-offset-1'
              )}
            >
              {format(day, 'd')}
              {hasEntries && !isSelected && (
                <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
