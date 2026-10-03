export interface Member {
  id: number;
  memberNumber: string | null;
  lastName: string;
  firstName: string;
  source: string;
  needsNewCard: boolean;
  needsNewCardSince: string | null;
  isTrainer: boolean;
  isTrial: boolean;
  trialRegistrationDate: string | null;
  createdAt: string;
}

export interface MembersListResult {
  members: Member[];
  total: number;
}

export interface Entry {
  id: number;
  memberId: number;
  member: Member;
  entryTime: string;
  entryDate: string;
  method: 'scan' | 'manual';
  notes: string | null;
}

export interface Warning {
  type: 'manual_frequency' | 'already_checked_in' | 'trial_training';
  message: string;
  count?: number;
}

export interface EntryResult {
  entry: Entry;
  member: Member;
  warnings: Warning[];
  alreadyCheckedIn: boolean;
}

export interface TodayCountResult {
  count: number;
  date: string;
}

export interface EntriesResult {
  entries: Entry[];
  total: number;
}

export interface DayStats {
  date: string;
  count: number;
  scanCount: number;
  manualCount: number;
  members: {
    id: number;
    lastName: string;
    firstName: string;
    memberNumber: string | null;
    method: 'scan' | 'manual';
    entryTime: string;
    entryId: number;
  }[];
}

export interface MemberStats {
  member: {
    id: number;
    memberNumber: string | null;
    lastName: string;
    firstName: string;
    source: string;
  };
  totalVisits: number;
  visitsByMonth: { month: string; count: number }[];
  visitDates: { date: string; method: 'scan' | 'manual'; entryTime: string; entryId: number }[];
}

export interface Summary {
  totalEntries: number;
  uniqueMembers: number;
  scanCount: number;
  manualCount: number;
  busiestDay: { date: string; count: number } | null;
  topMembers: {
    member: { id: number; lastName: string; firstName: string; memberNumber: string | null };
    visitCount: number;
  }[];
}

export interface ImportResult {
  importId: number | null;
  filename: string;
  recordsTotal: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: { line: number; content: string; reason: string }[];
  failed?: boolean;
}

export interface ImportBatchResult {
  results: ImportResult[];
}

export interface ImportLog {
  id: number;
  filename: string;
  importedAt: string;
  recordsTotal: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: { line: number; content: string; reason: string }[];
}

export interface ImportLogsResult {
  logs: ImportLog[];
  total: number;
}
