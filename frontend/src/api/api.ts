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

// ─── Interceptor risposta: logout automatico su 401, retry su 408/503 ────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const config = error.config as any;

    // Retry automatico su 408 (Request Timeout) e 503 (Service Unavailable)
    // Causati dal cold start di Render free tier
    if (status === 408 || status === 503) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 2) {
        await new Promise(resolve => setTimeout(resolve, 3000 * config._retryCount));
        return api(config);
      }
    }

    if (status === 401) {
      const isAuthRoute = (error.config?.url || '').includes('/auth/');
      if (!isAuthRoute) {
        // Rimuovi solo i dati di autenticazione; il redirect viene gestito
        // da React (ProtectedRoute / AuthContext) senza forzare un full-reload
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
