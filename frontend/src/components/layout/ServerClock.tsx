import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, RefreshCw } from 'lucide-react';
import { systemApi } from '@/api/system';
import { cn } from '@/utils/cn';

// Deviation from the browser clock above which the container time is flagged
const WARN_AFTER_MS = 60_000;

function formatDateTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ms);
}

export function ServerClock() {
  const { data, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () => {
      const before = Date.now();
      const result = await systemApi.getTime();
      const after = Date.now();
      // Container minus browser clock at the moment of the answer (half the round trip as latency)
      return { ...result, offsetMs: new Date(result.now).getTime() - (before + after) / 2 };
    },
    refetchInterval: 30_000,
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return null;

  const containerNow = Date.now() + data.offsetMs;
  const drifting = Math.abs(data.offsetMs) > WARN_AFTER_MS;
  const behind = data.offsetMs < 0;

  return (
    <div
      className={cn(
        'hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs md:flex',
        drifting ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'
      )}
      title={
        drifting
          ? `Die Uhr des Containers ${behind ? 'geht nach' : 'geht vor'} (Abweichung ${Math.round(Math.abs(data.offsetMs) / 1000)} s). ` +
            'Einträge nutzen die Browser-Zeit; der Container lässt sich mit „docker run --rm --privileged alpine hwclock -s“ synchronisieren.'
          : 'Uhrzeit des Containers'
      }
    >
      <Clock className="h-3.5 w-3.5" />
      <span className="tabular-nums">{formatDateTime(containerNow, data.timezone)}</span>
      {drifting && <span className="font-medium">· Uhr {behind ? 'geht nach' : 'geht vor'}</span>}
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        title={`Container-Zeit neu abfragen (zuletzt ${new Date(dataUpdatedAt).toLocaleTimeString('de-DE')})`}
        className="rounded p-0.5 hover:bg-black/5 disabled:opacity-50"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
      </button>
    </div>
  );
}
