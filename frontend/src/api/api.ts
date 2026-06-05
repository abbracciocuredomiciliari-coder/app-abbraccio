import axios from 'axios';

// Assicura che il baseURL termini con /api
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const baseURL = rawBaseURL.endsWith('/api') ? rawBaseURL : rawBaseURL.replace(/\/$/, '') + '/api';

const api = axios.create({
  baseURL,
  timeout: 60000, // 60 secondi per gestire il cold start di Render (piano gratuito)
});

// ─── Interceptor richiesta: aggiunge il token JWT a ogni chiamata ─────────────
api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
  if (!isAuthRoute) {
    const token = localStorage.getItem('authToken');
    if (!config.headers) {
      config.headers = axios.AxiosHeaders.from({});
    }
    if (token) {
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Interceptor risposta: gestione errori globale ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
