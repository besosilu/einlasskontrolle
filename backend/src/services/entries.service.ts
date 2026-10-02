import sql from '../lib/db.js';
import type { Warning } from '../types/api.types.js';

const MANUAL_WARNING_DAYS = 28;
const MANUAL_WARNING_THRESHOLD = 2;

interface EntryRow {
  id: number;
  member_id: number;
  entry_time: Date;
  entry_date: Date;
  method: string;
  notes: string | null;
  created_by: string | null;
  // joined member fields
  m_id: number;
  member_number: string | null;
  last_name: string;
  first_name: string;
  source: string;
  needs_new_card: boolean;
  is_trainer: boolean;
  is_trial: boolean;
  trial_registration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapEntry(r: EntryRow) {
  return {
    id: r.id,
    memberId: r.member_id,
    entryTime: r.entry_time,
    entryDate: r.entry_date,
    method: r.method as 'scan' | 'manual',
    notes: r.notes,
    createdBy: r.created_by,
    member: {
      id: r.m_id,
      memberNumber: r.member_number,
      lastName: r.last_name,
      firstName: r.first_name,
      source: r.source,
      needsNewCard: r.needs_new_card,
      isTrainer: r.is_trainer,
      isTrial: r.is_trial,
      trialRegistrationDate: r.trial_registration_date ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    },
  };
}

const ENTRY_SELECT = sql`
  SELECT
    e.id, e.member_id, e.entry_time, e.entry_date, e.method, e.notes, e.created_by,
    m.id AS m_id, m.member_number, m.last_name, m.first_name, m.source,
    m.needs_new_card, m.is_trainer, m.is_trial, m.trial_registration_date,
    m.created_at, m.updated_at
  FROM entries e
  JOIN members m ON m.id = e.member_id
`;

export async function getTodayCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM entries
    WHERE entry_time >= ${today} AND entry_time < ${tomorrow}
  `;
  return Number(count);
}

export async function getEntries(params: {
  date?: string;
  memberId?: number;
  from?: string;
  to?: string;
  method?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: ReturnType<typeof sql>[] = [];

  if (params.date) {
    const d = new Date(params.date);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    conditions.push(sql`e.entry_time >= ${d} AND e.entry_time < ${next}`);
  } else {
    if (params.from) conditions.push(sql`e.entry_time >= ${new Date(params.from)}`);
    if (params.to) {
      const to = new Date(params.to);
      to.setHours(23, 59, 59, 999);
      conditions.push(sql`e.entry_time <= ${to}`);
    }
  }
  if (params.memberId) conditions.push(sql`e.member_id = ${params.memberId}`);
  if (params.method) conditions.push(sql`e.method = ${params.method}`);

  const where = conditions.length
    ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : sql``;

  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const [entries, countResult] = await Promise.all([
    sql<EntryRow[]>`${ENTRY_SELECT} ${where} ORDER BY e.entry_time DESC LIMIT ${limit} OFFSET ${offset}`,
    sql<[{ count: string }]>`SELECT COUNT(*) AS count FROM entries e ${where}`,
  ]);

  return { entries: entries.map(mapEntry), total: Number(countResult[0].count) };
}

export async function checkManualWarning(memberId: number): Promise<Warning | null> {
  const since = new Date();
  since.setDate(since.getDate() - MANUAL_WARNING_DAYS);

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM entries
    WHERE member_id = ${memberId} AND method = 'manual' AND entry_time >= ${since}
  `;
  const n = Number(count);

  if (n > MANUAL_WARNING_THRESHOLD) {
    return {
      type: 'manual_frequency',
      message: `Dieses Mitglied wurde in den letzten 4 Wochen bereits ${n}x manuell eingelassen. Bitte beim nächsten Besuch daran erinnern, den Mitgliederausweis mitzubringen.`,
      count: n,
    };
  }
  return null;
}

export async function checkTrialWarning(memberId: number): Promise<Warning | null> {
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM entries
    WHERE member_id = ${memberId}
  `;
  const n = Number(count); // existing entries before this check-in

  // Show warning starting from the 3rd visit (n >= 2 means at least 2 prior visits)
  if (n >= 2) {
    const visitNumber = n + 1;
    return {
      type: 'trial_training',
      message: `Diese Person nimmt zum ${visitNumber}. Mal am Schnupper-Training teil. Bitte das Datum der Anmeldungsbestätigung erfassen.`,
      count: visitNumber,
    };
  }
  return null;
}

export async function createEntry(data: {
  memberId: number;
  method: 'scan' | 'manual';
  notes?: string;
  createdBy?: string;
  entryDateOverride?: string;
}) {
  const now = new Date();
  let entryTime = now;
  let entryDate = new Date(now);
  entryDate.setHours(0, 0, 0, 0);

  if (data.entryDateOverride) {
    const [y, m, d] = data.entryDateOverride.split('-').map(Number);
    entryTime = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    entryDate = new Date(y, m - 1, d);
  }

  const [created] = await sql<{ id: number }[]>`
    INSERT INTO entries (member_id, method, entry_time, entry_date, notes, created_by)
    VALUES (${data.memberId}, ${data.method}, ${entryTime}, ${entryDate}, ${data.notes ?? null}, ${data.createdBy ?? null})
    RETURNING id
  `;
  const [entry] = await sql<EntryRow[]>`
    ${ENTRY_SELECT}
    WHERE e.id = ${created.id}
  `;
  return mapEntry(entry);
}

export async function updateEntryNotes(id: number, notes: string | null) {
  const [entry] = await sql<EntryRow[]>`
    ${ENTRY_SELECT}
    WHERE e.id = ${id}
  `;
  if (!entry) return null;
  await sql`UPDATE entries SET notes = ${notes} WHERE id = ${id}`;
  const [updated] = await sql<EntryRow[]>`${ENTRY_SELECT} WHERE e.id = ${id}`;
  return mapEntry(updated);
}

export async function deleteEntry(id: number) {
  await sql`DELETE FROM entries WHERE id = ${id}`;
}

export async function getExistingEntryForDate(memberId: number, dateOverride?: string) {
  let dayStart: Date;
  if (dateOverride) {
    const [y, m, d] = dateOverride.split('-').map(Number);
    dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  } else {
    dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [entry] = await sql<EntryRow[]>`
    ${ENTRY_SELECT}
    WHERE e.member_id = ${memberId}
      AND e.entry_time >= ${dayStart}
      AND e.entry_time < ${dayEnd}
    LIMIT 1
  `;
  return entry ? mapEntry(entry) : null;
}
