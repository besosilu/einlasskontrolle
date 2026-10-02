export type EntryMethod = 'scan' | 'manual';

export interface Warning {
  type: 'manual_frequency' | 'already_checked_in' | 'trial_training';
  message: string;
  count?: number;
}

export interface MemberDto {
  id: number;
  memberNumber: string | null;
  lastName: string;
  firstName: string;
  source: string;
  createdAt: Date;
}

export interface EntryDto {
  id: number;
  memberId: number;
  member: MemberDto;
  entryTime: Date;
  entryDate: Date;
  method: EntryMethod;
  notes: string | null;
}

export interface CreateEntryResult {
  entry: EntryDto;
  member: MemberDto;
  warnings: Warning[];
  alreadyCheckedIn: boolean;
}
