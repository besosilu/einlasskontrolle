import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { SummaryCards } from '@/components/stats/SummaryCards';
import { DayView } from '@/components/stats/DayView';
import { MemberView } from '@/components/stats/MemberView';
import { CalendarView } from '@/components/stats/CalendarView';
import { NewCardView } from '@/components/stats/NewCardView';
import { WorkloadChart } from '@/components/stats/WorkloadChart';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Tab = 'summary' | 'calendar' | 'by-day' | 'by-member' | 'new-card' | 'workload';

export function StatsPage() {
  const [tab, setTab] = useState<Tab>('calendar');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: () => statsApi.summary(),
    enabled: tab === 'summary',
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'calendar', label: 'Kalender' },
    { key: 'summary', label: 'Übersicht' },
    { key: 'by-day', label: 'Pro Tag' },
    { key: 'by-member', label: 'Pro Mitglied' },
    { key: 'new-card', label: 'Neuer Ausweis' },
    { key: 'workload', label: 'Auslastung' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Statistiken</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            <SummaryCards summary={summary} />

            {summary.topMembers.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-3">
                  <p className="text-sm font-semibold text-slate-700">Top Mitglieder</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {summary.topMembers.map(({ member, visitCount }, i) => (
                    <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {member.lastName}, {member.firstName}
                        </p>
                        {member.memberNumber && (
                          <p className="text-xs text-slate-400">#{member.memberNumber}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{visitCount}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null
      )}

      {tab === 'calendar' && <CalendarView />}
      {tab === 'by-day' && <DayView />}
      {tab === 'by-member' && <MemberView />}
      {tab === 'new-card' && <NewCardView />}
      {tab === 'workload' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <WorkloadChart />
        </div>
      )}
    </div>
  );
}
