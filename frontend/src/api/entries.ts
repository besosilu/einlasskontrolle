import client from './client';
import type { EntryResult, TodayCountResult, EntriesResult } from '../types';
import { todayIso } from '../utils/dateUtils';

// The browser decides what "today" and "now" are; the server clock can drift (e.g. Docker Desktop after standby)
function clientTime() {
  return { entryDate: todayIso(), clientNow: new Date().toISOString() };
}

// An explicit entryDate: undefined (today) must not overwrite the browser's date
function definedOnly<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const entriesApi = {
  getTodayCount: () =>
    client.get<TodayCountResult>('/entries/today/count', { params: { date: todayIso() } }).then((r) => r.data),

  list: (params?: {
    date?: string;
    memberId?: number;
    from?: string;
    to?: string;
    method?: string;
    limit?: number;
    offset?: number;
  }) => client.get<EntriesResult>('/entries', { params }).then((r) => r.data),

  exportMembers: (date: string, type: 'new-card' | 'trial' | 'pre-swim') =>
    client
      .get<Blob>('/entries/export', { params: { date, type }, responseType: 'blob' })
      .then((r) => ({
        blob: r.data,
        filename: /filename="([^"]+)"/.exec(r.headers['content-disposition'] ?? '')?.[1] ?? `export_${date}.csv`,
      })),

  create: (data: {
    memberId?: number;
    lastName?: string;
    firstName?: string;
    memberNumber?: string;
    method: 'scan' | 'manual';
    notes?: string;
    entryDate?: string;
  }) => client.post<EntryResult>('/entries', { ...clientTime(), ...definedOnly(data) }).then((r) => r.data),

  updateNotes: (id: number, notes: string | null) =>
    client.patch<import('../types').Entry>(`/entries/${id}/notes`, { notes }).then((r) => r.data),

  delete: (id: number) => client.delete(`/entries/${id}`),

  scan: (data: { qrCode: string; entryDate?: string }) =>
    client.post<EntryResult>('/scan', { ...clientTime(), ...definedOnly(data) }).then((r) => r.data),
};
