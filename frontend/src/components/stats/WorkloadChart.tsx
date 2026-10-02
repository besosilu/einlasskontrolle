import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Loader2 } from 'lucide-react';

const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function WorkloadChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['workload'],
    queryFn: statsApi.workload,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }
  if (!data) return null;

  const maxDow = Math.max(...data.byDow.map((d) => d.count), 1);
  const maxHour = Math.max(...data.byHour.map((d) => d.count), 1);

  const dowData = data.byDow.map((d) => ({
    name: DOW_LABELS[d.dow],
    count: d.count,
  }));

  const hourData = data.byHour.map((d) => ({
    name: d.hour < 10 ? `0${d.hour}` : `${d.hour}`,
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Auslastung nach Wochentag</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={dowData} barCategoryGap="20%">
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => [`${v} Einlässe`, '']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {dowData.map((d) => (
                <Cell key={d.name} fill={d.count === maxDow ? '#3b82f6' : '#bfdbfe'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Auslastung nach Uhrzeit</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourData} barCategoryGap="10%">
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => [`${v} Einlässe`, '']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {hourData.map((d) => (
                <Cell key={d.name} fill={d.count === maxHour ? '#8b5cf6' : '#ddd6fe'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-400 text-center">Basierend auf den letzten 90 Tagen</p>
    </div>
  );
}
