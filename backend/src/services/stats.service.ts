import sql from '../lib/db.js';

interface EntryWithMember {
  id: number;
  member_id: number;
  entry_time: Date;
  entry_date: Date;
  method: string;
  member_number: string | null;
  last_name: string;
  first_name: string;
}

export async function getDashboard() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, week, month, trialActive, newCards] = await Promise.all([
    sql<[{ count: string; scans: string; manual: string }]>`
      SELECT COUNT(*) AS count,
             COUNT(*) FILTER (WHERE method = 'scan') AS scans,
             COUNT(*) FILTER (WHERE method = 'manual') AS manual
      FROM entries WHERE entry_time >= ${todayStart} AND entry_time <= ${todayEnd}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM entries WHERE entry_time >= ${weekStart}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM entries WHERE entry_time >= ${monthStart}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM members WHERE is_trial = true
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM members WHERE needs_new_card = true
    `,
  ]);

  return {
    today: {
      total: Number(today[0].count),
      scans: Number(today[0].scans),
      manual: Number(today[0].manual),
    },
    weekTotal: Number(week[0].count),
    monthTotal: Number(month[0].count),
    trialActive: Number(trialActive[0].count),
    newCardsNeeded: Number(newCards[0].count),
  };
}

export async function getWorkload() {
  // Entries per weekday (0=Mon..6=Sun) and per hour (0..23) for the last 90 days
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const rows = await sql<{ dow: string; hour: string; count: string }[]>`
    SELECT
      EXTRACT(ISODOW FROM entry_time)::integer - 1 AS dow,
      EXTRACT(HOUR FROM entry_time)::integer AS hour,
      COUNT(*) AS count
    FROM entries
    WHERE entry_time >= ${since}
    GROUP BY dow, hour
    ORDER BY dow, hour
  `;

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, dow: i }))
  );
  for (const r of rows) {
    weekdays[Number(r.dow)][Number(r.hour)].count = Number(r.count);
  }

  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: rows.filter((r) => Number(r.hour) === h).reduce((s, r) => s + Number(r.count), 0),
  }));

  const byDow = Array.from({ length: 7 }, (_, d) => ({
    dow: d,
    count: rows.filter((r) => Number(r.dow) === d).reduce((s, r) => s + Number(r.count), 0),
  }));

  return { byHour, byDow };
}

export async function getStatsByDay(from?: string, to?: string) {
  const conditions: ReturnType<typeof sql>[] = [];
  if (from) conditions.push(sql`e.entry_time >= ${new Date(from)}`);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(sql`e.entry_time <= ${toDate}`);
  }
  const where = conditions.length
    ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : sql``;

  const entries = await sql<EntryWithMember[]>`
    SELECT e.id, e.member_id, e.entry_time, e.entry_date, e.method,
           m.member_number, m.last_name, m.first_name
    FROM entries e
    JOIN members m ON m.id = e.member_id
    ${where}
    ORDER BY e.entry_time ASC
  `;

  const byDay = new Map<string, EntryWithMember[]>();
  for (const entry of entries) {
    const dateStr = entry.entry_time.toISOString().split('T')[0];
    if (!byDay.has(dateStr)) byDay.set(dateStr, []);
    byDay.get(dateStr)!.push(entry);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      count: dayEntries.length,
      scanCount: dayEntries.filter((e) => e.method === 'scan').length,
      manualCount: dayEntries.filter((e) => e.method === 'manual').length,
      members: dayEntries.map((e) => ({
        id: e.member_id,
        lastName: e.last_name,
        firstName: e.first_name,
        memberNumber: e.member_number,
        method: e.method,
        entryTime: e.entry_time,
        entryId: e.id,
      })),
    }));
}

export async function getStatsByMember(memberId: number) {
  const [member] = await sql<{ id: number; member_number: string | null; last_name: string; first_name: string; source: string }[]>`
    SELECT id, member_number, last_name, first_name, source FROM members WHERE id = ${memberId}
  `;
  if (!member) return null;

  const entries = await sql<{ id: number; entry_time: Date; method: string }[]>`
    SELECT id, entry_time, method FROM entries WHERE member_id = ${memberId} ORDER BY entry_time DESC
  `;

  const byMonth = new Map<string, number>();
  for (const entry of entries) {
    const monthKey = entry.entry_time.toISOString().slice(0, 7);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + 1);
  }

  return {
    member: {
      id: member.id,
      memberNumber: member.member_number,
      lastName: member.last_name,
      firstName: member.first_name,
      source: member.source,
    },
    totalVisits: entries.length,
    visitsByMonth: Array.from(byMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, count]) => ({ month, count })),
    visitDates: entries.map((e) => ({
      date: e.entry_time.toISOString().split('T')[0],
      method: e.method,
      entryTime: e.entry_time,
      entryId: e.id,
    })),
  };
}

