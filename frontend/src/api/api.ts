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
  const token = localStorage.getItem('authToken');
  if (!config.headers) {
    config.headers = axios.AxiosHeaders.from({});
  }
  if (token) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor risposta: auto-logout su 401 (token scaduto o non valido) ───
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Token scaduto o non valido: pulisci la sessione e reindirizza al login
      const tokenEsisteva = !!localStorage.getItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      if (tokenEsisteva) {
        // Mostra avviso solo se l'utente era loggato (evita loop sul login)
        alert('La tua sessione è scaduta. Effettua nuovamente il login.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
