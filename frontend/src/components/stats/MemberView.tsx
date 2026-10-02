import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { statsApi } from '@/api/stats';
import { membersApi } from '@/api/members';
import { MemberAutocomplete } from '@/components/entry/MemberAutocomplete';
import { EntryMethodBadge } from '@/components/entry/EntryMethodBadge';
import { formatDate, formatMonth, formatTime } from '@/utils/dateUtils';
import type { Member } from '@/types';

export function MemberView() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats-by-member', selectedMember?.id],
    queryFn: () => statsApi.byMember(selectedMember!.id),
    enabled: !!selectedMember,
  });

  return (
    <div className="space-y-4">
      <MemberAutocomplete
        onSelect={(m) => setSelectedMember(m)}
        placeholder="Mitglied suchen..."
      />

      {selectedMember && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-800">
            {selectedMember.lastName}, {selectedMember.firstName}
          </p>
          {selectedMember.memberNumber && (
            <p className="text-xs text-slate-400">#{selectedMember.memberNumber}</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.totalVisits}</p>
              <p className="text-xs text-slate-500">Besuche gesamt</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Pro Monat</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {stats.visitsByMonth.map(({ month, count }) => (
                  <div key={month} className="flex justify-between text-xs">
                    <span className="text-slate-600">{formatMonth(month)}</span>
                    <span className="font-medium text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-sm font-semibold text-slate-700">Besuchsverlauf</p>
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {stats.visitDates.map((v) => (
                <div key={v.entryId} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 text-sm text-slate-700">{formatDate(v.date)}</span>
                  <EntryMethodBadge method={v.method} />
                  <span className="text-sm text-slate-400 tabular-nums">{formatTime(v.entryTime)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedMember && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-400">
          <p className="text-sm">Mitglied auswählen, um Statistiken anzuzeigen</p>
        </div>
      )}
    </div>
  );
}