export async function getNewCardStats() {
  // Members currently marked as needing a new card
  const pending = await sql<{
    id: number;
    member_number: string | null;
    last_name: string;
    first_name: string;
    needs_new_card_since: Date | null;
    first_scan_after: Date | null;
    days_until_scan: number | null;
  }[]>`
    SELECT
      m.id,
      m.member_number,
      m.last_name,
      m.first_name,
      m.needs_new_card_since,
      (
        SELECT e.entry_time
        FROM entries e
        WHERE e.member_id = m.id
          AND e.method = 'scan'
          AND (m.needs_new_card_since IS NULL OR e.entry_time > m.needs_new_card_since)
        ORDER BY e.entry_time ASC
        LIMIT 1
      ) AS first_scan_after,
      CASE
        WHEN m.needs_new_card_since IS NOT NULL THEN
          EXTRACT(DAY FROM (
            COALESCE(
              (SELECT e.entry_time FROM entries e WHERE e.member_id = m.id AND e.method = 'scan' AND e.entry_time > m.needs_new_card_since ORDER BY e.entry_time ASC LIMIT 1),
              now()
            ) - m.needs_new_card_since
          ))::integer
        ELSE NULL
      END AS days_until_scan
    FROM members m
    WHERE m.needs_new_card = true
    ORDER BY m.needs_new_card_since ASC NULLS LAST
  `;

  return pending.map((m) => ({
    id: m.id,
    memberNumber: m.member_number,
    lastName: m.last_name,
    firstName: m.first_name,
    needsNewCardSince: m.needs_new_card_since,
    firstScanAfter: m.first_scan_after,
    daysUntilScan: m.days_until_scan,
    resolved: m.first_scan_after !== null,
  }));
}

export async function getSummary(from?: string, to?: string) {
  const conditions: ReturnType<typeof sql>[] = [];
  if (from) conditions.push(sql`entry_time >= ${new Date(from)}`);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(sql`entry_time <= ${toDate}`);
  }
  const where = conditions.length
    ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : sql``;

  const [counts] = await sql<[{ total: string; scans: string; manual: string; unique_members: string }]>`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE method = 'scan') AS scans,
      COUNT(*) FILTER (WHERE method = 'manual') AS manual,
      COUNT(DISTINCT member_id) AS unique_members
    FROM entries ${where}
  `;

  const entriesForStats = await sql<{ entry_time: Date; member_id: number }[]>`
    SELECT entry_time, member_id FROM entries ${where}
  `;

  const dayCount = new Map<string, number>();
  for (const e of entriesForStats) {
    const d = e.entry_time.toISOString().split('T')[0];
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
  }
  let busiestDay = { date: '', count: 0 };
  for (const [date, count] of dayCount) {
    if (count > busiestDay.count) busiestDay = { date, count };
  }

  const memberCount = new Map<number, number>();
  for (const e of entriesForStats) {
    memberCount.set(e.member_id, (memberCount.get(e.member_id) ?? 0) + 1);
  }
  const topMemberIds = Array.from(memberCount.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  const topMembersData = topMemberIds.length
    ? await sql<{ id: number; last_name: string; first_name: string; member_number: string | null }[]>`
        SELECT id, last_name, first_name, member_number FROM members WHERE id IN ${sql(topMemberIds)}
      `
    : [];

  const topMembers = topMemberIds.map((id) => {
    const m = topMembersData.find((x) => x.id === id)!;
    return {
      member: { id: m.id, lastName: m.last_name, firstName: m.first_name, memberNumber: m.member_number },
      visitCount: memberCount.get(id) ?? 0,
    };
  });

  return {
    totalEntries: Number(counts.total),
    uniqueMembers: Number(counts.unique_members),
    scanCount: Number(counts.scans),
    manualCount: Number(counts.manual),
    busiestDay: busiestDay.date ? busiestDay : null,
    topMembers,
  };
}
