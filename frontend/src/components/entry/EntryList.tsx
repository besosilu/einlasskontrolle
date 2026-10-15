import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { entriesApi } from '@/api/entries';
import { EntryCard } from './EntryCard';
import { Loader2, Inbox, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Entry } from '@/types';

const DAY_ENTRY_LIMIT = 5000;

type SortKey = 'name' | 'number' | 'method' | 'time';
type SortDir = 'asc' | 'desc';

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'number', label: 'Nr.' },
  { key: 'method', label: 'Methode' },
  { key: 'time', label: 'Zeit' },
];

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

function compareEntries(a: Entry, b: Entry, key: SortKey): number {
  switch (key) {
    case 'name':
      return collator.compare(`${a.member.lastName} ${a.member.firstName}`, `${b.member.lastName} ${b.member.firstName}`);
    case 'number': {
      // Entries without a member number always come last, regardless of the direction
      const an = a.member.memberNumber;
      const bn = b.member.memberNumber;
      if (!an && !bn) return 0;
      if (!an) return 1;
      if (!bn) return -1;
      return collator.compare(an, bn);
    }
    case 'method':
      return collator.compare(a.method, b.method);
    case 'time':
      return new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime();
  }
}

function matchesSearch(entry: Entry, terms: string[]): boolean {
  const { lastName, firstName, memberNumber } = entry.member;
  const haystack = `${lastName} ${firstName} ${firstName} ${lastName} ${memberNumber ?? ''} ${entry.notes ?? ''}`.toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

interface EntryListProps {
  date?: Date;
}

export function EntryList({ date }: EntryListProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dateStr = date ? format(date, 'yyyy-MM-dd') : today;
  const isToday = dateStr === today;

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['entries', dateStr],
    // The backend defaults to 100 entries; a day can have more, and the summary counts all of them
    queryFn: () => entriesApi.list({ date: dateStr, limit: DAY_ENTRY_LIMIT }),
    refetchInterval: isToday ? 15_000 : false,
  });

  const entries = data?.entries ?? [];

  const visibleEntries = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length ? entries.filter((e) => matchesSearch(e, terms)) : entries;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      // Missing member numbers stay at the end in both directions
      if (sortKey === 'number' && (!a.member.memberNumber || !b.member.memberNumber)) {
        return compareEntries(a, b, 'number');
      }
      return dir * compareEntries(a, b, sortKey) || b.id - a.id;
    });
  }, [entries, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Newest first for the time, A-Z for everything else
      setSortDir(key === 'time' ? 'desc' : 'asc');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

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
  const isFiltered = search.trim() !== '';

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

      {/* Search within this list only */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          placeholder="In der Liste suchen (Name, Nummer, Notiz)..."
          aria-label="In der Einlassliste suchen"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
        />
        {isFiltered && (
          <button
            onClick={() => setSearch('')}
            title="Suche löschen"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sortable columns */}
      <div className="flex items-center gap-1 border-b border-slate-100 pb-2 text-xs">
        <span className="mr-1 text-slate-400">Sortieren:</span>
        {SORT_COLUMNS.map(({ key, label }) => {
          const active = key === sortKey;
          const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
          return (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              {label}
              <Icon className={cn('h-3 w-3', !active && 'opacity-50')} />
            </button>
          );
        })}
        {isFiltered && (
          <span className="ml-auto text-slate-400">
            {visibleEntries.length} von {entries.length}
          </span>
        )}
      </div>

      {visibleEntries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Keine Treffer in der Liste</p>
      ) : (
        <div className="space-y-2">
          {visibleEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
