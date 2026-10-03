import client from './client';
import type { Member, MembersListResult } from '../types';

export const membersApi = {
  search: (query: string, limit = 10) =>
    client.get<Member[]>('/members', { params: { search: query, limit } }).then((r) => r.data),

  list: (params: { search?: string; limit?: number; offset?: number }) =>
    client.get<MembersListResult>('/members/list', { params }).then((r) => r.data),

  getById: (id: number) =>
    client.get<Member>(`/members/${id}`).then((r) => r.data),

  create: (data: { lastName: string; firstName: string; memberNumber?: string }) =>
    client.post<Member>('/members', data).then((r) => r.data),

  update: (id: number, data: { lastName?: string; firstName?: string; memberNumber?: string }) =>
    client.put<Member>(`/members/${id}`, data).then((r) => r.data),

  updateFlags: (id: number, data: { needsNewCard?: boolean; isTrainer?: boolean; isTrial?: boolean; trialRegistrationDate?: string | null }) =>
    client.patch<Member>(`/members/${id}/flags`, data).then((r) => r.data),
};
