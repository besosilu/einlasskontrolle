import { z } from 'zod';
import sql from '../lib/db.js';
import { parseDay } from '../lib/dateParams.js';

// Aggregate-only queries for the statistics chat. They never select names or member numbers,
// so nothing personal can reach the language model.

const MAX_GROUPS = 400;
const MAX_RANGE_DAYS = 5 * 366;
const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const day = z
  .string()
  .refine((v) => parseDay(v) !== undefined, 'Datum muss das Format yyyy-MM-dd haben');

const range = {
  from: day.describe('Erster Tag (yyyy-MM-dd), einschließlich'),
  to: day.describe('Letzter Tag (yyyy-MM-dd), einschließlich'),
};

const FLAGS = ['trainer', 'new_card', 'trial', 'pre_swim'] as const;

const visitsInput = z.object({
  ...range,
  group_by: z.enum(['day', 'week', 'month', 'weekday', 'hour']),
  method: z.enum(['scan', 'manual']).optional(),
  flag: z.enum(FLAGS).optional(),
});

const rangeInput = z.object(range);

const newMembersInput = z.object({
  ...range,
  group_by: z.enum(['day', 'week', 'month']),
});

export type Cell = string | number;

/** Result shown to the user (table/chart) and, as JSON, returned to the model. */
export interface Dataset {
  title: string;
  columns: string[];
  rows: Cell[][];
  chart: 'bar' | 'line' | 'none';
}

function checkRange(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (b < a) throw new Error('"from" darf nicht nach "to" liegen');
  if ((b - a) / 86_400_000 > MAX_RANGE_DAYS) throw new Error('Der Zeitraum darf höchstens 5 Jahre umfassen');
}

function flagFilter(flag?: (typeof FLAGS)[number]) {
  switch (flag) {
    case 'trainer': return sql`AND m.is_trainer`;
    case 'new_card': return sql`AND m.needs_new_card`;
    case 'trial': return sql`AND m.is_trial`;
    case 'pre_swim': return sql`AND m.is_preswim`;
    default: return sql``;
  }
}

function groupExpr(groupBy: 'day' | 'week' | 'month' | 'weekday' | 'hour') {
  switch (groupBy) {
    case 'day': return sql`to_char(e.entry_date, 'YYYY-MM-DD')`;
    case 'week': return sql`to_char(date_trunc('week', e.entry_date), 'YYYY-MM-DD')`;
    case 'month': return sql`to_char(date_trunc('month', e.entry_date), 'YYYY-MM')`;
    case 'weekday': return sql`EXTRACT(ISODOW FROM e.entry_date)::int::text`;
    case 'hour': return sql`lpad(EXTRACT(HOUR FROM e.entry_time)::int::text, 2, '0')`;
  }
}

function prettyLabel(groupBy: string, label: string): string {
  if (groupBy === 'weekday') return WEEKDAYS[Number(label) - 1] ?? label;
  if (groupBy === 'hour') return `${label}:00`;
  if (groupBy === 'week') return `Woche ab ${label}`;
  return label;
}

function capGroups<T>(rows: T[]): T[] {
  if (rows.length > MAX_GROUPS) {
    throw new Error(`Zu viele Gruppen (${rows.length}, erlaubt ${MAX_GROUPS}); bitte Zeitraum verkleinern oder gröber gruppieren`);
  }
  return rows;
}

const GROUP_LABEL: Record<string, string> = {
  day: 'Tag', week: 'Woche', month: 'Monat', weekday: 'Wochentag', hour: 'Uhrzeit',
};

async function visitsOverTime(raw: unknown): Promise<Dataset> {
  const { from, to, group_by, method, flag } = visitsInput.parse(raw);
  checkRange(from, to);
  const g = groupExpr(group_by);
  const rows = capGroups(
    await sql<{ label: string; visits: string }[]>`
      SELECT ${g} AS label, COUNT(*) AS visits
      FROM entries e JOIN members m ON m.id = e.member_id
      WHERE e.entry_date BETWEEN ${from}::date AND ${to}::date
        ${method ? sql`AND e.method = ${method}` : sql``}
        ${flagFilter(flag)}
      GROUP BY label ORDER BY label
    `
  );
  return {
    title: `Einlässe pro ${GROUP_LABEL[group_by]} (${from} bis ${to})`,
    columns: [GROUP_LABEL[group_by], 'Einlässe'],
    rows: rows.map((r) => [prettyLabel(group_by, r.label), Number(r.visits)]),
    chart: group_by === 'day' || group_by === 'week' || group_by === 'month' ? 'line' : 'bar',
  };
}

