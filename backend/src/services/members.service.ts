import sql from '../lib/db.js';

interface MemberRow {
  id: number;
  member_number: string | null;
  last_name: string;
  first_name: string;
  source: string;
  needs_new_card: boolean;
  needs_new_card_since: Date | null;
  is_trainer: boolean;
  is_trial: boolean;
  trial_registration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

const MEMBER_COLS = `id, member_number, last_name, first_name, source, needs_new_card, needs_new_card_since, is_trainer, is_trial, trial_registration_date, created_at, updated_at`;

function mapMember(m: MemberRow) {
  return {
    id: m.id,
    memberNumber: m.member_number,
    lastName: m.last_name,
    firstName: m.first_name,
    source: m.source,
    needsNewCard: m.needs_new_card,
    needsNewCardSince: m.needs_new_card_since ?? null,
    isTrainer: m.is_trainer,
    isTrial: m.is_trial,
    trialRegistrationDate: m.trial_registration_date ?? null,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

export async function searchMembers(query: string, limit = 10) {
  if (!query || query.length < 1) return [];

  const members = await sql<MemberRow[]>`
    SELECT ${sql.unsafe(MEMBER_COLS)}
    FROM members
    WHERE
      last_name ILIKE ${'%' + query + '%'}
      OR first_name ILIKE ${'%' + query + '%'}
      OR (last_name || ' ' || first_name) ILIKE ${'%' + query + '%'}
      OR (first_name || ' ' || last_name) ILIKE ${'%' + query + '%'}
      OR member_number ILIKE ${'%' + query + '%'}
    ORDER BY
      CASE WHEN last_name ILIKE ${query + '%'} THEN 0 ELSE 1 END,
      last_name, first_name
    LIMIT ${limit}
  `;

  return members.map(mapMember);
}

export async function listMembers(opts: { search?: string; limit?: number; offset?: number }) {
  const search = opts.search?.trim() ?? '';
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const whereClause = search
    ? sql`
        WHERE
          last_name ILIKE ${'%' + search + '%'}
          OR first_name ILIKE ${'%' + search + '%'}
          OR (last_name || ' ' || first_name) ILIKE ${'%' + search + '%'}
          OR (first_name || ' ' || last_name) ILIKE ${'%' + search + '%'}
          OR member_number ILIKE ${'%' + search + '%'}
      `
    : sql``;

  const [members, countResult] = await Promise.all([
    sql<MemberRow[]>`
      SELECT ${sql.unsafe(MEMBER_COLS)}
      FROM members
      ${whereClause}
      ORDER BY last_name, first_name
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql<[{ count: string }]>`
      SELECT COUNT(*) AS count FROM members ${whereClause}
    `,
  ]);

  return { members: members.map(mapMember), total: Number(countResult[0].count) };
}

export async function getMemberById(id: number) {
  const [m] = await sql<MemberRow[]>`
    SELECT ${sql.unsafe(MEMBER_COLS)} FROM members WHERE id = ${id}
  `;
  return m ? mapMember(m) : null;
}

export async function getMemberByNumber(memberNumber: string) {
  const [m] = await sql<MemberRow[]>`
    SELECT ${sql.unsafe(MEMBER_COLS)} FROM members WHERE member_number = ${memberNumber}
  `;
  return m ? mapMember(m) : null;
}

export async function getMemberByName(lastName: string, firstName: string) {
  const [m] = await sql<MemberRow[]>`
    SELECT ${sql.unsafe(MEMBER_COLS)}
    FROM members
    WHERE last_name ILIKE ${lastName} AND first_name ILIKE ${firstName}
    LIMIT 1
  `;
  return m ? mapMember(m) : null;
}

export async function findOrCreateMember(lastName: string, firstName: string, memberNumber?: string) {
  const normalizedLast = lastName.trim();
  const normalizedFirst = firstName.trim();

  if (memberNumber) {
    const existing = await getMemberByNumber(memberNumber);
    if (existing) return { member: existing, created: false };
  }

  const existing = await getMemberByName(normalizedLast, normalizedFirst);
  if (existing) return { member: existing, created: false };

  const [m] = await sql<MemberRow[]>`
    INSERT INTO members (last_name, first_name, member_number, source)
    VALUES (${normalizedLast}, ${normalizedFirst}, ${memberNumber ?? null}, 'manual')
    RETURNING ${sql.unsafe(MEMBER_COLS)}
  `;
  return { member: mapMember(m), created: true };
}

export async function createMember(data: { lastName: string; firstName: string; memberNumber?: string }) {
  const [m] = await sql<MemberRow[]>`
    INSERT INTO members (last_name, first_name, member_number, source)
    VALUES (${data.lastName.trim()}, ${data.firstName.trim()}, ${data.memberNumber?.trim() ?? null}, 'manual')
    RETURNING ${sql.unsafe(MEMBER_COLS)}
  `;
  return mapMember(m);
}

export async function updateMember(id: number, data: { lastName?: string; firstName?: string; memberNumber?: string }) {
  const [m] = await sql<MemberRow[]>`
    UPDATE members SET
      last_name   = COALESCE(${data.lastName ?? null}, last_name),
      first_name  = COALESCE(${data.firstName ?? null}, first_name),
      member_number = COALESCE(${data.memberNumber ?? null}, member_number),
      updated_at  = now()
    WHERE id = ${id}
    RETURNING ${sql.unsafe(MEMBER_COLS)}
  `;
  return mapMember(m);
}

export async function updateMemberFlags(id: number, data: {
  needsNewCard?: boolean;
  isTrainer?: boolean;
  isTrial?: boolean;
  trialRegistrationDate?: string | null;
}) {
  // When needs_new_card transitions to true, record the timestamp; when cleared, reset it
  const [current] = await sql<{ needs_new_card: boolean }[]>`SELECT needs_new_card FROM members WHERE id = ${id}`;

  let needsNewCardSinceExpr = sql`needs_new_card_since`;
  if (data.needsNewCard === true && !current?.needs_new_card) {
    needsNewCardSinceExpr = sql`now()`;
  } else if (data.needsNewCard === false) {
    needsNewCardSinceExpr = sql`NULL`;
  }

  // trialRegistrationDate: explicit string sets the date, explicit null clears it, undefined = no change
  let trialDateExpr = sql`trial_registration_date`;
  if (data.trialRegistrationDate !== undefined) {
    trialDateExpr = data.trialRegistrationDate
      ? sql`${new Date(data.trialRegistrationDate)}`
      : sql`NULL`;
  }

  const [m] = await sql<MemberRow[]>`
    UPDATE members SET
      needs_new_card         = COALESCE(${data.needsNewCard ?? null}, needs_new_card),
      needs_new_card_since   = ${needsNewCardSinceExpr},
      is_trainer             = COALESCE(${data.isTrainer ?? null}, is_trainer),
      is_trial               = COALESCE(${data.isTrial ?? null}, is_trial),
      trial_registration_date = ${trialDateExpr},
      updated_at             = now()
    WHERE id = ${id}
    RETURNING ${sql.unsafe(MEMBER_COLS)}
  `;
  return mapMember(m);
}
