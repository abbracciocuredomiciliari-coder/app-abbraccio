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

// ─── Interceptor risposta: auto-logout su 401 (token scaduto o non valido) ───
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url || '';
    const isAuthRoute = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    if (error?.response?.status === 401 && !isAuthRoute) {
      // Token scaduto o non valido: pulisci la sessione e reindirizza al login
      const tokenEsisteva = !!localStorage.getItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      if (tokenEsisteva) {
        window.location.href = '/?sessionExpired=1';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