async function uniqueVisitors(raw: unknown): Promise<Dataset> {
  const { from, to, group_by, method, flag } = visitsInput.parse(raw);
  checkRange(from, to);
  const g = groupExpr(group_by);
  const rows = capGroups(
    await sql<{ label: string; visitors: string }[]>`
      SELECT ${g} AS label, COUNT(DISTINCT e.member_id) AS visitors
      FROM entries e JOIN members m ON m.id = e.member_id
      WHERE e.entry_date BETWEEN ${from}::date AND ${to}::date
        ${method ? sql`AND e.method = ${method}` : sql``}
        ${flagFilter(flag)}
      GROUP BY label ORDER BY label
    `
  );
  const [{ total }] = await sql<{ total: string }[]>`
    SELECT COUNT(DISTINCT e.member_id) AS total
    FROM entries e JOIN members m ON m.id = e.member_id
    WHERE e.entry_date BETWEEN ${from}::date AND ${to}::date
      ${method ? sql`AND e.method = ${method}` : sql``}
      ${flagFilter(flag)}
  `;
  return {
    title: `Verschiedene Personen pro ${GROUP_LABEL[group_by]} (${from} bis ${to}); insgesamt im Zeitraum: ${Number(total)}`,
    columns: [GROUP_LABEL[group_by], 'Personen'],
    rows: rows.map((r) => [prettyLabel(group_by, r.label), Number(r.visitors)]),
    chart: group_by === 'day' || group_by === 'week' || group_by === 'month' ? 'line' : 'bar',
  };
}

async function visitFrequency(raw: unknown): Promise<Dataset> {
  const { from, to } = rangeInput.parse(raw);
  checkRange(from, to);
  const rows = await sql<{ bucket: string; members: string }[]>`
    WITH per_member AS (
      SELECT member_id, COUNT(DISTINCT entry_date) AS days
      FROM entries
      WHERE entry_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY member_id
    )
    SELECT CASE WHEN days = 1 THEN '1 Tag'
                WHEN days = 2 THEN '2 Tage'
                WHEN days <= 5 THEN '3-5 Tage'
                WHEN days <= 10 THEN '6-10 Tage'
                ELSE 'mehr als 10 Tage' END AS bucket,
           MIN(days) AS sort_key,
           COUNT(*) AS members
    FROM per_member GROUP BY bucket ORDER BY sort_key
  `;
  return {
    title: `An wie vielen verschiedenen Tagen waren die Personen da (${from} bis ${to})`,
    columns: ['Anwesenheitstage', 'Personen'],
    rows: rows.map((r) => [r.bucket, Number(r.members)]),
    chart: 'bar',
  };
}

async function newMembers(raw: unknown): Promise<Dataset> {
  const { from, to, group_by } = newMembersInput.parse(raw);
  checkRange(from, to);
  const format = group_by === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
  const rows = capGroups(
    await sql<{ label: string; source: string; created: string }[]>`
      SELECT to_char(date_trunc(${group_by}::text, created_at), ${format}) AS label, source, COUNT(*) AS created
      FROM members
      WHERE created_at::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY label, source ORDER BY label, source
    `
  );
  return {
    title: `Neu angelegte Personen pro ${GROUP_LABEL[group_by]} (${from} bis ${to}); source: import = per Datei-Import, manual = von Hand`,
    columns: [GROUP_LABEL[group_by], 'Quelle', 'Neu angelegt'],
    rows: rows.map((r) => [prettyLabel(group_by, r.label), r.source, Number(r.created)]),
    chart: 'none',
  };
}

