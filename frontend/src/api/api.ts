import axios from 'axios';

// Assicura che il baseURL termini con /api
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const baseURL = rawBaseURL.endsWith('/api') ? rawBaseURL : rawBaseURL.replace(/\/$/, '') + '/api';

const api = axios.create({
  baseURL,
  timeout: 60000, // 60 secondi per gestire il cold start di Render (piano gratuito)
});

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

export default api;
