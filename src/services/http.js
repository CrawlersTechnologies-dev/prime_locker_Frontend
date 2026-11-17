/**
 * Thin fetch wrapper for the Prime Locker backend (Django REST Framework).
 *
 * Mock vs live, per module:
 *   VITE_USE_MOCK=true            → every module uses the mock data in services/mock
 *   VITE_LIVE_MODULES=auth,dashboard → …except these, which call the real API
 *   VITE_USE_MOCK=false           → every module calls the real API
 * So screens move to the backend one module at a time while the rest keep working.
 */
export const USE_MOCK = (import.meta.env?.VITE_USE_MOCK ?? 'true') !== 'false';
const LIVE_MODULES = new Set(
  String(import.meta.env?.VITE_LIVE_MODULES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

/** true when this module should call the real API. */
export const isLive = (module) => !USE_MOCK || LIVE_MODULES.has(module);

const BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? 'https://api.primelocker.pro/api').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Tokens (SimpleJWT: short-lived access token + refresh token)
// ---------------------------------------------------------------------------
const ACCESS_KEY = 'plp.token';
const REFRESH_KEY = 'plp.refresh';

export const tokenStore = {
  get: () => localStorage.getItem(ACCESS_KEY),
  set: (access) => localStorage.setItem(ACCESS_KEY, access),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setPair: ({ access, refresh }) => {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

/** Turns a DRF error body into one readable sentence. */
export function errorMessage(data, status) {
  if (!data) return status >= 500 ? 'The server had a problem. Try again in a minute.' : `Request failed (${status})`;
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  if (data.message) return String(data.message);
  if (data.error) return String(data.error);
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) return String(data.non_field_errors[0]);
  // Field errors: { mobile_number: ["This field is required."] }
  const first = Object.entries(data).find(([, v]) => Array.isArray(v) ? v.length : typeof v === 'string');
  if (first) {
    const [field, v] = first;
    const msg = Array.isArray(v) ? v[0] : v;
    const label = field.replace(/_/g, ' ');
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${msg}`;
  }
  return `Request failed (${status})`;
}

let refreshing = null;

/** Gets a new access token with the refresh token. One refresh at a time. */
async function refreshAccess() {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  refreshing ??= fetch(`${BASE_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      tokenStore.setPair({ access: data.access, refresh: data.refresh });
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(method, path, { body, params, signal, auth = true, retry = true } = {}) {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));

  const headers = { Accept: 'application/json' };
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('Can’t reach the server. Check your internet connection.', 0, null);
  }

  // Access token expired → refresh once and retry.
  if (res.status === 401 && auth && retry && tokenStore.getRefresh()) {
    if (await refreshAccess()) return request(method, path, { body, params, signal, auth, retry: false });
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const data = res.status === 204 ? null : isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (res.status === 401 && auth) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
  return data;
}

export const http = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

/** DRF lists may be paginated ({ count, results }) or plain arrays. Always returns the rows. */
export const rows = (data) => (Array.isArray(data) ? data : data?.results ?? []);

/** DRF sends decimals as strings ("12450.00"). */
export const toNum = (v) => (v == null || v === '' ? 0 : Number(v));

/** Every page of a DRF list (stops after 100 pages). */
export async function allPages(path, params = {}) {
  const out = [];
  for (let page = 1; page <= 100; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const d = await http.get(path, { params: { ...params, page } });
    out.push(...rows(d));
    if (!d?.next) break;
  }
  return out;
}

/** Downloads a CSV the backend builds (endpoints that take ?export=csv). */
export async function downloadExport(path, params, filename) {
  const text = await http.get(path, { params: { ...params, export: 'csv' } });
  const blob = new Blob([typeof text === 'string' ? text : JSON.stringify(text)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Files under /media/ (KYC, photos, signatures, banners) need the login token, so <img src> and plain
 * links can't load them. This downloads one with the token and returns a local object URL.
 */
export async function mediaUrl(url) {
  if (!url) return null;
  const abs = new URL(url, BASE_URL.replace(/\/api$/, '/'));
  const load = () => fetch(abs, { headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {} });
  let res = await load();
  if (res.status === 401 && (await refreshAccess())) res = await load();
  if (!res.ok) throw new ApiError(res.status === 403 ? 'You don’t have access to this file.' : res.status === 404 ? 'File not found.' : `Couldn’t load the file (${res.status}).`, res.status);
  return URL.createObjectURL(await res.blob());
}

/** Simulated network delay for mock responses. */
export const mockDelay = (data, ms = 350) =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
