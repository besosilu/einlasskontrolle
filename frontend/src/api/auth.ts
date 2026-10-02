import client from './client';

export const authApi = {
  login: (email: string, password: string) =>
    client
      .post<{
        token: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        mustChangePassword: boolean;
      }>('/auth/login', { email, password })
      .then((r) => r.data),

  register: (data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) => client.post('/auth/register', data).then((r) => r.data),

  activate: (token: string) =>
    client.post('/auth/activate', { token }).then((r) => r.data),

  forgotPassword: (email: string) =>
    client.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    client.post('/auth/reset-password', { token, newPassword }).then((r) => r.data),

  me: () =>
    client
      .get<{ userId: number; email: string; role: string; isAdmin: boolean }>('/auth/me')
      .then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    client.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),

  setInitialPassword: (newPassword: string) =>
    client.post('/auth/set-initial-password', { newPassword }).then((r) => r.data),
};
