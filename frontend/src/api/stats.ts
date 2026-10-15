import client from './client';
import type { ChatResult, ChatStatus, ChatTurn, DayStats, MemberStats, Summary } from '../types';
import { todayIso } from '../utils/dateUtils';

export interface NewCardStat {
  id: number;
  memberNumber: string | null;
  lastName: string;
  firstName: string;
  needsNewCardSince: string | null;
  firstScanAfter: string | null;
  daysUntilScan: number | null;
  resolved: boolean;
}

export interface Dashboard {
  today: { total: number; scans: number; manual: number };
  weekTotal: number;
  monthTotal: number;
  trialActive: number;
  newCardsNeeded: number;
}

export interface Workload {
  byHour: { hour: number; count: number }[];
  byDow: { dow: number; count: number }[];
}

export const statsApi = {
  dashboard: () =>
    client.get<Dashboard>('/stats/dashboard', { params: { date: todayIso() } }).then((r) => r.data),

  workload: () =>
    client.get<Workload>('/stats/workload').then((r) => r.data),

  byDay: (params?: { from?: string; to?: string }) =>
    client.get<DayStats[]>('/stats/by-day', { params }).then((r) => r.data),

  byMember: (id: number) =>
    client.get<MemberStats>(`/stats/by-member/${id}`).then((r) => r.data),

  summary: (params?: { from?: string; to?: string }) =>
    client.get<Summary>('/stats/summary', { params }).then((r) => r.data),

  newCard: () =>
    client.get<NewCardStat[]>('/stats/new-card').then((r) => r.data),

  chatStatus: () =>
    client.get<ChatStatus>('/stats/chat/status').then((r) => r.data),

  // The browser's date is sent along so "last month" means the same as on the user's screen
  chat: (messages: ChatTurn[]) =>
    client
      .post<ChatResult>('/stats/chat', { messages, today: todayIso() }, { timeout: 60_000 })
      .then((r) => r.data),
};
