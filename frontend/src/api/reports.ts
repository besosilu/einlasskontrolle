import client from './client';
import type { MonthlyReport } from '../types';

export const reportsApi = {
  list: () => client.get<MonthlyReport[]>('/reports').then((r) => r.data),

  generate: (scope: 'month' | 'year', format: 'xlsx' | 'csv', period?: string) =>
    client.post<{ filename: string }>('/reports/generate', undefined, { params: { scope, period, format } }).then((r) => r.data),

  download: (filename: string, file?: string) =>
    client
      .get<Blob>(`/reports/${filename}/download`, { responseType: 'blob', params: { file } })
      .then((r) => ({
        blob: r.data,
        filename:
          /filename="([^"]+)"/.exec(r.headers['content-disposition'] ?? '')?.[1] ?? file ?? filename,
      })),
};
