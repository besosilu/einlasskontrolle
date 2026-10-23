import client from './client';
import type { AutoImportSettings } from '../types';

export const settingsApi = {
  getAutoImport: () => client.get<AutoImportSettings>('/settings/auto-import').then((r) => r.data),

  setAutoImport: (networkPath: string) =>
    client.put<AutoImportSettings>('/settings/auto-import', { networkPath }).then((r) => r.data),
};