async function flagTotals(): Promise<Dataset> {
  const [r] = await sql<Record<string, string>[]>`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE is_trainer) AS trainer,
           COUNT(*) FILTER (WHERE needs_new_card) AS new_card,
           COUNT(*) FILTER (WHERE is_trial) AS trial,
           COUNT(*) FILTER (WHERE is_preswim) AS pre_swim
    FROM members
  `;
  return {
    title: 'Aktueller Bestand an Personen und Kennzeichen',
    columns: ['Kategorie', 'Anzahl'],
    rows: [
      ['Personen gesamt', Number(r['total'])],
      ['Übungsleiter', Number(r['trainer'])],
      ['Neuer Ausweis nötig', Number(r['new_card'])],
      ['Schnupper-Training', Number(r['trial'])],
      ['Vorschwimmen', Number(r['pre_swim'])],
    ],
    chart: 'bar',
  };
}

const dayProp = (description: string) => ({ type: 'string', description, pattern: '^\\d{4}-\\d{2}-\\d{2}$' });

const filterProps = {
  method: { type: 'string', enum: ['scan', 'manual'], description: 'Nur Einlässe dieser Art (scan = QR-Scan, manual = von Hand erfasst)' },
  flag: {
    type: 'string',
    enum: [...FLAGS],
    description: 'Nur Personen mit diesem aktuellen Kennzeichen (trainer = Übungsleiter, new_card = Neuer Ausweis, trial = Schnupper-Training, pre_swim = Vorschwimmen)',
  },
};

export interface ChatTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  run: (input: unknown) => Promise<Dataset>;
}

export const CHAT_TOOLS: ChatTool[] = [
  {
    name: 'visits_over_time',
    description:
      'Zählt Einlässe (Besuche) im Zeitraum, gruppiert nach Tag, Woche (ab Montag), Monat, Wochentag oder Uhrzeit. Optional gefiltert nach Einlassart oder Kennzeichen.',
    input_schema: {
      type: 'object',
      properties: {
        from: dayProp('Erster Tag (yyyy-MM-dd)'),
        to: dayProp('Letzter Tag (yyyy-MM-dd)'),
        group_by: { type: 'string', enum: ['day', 'week', 'month', 'weekday', 'hour'] },
        ...filterProps,
      },
      required: ['from', 'to', 'group_by'],
    },
    run: visitsOverTime,
  },
  {
    name: 'unique_visitors',
    description:
      'Zählt verschiedene Personen (jede Person nur einmal pro Gruppe) im Zeitraum, gruppiert wie visits_over_time. Nennt zusätzlich die Zahl der verschiedenen Personen im gesamten Zeitraum.',
    input_schema: {
      type: 'object',
      properties: {
        from: dayProp('Erster Tag (yyyy-MM-dd)'),
        to: dayProp('Letzter Tag (yyyy-MM-dd)'),
        group_by: { type: 'string', enum: ['day', 'week', 'month', 'weekday', 'hour'] },
        ...filterProps,
      },
      required: ['from', 'to', 'group_by'],
    },
    run: uniqueVisitors,
  },
  {
    name: 'visit_frequency',
    description:
      'Verteilung, an wie vielen verschiedenen Tagen die Personen im Zeitraum da waren (1 Tag, 2 Tage, 3-5, 6-10, mehr als 10). Zeigt, wie regelmäßig die Besucher kommen.',
    input_schema: {
      type: 'object',
      properties: { from: dayProp('Erster Tag (yyyy-MM-dd)'), to: dayProp('Letzter Tag (yyyy-MM-dd)') },
      required: ['from', 'to'],
    },
    run: visitFrequency,
  },
  {
    name: 'new_members',
    description: 'Zählt neu angelegte Personen im Zeitraum, gruppiert nach Tag, Woche oder Monat und nach Quelle (import oder manual).',
    input_schema: {
      type: 'object',
      properties: {
        from: dayProp('Erster Tag (yyyy-MM-dd)'),
        to: dayProp('Letzter Tag (yyyy-MM-dd)'),
        group_by: { type: 'string', enum: ['day', 'week', 'month'] },
      },
      required: ['from', 'to', 'group_by'],
    },
    run: newMembers,
  },
  {
    name: 'flag_totals',
    description: 'Aktueller Bestand: Zahl der Personen insgesamt und mit den Kennzeichen Übungsleiter, Neuer Ausweis, Schnupper-Training, Vorschwimmen.',
    input_schema: { type: 'object', properties: {} },
    run: () => flagTotals(),
  },
];
