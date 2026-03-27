/**
 * axiosInstance.ts
 *
 * Single Axios instance used across the entire application.
 *
 * Request interceptor  — attaches the current access token to every request.
 * Response interceptor — on 401 tries to refresh the access token once, then
 *                        retries the original request transparently.
 *                        If refresh also fails → dispatches logout().
 *
 * The store is imported lazily (inside the interceptors) to avoid the
 * circular-dependency issue that arises when the store imports this module
 * and this module imports the store at the top level.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ─── Base URL ────────────────────────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://localhost:3001/api';

// ─── Instance ────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // keep for cookie-based fallback if needed
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the store lazily to break the circular dependency. */
async function getStore() {
  const { store } = await import('@/store');
  return store;
}

// We keep a single promise while a refresh is in flight so that concurrent
// requests that hit a 401 all wait for the same refresh instead of each
// sending their own refresh call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const store = await getStore();
  const state = store.getState();
  const refreshToken = state.auth.refreshToken;

  if (!refreshToken) return null;

  try {
    // ↓ Use a plain axios call (not the instance) to avoid interceptor loops
    const response = await axios.post<{
      accessToken: string;
      refreshToken: string;
    }>(`${API_BASE_URL}/auth/refresh`, { refreshToken });

    const tokens = response.data;

    const { tokenRefreshed } = await import('@/store/slices/authSlice');
    store.dispatch(tokenRefreshed(tokens));

    return tokens.accessToken;
  } catch {
    const { logout } = await import('@/store/slices/authSlice');
    store.dispatch(logout());
    return null;
  }
}

// ─── Request interceptor ─────────────────────────────────────────────────────

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const store = await getStore();
  const token = store.getState().auth.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────

api.interceptors.response.use(
  // Success path — pass through
  (response) => response,

  // Error path
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    // Only attempt a refresh once per request, and only on 401
    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;

      // Serialise concurrent refresh calls into one promise
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        // Retry the original request with the fresh token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
