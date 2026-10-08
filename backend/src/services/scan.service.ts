import sql from '../lib/db.js';

export interface ParsedQrCode {
  memberNumber?: string;
  lastName?: string;
  firstName?: string;
}

export function parseQrCode(raw: string): ParsedQrCode {
  const trimmed = raw.trim();

  if (trimmed.startsWith('SWIM:')) {
    const parts = trimmed.split(':');
    return {
      memberNumber: parts[1] || undefined,
      lastName: parts[2] || undefined,
      firstName: parts[3] || undefined,
    };
  }

  if (trimmed.includes(';')) {
    const parts = trimmed.split(';');
    return {
      memberNumber: parts[0]?.trim() || undefined,
      lastName: parts[1]?.trim() || undefined,
      firstName: parts[2]?.trim() || undefined,
    };
  }

  if (/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
    return { memberNumber: trimmed };
  }

  return {};
}

interface MemberRow {
  id: number;
  member_number: string | null;
  last_name: string;
  first_name: string;
  source: string;
  needs_new_card: boolean;
  is_trainer: boolean;
  is_trial: boolean;
  is_preswim: boolean;
  trial_registration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

const MEMBER_COLS = `id, member_number, last_name, first_name, source, needs_new_card, is_trainer, is_trial, is_preswim, trial_registration_date, created_at, updated_at`;

function mapMember(m: MemberRow) {
  return {
    id: m.id,
    memberNumber: m.member_number,
    lastName: m.last_name,
    firstName: m.first_name,
    source: m.source,
    needsNewCard: m.needs_new_card,
    isTrainer: m.is_trainer,
    isTrial: m.is_trial,
    isPreSwim: m.is_preswim,
    trialRegistrationDate: m.trial_registration_date ?? null,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

export async function findMemberByQrCode(raw: string) {
  const parsed = parseQrCode(raw);

  if (!parsed.memberNumber && !parsed.lastName) return null;

  if (parsed.memberNumber) {
    const [m] = await sql<MemberRow[]>`
      SELECT ${sql.unsafe(MEMBER_COLS)} FROM members WHERE member_number = ${parsed.memberNumber}
    `;
    if (m) return mapMember(m);
  }

  if (parsed.lastName) {
    const conditions = parsed.firstName
      ? sql`last_name ILIKE ${parsed.lastName} AND first_name ILIKE ${parsed.firstName}`
      : sql`last_name ILIKE ${parsed.lastName}`;

    const [m] = await sql<MemberRow[]>`
      SELECT ${sql.unsafe(MEMBER_COLS)} FROM members WHERE ${conditions} LIMIT 1
    `;
    if (m) return mapMember(m);
  }

  if (parsed.memberNumber && parsed.lastName && parsed.firstName) {
    const [m] = await sql<MemberRow[]>`
      INSERT INTO members (member_number, last_name, first_name, source)
      VALUES (${parsed.memberNumber}, ${parsed.lastName}, ${parsed.firstName}, 'scan')
      RETURNING ${sql.unsafe(MEMBER_COLS)}
    `;
    return mapMember(m);
  }

  return null;
}
