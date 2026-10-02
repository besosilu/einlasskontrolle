import { useRef, useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMemberSearch } from '@/hooks/useMemberSearch';
import type { Member } from '@/types';

interface MemberAutocompleteProps {
  onSelect: (member: Member) => void;
  placeholder?: string;
}

export function MemberAutocomplete({ onSelect, placeholder = 'Name oder Mitgliedsnummer...' }: MemberAutocompleteProps) {
  const { query, setQuery, suggestions, isFetching } = useMemberSearch();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setOpen(suggestions.length > 0 && query.length >= 2);
    setHighlighted(0);
  }, [suggestions, query]);

  function handleSelect(member: Member) {
    onSelect(member);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[highlighted]) handleSelect(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoComplete="off"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {suggestions.map((member, i) => (
            <li key={member.id}>
              <button
                onMouseDown={() => handleSelect(member)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                  i === highlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                  i === 0 && 'rounded-t-lg',
                  i === suggestions.length - 1 && 'rounded-b-lg'
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">
                    {member.lastName}, {member.firstName}
                  </span>
                  {member.memberNumber && (
                    <span className="ml-2 text-xs text-slate-400">#{member.memberNumber}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
