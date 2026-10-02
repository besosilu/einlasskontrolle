import client from './client';

export interface PriceItem {
  id: number;
  category: 'membership' | 'course';
  name: string;
  description: string | null;
  price: string;
  period: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceItemInput {
  category: 'membership' | 'course';
  name: string;
  description?: string;
  price: number;
  period?: string;
  active?: boolean;
}

export const pricesApi = {
  list: () => client.get<PriceItem[]>('/prices').then((r) => r.data),
  create: (data: PriceItemInput) => client.post<PriceItem>('/prices', data).then((r) => r.data),
  update: (id: number, data: Partial<PriceItemInput>) =>
    client.put<PriceItem>(`/prices/${id}`, data).then((r) => r.data),
  delete: (id: number) => client.delete(`/prices/${id}`),
};
