import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { entriesApi } from '@/api/entries';
import { EntryCard } from './EntryCard';
import { Loader2, Inbox } from 'lucide-react';

const DAY_ENTRY_LIMIT = 5000;

interface EntryListProps {
  date?: Date;
}

export function EntryList({ date }: EntryListProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dateStr = date ? format(date, 'yyyy-MM-dd') : today;
  const isToday = dateStr === today;

  const { data, isLoading } = useQuery({
    queryKey: ['entries', dateStr],
    // The backend defaults to 100 entries; a day can have more, and the summary counts all of them
    queryFn: () => entriesApi.list({ date: dateStr, limit: DAY_ENTRY_LIMIT }),
    refetchInterval: isToday ? 15_000 : false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Inbox className="mb-3 h-10 w-10" />
        <p className="text-sm">{isToday ? 'Noch keine Einlässe heute' : 'Keine Einlässe an diesem Tag'}</p>
      </div>
    );
  }

  const trainerCount = entries.filter((e) => e.member.isTrainer).length;
  const newCardCount = entries.filter((e) => e.member.needsNewCard).length;
  const manualCount = entries.filter((e) => e.method === 'manual').length;
  const trialCount = entries.filter((e) => e.member.isTrial).length;
  const preSwimCount = entries.filter((e) => e.member.isPreSwim).length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-6 gap-1 rounded-lg bg-slate-50 p-2 text-center text-xs">
        <div>
          <p className="font-semibold text-slate-700">{data?.total ?? entries.length}</p>
          <p className="text-slate-400">Gesamt</p>
        </div>
        <div>
          <p className="font-semibold text-violet-600">{trainerCount}</p>
          <p className="text-slate-400">ÜL</p>
        </div>
        <div>
          <p className="font-semibold text-amber-600">{newCardCount}</p>
          <p className="text-slate-400">Ausweis</p>
        </div>
        <div>
          <p className="font-semibold text-slate-600">{manualCount}</p>
          <p className="text-slate-400">Manuell</p>
        </div>
        <div>
          <p className="font-semibold text-teal-600">{trialCount}</p>
          <p className="text-slate-400">Schnupper</p>
        </div>
        <div>
          <p className="font-semibold text-sky-600">{preSwimCount}</p>
          <p className="text-slate-400">Vorschw.</p>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
