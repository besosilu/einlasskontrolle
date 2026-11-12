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
  isPreSwim: boolean;
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

export type ExportKind = 'new-card' | 'trial' | 'pre-swim';

export interface ExportRow {
  memberNumber: string | null;
  lastName: string;
  firstName: string;
}

export interface ExportSummary {
  newCard: ExportRow[];
  trial: ExportRow[];
  preSwim: ExportRow[];
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

export interface ChatDataset {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  chart: 'bar' | 'line' | 'none';
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  answer: string;
  datasets: ChatDataset[];
}

export interface ChatStatus {
  configured: boolean;
  model: string;
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
  resolvedEntryDate?: string;
  recordsTotal: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  entriesCreated: number;
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
  entriesCreated: number | null;
  errors: { line: number; content: string; reason: string }[];
  source: 'manual' | 'auto';
}

export interface ImportLogsResult {
  logs: ImportLog[];
  total: number;
}

export interface MonthlyReport {
  filename: string;
  period: string;
  scope: 'month' | 'year';
  sizeBytes: number;
  createdAt: string;
}

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AutoImportSettings {
  networkPath: string | null;
  enabled: boolean;
}

export interface AutoImportInboxFile {
  filename: string;
  state: 'waiting' | 'ready' | 'invalid-date' | 'ignored';
  secondsUntilReady: number | null;
  note: string | null;
}

export interface AutoImportStatus {
  enabled: boolean;
  state: 'disabled' | 'processing' | 'active';
  networkPath: string | null;
  intervalSeconds: number;
  nextCheckAt: string | null;
  lastCheck: {
    at: string;
    trigger: 'timer' | 'manual' | 'start';
    processed: number;
    failed: number;
    skippedBecauseDisabled: boolean;
  } | null;
  processing: { currentFile: string | null; done: number; total: number } | null;
  inbox: {
    files: AutoImportInboxFile[];
    archive: { processed: number; failed: number };
  };
  sync: { lastRunAt: string; ok: boolean; message: string | null } | null;
  lastImport: { id: number; filename: string; importedAt: string; hadErrors: boolean } | null;
  warnings: string[];
}
