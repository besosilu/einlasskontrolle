import client from './client';
import type { AutoImportSettings } from '../types';

export const settingsApi = {
  getAutoImport: () => client.get<AutoImportSettings>('/settings/auto-import').then((r) => r.data),

  setAutoImport: (data: { enabled: boolean }) =>
    client.put<AutoImportSettings>('/settings/auto-import', data).then((r) => r.data),

  runAutoImport: () => client.post<{ started: boolean }>('/settings/auto-import/run').then((r) => r.data),
};
