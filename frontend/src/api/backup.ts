import client from './client';
import type { BackupFile } from '../types';

export const backupApi = {
  list: () => client.get<BackupFile[]>('/backup').then((r) => r.data),

  generate: () => client.post<{ filename: string }>('/backup/generate').then((r) => r.data),

  download: (filename: string) =>
    client
      .get<Blob>(`/backup/${filename}/download`, { responseType: 'blob' })
      .then((r) => ({
        blob: r.data,
        filename:
          /filename="([^"]+)"/.exec(r.headers['content-disposition'] ?? '')?.[1] ?? filename,
      })),
};
