import client from './client';
import type { ImportResult, ImportLog, ImportLogsResult } from '../types';

export const importApi = {
  importMembers: (file: File, entryDate?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (entryDate) form.append('entryDate', entryDate);
    return client
      .post<ImportResult>('/import/members', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getLogs: (limit = 20, offset = 0) =>
    client.get<ImportLogsResult>('/import/logs', { params: { limit, offset } }).then((r) => r.data),

  getLogById: (id: number) =>
    client.get<ImportLog>(`/import/logs/${id}`).then((r) => r.data),

  deleteLog: (id: number) =>
    client.delete(`/import/logs/${id}`),
};
