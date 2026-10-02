import client from './client';

export interface UserDto {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface RegistrationRequestDto {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

export const usersApi = {
  listUsers: () => client.get<UserDto[]>('/users').then((r) => r.data),

  listRegistrations: () =>
    client.get<RegistrationRequestDto[]>('/users/registrations').then((r) => r.data),

  approveRegistration: (id: number) =>
    client.post(`/users/registrations/${id}/approve`).then((r) => r.data),

  rejectRegistration: (id: number) =>
    client.post(`/users/registrations/${id}/reject`).then((r) => r.data),

  toggleLock: (id: number, lock: boolean) =>
    client.post(`/users/${id}/toggle-lock`, { lock }).then((r) => r.data),

  deleteUser: (id: number) => client.delete(`/users/${id}`).then((r) => r.data),
};
