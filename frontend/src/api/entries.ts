import client from './client';
import type { EntryResult, TodayCountResult, EntriesResult } from '../types';

export const entriesApi = {
  getTodayCount: () =>
    client.get<TodayCountResult>('/entries/today/count').then((r) => r.data),

  list: (params?: {
    date?: string;
    memberId?: number;
    from?: string;
    to?: string;
    method?: string;
    limit?: number;
    offset?: number;
  }) => client.get<EntriesResult>('/entries', { params }).then((r) => r.data),

  create: (data: {
    memberId?: number;
    lastName?: string;
    firstName?: string;
    memberNumber?: string;
    method: 'scan' | 'manual';
    notes?: string;
    entryDate?: string;
  }) => client.post<EntryResult>('/entries', data).then((r) => r.data),

  updateNotes: (id: number, notes: string | null) =>
    client.patch<import('../types').Entry>(`/entries/${id}/notes`, { notes }).then((r) => r.data),

  delete: (id: number) => client.delete(`/entries/${id}`),

  scan: (data: { qrCode: string; entryDate?: string }) =>
    client.post<EntryResult>('/scan', data).then((r) => r.data),
};
