import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/';

/** Converte um caminho de midia (/media/...) em URL utilizavel pelo navegador. */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const origin = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : '';
  return `${origin}${path}`;
}

/** Origem do backend (para links como o Django Admin). Vazio = mesma origem. */
export const BACKEND_ORIGIN = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const refreshToken = (typeof window !== 'undefined' && Cookies.get('refresh_token')) || localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_BASE}users/refresh/`, {
      refresh: refreshToken,
    });
    const newToken = res.data.access;
    Cookies.set('access_token', newToken, { expires: 1, path: '/' });
    localStorage.setItem('access_token', newToken);
    return newToken;
  } catch (err) {
    console.warn('Sessão expirada ou token inválido:', err);
    Cookies.remove('access_token', { path: '/' });
    Cookies.remove('refresh_token', { path: '/' });
    Cookies.remove('user_role', { path: '/' });
    const isPublicPage =
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/cliente') ||
        window.location.pathname === '/login' ||
        window.location.pathname === '/unauthorized');
    if (!isPublicPage && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }
}

// Request interceptor para adicionar Token JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = Cookies.get('access_token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: renova automaticamente caso expire (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newToken);

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } else {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      const isPublicPage =
        typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/cliente') ||
          window.location.pathname === '/login' ||
          window.location.pathname === '/unauthorized');
      if (!isPublicPage && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// A API pagina as listagens ({ count, next, previous, results }). As telas esperam arrays,
// entao o fetcher desembrulha "results" quando presente; objetos comuns passam intactos.
const unwrap = (data: any) =>
  data && Array.isArray(data.results) ? data.results : data;

export const fetcher = (url: string) =>
  api.get(url).then((res) => unwrap(res.data));

export const fetcherResults = fetcher;

export { api };
export default api;
