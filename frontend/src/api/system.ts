import client from './client';

export interface ServerTime {
  now: string;
  timezone: string;
}

export const systemApi = {
  getTime: () => client.get<ServerTime>('/system/time').then((r) => r.data),
};
