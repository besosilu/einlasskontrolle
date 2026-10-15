import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Loader2, Send, ShieldCheck, User } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { statsApi } from '@/api/stats';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { ChatDataset, ChatTurn } from '@/types';

interface Message extends ChatTurn {
  datasets?: ChatDataset[];
  isError?: boolean;
}

const EXAMPLES = [
  'Wie viele Einlässe gab es pro Wochentag in den letzten 3 Monaten?',
  'Vergleiche den September mit dem Oktober.',
  'Wie viele Schnupperer waren pro Monat da?',
  'An wie vielen Tagen kommen die Leute durchschnittlich?',
  'Wie viele Personen wurden dieses Jahr neu angelegt?',
];

const COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed'];

function errorMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return msg ?? 'Die Auswertung ist fehlgeschlagen. Bitte noch einmal versuchen.';
}

function DatasetView({ dataset }: { dataset: ChatDataset }) {
  // Columns whose values are all numbers become chart series; the first column is the axis
  const numericCols = dataset.columns
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => i > 0 && dataset.rows.length > 0 && dataset.rows.every((r) => typeof r[i] === 'number'));
  const chartData = dataset.rows.map((r) => {
    const point: Record<string, string | number> = { x: String(r[0]) };
    for (const { name, i } of numericCols) point[name] = r[i] as number;
    return point;
  });
  const showChart = dataset.chart !== 'none' && numericCols.length > 0 && dataset.rows.length > 1;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">{dataset.title}</p>

      {showChart && (
        <div className="px-2 pt-3">
          <ResponsiveContainer width="100%" height={180}>
            {dataset.chart === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                {numericCols.map(({ name }, idx) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="x" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: '#f1f5f9' }} />
                {numericCols.map(({ name }, idx) => (
                  <Bar key={name} dataKey={name} fill={COLORS[idx % COLORS.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="max-h-56 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              {dataset.columns.map((c, i) => (
                <th key={c} className={cn('px-3 py-1.5 font-medium', i > 0 && typeof dataset.rows[0]?.[i] === 'number' && 'text-right')}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dataset.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci} className={cn('px-3 py-1 text-slate-700', typeof cell === 'number' && 'text-right tabular-nums')}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['chat-status'],
    queryFn: statsApi.chatStatus,
  });

  const mutation = useMutation({
    mutationFn: (history: ChatTurn[]) => statsApi.chat(history),
    onSuccess: (result) => {
      setMessages((m) => [...m, { role: 'assistant', content: result.answer, datasets: result.datasets }]);
    },
    onError: (err) => {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err), isError: true }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, mutation.isPending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || mutation.isPending) return;
    const next: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    // Only the texts go back to the server; the tables are rebuilt from fresh queries when needed
    mutation.mutate(
      next.filter((m) => !m.isError).map(({ role, content }) => ({ role, content }))
    );
  }

  if (statusLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (status && !status.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="font-semibold">Die KI-Auswertung ist noch nicht eingerichtet.</p>
        <p className="mt-2">
          Ein Administrator muss in der <span className="font-mono">.env</span> den Eintrag{' '}
          <span className="font-mono">ANTHROPIC_API_KEY=…</span> setzen und die Anwendung neu starten
          (<span className="font-mono">docker compose up -d</span>). Der Rechner braucht dafür einen Internetzugang.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
        <p>
          Die KI sieht nur zusammengerechnete Zahlen, keine Namen oder Mitgliedsnummern. Dein Fragetext wird an den
          Anbieter gesendet, bitte keine Namen eingeben.
        </p>
      </div>

      <div className="min-h-[18rem] max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Stelle eine Frage zu den Besucherzahlen, zum Beispiel:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
            <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500')}>
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={cn('max-w-[85%] min-w-0', m.role === 'user' && 'text-right')}>
              <div
                className={cn(
                  'inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-sm',
                  m.role === 'user' ? 'bg-blue-600 text-white' : m.isError ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-800'
                )}
              >
                {m.content}
              </div>
              {m.datasets?.map((d, di) => (
                <div key={di} className="text-left">
                  <DatasetView dataset={d} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Auswertung läuft...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 border-t border-slate-100 p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Frage stellen (Enter zum Senden)..."
          aria-label="Frage zur Statistik"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <Button type="submit" disabled={!input.trim() || mutation.isPending}>
          <Send className="h-4 w-4" />
          Senden
        </Button>
      </form>

      {messages.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 text-right">
          <button onClick={() => setMessages([])} className="text-xs text-slate-400 hover:text-slate-600">
            Neues Gespräch
          </button>
        </div>
      )}
    </div>
  );
}
