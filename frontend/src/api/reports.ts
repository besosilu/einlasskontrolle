import client from './client';
import type { MonthlyReport } from '../types';

export const reportsApi = {
  list: () => client.get<MonthlyReport[]>('/reports').then((r) => r.data),

  generate: (scope: 'month' | 'year', period?: string) =>
    client.post<{ filename: string }>('/reports/generate', null, { params: { scope, period } }).then((r) => r.data),

  download: (filename: string) =>
    client
      .get<Blob>(`/reports/${filename}/download`, { responseType: 'blob' })
      .then((r) => ({
        blob: r.data,
        filename:
          /filename="([^"]+)"/.exec(r.headers['content-disposition'] ?? '')?.[1] ?? filename,
      })),
};
