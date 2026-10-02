import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('einlass_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      ['einlass_token', 'einlass_email', 'einlass_firstName', 'einlass_lastName', 'einlass_role', 'einlass_mustChangePw'].forEach((k) => localStorage.removeItem(k));
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
